package restaurant

import (
	"errors"
	"fmt"
)

var (
	ErrRestaurantNotFound = errors.New("restaurant not found")
	ErrForbidden          = errors.New("restaurant access forbidden")
	ErrInvalidInput       = errors.New("invalid restaurant input")
	// ErrInvalidOpeningHours is a kind of ErrInvalidInput, so callers map one error to 400.
	ErrInvalidOpeningHours = fmt.Errorf("opening hours: %w", ErrInvalidInput)
)
