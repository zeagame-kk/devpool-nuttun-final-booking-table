package restaurant

import "errors"

var (
	ErrRestaurantNotFound  = errors.New("restaurant not found")
	ErrForbidden           = errors.New("restaurant access forbidden")
	ErrInvalidInput        = errors.New("invalid restaurant input")
	ErrInvalidOpeningHours = errors.New("invalid opening hours")
)
