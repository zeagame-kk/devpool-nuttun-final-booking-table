package restaurant

import (
	"context"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"
)

type Repository interface {
	Create(ctx context.Context, restaurant Restaurant) (*Restaurant, error)
	FindByID(ctx context.Context, id int, viewerID uuid.UUID) (*Restaurant, error)
	Replace(ctx context.Context, restaurant Restaurant) error
	DeleteIfNoActiveReservations(ctx context.Context, id int, now time.Time) error
	List(ctx context.Context, viewerID uuid.UUID, query ListQuery) ([]Restaurant, int64, error)
}

type service struct {
	repository Repository
	now        func() time.Time
}

func NewService(repo Repository, now func() time.Time) *service {
	return &service{repository: repo, now: now}
}

func (svc *service) Create(ctx context.Context, ownerID uuid.UUID, restaurant Restaurant) (*Restaurant, error) {
	if err := validate(restaurant); err != nil {
		return nil, err
	}

	restaurant.OwnerID = ownerID

	created, err := svc.repository.Create(ctx, restaurant)
	if err != nil {
		return nil, fmt.Errorf("create restaurant: %w", err)
	}

	return created, nil
}

func (svc *service) List(ctx context.Context, viewerID uuid.UUID, query ListQuery) ([]Restaurant, int64, error) {
	if hasNUL(query.Name) {
		return nil, 0, ErrInvalidInput
	}

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
	if _, err := svc.findOwned(ctx, id, userID); err != nil {
		return nil, fmt.Errorf("replace restaurant: %w", err)
	}

	if err := validate(restaurant); err != nil {
		return nil, err
	}

	restaurant.ID = id
	if err := svc.repository.Replace(ctx, restaurant); err != nil {
		return nil, fmt.Errorf("replace restaurant: %w", err)
	}

	replaced, err := svc.repository.FindByID(ctx, id, userID)
	if err != nil {
		return nil, fmt.Errorf("replace restaurant: %w", err)
	}

	return replaced, nil
}

func (svc *service) Delete(ctx context.Context, id int, userID uuid.UUID) error {
	if _, err := svc.findOwned(ctx, id, userID); err != nil {
		return fmt.Errorf("delete restaurant: %w", err)
	}

	if err := svc.repository.DeleteIfNoActiveReservations(ctx, id, svc.now()); err != nil {
		return fmt.Errorf("delete restaurant: %w", err)
	}

	return nil
}

// findOwned loads an active restaurant and checks that userID owns it: ErrRestaurantNotFound
// if there is none, ErrForbidden if it belongs to someone else.
func (svc *service) findOwned(ctx context.Context, id int, userID uuid.UUID) (*Restaurant, error) {
	restaurant, err := svc.repository.FindByID(ctx, id, userID)
	if err != nil {
		return nil, err
	}

	if restaurant.OwnerID != userID {
		return nil, ErrForbidden
	}

	return restaurant, nil
}

// validate holds the rules the binding tags cannot express. PostgreSQL text cannot contain a
// NUL byte, so one in any text field would otherwise surface as a 500.
func validate(restaurant Restaurant) error {
	if strings.TrimSpace(restaurant.Name) == "" || strings.TrimSpace(restaurant.Address) == "" {
		return ErrInvalidInput
	}

	if hasNUL(restaurant.Name) || hasNUL(restaurant.Address) {
		return ErrInvalidInput
	}
	if restaurant.Description != nil && hasNUL(*restaurant.Description) {
		return ErrInvalidInput
	}

	return validateOpeningHours(restaurant.OpeningHours)
}

func hasNUL(text string) bool { return strings.ContainsRune(text, 0) }

var hhmmPattern = regexp.MustCompile(`^([01]\d|2[0-3]):[0-5]\d$`)

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

		if !hhmmPattern.MatchString(hour.OpenTime) || !hhmmPattern.MatchString(hour.CloseTime) {
			return ErrInvalidOpeningHours
		}
		if hour.CloseTime <= hour.OpenTime {
			return ErrInvalidOpeningHours
		}
	}

	return nil
}
