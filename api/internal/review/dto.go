package review

import (
	"time"

	"bookingtable/internal/httputil"
)

// SaveReviewRequest is the body of both writing and changing a review. The reviewer comes
// from the token and the restaurant from the path.
type SaveReviewRequest struct {
	Rating  int    `json:"rating" binding:"required,min=1,max=5"`
	Comment string `json:"comment" binding:"required"`
}

type CreateReviewResponse struct {
	ID int `json:"id"`
}

func NewCreateReviewResponse(review Review) CreateReviewResponse {
	return CreateReviewResponse{ID: review.ID}
}

type PersonRef struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type ReviewResponse struct {
	ID        int       `json:"id"`
	Rating    int       `json:"rating"`
	Comment   string    `json:"comment"`
	User      PersonRef `json:"user"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

func NewReviewResponse(view ReviewView) ReviewResponse {
	return ReviewResponse{
		ID:        view.ID,
		Rating:    view.Rating,
		Comment:   view.Comment,
		User:      PersonRef{ID: view.UserID.String(), Name: view.UserName},
		CreatedAt: view.CreatedAt,
		UpdatedAt: view.UpdatedAt,
	}
}

func NewListReviewsResponse(views []ReviewView) httputil.ListResponse[ReviewResponse] {
	results := make([]ReviewResponse, len(views))
	for index, view := range views {
		results[index] = NewReviewResponse(view)
	}

	return httputil.ListResponse[ReviewResponse]{Total: int64(len(results)), Results: results}
}

type RestaurantRef struct {
	ID       int     `json:"id"`
	Name     string  `json:"name"`
	ImageURL *string `json:"imageUrl"`
}

// MyReviewItemResponse is one of the caller's reviews, naming the restaurant it is about.
type MyReviewItemResponse struct {
	ID         int           `json:"id"`
	Rating     int           `json:"rating"`
	Comment    string        `json:"comment"`
	Restaurant RestaurantRef `json:"restaurant"`
	CreatedAt  time.Time     `json:"createdAt"`
	UpdatedAt  time.Time     `json:"updatedAt"`
}

func NewListMyReviewsResponse(views []MyReviewView) httputil.ListResponse[MyReviewItemResponse] {
	results := make([]MyReviewItemResponse, len(views))
	for index, view := range views {
		results[index] = MyReviewItemResponse{
			ID:         view.ID,
			Rating:     view.Rating,
			Comment:    view.Comment,
			Restaurant: RestaurantRef{ID: view.RestaurantID, Name: view.RestaurantName, ImageURL: view.RestaurantImageURL},
			CreatedAt:  view.CreatedAt,
			UpdatedAt:  view.UpdatedAt,
		}
	}

	return httputil.ListResponse[MyReviewItemResponse]{Total: int64(len(results)), Results: results}
}
