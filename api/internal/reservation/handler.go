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
	Update(ctx context.Context, userID uuid.UUID, id int, in Input) (*ReservationView, error)
	Cancel(ctx context.Context, userID uuid.UUID, id int) error
	ListMine(ctx context.Context, userID uuid.UUID) ([]ReservationView, error)
	ListForRestaurant(ctx context.Context, ownerID uuid.UUID, restaurantID int, status string) ([]ReservationView, error)
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

// Update godoc
//
//	@Summary		แก้ไขการจอง
//	@Description	เฉพาะผู้จอง ตรวจ lead time จากเวลาเริ่มเดิม แล้วตรวจกฎการจองซ้ำ โดยไม่นับที่นั่งเดิมของตัวเอง
//	@Tags			reservations
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Param			id		path		int						true	"Reservation ID"
//	@Param			request	body		SaveReservationRequest	true	"Reservation data"
//	@Success		200		{object}	MyReservationResponse
//	@Failure		400		{object}	httputil.ErrorResponse
//	@Failure		401		{object}	httputil.ErrorResponse
//	@Failure		403		{object}	httputil.ErrorResponse
//	@Failure		404		{object}	httputil.ErrorResponse
//	@Failure		409		{object}	httputil.ErrorResponse
//	@Router			/reservations/{id} [put]
func (hdr *handler) Update(ctx *gin.Context) {
	userID, ok := reqctx.UserID(ctx.Request.Context())
	if !ok {
		ctx.AbortWithStatusJSON(http.StatusUnauthorized, httputil.ErrorResponse{Message: "unauthorized"})
		return
	}

	id, err := strconv.Atoi(ctx.Param("id"))
	if err != nil {
		ctx.AbortWithStatusJSON(http.StatusBadRequest, httputil.ErrorResponse{Message: "invalid request"})
		return
	}

	var req SaveReservationRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.AbortWithStatusJSON(http.StatusBadRequest, httputil.ErrorResponse{Message: "invalid request"})
		return
	}

	view, err := hdr.service.Update(ctx.Request.Context(), userID, id, req.ToInput())
	if err != nil {
		abortWithError(ctx, err)
		return
	}

	ctx.JSON(http.StatusOK, NewMyReservationResponse(*view))
}

// Cancel godoc
//
//	@Summary		ยกเลิกการจอง
//	@Description	เฉพาะผู้จอง ต้องก่อนเวลาเริ่มอย่างน้อยเท่า lead time ของร้าน การจองที่ยกเลิกแล้วไม่นับในความจุ
//	@Tags			reservations
//	@Security		BearerAuth
//	@Param			id	path	int	true	"Reservation ID"
//	@Success		204
//	@Failure		400	{object}	httputil.ErrorResponse
//	@Failure		401	{object}	httputil.ErrorResponse
//	@Failure		403	{object}	httputil.ErrorResponse
//	@Failure		404	{object}	httputil.ErrorResponse
//	@Failure		409	{object}	httputil.ErrorResponse
//	@Router			/reservations/{id}/cancel [post]
func (hdr *handler) Cancel(ctx *gin.Context) {
	userID, ok := reqctx.UserID(ctx.Request.Context())
	if !ok {
		ctx.AbortWithStatusJSON(http.StatusUnauthorized, httputil.ErrorResponse{Message: "unauthorized"})
		return
	}

	id, err := strconv.Atoi(ctx.Param("id"))
	if err != nil {
		ctx.AbortWithStatusJSON(http.StatusBadRequest, httputil.ErrorResponse{Message: "invalid request"})
		return
	}

	if err := hdr.service.Cancel(ctx.Request.Context(), userID, id); err != nil {
		abortWithError(ctx, err)
		return
	}

	ctx.Status(http.StatusNoContent)
}

// ListMine godoc
//
//	@Summary		การจองของฉัน
//	@Description	ทุกสถานะ เรียงเวลาเริ่มใหม่ไปเก่า แสดงชื่อร้านแม้ร้านถูกลบแล้ว
//	@Tags			reservations
//	@Produce		json
//	@Security		BearerAuth
//	@Success		200	{object}	httputil.ListResponse[reservation.MyReservationResponse]
//	@Failure		401	{object}	httputil.ErrorResponse
//	@Router			/reservations [get]
func (hdr *handler) ListMine(ctx *gin.Context) {
	userID, ok := reqctx.UserID(ctx.Request.Context())
	if !ok {
		ctx.AbortWithStatusJSON(http.StatusUnauthorized, httputil.ErrorResponse{Message: "unauthorized"})
		return
	}

	views, err := hdr.service.ListMine(ctx.Request.Context(), userID)
	if err != nil {
		abortWithError(ctx, err)
		return
	}

	ctx.JSON(http.StatusOK, NewListMyReservationsResponse(views))
}

// ListForRestaurant godoc
//
//	@Summary		การจองของร้าน (มุมมองเจ้าของ)
//	@Description	อ่านอย่างเดียว เฉพาะเจ้าของร้าน แสดงชื่อลูกค้าแต่ไม่แสดงอีเมล กรองตามสถานะได้
//	@Tags			reservations
//	@Produce		json
//	@Security		BearerAuth
//	@Param			id		path		int		true	"Restaurant ID"
//	@Param			status	query		string	false	"confirmed or cancelled (default: all)"
//	@Success		200		{object}	httputil.ListResponse[reservation.OwnerReservationResponse]
//	@Failure		400		{object}	httputil.ErrorResponse
//	@Failure		401		{object}	httputil.ErrorResponse
//	@Failure		403		{object}	httputil.ErrorResponse
//	@Failure		404		{object}	httputil.ErrorResponse
//	@Router			/restaurants/{id}/reservations [get]
func (hdr *handler) ListForRestaurant(ctx *gin.Context) {
	ownerID, ok := reqctx.UserID(ctx.Request.Context())
	if !ok {
		ctx.AbortWithStatusJSON(http.StatusUnauthorized, httputil.ErrorResponse{Message: "unauthorized"})
		return
	}

	restaurantID, err := strconv.Atoi(ctx.Param("id"))
	if err != nil {
		ctx.AbortWithStatusJSON(http.StatusBadRequest, httputil.ErrorResponse{Message: "invalid request"})
		return
	}

	views, err := hdr.service.ListForRestaurant(ctx.Request.Context(), ownerID, restaurantID, ctx.Query("status"))
	if err != nil {
		abortWithError(ctx, err)
		return
	}

	ctx.JSON(http.StatusOK, NewListOwnerReservationsResponse(views))
}

// abortWithError maps a service error to the HTTP status and code the contract promises.
func abortWithError(ctx *gin.Context, err error) {
	switch {
	case errors.Is(err, ErrRestaurantNotFound):
		ctx.AbortWithStatusJSON(http.StatusNotFound, httputil.ErrorResponse{Message: "restaurant not found"})

	case errors.Is(err, ErrReservationNotFound):
		ctx.AbortWithStatusJSON(http.StatusNotFound, httputil.ErrorResponse{Message: "reservation not found"})

	case errors.Is(err, ErrForbidden):
		ctx.AbortWithStatusJSON(http.StatusForbidden, httputil.ErrorResponse{Message: "forbidden"})

	case errors.Is(err, ErrInvalidInput):
		ctx.AbortWithStatusJSON(http.StatusBadRequest, httputil.ErrorResponse{Message: "invalid request"})

	case errors.Is(err, ErrStartInPast):
		ctx.AbortWithStatusJSON(http.StatusBadRequest, httputil.ErrorResponse{Message: "reservation starts in the past", Code: "start_in_past"})

	case errors.Is(err, ErrOutsideOpeningHours):
		ctx.AbortWithStatusJSON(http.StatusBadRequest, httputil.ErrorResponse{Message: "outside opening hours", Code: "outside_opening_hours"})

	case errors.Is(err, ErrCapacityExceeded):
		ctx.AbortWithStatusJSON(http.StatusConflict, httputil.ErrorResponse{Message: "not enough seats", Code: "capacity_exceeded"})

	case errors.Is(err, ErrNotActive):
		ctx.AbortWithStatusJSON(http.StatusConflict, httputil.ErrorResponse{Message: "reservation is not active", Code: "reservation_not_active"})

	case errors.Is(err, ErrTooLateToCancel):
		ctx.AbortWithStatusJSON(http.StatusConflict, httputil.ErrorResponse{Message: "too late to cancel", Code: "too_late_to_cancel"})

	case errors.Is(err, ErrTooLateToModify):
		ctx.AbortWithStatusJSON(http.StatusConflict, httputil.ErrorResponse{Message: "too late to modify", Code: "too_late_to_modify"})

	default:
		ctx.AbortWithStatusJSON(http.StatusInternalServerError, httputil.ErrorResponse{Message: "internal server error"})
	}
}
