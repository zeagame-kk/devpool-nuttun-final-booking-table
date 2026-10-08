package reservation

import (
	"context"
	"fmt"
	"time"
	_ "time/tzdata" // Asia/Bangkok must load even where the OS has no zoneinfo (distroless images)

	"github.com/google/uuid"
)

type Repository interface {
	InTx(ctx context.Context, restaurantID int, fn func(tx TxRepo) error) error
}

// TxRepo is the repository inside a transaction that holds the restaurant's row lock.
type TxRepo interface {
	Restaurant() RestaurantInfo
	Overlapping(ctx context.Context, start, end time.Time, excludeID int) ([]Booking, error)
	Create(ctx context.Context, reservation Reservation) (*Reservation, error)
}

type service struct {
	repository Repository
	now        func() time.Time
}

func NewService(repo Repository, now func() time.Time) *service {
	return &service{repository: repo, now: now}
}

// bangkok is the one time zone every restaurant uses to decide what "open on Monday" means.
var bangkok = mustLoadBangkok()

func mustLoadBangkok() *time.Location {
	location, err := time.LoadLocation("Asia/Bangkok")
	if err != nil {
		panic(fmt.Sprintf("load Asia/Bangkok: %v", err))
	}

	return location
}

func (svc *service) Create(ctx context.Context, userID uuid.UUID, restaurantID int, in Input) (*Reservation, error) {
	var created *Reservation

	if err := svc.repository.InTx(ctx, restaurantID, func(tx TxRepo) error {
		if err := svc.check(ctx, tx, in, 0); err != nil {
			return err
		}

		reservation, err := tx.Create(ctx, Reservation{
			RestaurantID: restaurantID,
			UserID:       userID,
			StartAt:      in.StartAt,
			EndAt:        in.EndAt,
			Guests:       in.Guests,
			Status:       StatusConfirmed,
		})
		created = reservation

		return err
	}); err != nil {
		return nil, fmt.Errorf("create reservation: %w", err)
	}

	return created, nil
}

// check applies the booking rules, cheapest first, to a request made against the locked
// restaurant: the range makes sense, it does not start in the past, it lies inside the opening
// hours of one local day, and it fits next to the other bookings. excludeID is the
// reservation being changed, if any.
func (svc *service) check(ctx context.Context, tx TxRepo, in Input, excludeID int) error {
	if !in.EndAt.After(in.StartAt) || in.Guests < 1 {
		return ErrInvalidInput
	}

	if in.StartAt.Before(svc.now()) {
		return ErrStartInPast
	}

	info := tx.Restaurant()
	if !withinOpeningHours(info, in.StartAt, in.EndAt) {
		return ErrOutsideOpeningHours
	}

	others, err := tx.Overlapping(ctx, in.StartAt, in.EndAt, excludeID)
	if err != nil {
		return err
	}
	if PeakGuests(others, Booking{Start: in.StartAt, End: in.EndAt, Guests: in.Guests}) > info.Capacity {
		return ErrCapacityExceeded
	}

	return nil
}

// withinOpeningHours converts to Bangkok time first (clients may send any offset, such as UTC),
// then requires one local day on which the restaurant is open for the whole span.
func withinOpeningHours(info RestaurantInfo, start, end time.Time) bool {
	localStart, localEnd := start.In(bangkok), end.In(bangkok)

	if localStart.Year() != localEnd.Year() || localStart.YearDay() != localEnd.YearDay() {
		return false
	}

	hours, open := info.Hours[int(localStart.Weekday())]
	if !open {
		return false
	}

	return timeOfDayOf(localStart) >= hours.Open && timeOfDayOf(localEnd) <= hours.Close
}

func timeOfDayOf(moment time.Time) time.Duration {
	return time.Duration(moment.Hour())*time.Hour +
		time.Duration(moment.Minute())*time.Minute +
		time.Duration(moment.Second())*time.Second +
		time.Duration(moment.Nanosecond())
}
