package restaurant

import (
	"time"

	"bookingtable/internal/user"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Restaurant struct {
	ID                      int `gorm:"primaryKey"`
	OwnerID                 uuid.UUID
	Owner                   user.User `gorm:"foreignKey:OwnerID;references:ID"`
	Name                    string
	Address                 string
	Description             *string
	ImageURL                *string
	SeatingCapacity         int
	CancellationLeadMinutes int
	OpeningHours            []OpeningHour `gorm:"foreignKey:RestaurantID"`
	// Filled from the reviews table by the repository; they have no column here.
	AverageRating float64   `gorm:"-"`
	ReviewCount   int64     `gorm:"-"`
	MyReview      *MyReview `gorm:"-"`
	CreatedAt     time.Time
	UpdatedAt     time.Time
	DeletedAt     gorm.DeletedAt
}

// OpeningHour is one open weekday (0 = Sunday ... 6 = Saturday). Times are "HH:MM" on input
// and whatever PostgreSQL returns for a TIME column ("HH:MM:SS") when read.
type OpeningHour struct {
	RestaurantID int `gorm:"primaryKey"`
	Weekday      int `gorm:"primaryKey"`
	OpenTime     string
	CloseTime    string
}

func (OpeningHour) TableName() string { return "restaurant_opening_hours" }

// MyReview is the caller's own review of a restaurant, read straight from the reviews table.
type MyReview struct {
	ID      int
	Rating  int
	Comment string
}
