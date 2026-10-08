package restaurant

import (
	"errors"
	"fmt"
)

var (
	ErrRestaurantNotFound = errors.New("restaurant not found")
	ErrForbidden          = errors.New("restaurant access forbidden")
	ErrInvalidInput       = errors.New("invalid restaurant input")
	// ErrInvalidImage is a missing, empty, oversized or unsupported picture.
	ErrInvalidImage = errors.New("invalid restaurant image")
	// ErrHasActiveReservations stops a delete while customers still hold confirmed bookings.
	ErrHasActiveReservations = errors.New("restaurant has active reservations")
	// ErrInvalidOpeningHours is a kind of ErrInvalidInput, so callers map one error to 400.
	ErrInvalidOpeningHours = fmt.Errorf("opening hours: %w", ErrInvalidInput)
)
