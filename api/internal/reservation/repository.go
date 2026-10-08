package reservation

import (
	"context"
	"fmt"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *repository {
	return &repository{db: db}
}

// InTx runs fn in one transaction that holds a row lock on the restaurant. Every change to a
// restaurant's reservations goes through here, so they are applied one at a time per
// restaurant: whatever fn reads, no other booking can slip in before it commits. The
// capacity and opening hours handed to fn are read after the lock is held.
func (repo *repository) InTx(ctx context.Context, restaurantID int, fn func(tx TxRepo) error) error {
	return repo.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		info, err := lockRestaurant(tx, restaurantID)
		if err != nil {
			return err
		}

		return fn(&txRepo{tx: tx, info: info})
	})
}

func lockRestaurant(tx *gorm.DB, restaurantID int) (RestaurantInfo, error) {
	var row struct {
		SeatingCapacity         int
		CancellationLeadMinutes int
	}
	result := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		Table("restaurants").
		Select("seating_capacity, cancellation_lead_minutes").
		Where("id = ? AND deleted_at IS NULL", restaurantID).
		Limit(1).
		Scan(&row)
	if result.Error != nil {
		return RestaurantInfo{}, fmt.Errorf("lock restaurant %d: %w", restaurantID, result.Error)
	}
	if result.RowsAffected == 0 {
		return RestaurantInfo{}, ErrRestaurantNotFound
	}

	var hourRows []struct {
		Weekday   int
		OpenTime  string
		CloseTime string
	}
	if err := tx.Table("restaurant_opening_hours").
		Select("weekday, open_time, close_time").
		Where("restaurant_id = ?", restaurantID).
		Scan(&hourRows).Error; err != nil {
		return RestaurantInfo{}, fmt.Errorf("read opening hours of restaurant %d: %w", restaurantID, err)
	}

	hours := make(map[int]DayHours, len(hourRows))
	for _, hour := range hourRows {
		open, err := timeOfDay(hour.OpenTime)
		if err != nil {
			return RestaurantInfo{}, err
		}
		closing, err := timeOfDay(hour.CloseTime)
		if err != nil {
			return RestaurantInfo{}, err
		}
		hours[hour.Weekday] = DayHours{Open: open, Close: closing}
	}

	return RestaurantInfo{
		ID:          restaurantID,
		Capacity:    row.SeatingCapacity,
		LeadMinutes: row.CancellationLeadMinutes,
		Hours:       hours,
	}, nil
}

// timeOfDay turns a PostgreSQL TIME ("11:00:00") into an offset from midnight.
func timeOfDay(value string) (time.Duration, error) {
	parsed, err := time.Parse("15:04:05", value)
	if err != nil {
		return 0, fmt.Errorf("parse time of day %q: %w", value, err)
	}

	return time.Duration(parsed.Hour())*time.Hour +
		time.Duration(parsed.Minute())*time.Minute +
		time.Duration(parsed.Second())*time.Second, nil
}

// txRepo is the repository as seen inside InTx: it works on the locked restaurant.
type txRepo struct {
	tx   *gorm.DB
	info RestaurantInfo
}

func (repo *txRepo) Restaurant() RestaurantInfo { return repo.info }

// Overlapping returns the confirmed bookings that intersect [start, end), leaving out
// excludeID (0 excludes nothing) so that changing a reservation does not count its old seats.
func (repo *txRepo) Overlapping(ctx context.Context, start, end time.Time, excludeID int) ([]Booking, error) {
	var rows []Reservation
	if err := repo.tx.WithContext(ctx).
		Where("restaurant_id = ? AND status = ? AND start_at < ? AND end_at > ? AND id <> ?",
			repo.info.ID, StatusConfirmed, end, start, excludeID).
		Find(&rows).Error; err != nil {
		return nil, fmt.Errorf("find overlapping reservations: %w", err)
	}

	bookings := make([]Booking, len(rows))
	for index, row := range rows {
		bookings[index] = Booking{Start: row.StartAt, End: row.EndAt, Guests: row.Guests}
	}

	return bookings, nil
}

func (repo *txRepo) Create(ctx context.Context, reservation Reservation) (*Reservation, error) {
	if err := repo.tx.WithContext(ctx).Create(&reservation).Error; err != nil {
		return nil, fmt.Errorf("insert reservation: %w", err)
	}

	return &reservation, nil
}
