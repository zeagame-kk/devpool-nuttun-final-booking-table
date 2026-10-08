package reservation

import (
	"time"

	"bookingtable/internal/httputil"
)

// SaveReservationRequest is the body of both booking and changing a reservation. The user
// comes from the token and the restaurant from the path, never from the body.
type SaveReservationRequest struct {
	StartAt time.Time `json:"startAt" binding:"required"`
	EndAt   time.Time `json:"endAt" binding:"required"`
	Guests  int       `json:"guests" binding:"required,min=1,max=2147483647"`
}

func (req SaveReservationRequest) ToInput() Input {
	return Input{StartAt: req.StartAt, EndAt: req.EndAt, Guests: req.Guests}
}

type RestaurantRef struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

// MyReservationResponse is a reservation as its booker sees it.
type MyReservationResponse struct {
	ID         int           `json:"id"`
	Restaurant RestaurantRef `json:"restaurant"`
	StartAt    time.Time     `json:"startAt"`
	EndAt      time.Time     `json:"endAt"`
	Guests     int           `json:"guests"`
	Status     string        `json:"status"`
	CreatedAt  time.Time     `json:"createdAt"`
}

func NewMyReservationResponse(view ReservationView) MyReservationResponse {
	return MyReservationResponse{
		ID:         view.ID,
		Restaurant: RestaurantRef{ID: view.RestaurantID, Name: view.RestaurantName},
		StartAt:    view.StartAt,
		EndAt:      view.EndAt,
		Guests:     view.Guests,
		Status:     view.Status,
		CreatedAt:  view.CreatedAt,
	}
}

func NewListMyReservationsResponse(views []ReservationView) httputil.ListResponse[MyReservationResponse] {
	results := make([]MyReservationResponse, len(views))
	for index, view := range views {
		results[index] = NewMyReservationResponse(view)
	}

	return httputil.ListResponse[MyReservationResponse]{Total: int64(len(results)), Results: results}
}

type PersonRef struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// OwnerReservationResponse is a reservation as the restaurant's owner sees it: who booked (by
// name only, never an email), and when.
type OwnerReservationResponse struct {
	ID        int       `json:"id"`
	Customer  PersonRef `json:"customer"`
	StartAt   time.Time `json:"startAt"`
	EndAt     time.Time `json:"endAt"`
	Guests    int       `json:"guests"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"createdAt"`
}

func NewOwnerReservationResponse(view ReservationView) OwnerReservationResponse {
	return OwnerReservationResponse{
		ID:        view.ID,
		Customer:  PersonRef{ID: view.UserID.String(), Name: view.CustomerName},
		StartAt:   view.StartAt,
		EndAt:     view.EndAt,
		Guests:    view.Guests,
		Status:    view.Status,
		CreatedAt: view.CreatedAt,
	}
}

func NewListOwnerReservationsResponse(views []ReservationView) httputil.ListResponse[OwnerReservationResponse] {
	results := make([]OwnerReservationResponse, len(views))
	for index, view := range views {
		results[index] = NewOwnerReservationResponse(view)
	}

	return httputil.ListResponse[OwnerReservationResponse]{Total: int64(len(results)), Results: results}
}

type CreateReservationResponse struct {
	ID int `json:"id"`
}

func NewCreateReservationResponse(reservation Reservation) CreateReservationResponse {
	return CreateReservationResponse{ID: reservation.ID}
}
