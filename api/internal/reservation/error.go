package reservation

import "errors"

var (
	ErrRestaurantNotFound  = errors.New("restaurant not found")
	ErrReservationNotFound = errors.New("reservation not found")
	ErrForbidden           = errors.New("reservation access forbidden")
	ErrInvalidInput        = errors.New("invalid reservation input")
	ErrStartInPast         = errors.New("reservation starts in the past")
	ErrOutsideOpeningHours = errors.New("reservation is outside opening hours")
	ErrCapacityExceeded    = errors.New("restaurant capacity exceeded")
	ErrNotActive           = errors.New("reservation is cancelled or has already started")
	ErrTooLateToCancel     = errors.New("too late to cancel this reservation")
	ErrTooLateToModify     = errors.New("too late to modify this reservation")
)
