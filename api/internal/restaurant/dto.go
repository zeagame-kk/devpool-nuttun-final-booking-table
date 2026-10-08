package restaurant

import (
	"math"

	"bookingtable/internal/convutil"
	"bookingtable/internal/httputil"

	"github.com/google/uuid"
)

// SaveRestaurantRequest is the body of both POST and PUT: PUT replaces the whole restaurant.
// Owner and image are deliberately absent: the owner comes from the token and the image is
// only set through the upload endpoint.
type SaveRestaurantRequest struct {
	Name                    string               `json:"name" binding:"required,max=255"`
	Address                 string               `json:"address" binding:"required"`
	Description             *string              `json:"description"`
	SeatingCapacity         int                  `json:"seatingCapacity" binding:"required,min=1,max=2147483647"`
	CancellationLeadMinutes int                  `json:"cancellationLeadMinutes" binding:"required,min=30,max=2147483647"`
	OpeningHours            []OpeningHourRequest `json:"openingHours" binding:"required,min=1,dive"`
}

// OpeningHourRequest uses a pointer for weekday: 0 (Sunday) is a valid value that
// `required` would reject on a plain int.
type OpeningHourRequest struct {
	Weekday *int   `json:"weekday" binding:"required,min=0,max=6"`
	Open    string `json:"open" binding:"required"`
	Close   string `json:"close" binding:"required"`
}

func (req SaveRestaurantRequest) ToRestaurant() Restaurant {
	hours := make([]OpeningHour, len(req.OpeningHours))
	for index, hour := range req.OpeningHours {
		hours[index] = OpeningHour{Weekday: *hour.Weekday, OpenTime: hour.Open, CloseTime: hour.Close}
	}

	return Restaurant{
		Name:                    req.Name,
		Address:                 req.Address,
		Description:             req.Description,
		SeatingCapacity:         req.SeatingCapacity,
		CancellationLeadMinutes: req.CancellationLeadMinutes,
		OpeningHours:            hours,
	}
}

// Pagination follows the recipe convention: page defaults to 1, limit to 12 (at most 100).
// Page is capped so the SQL offset (page-1)*limit cannot overflow.
type Pagination struct {
	Page  int `form:"page" binding:"omitempty,min=1,max=1000000"`
	Limit int `form:"limit" binding:"omitempty,min=1,max=100"`
}

func (pg *Pagination) Ensure() {
	if pg.Page <= 0 {
		pg.Page = 1
	}

	if pg.Limit <= 0 || pg.Limit > 100 {
		pg.Limit = 12
	}
}

// Values of the sort query parameter; without one, the newest restaurants come first.
const (
	SortRating  = "rating"
	SortReviews = "reviews"
)

// ListQuery is the query string of GET /restaurants.
type ListQuery struct {
	Pagination
	Name string `form:"name"`
	Sort string `form:"sort" binding:"omitempty,oneof=rating reviews"`
	Mine *bool  `form:"mine"`
}

func NewListRestaurantsResponse(restaurants []Restaurant, total int64) httputil.ListResponse[RestaurantResponse] {
	results := make([]RestaurantResponse, len(restaurants))
	for index, restaurant := range restaurants {
		results[index] = NewRestaurantResponse(restaurant)
	}

	return httputil.ListResponse[RestaurantResponse]{Total: total, Results: results}
}

type CreateRestaurantResponse struct {
	ID int `json:"id"`
}

func NewCreateRestaurantResponse(restaurant Restaurant) CreateRestaurantResponse {
	return CreateRestaurantResponse{ID: restaurant.ID}
}

type PersonResponse struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type RatingResponse struct {
	Average float64 `json:"average"`
	Total   int64   `json:"total"`
}

type OpeningHourResponse struct {
	Weekday int    `json:"weekday"`
	Open    string `json:"open"`
	Close   string `json:"close"`
}

type MyReviewResponse struct {
	ID      int    `json:"id"`
	Rating  int    `json:"rating"`
	Comment string `json:"comment"`
}

// RestaurantResponse is what a list returns; RestaurantDetailResponse adds what only the
// detail page needs.
type RestaurantResponse struct {
	ID                      int            `json:"id"`
	Name                    string         `json:"name"`
	Address                 string         `json:"address"`
	Description             *string        `json:"description"`
	ImageURL                *string        `json:"imageUrl"`
	SeatingCapacity         int            `json:"seatingCapacity"`
	CancellationLeadMinutes int            `json:"cancellationLeadMinutes"`
	Owner                   PersonResponse `json:"owner"`
	Rating                  RatingResponse `json:"rating"`
}

type RestaurantDetailResponse struct {
	RestaurantResponse
	OpeningHours []OpeningHourResponse `json:"openingHours"`
	IsOwner      bool                  `json:"isOwner"`
	MyReview     *MyReviewResponse     `json:"myReview"`
}

func NewRestaurantResponse(restaurant Restaurant) RestaurantResponse {
	return RestaurantResponse{
		ID:                      restaurant.ID,
		Name:                    restaurant.Name,
		Address:                 restaurant.Address,
		Description:             restaurant.Description,
		ImageURL:                restaurant.ImageURL,
		SeatingCapacity:         restaurant.SeatingCapacity,
		CancellationLeadMinutes: restaurant.CancellationLeadMinutes,
		Owner: PersonResponse{
			ID:   restaurant.OwnerID.String(),
			Name: convutil.ToSafeValue(restaurant.Owner.Name),
		},
		Rating: RatingResponse{
			Average: math.Round(restaurant.AverageRating*10) / 10,
			Total:   restaurant.ReviewCount,
		},
	}
}

func NewRestaurantDetailResponse(restaurant Restaurant, viewerID uuid.UUID) RestaurantDetailResponse {
	hours := make([]OpeningHourResponse, len(restaurant.OpeningHours))
	for index, hour := range restaurant.OpeningHours {
		hours[index] = OpeningHourResponse{Weekday: hour.Weekday, Open: trimToHHMM(hour.OpenTime), Close: trimToHHMM(hour.CloseTime)}
	}

	detail := RestaurantDetailResponse{
		RestaurantResponse: NewRestaurantResponse(restaurant),
		OpeningHours:       hours,
		IsOwner:            restaurant.OwnerID == viewerID,
	}
	if restaurant.MyReview != nil {
		detail.MyReview = &MyReviewResponse{
			ID:      restaurant.MyReview.ID,
			Rating:  restaurant.MyReview.Rating,
			Comment: restaurant.MyReview.Comment,
		}
	}

	return detail
}

// trimToHHMM trims a PostgreSQL TIME ("11:00:00") to "HH:MM".
func trimToHHMM(value string) string {
	if len(value) >= 5 {
		return value[:5]
	}

	return value
}
