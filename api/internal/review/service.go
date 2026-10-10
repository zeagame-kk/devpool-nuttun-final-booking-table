package review

import (
	"context"
	"fmt"
	"strings"

	"github.com/google/uuid"
)

type Repository interface {
	RestaurantOwner(ctx context.Context, restaurantID int) (uuid.UUID, error)
	Create(ctx context.Context, review Review) (*Review, error)
	UpdateMine(ctx context.Context, restaurantID int, userID uuid.UUID, rating int, comment string) error
	FindMine(ctx context.Context, restaurantID int, userID uuid.UUID) (*ReviewView, error)
	ListByRestaurant(ctx context.Context, restaurantID int) ([]ReviewView, error)
	ListByUser(ctx context.Context, userID uuid.UUID) ([]MyReviewView, error)
}

type service struct {
	repository Repository
}

func NewService(repo Repository) *service {
	return &service{repository: repo}
}

// Create records the caller's review. Owners may not review their own restaurant, and nobody
// may review the same restaurant twice. A reservation is not required.
func (svc *service) Create(ctx context.Context, userID uuid.UUID, restaurantID int, rating int, comment string) (*Review, error) {
	if err := validateComment(comment); err != nil {
		return nil, err
	}

	owner, err := svc.repository.RestaurantOwner(ctx, restaurantID)
	if err != nil {
		return nil, fmt.Errorf("create review: %w", err)
	}
	if owner == userID {
		return nil, ErrOwnRestaurant
	}

	created, err := svc.repository.Create(ctx, Review{
		RestaurantID: restaurantID,
		UserID:       userID,
		Rating:       rating,
		Comment:      comment,
	})
	if err != nil {
		return nil, fmt.Errorf("create review: %w", err)
	}

	return created, nil
}

// UpdateMine changes the caller's existing review of the restaurant.
func (svc *service) UpdateMine(ctx context.Context, userID uuid.UUID, restaurantID int, rating int, comment string) (*ReviewView, error) {
	if err := validateComment(comment); err != nil {
		return nil, err
	}

	if _, err := svc.repository.RestaurantOwner(ctx, restaurantID); err != nil {
		return nil, fmt.Errorf("update review: %w", err)
	}

	if err := svc.repository.UpdateMine(ctx, restaurantID, userID, rating, comment); err != nil {
		return nil, fmt.Errorf("update review: %w", err)
	}

	view, err := svc.repository.FindMine(ctx, restaurantID, userID)
	if err != nil {
		return nil, fmt.Errorf("update review: %w", err)
	}

	return view, nil
}

func (svc *service) List(ctx context.Context, restaurantID int) ([]ReviewView, error) {
	if _, err := svc.repository.RestaurantOwner(ctx, restaurantID); err != nil {
		return nil, fmt.Errorf("list reviews: %w", err)
	}

	views, err := svc.repository.ListByRestaurant(ctx, restaurantID)
	if err != nil {
		return nil, fmt.Errorf("list reviews: %w", err)
	}

	return views, nil
}

// ListMine returns every review the caller wrote, across restaurants.
func (svc *service) ListMine(ctx context.Context, userID uuid.UUID) ([]MyReviewView, error) {
	views, err := svc.repository.ListByUser(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("list my reviews: %w", err)
	}

	return views, nil
}

// validateComment adds what the binding tag cannot: the text must hold something besides
// whitespace, and PostgreSQL text cannot contain a NUL byte.
func validateComment(comment string) error {
	if strings.TrimSpace(comment) == "" || strings.ContainsRune(comment, 0) {
		return fmt.Errorf("comment: %w", ErrInvalidInput)
	}

	return nil
}
