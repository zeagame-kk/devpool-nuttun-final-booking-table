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

// RestaurantRef is the restaurant of a reservation. imageUrl is null when it has no picture, and
// cancellationLeadMinutes is the rule it applied when the reservation is changed or cancelled.
type RestaurantRef struct {
	ID                      int     `json:"id"`
	Name                    string  `json:"name"`
	ImageURL                *string `json:"imageUrl"`
	CancellationLeadMinutes int     `json:"cancellationLeadMinutes"`
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
		ID: view.ID,
		Restaurant: RestaurantRef{
			ID:                      view.RestaurantID,
			Name:                    view.RestaurantName,
			ImageURL:                view.RestaurantImageURL,
			CancellationLeadMinutes: view.RestaurantLeadMinutes,
		},
		StartAt:   view.StartAt,
		EndAt:     view.EndAt,
		Guests:    view.Guests,
		Status:    view.Status,
		CreatedAt: view.CreatedAt,
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

// AvailabilitySlotResponse is one hour of a day: bookedGuests is the most guests present at one
// moment within it, not a sum.
type AvailabilitySlotResponse struct {
	StartAt        time.Time `json:"startAt"`
	EndAt          time.Time `json:"endAt"`
	BookedGuests   int       `json:"bookedGuests"`
	RemainingSeats int       `json:"remainingSeats"`
}

type AvailabilityResponse struct {
	Date     string                     `json:"date"`
	Closed   bool                       `json:"closed"`
	Capacity int                        `json:"capacity"`
	Slots    []AvailabilitySlotResponse `json:"slots"`
}

func NewAvailabilityResponse(day DayAvailability) AvailabilityResponse {
	slots := make([]AvailabilitySlotResponse, len(day.Slots))
	for index, slot := range day.Slots {
		slots[index] = AvailabilitySlotResponse{
			StartAt:        slot.Start.In(bangkok),
			EndAt:          slot.End.In(bangkok),
			BookedGuests:   slot.BookedGuests,
			RemainingSeats: slot.RemainingSeats,
		}
	}

	return AvailabilityResponse{Date: day.Date, Closed: day.Closed, Capacity: day.Capacity, Slots: slots}
}
