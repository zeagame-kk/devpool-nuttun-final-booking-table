package review

import (
	"time"

	"github.com/google/uuid"
)

// Review is one customer's opinion of one restaurant. The database allows one per pair.
type Review struct {
	ID           int `gorm:"primaryKey"`
	RestaurantID int
	UserID       uuid.UUID
	Rating       int
	Comment      string
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

// ReviewView is a review joined with the reviewer's name (never the email).
type ReviewView struct {
	Review
	UserName string
}

// MyReviewView is one of the caller's own reviews with the name of the restaurant it is about.
type MyReviewView struct {
	Review
	RestaurantName     string
	RestaurantImageURL *string
}
