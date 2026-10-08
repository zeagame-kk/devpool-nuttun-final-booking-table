package apitest

import (
	"net/http"
	"net/http/httptest"
	"strconv"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Times on Monday 2026-10-12 and Tuesday 2026-10-13 in Bangkok (the fixed clock says
// Monday 09:00, so everything below is in the future unless a test says otherwise).
func mondayAt(hour, minute int) time.Time {
	return time.Date(2026, 10, 12, hour, minute, 0, 0, bangkok)
}

func tuesdayAt(hour, minute int) time.Time {
	return time.Date(2026, 10, 13, hour, minute, 0, 0, bangkok)
}

func rfc(moment time.Time) string { return moment.Format(time.RFC3339) }

func reservationBody(start, end string, guests int) map[string]any {
	return map[string]any{"startAt": start, "endAt": end, "guests": guests}
}

// reserve books [start, end) for guests people as the given user.
func (a *app) reserve(as uuid.UUID, restaurantID int, start, end time.Time, guests int) *httptest.ResponseRecorder {
	a.t.Helper()

	return a.do(as, http.MethodPost, "/restaurants/"+strconv.Itoa(restaurantID)+"/reservations",
		reservationBody(rfc(start), rfc(end), guests))
}

func countReservations(t *testing.T, a *app) int64 {
	t.Helper()

	var n int64
	require.NoError(t, a.db.Raw("SELECT count(*) FROM reservations").Scan(&n).Error)
	return n
}

func assertRejected(t *testing.T, response *httptest.ResponseRecorder, status int, code string) {
	t.Helper()

	assert.Equal(t, status, response.Code, response.Body.String())
	assert.Equal(t, code, decode[errorJSON](t, response).Code, response.Body.String())
}

func TestReservationCreate_Success(t *testing.T) {
	a := newApp(t)
	owner := a.newUser("เจ้าของ")
	customer := a.newUser("ลูกค้า")
	restaurantID := a.seedRestaurant(owner, restaurantOpts{})

	response := a.reserve(customer, restaurantID, mondayAt(18, 0), mondayAt(20, 0), 4)

	require.Equal(t, http.StatusCreated, response.Code, response.Body.String())
	id := decode[idJSON](t, response).ID
	require.Positive(t, id)

	var stored struct {
		RestaurantID int
		UserID       uuid.UUID
		StartAt      time.Time
		EndAt        time.Time
		Guests       int
		Status       string
	}
	require.NoError(t, a.db.Raw("SELECT restaurant_id, user_id, start_at, end_at, guests, status FROM reservations WHERE id = ?", id).Scan(&stored).Error)
	assert.Equal(t, restaurantID, stored.RestaurantID)
	assert.Equal(t, customer, stored.UserID, "the booker comes from the token")
	assert.True(t, mondayAt(18, 0).Equal(stored.StartAt), "start %s", stored.StartAt)
	assert.True(t, mondayAt(20, 0).Equal(stored.EndAt), "end %s", stored.EndAt)
	assert.Equal(t, 4, stored.Guests)
	assert.Equal(t, "confirmed", stored.Status, "no approval step")
}

func TestReservationCreate_OwnerMayBookTheirOwnRestaurant(t *testing.T) {
	a := newApp(t)
	owner := a.newUser("เจ้าของ")
	restaurantID := a.seedRestaurant(owner, restaurantOpts{})

	assert.Equal(t, http.StatusCreated, a.reserve(owner, restaurantID, mondayAt(18, 0), mondayAt(19, 0), 2).Code)
}

func TestReservationCreate_Validation(t *testing.T) {
	good := func() map[string]any { return reservationBody(rfc(mondayAt(18, 0)), rfc(mondayAt(20, 0)), 4) }

	cases := map[string]func(b map[string]any){
		"zero guests":        func(b map[string]any) { b["guests"] = 0 },
		"negative guests":    func(b map[string]any) { b["guests"] = -1 },
		"guests missing":     func(b map[string]any) { delete(b, "guests") },
		"guests beyond int":  func(b map[string]any) { b["guests"] = 2147483648 },
		"guests as string":   func(b map[string]any) { b["guests"] = "4" },
		"end equals start":   func(b map[string]any) { b["endAt"] = b["startAt"] },
		"end before start":   func(b map[string]any) { b["endAt"] = rfc(mondayAt(17, 0)) },
		"start missing":      func(b map[string]any) { delete(b, "startAt") },
		"end missing":        func(b map[string]any) { delete(b, "endAt") },
		"start not RFC 3339": func(b map[string]any) { b["startAt"] = "2026-10-12 18:00" },
		"end not a date":     func(b map[string]any) { b["endAt"] = "tonight" },
	}

	for name, change := range cases {
		t.Run(name, func(t *testing.T) {
			a := newApp(t)
			owner := a.newUser("เจ้าของ")
			customer := a.newUser("ลูกค้า")
			restaurantID := a.seedRestaurant(owner, restaurantOpts{})
			body := good()
			change(body)

			response := a.do(customer, http.MethodPost, "/restaurants/"+strconv.Itoa(restaurantID)+"/reservations", body)

			assert.Equal(t, http.StatusBadRequest, response.Code, response.Body.String())
			assert.Zero(t, countReservations(t, a))
		})
	}

	t.Run("malformed json and bad restaurant id", func(t *testing.T) {
		a := newApp(t)
		customer := a.newUser("ลูกค้า")

		assert.Equal(t, http.StatusBadRequest, a.do(customer, http.MethodPost, "/restaurants/1/reservations", `{"startAt":`).Code)
		assert.Equal(t, http.StatusBadRequest, a.do(customer, http.MethodPost, "/restaurants/abc/reservations", good()).Code)
	})
}

func TestReservationCreate_StartInPast(t *testing.T) {
	a := newApp(t)
	owner := a.newUser("เจ้าของ")
	customer := a.newUser("ลูกค้า")
	restaurantID := a.seedRestaurant(owner, restaurantOpts{})

	earlierToday := a.reserve(customer, restaurantID, mondayAt(8, 0), mondayAt(9, 30), 2)
	oneMinuteAgo := a.reserve(customer, restaurantID, mondayAt(8, 59), mondayAt(12, 0), 2)
	// Starting exactly now is not "in the past": it is rejected for opening at 11:00 instead.
	rightNow := a.reserve(customer, restaurantID, mondayAt(9, 0), mondayAt(12, 0), 2)

	assertRejected(t, earlierToday, http.StatusBadRequest, "start_in_past")
	assertRejected(t, oneMinuteAgo, http.StatusBadRequest, "start_in_past")
	assertRejected(t, rightNow, http.StatusBadRequest, "outside_opening_hours")
	assert.Zero(t, countReservations(t, a))
}

func TestReservationCreate_OpeningBoundaries(t *testing.T) {
	cases := []struct {
		name       string
		start, end time.Time
		wantStatus int
		wantCode   string
	}{
		{"exactly open to exactly close", mondayAt(11, 0), mondayAt(22, 0), http.StatusCreated, ""},
		{"one minute before opening", mondayAt(10, 59), mondayAt(12, 0), http.StatusBadRequest, "outside_opening_hours"},
		{"one minute after closing", mondayAt(21, 0), mondayAt(22, 1), http.StatusBadRequest, "outside_opening_hours"},
		{"thirty seconds after closing", mondayAt(21, 0), mondayAt(22, 0).Add(30 * time.Second), http.StatusBadRequest, "outside_opening_hours"},
		{"ends right at closing", mondayAt(20, 0), mondayAt(22, 0), http.StatusCreated, ""},
		{"starts right at opening", mondayAt(11, 0), mondayAt(12, 0), http.StatusCreated, ""},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			a := newApp(t)
			owner := a.newUser("เจ้าของ")
			customer := a.newUser("ลูกค้า")
			restaurantID := a.seedRestaurant(owner, restaurantOpts{})

			response := a.reserve(customer, restaurantID, tc.start, tc.end, 2)

			if tc.wantCode == "" {
				assert.Equal(t, tc.wantStatus, response.Code, response.Body.String())
				return
			}
			assertRejected(t, response, tc.wantStatus, tc.wantCode)
		})
	}
}

func TestReservationCreate_ClosedDay(t *testing.T) {
	a := newApp(t)
	owner := a.newUser("เจ้าของ")
	customer := a.newUser("ลูกค้า")
	restaurantID := a.seedRestaurant(owner, restaurantOpts{ClosedWeekdays: []int{2}}) // closed on Tuesdays

	tuesday := a.reserve(customer, restaurantID, tuesdayAt(12, 0), tuesdayAt(13, 0), 2)
	monday := a.reserve(customer, restaurantID, mondayAt(12, 0), mondayAt(13, 0), 2)

	assertRejected(t, tuesday, http.StatusBadRequest, "outside_opening_hours")
	assert.Equal(t, http.StatusCreated, monday.Code, monday.Body.String())
}

func TestReservationCreate_UsesTheDaysOwnHours(t *testing.T) {
	a := newApp(t)
	owner := a.newUser("เจ้าของ")
	customer := a.newUser("ลูกค้า")
	restaurantID := a.seedRestaurant(owner, restaurantOpts{})
	// Tuesday is a short day: 14:00-16:00.
	require.NoError(t, a.db.Exec("UPDATE restaurant_opening_hours SET open_time = '14:00', close_time = '16:00' WHERE restaurant_id = ? AND weekday = 2", restaurantID).Error)

	assertRejected(t, a.reserve(customer, restaurantID, tuesdayAt(11, 0), tuesdayAt(12, 0), 2), http.StatusBadRequest, "outside_opening_hours")
	assert.Equal(t, http.StatusCreated, a.reserve(customer, restaurantID, tuesdayAt(14, 0), tuesdayAt(16, 0), 2).Code)
}

func TestReservationCreate_CrossMidnight(t *testing.T) {
	a := newApp(t)
	owner := a.newUser("เจ้าของ")
	customer := a.newUser("ลูกค้า")
	restaurantID := a.seedRestaurant(owner, restaurantOpts{})

	response := a.reserve(customer, restaurantID, mondayAt(21, 0), tuesdayAt(1, 0), 2)

	assertRejected(t, response, http.StatusBadRequest, "outside_opening_hours")
}

func TestReservationCreate_UTCInputConvertedToBangkok(t *testing.T) {
	a := newApp(t)
	owner := a.newUser("เจ้าของ")
	customer := a.newUser("ลูกค้า")
	restaurantID := a.seedRestaurant(owner, restaurantOpts{})
	path := "/restaurants/" + strconv.Itoa(restaurantID) + "/reservations"

	// 14:00Z-16:00Z is 21:00-23:00 in Bangkok: closes at 22:00.
	lateEvening := a.do(customer, http.MethodPost, path, reservationBody("2026-10-12T14:00:00Z", "2026-10-12T16:00:00Z", 2))
	// 11:00Z-13:00Z is 18:00-20:00 in Bangkok: fine.
	earlyEvening := a.do(customer, http.MethodPost, path, reservationBody("2026-10-12T11:00:00Z", "2026-10-12T13:00:00Z", 2))
	// 16:30Z-18:00Z is 23:30 Monday to 01:00 Tuesday in Bangkok: the same UTC day, two local days.
	acrossLocalMidnight := a.do(customer, http.MethodPost, path, reservationBody("2026-10-12T16:30:00Z", "2026-10-12T18:00:00Z", 2))
	// 04:30Z is 11:30 Bangkok: a morning UTC time that is inside opening hours locally.
	lateMorningLocal := a.do(customer, http.MethodPost, path, reservationBody("2026-10-12T04:30:00Z", "2026-10-12T06:00:00Z", 2))

	assertRejected(t, lateEvening, http.StatusBadRequest, "outside_opening_hours")
	assert.Equal(t, http.StatusCreated, earlyEvening.Code, earlyEvening.Body.String())
	assertRejected(t, acrossLocalMidnight, http.StatusBadRequest, "outside_opening_hours")
	assert.Equal(t, http.StatusCreated, lateMorningLocal.Code, lateMorningLocal.Body.String())
}

func TestReservationCreate_Capacity(t *testing.T) {
	setup := func(t *testing.T) (a *app, owner, customer uuid.UUID, restaurantID int) {
		t.Helper()
		a = newApp(t)
		owner = a.newUser("เจ้าของ")
		customer = a.newUser("ลูกค้า")
		restaurantID = a.seedRestaurant(owner, restaurantOpts{Capacity: 10})
		return a, owner, customer, restaurantID
	}

	t.Run("exactly the capacity fits, one more does not", func(t *testing.T) {
		a, owner, customer, restaurantID := setup(t)
		a.seedReservation(restaurantID, owner, mondayAt(18, 0), mondayAt(20, 0), 6, "confirmed")

		assert.Equal(t, http.StatusCreated, a.reserve(customer, restaurantID, mondayAt(18, 0), mondayAt(20, 0), 4).Code)
		assertRejected(t, a.reserve(customer, restaurantID, mondayAt(18, 30), mondayAt(19, 0), 1), http.StatusConflict, "capacity_exceeded")
	})

	t.Run("five more than the six already there", func(t *testing.T) {
		a, owner, customer, restaurantID := setup(t)
		a.seedReservation(restaurantID, owner, mondayAt(18, 0), mondayAt(20, 0), 6, "confirmed")

		assertRejected(t, a.reserve(customer, restaurantID, mondayAt(18, 0), mondayAt(20, 0), 5), http.StatusConflict, "capacity_exceeded")
		assert.Equal(t, int64(1), countReservations(t, a), "the rejected one is not saved")
	})

	t.Run("more guests than the whole restaurant seats", func(t *testing.T) {
		a, _, customer, restaurantID := setup(t)

		assertRejected(t, a.reserve(customer, restaurantID, mondayAt(18, 0), mondayAt(20, 0), 11), http.StatusConflict, "capacity_exceeded")
		assert.Equal(t, http.StatusCreated, a.reserve(customer, restaurantID, mondayAt(18, 0), mondayAt(20, 0), 10).Code)
	})

	t.Run("the spec example: 16 overlap in total but never more than 10 at once", func(t *testing.T) {
		a, owner, customer, restaurantID := setup(t)
		a.seedReservation(restaurantID, owner, mondayAt(12, 0), mondayAt(14, 0), 6, "confirmed")
		a.seedReservation(restaurantID, owner, mondayAt(14, 0), mondayAt(16, 0), 6, "confirmed")

		assert.Equal(t, http.StatusCreated, a.reserve(customer, restaurantID, mondayAt(13, 0), mondayAt(15, 0), 4).Code)
		assertRejected(t, a.reserve(customer, restaurantID, mondayAt(13, 0), mondayAt(15, 0), 1), http.StatusConflict, "capacity_exceeded")
	})

	t.Run("back to back bookings do not share seats", func(t *testing.T) {
		a, owner, customer, restaurantID := setup(t)
		a.seedReservation(restaurantID, owner, mondayAt(12, 0), mondayAt(14, 0), 10, "confirmed")

		assert.Equal(t, http.StatusCreated, a.reserve(customer, restaurantID, mondayAt(14, 0), mondayAt(16, 0), 10).Code)
		assert.Equal(t, http.StatusCreated, a.reserve(customer, restaurantID, mondayAt(11, 0), mondayAt(12, 0), 10).Code)
	})

	t.Run("cancelled bookings do not count", func(t *testing.T) {
		a, owner, customer, restaurantID := setup(t)
		a.seedReservation(restaurantID, owner, mondayAt(18, 0), mondayAt(20, 0), 10, "cancelled")

		assert.Equal(t, http.StatusCreated, a.reserve(customer, restaurantID, mondayAt(18, 0), mondayAt(20, 0), 10).Code)
	})

	t.Run("other restaurants do not count", func(t *testing.T) {
		a, owner, customer, restaurantID := setup(t)
		elsewhere := a.seedRestaurant(owner, restaurantOpts{Capacity: 10})
		a.seedReservation(elsewhere, owner, mondayAt(18, 0), mondayAt(20, 0), 10, "confirmed")

		assert.Equal(t, http.StatusCreated, a.reserve(customer, restaurantID, mondayAt(18, 0), mondayAt(20, 0), 10).Code)
	})
}

func TestReservationCreate_RestaurantMissingOrDeleted(t *testing.T) {
	a := newApp(t)
	owner := a.newUser("เจ้าของ")
	customer := a.newUser("ลูกค้า")
	deleted := a.seedRestaurant(owner, restaurantOpts{})
	require.NoError(t, a.db.Exec("UPDATE restaurants SET deleted_at = now() WHERE id = ?", deleted).Error)

	assert.Equal(t, http.StatusNotFound, a.reserve(customer, 9999, mondayAt(18, 0), mondayAt(19, 0), 2).Code)
	assert.Equal(t, http.StatusNotFound, a.reserve(customer, deleted, mondayAt(18, 0), mondayAt(19, 0), 2).Code)
}

func TestReservationCreate_RequiresAuth(t *testing.T) {
	a := newApp(t)

	response := a.do(uuid.Nil, http.MethodPost, "/restaurants/1/reservations", reservationBody(rfc(mondayAt(18, 0)), rfc(mondayAt(19, 0)), 2))

	assert.Equal(t, http.StatusUnauthorized, response.Code)
}

// Five customers ask for 4 seats each in the same slot of a 10-seat restaurant. Only two
// can fit. Without the row lock all five read "0 seated" at the same moment and succeed.
func TestReservationCreate_ConcurrentRequestsNeverOverbook(t *testing.T) {
	a := newApp(t)
	owner := a.newUser("เจ้าของ")
	restaurantID := a.seedRestaurant(owner, restaurantOpts{Capacity: 10})

	const requests = 5
	customers := make([]uuid.UUID, requests)
	for index := range customers {
		customers[index] = a.newUser("ลูกค้า " + strconv.Itoa(index))
	}

	responses := make([]*httptest.ResponseRecorder, requests)
	start := make(chan struct{})
	var ready, done sync.WaitGroup
	for index := range customers {
		ready.Add(1)
		done.Add(1)
		go func() {
			defer done.Done()
			ready.Done()
			<-start // release everyone at once
			responses[index] = a.reserve(customers[index], restaurantID, mondayAt(18, 0), mondayAt(20, 0), 4)
		}()
	}
	ready.Wait()
	close(start)
	done.Wait()

	created, full := 0, 0
	for _, response := range responses {
		switch response.Code {
		case http.StatusCreated:
			created++
		case http.StatusConflict:
			assert.Equal(t, "capacity_exceeded", decode[errorJSON](t, response).Code)
			full++
		default:
			t.Errorf("unexpected status %d: %s", response.Code, response.Body.String())
		}
	}

	assert.Equal(t, 2, created, "10 seats hold two parties of 4")
	assert.Equal(t, requests-2, full)

	var seated int64
	require.NoError(t, a.db.Raw("SELECT COALESCE(SUM(guests), 0) FROM reservations WHERE status = 'confirmed'").Scan(&seated).Error)
	assert.Equal(t, int64(8), seated)
}
