package apitest

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Each invalid row is tried where no other rule could reject it, and the error must name the
// kind of constraint, so a rule cannot pass because of an unrelated failure.
func TestSchema_ConstraintsRejectInvalidRows(t *testing.T) {
	a := newApp(t)
	owner := a.newUser("เจ้าของ")
	customer := a.newUser("ลูกค้า")

	insertRestaurant := "INSERT INTO restaurants (owner_id, name, address, seating_capacity, cancellation_lead_minutes) VALUES (?, 'ร้าน', 'ที่อยู่', ?, ?)"

	t.Run("restaurants", func(t *testing.T) {
		assert.ErrorContains(t, a.db.Exec(insertRestaurant, owner, 10, 29).Error, "check constraint", "lead time below 30")
		assert.ErrorContains(t, a.db.Exec(insertRestaurant, owner, 0, 60).Error, "check constraint", "capacity below 1")
		require.NoError(t, a.db.Exec(insertRestaurant, owner, 1, 30).Error, "boundary values 1 and 30 are valid")
	})

	t.Run("opening hours", func(t *testing.T) {
		var restaurantID int
		require.NoError(t, a.db.Raw(insertRestaurant+" RETURNING id", owner, 10, 60).Scan(&restaurantID).Error)

		insertHours := "INSERT INTO restaurant_opening_hours (restaurant_id, weekday, open_time, close_time) VALUES (?, ?, ?, ?)"
		assert.ErrorContains(t, a.db.Exec(insertHours, restaurantID, 7, "11:00", "22:00").Error, "check constraint", "weekday 7")
		assert.ErrorContains(t, a.db.Exec(insertHours, restaurantID, 0, "22:00", "11:00").Error, "check constraint", "close before open")
		assert.ErrorContains(t, a.db.Exec(insertHours, restaurantID, 0, "11:00", "11:00").Error, "check constraint", "close equal to open")
		require.NoError(t, a.db.Exec(insertHours, restaurantID, 0, "11:00", "22:00").Error, "weekday 0 (Sunday) is valid")
		assert.ErrorContains(t, a.db.Exec(insertHours, restaurantID, 0, "12:00", "21:00").Error, "duplicate key", "one row per weekday")
	})

	t.Run("reservations", func(t *testing.T) {
		restaurantID := a.seedRestaurant(owner, restaurantOpts{})
		start := fixedNow.Add(24 * time.Hour)

		insertReservation := "INSERT INTO reservations (restaurant_id, user_id, start_at, end_at, guests, status) VALUES (?, ?, ?, ?, ?, ?)"
		assert.ErrorContains(t, a.db.Exec(insertReservation, restaurantID, customer, start, start, 2, "confirmed").Error, "check constraint", "end equal to start")
		assert.ErrorContains(t, a.db.Exec(insertReservation, restaurantID, customer, start, start.Add(-time.Hour), 2, "confirmed").Error, "check constraint", "end before start")
		assert.ErrorContains(t, a.db.Exec(insertReservation, restaurantID, customer, start, start.Add(time.Hour), 0, "confirmed").Error, "check constraint", "zero guests")
		assert.ErrorContains(t, a.db.Exec(insertReservation, restaurantID, customer, start, start.Add(time.Hour), 2, "pending").Error, "check constraint", "unknown status")
		require.NoError(t, a.db.Exec(insertReservation, restaurantID, customer, start, start.Add(time.Hour), 2, "confirmed").Error)
		require.NoError(t, a.db.Exec(insertReservation, restaurantID, customer, start, start.Add(time.Hour), 2, "cancelled").Error)
	})

	t.Run("reviews", func(t *testing.T) {
		restaurantID := a.seedRestaurant(owner, restaurantOpts{})

		insertReview := "INSERT INTO reviews (restaurant_id, user_id, rating, comment) VALUES (?, ?, ?, ?)"
		assert.ErrorContains(t, a.db.Exec(insertReview, restaurantID, customer, 6, "ดี").Error, "check constraint", "rating 6")
		assert.ErrorContains(t, a.db.Exec(insertReview, restaurantID, customer, 0, "ดี").Error, "check constraint", "rating 0")
		assert.ErrorContains(t, a.db.Exec(insertReview, restaurantID, customer, 5, "   ").Error, "check constraint", "blank comment")
		require.NoError(t, a.db.Exec(insertReview, restaurantID, customer, 5, "ดี").Error)
		assert.ErrorContains(t, a.db.Exec(insertReview, restaurantID, customer, 4, "ดีมาก").Error, "duplicate key", "one review per user per restaurant")
	})
}
