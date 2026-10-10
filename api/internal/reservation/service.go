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
	FindView(ctx context.Context, id int) (*ReservationView, error)
	ListByUser(ctx context.Context, userID uuid.UUID) ([]ReservationView, error)
	RestaurantOwner(ctx context.Context, restaurantID int) (uuid.UUID, error)
	ListByRestaurant(ctx context.Context, restaurantID int, status string) ([]ReservationView, error)
	Availability(ctx context.Context, restaurantID int, from, to time.Time) (RestaurantInfo, []Booking, error)
}

// TxRepo is the repository inside a transaction that holds the restaurant's row lock.
type TxRepo interface {
	Restaurant() RestaurantInfo
	Overlapping(ctx context.Context, start, end time.Time, excludeID int) ([]Booking, error)
	Create(ctx context.Context, reservation Reservation) (*Reservation, error)
	Reservation(ctx context.Context, id int) (*Reservation, error)
	Save(ctx context.Context, reservation Reservation) (*Reservation, error)
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

// Update moves or resizes a reservation. Only its booker may, only while it is still active and
// the cancellation lead time (counted from the original start) has not run out, and the new
// time must satisfy every booking rule again, not counting the seats this reservation holds now.
func (svc *service) Update(ctx context.Context, userID uuid.UUID, id int, in Input) (*ReservationView, error) {
	existing, err := svc.findOwned(ctx, userID, id)
	if err != nil {
		return nil, fmt.Errorf("update reservation: %w", err)
	}

	if err := svc.repository.InTx(ctx, existing.RestaurantID, func(tx TxRepo) error {
		current, err := tx.Reservation(ctx, id)
		if err != nil {
			return err
		}
		if err := svc.ensureChangeable(tx, *current, ErrTooLateToModify); err != nil {
			return err
		}
		if err := svc.check(ctx, tx, in, id); err != nil {
			return err
		}

		current.StartAt, current.EndAt, current.Guests = in.StartAt, in.EndAt, in.Guests
		_, err = tx.Save(ctx, *current)

		return err
	}); err != nil {
		return nil, fmt.Errorf("update reservation: %w", err)
	}

	view, err := svc.repository.FindView(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("update reservation: %w", err)
	}

	return view, nil
}

// Cancel marks a reservation cancelled, under the same rules as Update about who, when and how
// late. A cancelled reservation no longer counts towards capacity.
func (svc *service) Cancel(ctx context.Context, userID uuid.UUID, id int) error {
	existing, err := svc.findOwned(ctx, userID, id)
	if err != nil {
		return fmt.Errorf("cancel reservation: %w", err)
	}

	if err := svc.repository.InTx(ctx, existing.RestaurantID, func(tx TxRepo) error {
		current, err := tx.Reservation(ctx, id)
		if err != nil {
			return err
		}
		if err := svc.ensureChangeable(tx, *current, ErrTooLateToCancel); err != nil {
			return err
		}

		current.Status = StatusCancelled
		_, err = tx.Save(ctx, *current)

		return err
	}); err != nil {
		return fmt.Errorf("cancel reservation: %w", err)
	}

	return nil
}

func (svc *service) ListMine(ctx context.Context, userID uuid.UUID) ([]ReservationView, error) {
	views, err := svc.repository.ListByUser(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("list reservations: %w", err)
	}

	return views, nil
}

// ListForRestaurant is the owner's read-only view of who has booked. status is "", "confirmed"
// or "cancelled".
func (svc *service) ListForRestaurant(ctx context.Context, ownerID uuid.UUID, restaurantID int, status string) ([]ReservationView, error) {
	if status != "" && status != StatusConfirmed && status != StatusCancelled {
		return nil, fmt.Errorf("list reservations of restaurant: %w", ErrInvalidInput)
	}

	actualOwner, err := svc.repository.RestaurantOwner(ctx, restaurantID)
	if err != nil {
		return nil, fmt.Errorf("list reservations of restaurant: %w", err)
	}
	if actualOwner != ownerID {
		return nil, fmt.Errorf("list reservations of restaurant: %w", ErrForbidden)
	}

	views, err := svc.repository.ListByRestaurant(ctx, restaurantID, status)
	if err != nil {
		return nil, fmt.Errorf("list reservations of restaurant: %w", err)
	}

	return views, nil
}

// Availability shows, for each hour the restaurant is open on date (YYYY-MM-DD, Bangkok), the most
// guests that will be present at once and how many seats that leaves. It reads without the
// restaurant lock, so it can be a moment out of date; booking still re-checks under the lock.
func (svc *service) Availability(ctx context.Context, restaurantID int, date string) (*DayAvailability, error) {
	day, err := time.ParseInLocation("2006-01-02", date, bangkok)
	if err != nil {
		return nil, fmt.Errorf("availability: %w", ErrInvalidInput)
	}

	info, bookings, err := svc.repository.Availability(ctx, restaurantID, day, day.AddDate(0, 0, 1))
	if err != nil {
		return nil, fmt.Errorf("availability: %w", err)
	}

	result := &DayAvailability{Date: date, Capacity: info.Capacity, Slots: []Slot{}}

	hours, open := info.Hours[int(day.Weekday())]
	if !open {
		result.Closed = true
		return result, nil
	}

	for _, hour := range hourlySlots(day, hours) {
		booked := PeakGuests(bookings, hour)
		result.Slots = append(result.Slots, Slot{
			Start:          hour.Start,
			End:            hour.End,
			BookedGuests:   booked,
			RemainingSeats: max(info.Capacity-booked, 0),
		})
	}

	return result, nil
}

// hourlySlots cuts the opening hours of the local day starting at midnight into one-hour
// intervals counted from opening time; the last one ends at closing time, so it may be shorter.
// Each comes back as a Booking of no guests, ready to be measured with PeakGuests.
func hourlySlots(midnight time.Time, hours DayHours) []Booking {
	slots := []Booking{}
	for start := hours.Open; start < hours.Close; start += time.Hour {
		end := min(start+time.Hour, hours.Close)
		slots = append(slots, Booking{Start: midnight.Add(start), End: midnight.Add(end)})
	}

	return slots
}

// findOwned loads a reservation and checks it belongs to userID. Whether it may still be
// changed is decided later, inside the transaction, from fresh data.
func (svc *service) findOwned(ctx context.Context, userID uuid.UUID, id int) (*ReservationView, error) {
	view, err := svc.repository.FindView(ctx, id)
	if err != nil {
		return nil, err
	}

	if view.UserID != userID {
		return nil, ErrForbidden
	}

	return view, nil
}

// ensureChangeable is the one rule behind both modifying and cancelling: the reservation must
// be confirmed and not started, and its original start must be at least the restaurant's lead
// time away. tooLate says which error to report when that last part fails.
func (svc *service) ensureChangeable(tx TxRepo, current Reservation, tooLate error) error {
	now := svc.now()

	if current.Status != StatusConfirmed || !current.StartAt.After(now) {
		return ErrNotActive
	}

	if !leadTimeOK(current.StartAt, now, tx.Restaurant().LeadMinutes) {
		return tooLate
	}

	return nil
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
