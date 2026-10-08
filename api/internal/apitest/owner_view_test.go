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

type ownerReservationJSON struct {
	ID       int `json:"id"`
	Customer struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	} `json:"customer"`
	StartAt   time.Time `json:"startAt"`
	EndAt     time.Time `json:"endAt"`
	Guests    int       `json:"guests"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"createdAt"`
}

type ownerReservationListJSON struct {
	Total   int                    `json:"total"`
	Results []ownerReservationJSON `json:"results"`
}

func ownerPath(restaurantID int, query string) string {
	return "/restaurants/" + strconv.Itoa(restaurantID) + "/reservations" + query
}

func TestOwnerReservations_ListsWithCustomerNames(t *testing.T) {
	a := newApp(t)
	owner := a.newUser("เจ้าของ")
	somsri := a.newUser("สมศรี")
	sommai := a.newUser("สมหมาย")
	restaurantID := a.seedRestaurant(owner, restaurantOpts{})
	a.seedReservation(restaurantID, somsri, mondayAt(12, 0), mondayAt(13, 0), 2, "confirmed")
	a.seedReservation(restaurantID, sommai, mondayAt(18, 0), mondayAt(19, 0), 5, "cancelled")
	a.seedReservation(restaurantID, somsri, tuesdayAt(12, 0), tuesdayAt(13, 0), 3, "confirmed")

	response := a.do(owner, http.MethodGet, ownerPath(restaurantID, ""), nil)

	require.Equal(t, http.StatusOK, response.Code, response.Body.String())
	list := decode[ownerReservationListJSON](t, response)
	assert.Equal(t, 3, list.Total)
	require.Len(t, list.Results, 3)
	assert.True(t, tuesdayAt(12, 0).Equal(list.Results[0].StartAt), "newest start first")
	assert.True(t, mondayAt(18, 0).Equal(list.Results[1].StartAt))
	assert.True(t, mondayAt(12, 0).Equal(list.Results[2].StartAt))
	assert.Equal(t, "สมศรี", list.Results[0].Customer.Name)
	assert.Equal(t, somsri.String(), list.Results[0].Customer.ID)
	assert.Equal(t, "สมหมาย", list.Results[1].Customer.Name)
	assert.Equal(t, "cancelled", list.Results[1].Status)
	assert.Equal(t, 5, list.Results[1].Guests)

	// The owner learns who is coming, not how to reach them: no email anywhere in the body.
	assert.NotContains(t, response.Body.String(), "@")
	assert.NotContains(t, response.Body.String(), "email")
}

func TestOwnerReservations_FilterByStatus(t *testing.T) {
	a := newApp(t)
	owner := a.newUser("เจ้าของ")
	customer := a.newUser("ลูกค้า")
	restaurantID := a.seedRestaurant(owner, restaurantOpts{})
	a.seedReservation(restaurantID, customer, mondayAt(12, 0), mondayAt(13, 0), 2, "confirmed")
	a.seedReservation(restaurantID, customer, mondayAt(14, 0), mondayAt(15, 0), 2, "cancelled")
	a.seedReservation(restaurantID, customer, mondayAt(16, 0), mondayAt(17, 0), 2, "cancelled")

	get := func(query string) ownerReservationListJSON {
		response := a.do(owner, http.MethodGet, ownerPath(restaurantID, query), nil)
		require.Equal(t, http.StatusOK, response.Code, response.Body.String())
		return decode[ownerReservationListJSON](t, response)
	}

	assert.Equal(t, 3, get("").Total, "no status means all of them")
	assert.Equal(t, 1, get("?status=confirmed").Total)
	assert.Equal(t, 2, get("?status=cancelled").Total)
	assert.Equal(t, http.StatusBadRequest, a.do(owner, http.MethodGet, ownerPath(restaurantID, "?status=pending"), nil).Code)
}

func TestOwnerReservations_OnlyThisRestaurantsOwner(t *testing.T) {
	a := newApp(t)
	owner := a.newUser("เจ้าของ")
	customer := a.newUser("ลูกค้า")
	restaurantID := a.seedRestaurant(owner, restaurantOpts{})
	a.seedReservation(restaurantID, customer, mondayAt(12, 0), mondayAt(13, 0), 2, "confirmed")

	assert.Equal(t, http.StatusForbidden, a.do(customer, http.MethodGet, ownerPath(restaurantID, ""), nil).Code, "not even the customer who booked there")

	otherOwner := a.newUser("เจ้าของอื่น")
	assert.Equal(t, http.StatusForbidden, a.do(otherOwner, http.MethodGet, ownerPath(restaurantID, ""), nil).Code)

	assert.Equal(t, http.StatusNotFound, a.do(owner, http.MethodGet, ownerPath(9999, ""), nil).Code)
	assert.Equal(t, http.StatusBadRequest, a.do(owner, http.MethodGet, "/restaurants/abc/reservations", nil).Code)
	assert.Equal(t, http.StatusUnauthorized, a.do(uuid.Nil, http.MethodGet, ownerPath(restaurantID, ""), nil).Code)
}

func TestOwnerReservations_OtherRestaurantsAreNotIncluded(t *testing.T) {
	a := newApp(t)
	owner := a.newUser("เจ้าของ")
	customer := a.newUser("ลูกค้า")
	mine := a.seedRestaurant(owner, restaurantOpts{Name: "ร้านแรก"})
	other := a.seedRestaurant(owner, restaurantOpts{Name: "ร้านสอง"})
	a.seedReservation(mine, customer, mondayAt(12, 0), mondayAt(13, 0), 2, "confirmed")
	a.seedReservation(other, customer, mondayAt(12, 0), mondayAt(13, 0), 7, "confirmed")

	list := decode[ownerReservationListJSON](t, a.do(owner, http.MethodGet, ownerPath(mine, ""), nil))

	require.Equal(t, 1, list.Total)
	assert.Equal(t, 2, list.Results[0].Guests)
}

func TestOwnerReservations_DeletedRestaurantIsGone(t *testing.T) {
	a := newApp(t)
	owner := a.newUser("เจ้าของ")
	restaurantID := a.seedRestaurant(owner, restaurantOpts{})
	require.NoError(t, a.db.Exec("UPDATE restaurants SET deleted_at = now() WHERE id = ?", restaurantID).Error)

	assert.Equal(t, http.StatusNotFound, a.do(owner, http.MethodGet, ownerPath(restaurantID, ""), nil).Code)
}

func TestOwnerReservations_NoneIsAnEmptyArray(t *testing.T) {
	a := newApp(t)
	owner := a.newUser("เจ้าของ")
	restaurantID := a.seedRestaurant(owner, restaurantOpts{})

	response := a.do(owner, http.MethodGet, ownerPath(restaurantID, ""), nil)

	assert.JSONEq(t, `{"total":0,"results":[]}`, response.Body.String())
}

func TestRestaurantDelete_BlockedByAnActiveReservation(t *testing.T) {
	a := newApp(t)
	owner := a.newUser("เจ้าของ")
	customer := a.newUser("ลูกค้า")
	restaurantID := a.seedRestaurant(owner, restaurantOpts{})
	reservationID := a.seedReservation(restaurantID, customer, mondayAt(18, 0), mondayAt(20, 0), 4, "confirmed")

	blocked := a.do(owner, http.MethodDelete, "/restaurants/"+strconv.Itoa(restaurantID), nil)

	assertRejected(t, blocked, http.StatusConflict, "restaurant_has_active_reservations")
	assert.Equal(t, http.StatusOK, a.do(owner, http.MethodGet, "/restaurants/"+strconv.Itoa(restaurantID), nil).Code, "the restaurant is still there")

	// Once the customer cancels, nothing is holding the restaurant any more.
	require.Equal(t, http.StatusNoContent, a.do(customer, http.MethodPost, "/reservations/"+strconv.Itoa(reservationID)+"/cancel", nil).Code)
	assert.Equal(t, http.StatusNoContent, a.do(owner, http.MethodDelete, "/restaurants/"+strconv.Itoa(restaurantID), nil).Code)
}

func TestRestaurantDelete_OnlyActiveReservationsBlock(t *testing.T) {
	cases := []struct {
		name       string
		start, end time.Time
		status     string
		wantStatus int
	}{
		{"over and done", mondayAt(7, 0), mondayAt(8, 0), "confirmed", http.StatusNoContent},
		{"cancelled in the future", mondayAt(18, 0), mondayAt(20, 0), "cancelled", http.StatusNoContent},
		{"in progress right now", mondayAt(8, 30), mondayAt(9, 30), "confirmed", http.StatusConflict},
		{"ends exactly now", mondayAt(8, 0), mondayAt(9, 0), "confirmed", http.StatusNoContent},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			a := newApp(t)
			owner := a.newUser("เจ้าของ")
			customer := a.newUser("ลูกค้า")
			restaurantID := a.seedRestaurant(owner, restaurantOpts{})
			a.seedReservation(restaurantID, customer, tc.start, tc.end, 2, tc.status)

			response := a.do(owner, http.MethodDelete, "/restaurants/"+strconv.Itoa(restaurantID), nil)

			assert.Equal(t, tc.wantStatus, response.Code, response.Body.String())
		})
	}
}

// Customers book while the owner deletes. Whichever gets the restaurant lock first wins, and the
// other must see it: either a booking exists and the delete is refused, or the restaurant is
// deleted and no booking was made. "Deleted, yet bookings made" is the outcome to rule out.
//
// The delete does several reads before it takes the lock, so the bookings are released a little
// after it starts. Trying many offsets makes some of them land inside the window between the
// delete's check and its write, which is where a missing lock shows.
func TestRestaurantDelete_RacingWithBookingsStaysConsistent(t *testing.T) {
	const bookers = 4

	for offset := time.Duration(0); offset <= 4*time.Millisecond; offset += 250 * time.Microsecond {
		a := newApp(t)
		owner := a.newUser("เจ้าของ")
		restaurantID := a.seedRestaurant(owner, restaurantOpts{Capacity: 100})
		customers := make([]uuid.UUID, bookers)
		for index := range customers {
			customers[index] = a.newUser("ลูกค้า " + strconv.Itoa(index))
		}
		a.warmPool(bookers + 1)

		var deleteResponse *httptest.ResponseRecorder
		bookResponses := make([]*httptest.ResponseRecorder, bookers)
		start := make(chan struct{})
		var ready, done sync.WaitGroup
		ready.Add(bookers + 1)
		done.Add(bookers + 1)
		go func() {
			defer done.Done()
			ready.Done()
			<-start
			deleteResponse = a.do(owner, http.MethodDelete, "/restaurants/"+strconv.Itoa(restaurantID), nil)
		}()
		for index := range customers {
			go func() {
				defer done.Done()
				ready.Done()
				<-start
				time.Sleep(offset)
				bookResponses[index] = a.reserve(customers[index], restaurantID, mondayAt(18, 0), mondayAt(19, 0), 2)
			}()
		}
		ready.Wait()
		close(start)
		done.Wait()

		created := 0
		for _, response := range bookResponses {
			if response.Code == http.StatusCreated {
				created++
			}
		}
		var stillThere, activeBookings int64
		require.NoError(t, a.db.Raw("SELECT count(*) FROM restaurants WHERE id = ? AND deleted_at IS NULL", restaurantID).Scan(&stillThere).Error)
		require.NoError(t, a.db.Raw("SELECT count(*) FROM reservations WHERE restaurant_id = ? AND status = 'confirmed'", restaurantID).Scan(&activeBookings).Error)

		switch deleteResponse.Code {
		case http.StatusNoContent:
			assert.Zero(t, stillThere, "offset %v: the restaurant is deleted", offset)
			assert.Zero(t, activeBookings, "offset %v: a deleted restaurant must not have active bookings", offset)
			assert.Zero(t, created, "offset %v: no booking may succeed once the restaurant is deleted", offset)
		case http.StatusConflict:
			assert.Equal(t, int64(1), stillThere, "offset %v", offset)
			assert.Positive(t, activeBookings, "offset %v: the delete was refused because a booking exists", offset)
		default:
			t.Fatalf("offset %v: unexpected delete status %d: %s", offset, deleteResponse.Code, deleteResponse.Body.String())
		}
	}
}

// R5: the owner may shrink the restaurant; existing reservations are left alone and only new
// bookings follow the new capacity and hours.
func TestRestaurantReplace_DoesNotRevalidateExistingReservations(t *testing.T) {
	a := newApp(t)
	owner := a.newUser("เจ้าของ")
	customer := a.newUser("ลูกค้า")
	restaurantID := a.seedRestaurant(owner, restaurantOpts{Capacity: 10})
	reservationID := a.seedReservation(restaurantID, customer, mondayAt(18, 0), mondayAt(20, 0), 6, "confirmed")

	shrink := map[string]any{
		"name":                    "ร้านที่เล็กลง",
		"address":                 "ที่อยู่เดิม",
		"seatingCapacity":         1,
		"cancellationLeadMinutes": 30,
		"openingHours":            hours(2, "12:00", "14:00"), // no longer open on Mondays at all
	}
	require.Equal(t, http.StatusOK, a.do(owner, http.MethodPut, "/restaurants/"+strconv.Itoa(restaurantID), shrink).Code)

	var status string
	require.NoError(t, a.db.Raw("SELECT status FROM reservations WHERE id = ?", reservationID).Scan(&status).Error)
	assert.Equal(t, "confirmed", status, "the existing reservation survives")

	// New bookings do follow the new rules...
	assertRejected(t, a.reserve(customer, restaurantID, mondayAt(12, 0), mondayAt(13, 0), 1), http.StatusBadRequest, "outside_opening_hours")
	assert.Equal(t, http.StatusCreated, a.reserve(customer, restaurantID, tuesdayAt(12, 0), tuesdayAt(13, 0), 1).Code)
	assertRejected(t, a.reserve(customer, restaurantID, tuesdayAt(12, 0), tuesdayAt(13, 0), 1), http.StatusConflict, "capacity_exceeded")

	// ...and the old customer can still cancel what they booked.
	assert.Equal(t, http.StatusNoContent, a.do(customer, http.MethodPost, "/reservations/"+strconv.Itoa(reservationID)+"/cancel", nil).Code)
}
