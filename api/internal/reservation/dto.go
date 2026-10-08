package reservation

import "time"

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

type CreateReservationResponse struct {
	ID int `json:"id"`
}

func NewCreateReservationResponse(reservation Reservation) CreateReservationResponse {
	return CreateReservationResponse{ID: reservation.ID}
}
