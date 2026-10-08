package restaurant

import (
	"context"
	"fmt"
	"regexp"
	"strings"

	"github.com/google/uuid"
)

type Repository interface {
	Create(ctx context.Context, restaurant Restaurant) (*Restaurant, error)
	FindByID(ctx context.Context, id int, viewerID uuid.UUID) (*Restaurant, error)
	Replace(ctx context.Context, restaurant Restaurant) error
	Delete(ctx context.Context, id int) error
	List(ctx context.Context, viewerID uuid.UUID, query ListQuery) ([]Restaurant, int64, error)
}

type service struct {
	repository Repository
}

func NewService(repo Repository) *service {
	return &service{repository: repo}
}

func (svc *service) Create(ctx context.Context, ownerID uuid.UUID, restaurant Restaurant) (*Restaurant, error) {
	if err := validate(restaurant); err != nil {
		return nil, err
	}

	restaurant.OwnerID = ownerID

	return svc.repository.Create(ctx, restaurant)
}

func (svc *service) List(ctx context.Context, viewerID uuid.UUID, query ListQuery) ([]Restaurant, int64, error) {
	query.Ensure()

	restaurants, total, err := svc.repository.List(ctx, viewerID, query)
	if err != nil {
		return nil, 0, fmt.Errorf("list restaurants: %w", err)
	}

	return restaurants, total, nil
}

func (svc *service) Get(ctx context.Context, id int, viewerID uuid.UUID) (*Restaurant, error) {
	restaurant, err := svc.repository.FindByID(ctx, id, viewerID)
	if err != nil {
		return nil, fmt.Errorf("get restaurant: %w", err)
	}

	return restaurant, nil
}

func (svc *service) Replace(ctx context.Context, id int, userID uuid.UUID, restaurant Restaurant) (*Restaurant, error) {
	existing, err := svc.repository.FindByID(ctx, id, userID)
	if err != nil {
		return nil, fmt.Errorf("replace restaurant: %w", err)
	}

	if existing.OwnerID != userID {
		return nil, ErrForbidden
	}

	if err := validate(restaurant); err != nil {
		return nil, err
	}

	restaurant.ID = id
	if err := svc.repository.Replace(ctx, restaurant); err != nil {
		return nil, err
	}

	return svc.repository.FindByID(ctx, id, userID)
}

func (svc *service) Delete(ctx context.Context, id int, userID uuid.UUID) error {
	existing, err := svc.repository.FindByID(ctx, id, userID)
	if err != nil {
		return fmt.Errorf("delete restaurant: %w", err)
	}

	if existing.OwnerID != userID {
		return ErrForbidden
	}

	return svc.repository.Delete(ctx, id)
}

// validate holds the rules the binding tags cannot express.
func validate(restaurant Restaurant) error {
	if strings.TrimSpace(restaurant.Name) == "" || strings.TrimSpace(restaurant.Address) == "" {
		return ErrInvalidInput
	}

	return validateOpeningHours(restaurant.OpeningHours)
}

var clockPattern = regexp.MustCompile(`^([01]\d|2[0-3]):[0-5]\d$`)

// validateOpeningHours requires at least one day, one entry per weekday, "HH:MM" times and
// close after open. Zero-padded "HH:MM" strings compare correctly as text.
func validateOpeningHours(hours []OpeningHour) error {
	if len(hours) == 0 {
		return ErrInvalidOpeningHours
	}

	seen := make(map[int]bool, len(hours))
	for _, hour := range hours {
		if hour.Weekday < 0 || hour.Weekday > 6 || seen[hour.Weekday] {
			return ErrInvalidOpeningHours
		}
		seen[hour.Weekday] = true

		if !clockPattern.MatchString(hour.OpenTime) || !clockPattern.MatchString(hour.CloseTime) {
			return ErrInvalidOpeningHours
		}
		if hour.CloseTime <= hour.OpenTime {
			return ErrInvalidOpeningHours
		}
	}

	return nil
}
