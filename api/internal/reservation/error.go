package reservation

import "errors"

var (
	ErrRestaurantNotFound  = errors.New("restaurant not found")
	ErrInvalidInput        = errors.New("invalid reservation input")
	ErrStartInPast         = errors.New("reservation starts in the past")
	ErrOutsideOpeningHours = errors.New("reservation is outside opening hours")
	ErrCapacityExceeded    = errors.New("restaurant capacity exceeded")
)
