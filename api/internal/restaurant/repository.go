package restaurant

import (
	"context"
	"errors"
	"fmt"
	"strings"

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

func (repo *repository) Create(ctx context.Context, restaurant Restaurant) (*Restaurant, error) {
	hours := restaurant.OpeningHours

	if err := repo.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Omit(clause.Associations).Create(&restaurant).Error; err != nil {
			return err
		}

		return insertOpeningHours(tx, restaurant.ID, hours)
	}); err != nil {
		return nil, fmt.Errorf("insert restaurant: %w", err)
	}

	return &restaurant, nil
}

// listStats is one row of the list query: which restaurant, and its review totals.
type listStats struct {
	ID            int
	AverageRating float64
	ReviewCount   int64
}

// List returns one page of active restaurants plus the total count. The page is chosen with
// a query that joins the review totals (so it can sort by them); the full rows are then
// loaded by id and put back in that order.
func (repo *repository) List(ctx context.Context, viewerID uuid.UUID, query ListQuery) ([]Restaurant, int64, error) {
	db := repo.db.WithContext(ctx).Model(&Restaurant{}).
		Joins("LEFT JOIN (SELECT restaurant_id, AVG(rating) AS avg_rating, COUNT(*) AS review_count FROM reviews GROUP BY restaurant_id) rs ON rs.restaurant_id = restaurants.id")

	if name := strings.TrimSpace(query.Name); name != "" {
		db = db.Where(`restaurants.name ILIKE ? ESCAPE '\'`, "%"+escapeLike(name)+"%")
	}
	if query.Mine != nil && *query.Mine {
		db = db.Where("restaurants.owner_id = ?", viewerID)
	}

	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("count restaurants: %w", err)
	}

	var page []listStats
	if err := db.
		Select("restaurants.id AS id, COALESCE(rs.avg_rating, 0) AS average_rating, COALESCE(rs.review_count, 0) AS review_count").
		Order(orderBy(query.Sort)).
		Offset((query.Page - 1) * query.Limit).
		Limit(query.Limit).
		Scan(&page).Error; err != nil {
		return nil, 0, fmt.Errorf("select restaurant page: %w", err)
	}
	if len(page) == 0 {
		return []Restaurant{}, total, nil
	}

	pageIDs := make([]int, len(page))
	for index, row := range page {
		pageIDs[index] = row.ID
	}

	var loaded []Restaurant
	if err := repo.db.WithContext(ctx).Preload("Owner").Where("id IN ?", pageIDs).Find(&loaded).Error; err != nil {
		return nil, 0, fmt.Errorf("load restaurants: %w", err)
	}
	byID := make(map[int]Restaurant, len(loaded))
	for _, restaurant := range loaded {
		byID[restaurant.ID] = restaurant
	}

	restaurants := make([]Restaurant, 0, len(page))
	for _, row := range page {
		restaurant, ok := byID[row.ID]
		if !ok {
			continue
		}
		restaurant.AverageRating = row.AverageRating
		restaurant.ReviewCount = row.ReviewCount
		restaurants = append(restaurants, restaurant)
	}

	return restaurants, total, nil
}

// likeEscaper makes a search term literal: without it a typed % or _ would act as a wildcard.
var likeEscaper = strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`)

func escapeLike(term string) string { return likeEscaper.Replace(term) }

// orderBy maps the sort option to an ORDER BY. Ties always fall back to the id so pages are stable.
func orderBy(sort string) string {
	switch sort {
	case SortRating:
		return "COALESCE(rs.avg_rating, 0) DESC, restaurants.id ASC"
	case SortReviews:
		return "COALESCE(rs.review_count, 0) DESC, restaurants.id ASC"
	default:
		return "restaurants.created_at DESC, restaurants.id ASC"
	}
}

// Replace overwrites the editable columns and swaps the whole opening-hours set in one
// transaction. The image is not editable here, and the owner never changes.
func (repo *repository) Replace(ctx context.Context, restaurant Restaurant) error {
	if err := repo.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		result := tx.Model(&Restaurant{}).
			Where("id = ?", restaurant.ID).
			Select("Name", "Address", "Description", "SeatingCapacity", "CancellationLeadMinutes").
			Updates(restaurant)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return ErrRestaurantNotFound
		}

		if err := tx.Where("restaurant_id = ?", restaurant.ID).Delete(&OpeningHour{}).Error; err != nil {
			return err
		}

		return insertOpeningHours(tx, restaurant.ID, restaurant.OpeningHours)
	}); err != nil {
		if errors.Is(err, ErrRestaurantNotFound) {
			return err
		}

		return fmt.Errorf("update restaurant %d: %w", restaurant.ID, err)
	}

	return nil
}

// Delete soft-deletes the restaurant; its opening hours stay so nothing dangles.
func (repo *repository) Delete(ctx context.Context, id int) error {
	result := repo.db.WithContext(ctx).Delete(&Restaurant{}, id)
	if result.Error != nil {
		return fmt.Errorf("soft-delete restaurant %d: %w", id, result.Error)
	}
	if result.RowsAffected == 0 {
		return ErrRestaurantNotFound
	}

	return nil
}

// FindByID loads one active restaurant with its owner, opening hours, review totals and the
// viewer's own review.
func (repo *repository) FindByID(ctx context.Context, id int, viewerID uuid.UUID) (*Restaurant, error) {
	db := repo.db.WithContext(ctx)

	var restaurant Restaurant
	if err := db.
		Preload("Owner").
		Preload("OpeningHours", func(db *gorm.DB) *gorm.DB { return db.Order("weekday") }).
		First(&restaurant, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrRestaurantNotFound
		}

		return nil, fmt.Errorf("find restaurant %d: %w", id, err)
	}

	var totals struct {
		Average float64
		Total   int64
	}
	if err := db.Table("reviews").
		Select("COALESCE(AVG(rating), 0) AS average, COUNT(*) AS total").
		Where("restaurant_id = ?", id).
		Scan(&totals).Error; err != nil {
		return nil, fmt.Errorf("sum reviews of restaurant %d: %w", id, err)
	}
	restaurant.AverageRating = totals.Average
	restaurant.ReviewCount = totals.Total

	var mine MyReview
	result := db.Table("reviews").
		Select("id, rating, comment").
		Where("restaurant_id = ? AND user_id = ?", id, viewerID).
		Limit(1).
		Scan(&mine)
	if result.Error != nil {
		return nil, fmt.Errorf("find review of restaurant %d: %w", id, result.Error)
	}
	if result.RowsAffected > 0 {
		restaurant.MyReview = &mine
	}

	return &restaurant, nil
}

func insertOpeningHours(tx *gorm.DB, restaurantID int, hours []OpeningHour) error {
	if len(hours) == 0 {
		return nil
	}

	rows := make([]OpeningHour, len(hours))
	for index, hour := range hours {
		hour.RestaurantID = restaurantID
		rows[index] = hour
	}

	return tx.Create(&rows).Error
}
