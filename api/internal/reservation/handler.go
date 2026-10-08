package reservation

import (
	"context"
	"errors"
	"net/http"
	"strconv"

	"bookingtable/internal/httputil"
	"bookingtable/internal/reqctx"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type Service interface {
	Create(ctx context.Context, userID uuid.UUID, restaurantID int, in Input) (*Reservation, error)
}

type handler struct {
	service Service
}

func NewHandler(service Service) *handler {
	return &handler{service: service}
}

// Create godoc
//
//	@Summary		จองโต๊ะ
//	@Description	ตรวจเวลาเปิด ย้อนหลัง และความจุที่ฝั่ง server การจองใหม่เป็น confirmed ทันที
//	@Tags			reservations
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Param			id		path		int						true	"Restaurant ID"
//	@Param			request	body		SaveReservationRequest	true	"Reservation data"
//	@Success		201		{object}	CreateReservationResponse
//	@Failure		400		{object}	httputil.ErrorResponse
//	@Failure		401		{object}	httputil.ErrorResponse
//	@Failure		404		{object}	httputil.ErrorResponse
//	@Failure		409		{object}	httputil.ErrorResponse
//	@Router			/restaurants/{id}/reservations [post]
func (hdr *handler) Create(ctx *gin.Context) {
	userID, ok := reqctx.UserID(ctx.Request.Context())
	if !ok {
		ctx.AbortWithStatusJSON(http.StatusUnauthorized, httputil.ErrorResponse{Message: "unauthorized"})
		return
	}

	restaurantID, err := strconv.Atoi(ctx.Param("id"))
	if err != nil {
		ctx.AbortWithStatusJSON(http.StatusBadRequest, httputil.ErrorResponse{Message: "invalid request"})
		return
	}

	var req SaveReservationRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.AbortWithStatusJSON(http.StatusBadRequest, httputil.ErrorResponse{Message: "invalid request"})
		return
	}

	reservation, err := hdr.service.Create(ctx.Request.Context(), userID, restaurantID, req.ToInput())
	if err != nil {
		abortWithError(ctx, err)
		return
	}

	ctx.JSON(http.StatusCreated, NewCreateReservationResponse(*reservation))
}

// abortWithError maps a service error to the HTTP status and code the contract promises.
func abortWithError(ctx *gin.Context, err error) {
	switch {
	case errors.Is(err, ErrRestaurantNotFound):
		ctx.AbortWithStatusJSON(http.StatusNotFound, httputil.ErrorResponse{Message: "restaurant not found"})

	case errors.Is(err, ErrInvalidInput):
		ctx.AbortWithStatusJSON(http.StatusBadRequest, httputil.ErrorResponse{Message: "invalid request"})

	case errors.Is(err, ErrStartInPast):
		ctx.AbortWithStatusJSON(http.StatusBadRequest, httputil.ErrorResponse{Message: "reservation starts in the past", Code: "start_in_past"})

	case errors.Is(err, ErrOutsideOpeningHours):
		ctx.AbortWithStatusJSON(http.StatusBadRequest, httputil.ErrorResponse{Message: "outside opening hours", Code: "outside_opening_hours"})

	case errors.Is(err, ErrCapacityExceeded):
		ctx.AbortWithStatusJSON(http.StatusConflict, httputil.ErrorResponse{Message: "not enough seats", Code: "capacity_exceeded"})

	default:
		ctx.AbortWithStatusJSON(http.StatusInternalServerError, httputil.ErrorResponse{Message: "internal server error"})
	}
}
