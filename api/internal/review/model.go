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
