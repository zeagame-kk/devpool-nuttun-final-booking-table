package apitest

import (
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type reservationJSON struct {
	ID         int `json:"id"`
	Restaurant struct {
		ID                      int     `json:"id"`
		Name                    string  `json:"name"`
		ImageURL                *string `json:"imageUrl"`
		CancellationLeadMinutes int     `json:"cancellationLeadMinutes"`
	} `json:"restaurant"`
	StartAt   time.Time `json:"startAt"`
	EndAt     time.Time `json:"endAt"`
	Guests    int       `json:"guests"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"createdAt"`
}

type reservationListJSON struct {
	Total   int               `json:"total"`
	Results []reservationJSON `json:"results"`
}

// A restaurant with a 60 minute cancellation lead time and one 11:00-12:00 booking for
// `customer` on Monday. The fixed clock says 09:00, so the booking is two hours away.
type bookedFixture struct {
	app           *app
	owner         uuid.UUID
	customer      uuid.UUID
	stranger      uuid.UUID
	restaurantID  int
	reservationID int
}

func newBooked(t *testing.T, capacity int, guests int) bookedFixture {
	t.Helper()

	a := newApp(t)
	f := bookedFixture{
		app:      a,
		owner:    a.newUser("เจ้าของ"),
		customer: a.newUser("ลูกค้า"),
		stranger: a.newUser("คนอื่น"),
	}
	f.restaurantID = a.seedRestaurant(f.owner, restaurantOpts{Name: "ชาบูทอง", Capacity: capacity, LeadMinutes: 60})
	f.reservationID = a.seedReservation(f.restaurantID, f.customer, mondayAt(11, 0), mondayAt(12, 0), guests, "confirmed")
	return f
}

func (f bookedFixture) path(suffix string) string {
	return "/reservations/" + strconv.Itoa(f.reservationID) + suffix
}

func (f bookedFixture) cancel(as uuid.UUID) *httptest.ResponseRecorder {
	return f.app.do(as, http.MethodPost, f.path("/cancel"), nil)
}

func (f bookedFixture) change(as uuid.UUID, start, end time.Time, guests int) *httptest.ResponseRecorder {
	return f.app.do(as, http.MethodPut, f.path(""), reservationBody(rfc(start), rfc(end), guests))
}

func (f bookedFixture) status(t *testing.T) string {
	t.Helper()

	var status string
	require.NoError(t, f.app.db.Raw("SELECT status FROM reservations WHERE id = ?", f.reservationID).Scan(&status).Error)
	return status
}

func TestReservationCancel_Success(t *testing.T) {
	f := newBooked(t, 10, 4)

	response := f.cancel(f.customer)

	assert.Equal(t, http.StatusNoContent, response.Code, response.Body.String())
	assert.Empty(t, response.Body.String())
	assert.Equal(t, "cancelled", f.status(t), "the row is kept, only its status changes")
}

func TestReservationCancel_LeadTimeBoundary(t *testing.T) {
	t.Run("exactly the lead time before the start", func(t *testing.T) {
		f := newBooked(t, 10, 4)
		f.app.setNow(mondayAt(10, 0)) // 60 minutes before 11:00

		assert.Equal(t, http.StatusNoContent, f.cancel(f.customer).Code)
		assert.Equal(t, "cancelled", f.status(t))
	})

	t.Run("one minute too late", func(t *testing.T) {
		f := newBooked(t, 10, 4)
		f.app.setNow(mondayAt(10, 1))

		assertRejected(t, f.cancel(f.customer), http.StatusConflict, "too_late_to_cancel")
		assert.Equal(t, "confirmed", f.status(t))
	})

	t.Run("each restaurant has its own lead time", func(t *testing.T) {
		f := newBooked(t, 10, 4)
		require.NoError(t, f.app.db.Exec("UPDATE restaurants SET cancellation_lead_minutes = 180 WHERE id = ?", f.restaurantID).Error)

		assertRejected(t, f.cancel(f.customer), http.StatusConflict, "too_late_to_cancel") // 120 minutes away
	})
}

func TestReservationUpdate_LeadTimeBoundary(t *testing.T) {
	t.Run("exactly the lead time before the original start", func(t *testing.T) {
		f := newBooked(t, 10, 4)
		f.app.setNow(mondayAt(10, 0))

		assert.Equal(t, http.StatusOK, f.change(f.customer, mondayAt(13, 0), mondayAt(14, 0), 4).Code)
	})

	t.Run("one minute too late, even though the new time is far away", func(t *testing.T) {
		f := newBooked(t, 10, 4)
		f.app.setNow(mondayAt(10, 1))

		assertRejected(t, f.change(f.customer, tuesdayAt(13, 0), tuesdayAt(14, 0), 4), http.StatusConflict, "too_late_to_modify")
		assert.True(t, mondayAt(11, 0).Equal(f.startAt(t)), "the reservation did not move")
	})
}

func (f bookedFixture) startAt(t *testing.T) time.Time {
	t.Helper()

	var start time.Time
	require.NoError(t, f.app.db.Raw("SELECT start_at FROM reservations WHERE id = ?", f.reservationID).Scan(&start).Error)
	return start
}

func TestReservation_OnlyTheBookerMayChangeIt(t *testing.T) {
	f := newBooked(t, 10, 4)

	assert.Equal(t, http.StatusForbidden, f.change(f.stranger, mondayAt(13, 0), mondayAt(14, 0), 4).Code)
	assert.Equal(t, http.StatusForbidden, f.change(f.owner, mondayAt(13, 0), mondayAt(14, 0), 4).Code, "not even the restaurant owner")
	assert.Equal(t, http.StatusForbidden, f.cancel(f.stranger).Code)
	assert.Equal(t, http.StatusForbidden, f.cancel(f.owner).Code)

	assert.Equal(t, "confirmed", f.status(t))
	assert.True(t, mondayAt(11, 0).Equal(f.startAt(t)))
}

func TestReservation_UnknownBadAndAnonymous(t *testing.T) {
	f := newBooked(t, 10, 4)
	body := reservationBody(rfc(mondayAt(13, 0)), rfc(mondayAt(14, 0)), 2)

	assert.Equal(t, http.StatusNotFound, f.app.do(f.customer, http.MethodPut, "/reservations/9999", body).Code)
	assert.Equal(t, http.StatusNotFound, f.app.do(f.customer, http.MethodPost, "/reservations/9999/cancel", nil).Code)
	assert.Equal(t, http.StatusBadRequest, f.app.do(f.customer, http.MethodPut, "/reservations/abc", body).Code)
	assert.Equal(t, http.StatusBadRequest, f.app.do(f.customer, http.MethodPost, "/reservations/abc/cancel", nil).Code)

	assert.Equal(t, http.StatusUnauthorized, f.app.do(uuid.Nil, http.MethodPut, f.path(""), body).Code)
	assert.Equal(t, http.StatusUnauthorized, f.app.do(uuid.Nil, http.MethodPost, f.path("/cancel"), nil).Code)
	assert.Equal(t, http.StatusUnauthorized, f.app.do(uuid.Nil, http.MethodGet, "/reservations", nil).Code)
}

func TestReservationCancel_TwiceIsAConflict(t *testing.T) {
	f := newBooked(t, 10, 4)
	require.Equal(t, http.StatusNoContent, f.cancel(f.customer).Code)

	assertRejected(t, f.cancel(f.customer), http.StatusConflict, "reservation_not_active")
}

// Ten simultaneous cancellations of one reservation: exactly one may win. Two requests
// rarely overlap enough to show a missing lock, ten almost always do.
func TestReservationCancel_ConcurrentCancelsSucceedOnce(t *testing.T) {
	f := newBooked(t, 10, 4)

	const requests = 10
	f.app.warmPool(requests)
	responses := make([]*httptest.ResponseRecorder, requests)
	runTogether(requests, func(index int) { responses[index] = f.cancel(f.customer) })

	noContent, conflict := 0, 0
	for _, response := range responses {
		switch response.Code {
		case http.StatusNoContent:
			noContent++
		case http.StatusConflict:
			assert.Equal(t, "reservation_not_active", decode[errorJSON](t, response).Code)
			conflict++
		default:
			t.Errorf("unexpected status %d: %s", response.Code, response.Body.String())
		}
	}
	assert.Equal(t, 1, noContent, "exactly one cancellation wins")
	assert.Equal(t, requests-1, conflict)
}

// Four customers each hold a small booking at 11:00 and all try to move to the same empty slot
// at once. The slot seats 10 and each wants 4, so only two moves can succeed. Every move looks
// fine on its own: without the restaurant lock each would see an empty target slot.
func TestReservationUpdate_ConcurrentMovesNeverOverbook(t *testing.T) {
	a := newApp(t)
	owner := a.newUser("เจ้าของ")
	restaurantID := a.seedRestaurant(owner, restaurantOpts{Capacity: 10, LeadMinutes: 60})

	const movers = 4
	customers := make([]uuid.UUID, movers)
	reservations := make([]int, movers)
	for index := range customers {
		customers[index] = a.newUser("ลูกค้า " + strconv.Itoa(index))
		reservations[index] = a.seedReservation(restaurantID, customers[index], mondayAt(11, 0), mondayAt(12, 0), 1, "confirmed")
	}
	a.warmPool(movers)

	responses := make([]*httptest.ResponseRecorder, movers)
	runTogether(movers, func(index int) {
		responses[index] = a.do(customers[index], http.MethodPut, "/reservations/"+strconv.Itoa(reservations[index]),
			reservationBody(rfc(mondayAt(15, 0)), rfc(mondayAt(16, 0)), 4))
	})

	moved, refused := 0, 0
	for _, response := range responses {
		switch response.Code {
		case http.StatusOK:
			moved++
		case http.StatusConflict:
			assert.Equal(t, "capacity_exceeded", decode[errorJSON](t, response).Code)
			refused++
		default:
			t.Errorf("unexpected status %d: %s", response.Code, response.Body.String())
		}
	}
	assert.Equal(t, 2, moved, "10 seats hold two parties of 4")
	assert.Equal(t, movers-2, refused)

	var seated int64
	require.NoError(t, a.db.Raw("SELECT COALESCE(SUM(guests), 0) FROM reservations WHERE start_at = ? AND status = 'confirmed'", mondayAt(15, 0)).Scan(&seated).Error)
	assert.Equal(t, int64(8), seated)
}

func TestReservationUpdate_NotActive(t *testing.T) {
	t.Run("cancelled", func(t *testing.T) {
		f := newBooked(t, 10, 4)
		require.Equal(t, http.StatusNoContent, f.cancel(f.customer).Code)

		assertRejected(t, f.change(f.customer, mondayAt(13, 0), mondayAt(14, 0), 4), http.StatusConflict, "reservation_not_active")
	})

	t.Run("already started is not active, whatever the lead time says", func(t *testing.T) {
		f := newBooked(t, 10, 4)
		f.app.setNow(mondayAt(11, 30))

		assertRejected(t, f.change(f.customer, mondayAt(13, 0), mondayAt(14, 0), 4), http.StatusConflict, "reservation_not_active")
		assertRejected(t, f.cancel(f.customer), http.StatusConflict, "reservation_not_active")
	})
}

func TestReservationUpdate_ExcludesOwnAllocation(t *testing.T) {
	t.Run("moving a full booking over its own old time", func(t *testing.T) {
		f := newBooked(t, 10, 10) // the restaurant is full at 11:00-12:00 with this booking

		moved := f.change(f.customer, mondayAt(11, 30), mondayAt(12, 30), 10)

		assert.Equal(t, http.StatusOK, moved.Code, moved.Body.String())
	})

	t.Run("growing past the capacity is still refused", func(t *testing.T) {
		f := newBooked(t, 10, 10)

		assertRejected(t, f.change(f.customer, mondayAt(11, 0), mondayAt(12, 0), 11), http.StatusConflict, "capacity_exceeded")
	})

	t.Run("other people's seats still count", func(t *testing.T) {
		f := newBooked(t, 10, 4)
		f.app.seedReservation(f.restaurantID, f.stranger, mondayAt(13, 0), mondayAt(15, 0), 6, "confirmed")

		assertRejected(t, f.change(f.customer, mondayAt(14, 0), mondayAt(16, 0), 5), http.StatusConflict, "capacity_exceeded")
		assert.Equal(t, http.StatusOK, f.change(f.customer, mondayAt(14, 0), mondayAt(16, 0), 4).Code)
	})

	t.Run("a cancelled booking no longer holds seats", func(t *testing.T) {
		f := newBooked(t, 10, 4)
		f.app.seedReservation(f.restaurantID, f.stranger, mondayAt(13, 0), mondayAt(15, 0), 10, "cancelled")

		assert.Equal(t, http.StatusOK, f.change(f.customer, mondayAt(13, 0), mondayAt(15, 0), 10).Code)
	})
}

func TestReservationUpdate_AppliesTheSameRulesAsBooking(t *testing.T) {
	cases := []struct {
		name       string
		start, end time.Time
		guests     int
		wantStatus int
		wantCode   string
	}{
		{"end before start", mondayAt(14, 0), mondayAt(13, 0), 4, http.StatusBadRequest, ""},
		{"into the past", mondayAt(8, 0), mondayAt(9, 30), 4, http.StatusBadRequest, "start_in_past"},
		{"before opening", mondayAt(10, 0), mondayAt(12, 0), 4, http.StatusBadRequest, "outside_opening_hours"},
		{"across midnight", mondayAt(21, 0), tuesdayAt(1, 0), 4, http.StatusBadRequest, "outside_opening_hours"},
		{"zero guests", mondayAt(13, 0), mondayAt(14, 0), 0, http.StatusBadRequest, ""},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			f := newBooked(t, 10, 4)

			response := f.change(f.customer, tc.start, tc.end, tc.guests)

			assert.Equal(t, tc.wantStatus, response.Code, response.Body.String())
			assert.Equal(t, tc.wantCode, decode[errorJSON](t, response).Code)
			assert.True(t, mondayAt(11, 0).Equal(f.startAt(t)), "a rejected change leaves the reservation alone")
		})
	}
}

func TestReservationUpdate_ReturnsTheWholeReservation(t *testing.T) {
	f := newBooked(t, 10, 4)
	other := f.app.seedRestaurant(f.owner, restaurantOpts{Name: "ร้านอื่น"})
	body := reservationBody(rfc(mondayAt(15, 0)), rfc(mondayAt(17, 0)), 6)
	body["restaurantId"] = other // the restaurant cannot be changed
	body["userId"] = f.stranger.String()
	body["status"] = "cancelled"

	response := f.app.do(f.customer, http.MethodPut, f.path(""), body)

	require.Equal(t, http.StatusOK, response.Code, response.Body.String())
	got := decode[reservationJSON](t, response)
	assert.Equal(t, f.reservationID, got.ID)
	assert.Equal(t, f.restaurantID, got.Restaurant.ID)
	assert.Equal(t, "ชาบูทอง", got.Restaurant.Name)
	assert.True(t, mondayAt(15, 0).Equal(got.StartAt))
	assert.True(t, mondayAt(17, 0).Equal(got.EndAt))
	assert.Equal(t, 6, got.Guests)
	assert.Equal(t, "confirmed", got.Status)
	assert.False(t, got.CreatedAt.IsZero())

	var stored struct {
		RestaurantID int
		UserID       uuid.UUID
		Status       string
	}
	require.NoError(t, f.app.db.Raw("SELECT restaurant_id, user_id, status FROM reservations WHERE id = ?", f.reservationID).Scan(&stored).Error)
	assert.Equal(t, f.restaurantID, stored.RestaurantID)
	assert.Equal(t, f.customer, stored.UserID)
	assert.Equal(t, "confirmed", stored.Status)
}

func TestReservationCancel_FreesTheSeats(t *testing.T) {
	f := newBooked(t, 10, 10)
	other := f.stranger

	assertRejected(t, f.app.reserve(other, f.restaurantID, mondayAt(11, 0), mondayAt(12, 0), 1), http.StatusConflict, "capacity_exceeded")
	require.Equal(t, http.StatusNoContent, f.cancel(f.customer).Code)

	assert.Equal(t, http.StatusCreated, f.app.reserve(other, f.restaurantID, mondayAt(11, 0), mondayAt(12, 0), 10).Code)
}

func TestReservationListMine(t *testing.T) {
	f := newBooked(t, 10, 4) // customer: Monday 11:00 (confirmed)
	a := f.app
	a.seedReservation(f.restaurantID, f.customer, mondayAt(18, 0), mondayAt(19, 0), 2, "cancelled")
	a.seedReservation(f.restaurantID, f.customer, tuesdayAt(12, 0), tuesdayAt(13, 0), 3, "confirmed")
	a.seedReservation(f.restaurantID, f.stranger, mondayAt(13, 0), mondayAt(14, 0), 5, "confirmed")

	list := decode[reservationListJSON](t, a.do(f.customer, http.MethodGet, "/reservations", nil))

	assert.Equal(t, 3, list.Total)
	require.Len(t, list.Results, 3)
	assert.True(t, tuesdayAt(12, 0).Equal(list.Results[0].StartAt), "newest start first")
	assert.True(t, mondayAt(18, 0).Equal(list.Results[1].StartAt))
	assert.True(t, mondayAt(11, 0).Equal(list.Results[2].StartAt))
	assert.Equal(t, []string{"confirmed", "cancelled", "confirmed"},
		[]string{list.Results[0].Status, list.Results[1].Status, list.Results[2].Status}, "every status is listed")
	for _, item := range list.Results {
		assert.Equal(t, f.restaurantID, item.Restaurant.ID)
		assert.Equal(t, "ชาบูทอง", item.Restaurant.Name)
	}

	t.Run("nobody else's reservations", func(t *testing.T) {
		others := decode[reservationListJSON](t, a.do(f.stranger, http.MethodGet, "/reservations", nil))
		assert.Equal(t, 1, others.Total)
		assert.Equal(t, 5, others.Results[0].Guests)
	})

	t.Run("a deleted restaurant keeps its name on old reservations", func(t *testing.T) {
		require.NoError(t, a.db.Exec("UPDATE restaurants SET deleted_at = now() WHERE id = ?", f.restaurantID).Error)

		after := decode[reservationListJSON](t, a.do(f.customer, http.MethodGet, "/reservations", nil))
		assert.Equal(t, 3, after.Total)
		assert.Equal(t, "ชาบูทอง", after.Results[0].Restaurant.Name)
	})

	t.Run("no reservations is an empty array", func(t *testing.T) {
		nobody := a.newUser("ไม่เคยจอง")

		response := a.do(nobody, http.MethodGet, "/reservations", nil)

		assert.JSONEq(t, `{"total":0,"results":[]}`, response.Body.String())
	})
}

func TestReservationListMine_RestaurantPictureAndLeadTime(t *testing.T) {
	a := newApp(t)
	owner := a.newUser("เจ้าของ")
	customer := a.newUser("ลูกค้า")
	withPicture := a.seedRestaurant(owner, restaurantOpts{Name: "มีรูป", LeadMinutes: 90, ImageURL: "/uploads/restaurants/1-abc.png"})
	noPicture := a.seedRestaurant(owner, restaurantOpts{Name: "ไม่มีรูป", LeadMinutes: 45})
	a.seedReservation(withPicture, customer, mondayAt(18, 0), mondayAt(19, 0), 2, "confirmed")
	a.seedReservation(noPicture, customer, mondayAt(20, 0), mondayAt(21, 0), 2, "confirmed")

	byName := func() map[string]reservationJSON {
		list := decode[reservationListJSON](t, a.do(customer, http.MethodGet, "/reservations", nil))
		result := map[string]reservationJSON{}
		for _, item := range list.Results {
			result[item.Restaurant.Name] = item
		}
		return result
	}

	t.Run("each reservation carries its restaurant's picture and cancellation lead time", func(t *testing.T) {
		items := byName()

		require.NotNil(t, items["มีรูป"].Restaurant.ImageURL)
		assert.Equal(t, "/uploads/restaurants/1-abc.png", *items["มีรูป"].Restaurant.ImageURL)
		assert.Equal(t, 90, items["มีรูป"].Restaurant.CancellationLeadMinutes)
		assert.Equal(t, 45, items["ไม่มีรูป"].Restaurant.CancellationLeadMinutes)
	})

	t.Run("a restaurant without a picture says imageUrl is null", func(t *testing.T) {
		response := a.do(customer, http.MethodGet, "/reservations", nil)

		assert.Nil(t, byName()["ไม่มีรูป"].Restaurant.ImageURL)
		assert.Contains(t, response.Body.String(), `"imageUrl":null`)
	})

	t.Run("a deleted restaurant keeps both on old reservations", func(t *testing.T) {
		require.NoError(t, a.db.Exec("UPDATE restaurants SET deleted_at = now() WHERE id = ?", withPicture).Error)

		items := byName()

		require.NotNil(t, items["มีรูป"].Restaurant.ImageURL)
		assert.Equal(t, 90, items["มีรูป"].Restaurant.CancellationLeadMinutes)
	})
}
