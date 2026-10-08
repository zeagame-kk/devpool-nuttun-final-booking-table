package reservation

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *repository {
	return &repository{db: db}
}

// viewQuery selects reservations with their restaurant's and booker's names. A plain JOIN on
// the table does not apply the soft-delete filter, which is what we want: a deleted restaurant
// keeps its name here. Only the name of the booker is read, never the email.
func (repo *repository) viewQuery(ctx context.Context) *gorm.DB {
	return repo.db.WithContext(ctx).
		Table("reservations").
		Select("reservations.*, restaurants.name AS restaurant_name, COALESCE(users.name, '') AS customer_name").
		Joins("JOIN restaurants ON restaurants.id = reservations.restaurant_id").
		Joins("LEFT JOIN users ON users.id = reservations.user_id")
}

// RestaurantOwner returns who owns an active (not deleted) restaurant.
func (repo *repository) RestaurantOwner(ctx context.Context, restaurantID int) (uuid.UUID, error) {
	var owners []uuid.UUID
	if err := repo.db.WithContext(ctx).
		Table("restaurants").
		Where("id = ? AND deleted_at IS NULL", restaurantID).
		Pluck("owner_id", &owners).Error; err != nil {
		return uuid.Nil, fmt.Errorf("find owner of restaurant %d: %w", restaurantID, err)
	}
	if len(owners) == 0 {
		return uuid.Nil, ErrRestaurantNotFound
	}

	return owners[0], nil
}

// ListByRestaurant returns a restaurant's reservations, newest start first. An empty status
// means every status.
func (repo *repository) ListByRestaurant(ctx context.Context, restaurantID int, status string) ([]ReservationView, error) {
	query := repo.viewQuery(ctx).Where("reservations.restaurant_id = ?", restaurantID)
	if status != "" {
		query = query.Where("reservations.status = ?", status)
	}

	views := []ReservationView{}
	if err := query.Order("reservations.start_at DESC, reservations.id DESC").Scan(&views).Error; err != nil {
		return nil, fmt.Errorf("list reservations of restaurant %d: %w", restaurantID, err)
	}

	return views, nil
}

func (repo *repository) FindView(ctx context.Context, id int) (*ReservationView, error) {
	var views []ReservationView
	if err := repo.viewQuery(ctx).Where("reservations.id = ?", id).Scan(&views).Error; err != nil {
		return nil, fmt.Errorf("find reservation %d: %w", id, err)
	}
	if len(views) == 0 {
		return nil, ErrReservationNotFound
	}

	return &views[0], nil
}

// ListByUser returns every reservation the user has made, newest start first.
func (repo *repository) ListByUser(ctx context.Context, userID uuid.UUID) ([]ReservationView, error) {
	views := []ReservationView{}
	if err := repo.viewQuery(ctx).
		Where("reservations.user_id = ?", userID).
		Order("reservations.start_at DESC, reservations.id DESC").
		Scan(&views).Error; err != nil {
		return nil, fmt.Errorf("list reservations of user: %w", err)
	}

	return views, nil
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

	return timeOfDayOf(parsed), nil
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

// Reservation re-reads a reservation inside the transaction, so a status change made by
// someone who held the lock just before us is seen.
func (repo *txRepo) Reservation(ctx context.Context, id int) (*Reservation, error) {
	var reservation Reservation
	if err := repo.tx.WithContext(ctx).Where("restaurant_id = ?", repo.info.ID).First(&reservation, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrReservationNotFound
		}

		return nil, fmt.Errorf("read reservation %d: %w", id, err)
	}

	return &reservation, nil
}

func (repo *txRepo) Save(ctx context.Context, reservation Reservation) (*Reservation, error) {
	if err := repo.tx.WithContext(ctx).Save(&reservation).Error; err != nil {
		return nil, fmt.Errorf("update reservation %d: %w", reservation.ID, err)
	}

	return &reservation, nil
}

func (repo *txRepo) Create(ctx context.Context, reservation Reservation) (*Reservation, error) {
	if err := repo.tx.WithContext(ctx).Create(&reservation).Error; err != nil {
		return nil, fmt.Errorf("insert reservation: %w", err)
	}

	return &reservation, nil
}
