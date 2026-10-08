package review

import "errors"

var (
	ErrRestaurantNotFound = errors.New("restaurant not found")
	ErrReviewNotFound     = errors.New("review not found")
	ErrOwnRestaurant      = errors.New("owners cannot review their own restaurant")
	ErrAlreadyReviewed    = errors.New("restaurant already reviewed by this user")
	ErrInvalidInput       = errors.New("invalid review input")
)
