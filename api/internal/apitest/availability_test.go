package apitest

import (
	"net/http"
	"strconv"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type availabilityJSON struct {
	Date     string `json:"date"`
	Closed   bool   `json:"closed"`
	Capacity int    `json:"capacity"`
	Slots    []struct {
		StartAt        string `json:"startAt"`
		EndAt          string `json:"endAt"`
		BookedGuests   int    `json:"bookedGuests"`
		RemainingSeats int    `json:"remainingSeats"`
	} `json:"slots"`
}

// availability asks for the hourly picture of one day (a "YYYY-MM-DD" date, Bangkok time).
func (a *app) availability(as uuid.UUID, restaurantID int, date string) (availabilityJSON, int) {
	a.t.Helper()

	response := a.do(as, http.MethodGet, "/restaurants/"+strconv.Itoa(restaurantID)+"/availability?date="+date, nil)
	if response.Code != http.StatusOK {
		return availabilityJSON{}, response.Code
	}

	return decode[availabilityJSON](a.t, response), response.Code
}

func TestAvailability_EmptyDayHasHourlySlotsWithFullCapacity(t *testing.T) {
	a := newApp(t)
	owner := a.newUser("เจ้าของ")
	viewer := a.newUser("ลูกค้า")
	restaurantID := a.seedRestaurant(owner, restaurantOpts{Capacity: 10})

	got, status := a.availability(viewer, restaurantID, "2026-10-12")

	require.Equal(t, http.StatusOK, status)
	assert.Equal(t, "2026-10-12", got.Date)
	assert.False(t, got.Closed)
	assert.Equal(t, 10, got.Capacity)
	require.Len(t, got.Slots, 11, "open 11:00-22:00 is eleven one-hour slots")
	assert.Equal(t, "2026-10-12T11:00:00+07:00", got.Slots[0].StartAt)
	assert.Equal(t, "2026-10-12T12:00:00+07:00", got.Slots[0].EndAt)
	assert.Equal(t, "2026-10-12T21:00:00+07:00", got.Slots[10].StartAt)
	assert.Equal(t, "2026-10-12T22:00:00+07:00", got.Slots[10].EndAt)
	for _, slot := range got.Slots {
		assert.Equal(t, 0, slot.BookedGuests)
		assert.Equal(t, 10, slot.RemainingSeats)
	}
}

// slotBooked returns bookedGuests of the slot starting at the given Bangkok hour:minute of the day.
func slotBooked(t *testing.T, got availabilityJSON, startAt string) int {
	t.Helper()

	for _, slot := range got.Slots {
		if slot.StartAt == startAt {
			return slot.BookedGuests
		}
	}
	require.FailNow(t, "no slot starts at "+startAt)

	return 0
}

func TestAvailability_CountsPeakNotSum(t *testing.T) {
	a := newApp(t)
	owner := a.newUser("เจ้าของ")
	viewer := a.newUser("ลูกค้า")
	restaurantID := a.seedRestaurant(owner, restaurantOpts{Capacity: 10})
	// 12:00-12:30 (4) and 12:30-13:00 (5) are never in the restaurant together: the peak is 5, not 9.
	a.seedReservation(restaurantID, viewer, mondayAt(12, 0), mondayAt(12, 30), 4, "confirmed")
	a.seedReservation(restaurantID, viewer, mondayAt(12, 30), mondayAt(13, 0), 5, "confirmed")

	got, status := a.availability(viewer, restaurantID, "2026-10-12")

	require.Equal(t, http.StatusOK, status)
	assert.Equal(t, 5, slotBooked(t, got, "2026-10-12T12:00:00+07:00"))
	for _, slot := range got.Slots {
		if slot.StartAt == "2026-10-12T12:00:00+07:00" {
			assert.Equal(t, 5, slot.RemainingSeats)
		}
	}
}

func TestAvailability_HalfOpenBoundaries(t *testing.T) {
	a := newApp(t)
	owner := a.newUser("เจ้าของ")
	viewer := a.newUser("ลูกค้า")
	restaurantID := a.seedRestaurant(owner, restaurantOpts{Capacity: 10})
	// Ends exactly when the 13:00 slot starts: it must not touch that slot.
	a.seedReservation(restaurantID, viewer, mondayAt(12, 0), mondayAt(13, 0), 3, "confirmed")
	// Runs across the 14:00 and 15:00 slots (starts mid-hour, ends mid-hour).
	a.seedReservation(restaurantID, viewer, mondayAt(14, 30), mondayAt(15, 30), 2, "confirmed")

	got, status := a.availability(viewer, restaurantID, "2026-10-12")

	require.Equal(t, http.StatusOK, status)
	assert.Equal(t, 3, slotBooked(t, got, "2026-10-12T12:00:00+07:00"))
	assert.Equal(t, 0, slotBooked(t, got, "2026-10-12T13:00:00+07:00"))
	assert.Equal(t, 2, slotBooked(t, got, "2026-10-12T14:00:00+07:00"))
	assert.Equal(t, 2, slotBooked(t, got, "2026-10-12T15:00:00+07:00"))
	assert.Equal(t, 0, slotBooked(t, got, "2026-10-12T16:00:00+07:00"))
}

func TestAvailability_IgnoresCancelledAndOtherRestaurantsAndOtherDays(t *testing.T) {
	a := newApp(t)
	owner := a.newUser("เจ้าของ")
	viewer := a.newUser("ลูกค้า")
	restaurantID := a.seedRestaurant(owner, restaurantOpts{Capacity: 10})
	elsewhere := a.seedRestaurant(owner, restaurantOpts{Name: "อีกร้าน", Capacity: 10})
	a.seedReservation(restaurantID, viewer, mondayAt(12, 0), mondayAt(13, 0), 6, "cancelled")
	a.seedReservation(elsewhere, viewer, mondayAt(12, 0), mondayAt(13, 0), 6, "confirmed")
	a.seedReservation(restaurantID, viewer, tuesdayAt(12, 0), tuesdayAt(13, 0), 6, "confirmed")

	got, status := a.availability(viewer, restaurantID, "2026-10-12")

	require.Equal(t, http.StatusOK, status)
	for _, slot := range got.Slots {
		assert.Equal(t, 0, slot.BookedGuests, slot.StartAt)
		assert.Equal(t, 10, slot.RemainingSeats, slot.StartAt)
	}
}

func TestAvailability_ShortLastSlot(t *testing.T) {
	a := newApp(t)
	owner := a.newUser("เจ้าของ")
	viewer := a.newUser("ลูกค้า")
	restaurantID := a.seedRestaurant(owner, restaurantOpts{Open: "11:30", Close: "13:15"})

	got, status := a.availability(viewer, restaurantID, "2026-10-12")

	require.Equal(t, http.StatusOK, status)
	require.Len(t, got.Slots, 2)
	assert.Equal(t, "2026-10-12T11:30:00+07:00", got.Slots[0].StartAt)
	assert.Equal(t, "2026-10-12T12:30:00+07:00", got.Slots[0].EndAt)
	assert.Equal(t, "2026-10-12T12:30:00+07:00", got.Slots[1].StartAt)
	assert.Equal(t, "2026-10-12T13:15:00+07:00", got.Slots[1].EndAt, "the last slot ends at closing time")
}

func TestAvailability_ClosedDay(t *testing.T) {
	a := newApp(t)
	owner := a.newUser("เจ้าของ")
	viewer := a.newUser("ลูกค้า")
	restaurantID := a.seedRestaurant(owner, restaurantOpts{ClosedWeekdays: []int{1}}) // closed Mondays

	response := a.do(viewer, http.MethodGet, "/restaurants/"+strconv.Itoa(restaurantID)+"/availability?date=2026-10-12", nil)

	require.Equal(t, http.StatusOK, response.Code, response.Body.String())
	assert.JSONEq(t, `{"date":"2026-10-12","closed":true,"capacity":10,"slots":[]}`, response.Body.String())
}

func TestAvailability_FullSlotNeverNegative(t *testing.T) {
	a := newApp(t)
	owner := a.newUser("เจ้าของ")
	viewer := a.newUser("ลูกค้า")
	restaurantID := a.seedRestaurant(owner, restaurantOpts{Capacity: 10})
	// More than the capacity (for example the owner lowered the seats afterwards).
	a.seedReservation(restaurantID, viewer, mondayAt(18, 0), mondayAt(19, 0), 12, "confirmed")

	got, status := a.availability(viewer, restaurantID, "2026-10-12")

	require.Equal(t, http.StatusOK, status)
	for _, slot := range got.Slots {
		if slot.StartAt == "2026-10-12T18:00:00+07:00" {
			assert.Equal(t, 12, slot.BookedGuests)
			assert.Equal(t, 0, slot.RemainingSeats)
		}
	}
}

func TestAvailability_InvalidDateMissingRestaurantAndAuth(t *testing.T) {
	a := newApp(t)
	owner := a.newUser("เจ้าของ")
	viewer := a.newUser("ลูกค้า")
	restaurantID := a.seedRestaurant(owner, restaurantOpts{})
	deleted := a.seedRestaurant(owner, restaurantOpts{Name: "ปิดถาวร"})
	require.NoError(t, a.db.Exec("UPDATE restaurants SET deleted_at = now() WHERE id = ?", deleted).Error)
	base := "/restaurants/" + strconv.Itoa(restaurantID) + "/availability"

	for name, path := range map[string]string{
		"missing date":         base,
		"empty date":           base + "?date=",
		"not a date":           base + "?date=tomorrow",
		"impossible day":       base + "?date=2026-02-30",
		"no zero padding":      base + "?date=2026-1-5",
		"a time is not a date": base + "?date=2026-10-12T09:00:00%2B07:00",
		"bad restaurant id":    "/restaurants/abc/availability?date=2026-10-12",
	} {
		t.Run(name, func(t *testing.T) {
			response := a.do(viewer, http.MethodGet, path, nil)
			assert.Equal(t, http.StatusBadRequest, response.Code, response.Body.String())
		})
	}

	t.Run("unknown restaurant", func(t *testing.T) {
		_, status := a.availability(viewer, 999999, "2026-10-12")
		assert.Equal(t, http.StatusNotFound, status)
	})
	t.Run("deleted restaurant", func(t *testing.T) {
		_, status := a.availability(viewer, deleted, "2026-10-12")
		assert.Equal(t, http.StatusNotFound, status)
	})
	t.Run("no credentials", func(t *testing.T) {
		_, status := a.availability(uuid.Nil, restaurantID, "2026-10-12")
		assert.Equal(t, http.StatusUnauthorized, status)
	})
}
