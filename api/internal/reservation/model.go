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

// ReservationView is a reservation joined with the names a response needs. The restaurant is
// joined without hiding deleted ones, so old reservations keep showing where they were.
type ReservationView struct {
	Reservation
	RestaurantName        string
	RestaurantImageURL    *string
	RestaurantLeadMinutes int
	CustomerName          string
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

// DayAvailability is how full a restaurant is, hour by hour, on one Bangkok calendar day. It is a
// display aid: only the booking rules decide whether a reservation is accepted.
type DayAvailability struct {
	Date     string // YYYY-MM-DD
	Closed   bool
	Capacity int
	Slots    []Slot
}

// Slot is one hour (the last one of the day may be shorter) with the most guests present at once.
type Slot struct {
	Start, End     time.Time
	BookedGuests   int
	RemainingSeats int
}
