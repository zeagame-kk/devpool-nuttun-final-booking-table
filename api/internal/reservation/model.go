package reservation

import (
	"time"

	"github.com/google/uuid"
)

const (
	StatusConfirmed = "confirmed"
	StatusCancelled = "cancelled"
)

// Reservation covers the half-open interval [StartAt, EndAt). Cancelling sets Status;
// rows are never deleted.
type Reservation struct {
	ID           int `gorm:"primaryKey"`
	RestaurantID int
	UserID       uuid.UUID
	StartAt      time.Time
	EndAt        time.Time
	Guests       int
	Status       string
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

// Input is what a customer chooses when booking or changing a reservation.
type Input struct {
	StartAt time.Time
	EndAt   time.Time
	Guests  int
}

// RestaurantInfo is the part of a restaurant the booking rules need, read after the
// restaurant row has been locked.
type RestaurantInfo struct {
	ID          int
	Capacity    int
	LeadMinutes int
	Hours       map[int]DayHours // by weekday, 0 = Sunday; a missing weekday means closed
}

// DayHours are the opening and closing times as offsets from local midnight.
type DayHours struct {
	Open  time.Duration
	Close time.Duration
}
