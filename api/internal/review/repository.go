package review

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
	"gorm.io/gorm"
)

// uniqueViolation is PostgreSQL's error code for a duplicate key.
const uniqueViolation = "23505"

type repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *repository {
	return &repository{db: db}
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

// Create inserts a review. The unique key on (user, restaurant) is what keeps it to one per
// customer, so two simultaneous attempts cannot both succeed; the loser gets ErrAlreadyReviewed.
func (repo *repository) Create(ctx context.Context, review Review) (*Review, error) {
	if err := repo.db.WithContext(ctx).Create(&review).Error; err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == uniqueViolation {
			return nil, ErrAlreadyReviewed
		}

		return nil, fmt.Errorf("insert review: %w", err)
	}

	return &review, nil
}

// UpdateMine changes the caller's own review of a restaurant.
func (repo *repository) UpdateMine(ctx context.Context, restaurantID int, userID uuid.UUID, rating int, comment string) error {
	result := repo.db.WithContext(ctx).
		Model(&Review{}).
		Where("restaurant_id = ? AND user_id = ?", restaurantID, userID).
		Select("Rating", "Comment").
		Updates(Review{Rating: rating, Comment: comment})
	if result.Error != nil {
		return fmt.Errorf("update review: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return ErrReviewNotFound
	}

	return nil
}

func (repo *repository) viewQuery(ctx context.Context) *gorm.DB {
	return repo.db.WithContext(ctx).
		Table("reviews").
		Select("reviews.*, COALESCE(users.name, '') AS user_name").
		Joins("LEFT JOIN users ON users.id = reviews.user_id")
}

func (repo *repository) FindMine(ctx context.Context, restaurantID int, userID uuid.UUID) (*ReviewView, error) {
	var views []ReviewView
	if err := repo.viewQuery(ctx).
		Where("reviews.restaurant_id = ? AND reviews.user_id = ?", restaurantID, userID).
		Scan(&views).Error; err != nil {
		return nil, fmt.Errorf("find review: %w", err)
	}
	if len(views) == 0 {
		return nil, ErrReviewNotFound
	}

	return &views[0], nil
}

// ListByRestaurant returns every review of a restaurant, newest first.
func (repo *repository) ListByRestaurant(ctx context.Context, restaurantID int) ([]ReviewView, error) {
	views := []ReviewView{}
	if err := repo.viewQuery(ctx).
		Where("reviews.restaurant_id = ?", restaurantID).
		Order("reviews.created_at DESC, reviews.id DESC").
		Scan(&views).Error; err != nil {
		return nil, fmt.Errorf("list reviews of restaurant %d: %w", restaurantID, err)
	}

	return views, nil
}

// ListByUser returns every review the user wrote, the most recently edited first. Reviews of
// restaurants that have since been deleted are left out: there is nowhere left to open them.
func (repo *repository) ListByUser(ctx context.Context, userID uuid.UUID) ([]MyReviewView, error) {
	views := []MyReviewView{}
	if err := repo.db.WithContext(ctx).
		Table("reviews").
		Select("reviews.*, restaurants.name AS restaurant_name").
		Joins("JOIN restaurants ON restaurants.id = reviews.restaurant_id AND restaurants.deleted_at IS NULL").
		Where("reviews.user_id = ?", userID).
		Order("reviews.updated_at DESC, reviews.id DESC").
		Scan(&views).Error; err != nil {
		return nil, fmt.Errorf("list reviews of user: %w", err)
	}

	return views, nil
}
