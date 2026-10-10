package review

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
	Create(ctx context.Context, userID uuid.UUID, restaurantID int, rating int, comment string) (*Review, error)
	UpdateMine(ctx context.Context, userID uuid.UUID, restaurantID int, rating int, comment string) (*ReviewView, error)
	List(ctx context.Context, restaurantID int) ([]ReviewView, error)
	ListMine(ctx context.Context, userID uuid.UUID) ([]MyReviewView, error)
}

type handler struct {
	service Service
}

func NewHandler(service Service) *handler {
	return &handler{service: service}
}

// Create godoc
//
//	@Summary		เขียนรีวิวร้าน
//	@Description	คะแนนจำนวนเต็ม 1-5 พร้อมข้อความ รีวิวได้ครั้งเดียวต่อร้าน และรีวิวร้านตัวเองไม่ได้ ไม่ต้องเคยจองก่อน
//	@Tags			reviews
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Param			id		path		int					true	"Restaurant ID"
//	@Param			request	body		SaveReviewRequest	true	"Review data"
//	@Success		201		{object}	CreateReviewResponse
//	@Failure		400		{object}	httputil.ErrorResponse
//	@Failure		401		{object}	httputil.ErrorResponse
//	@Failure		403		{object}	httputil.ErrorResponse
//	@Failure		404		{object}	httputil.ErrorResponse
//	@Failure		409		{object}	httputil.ErrorResponse
//	@Router			/restaurants/{id}/reviews [post]
func (hdr *handler) Create(ctx *gin.Context) {
	userID, restaurantID, req, ok := readSaveRequest(ctx)
	if !ok {
		return
	}

	review, err := hdr.service.Create(ctx.Request.Context(), userID, restaurantID, req.Rating, req.Comment)
	if err != nil {
		abortWithError(ctx, err)
		return
	}

	ctx.JSON(http.StatusCreated, NewCreateReviewResponse(*review))
}

// UpdateMine godoc
//
//	@Summary		แก้รีวิวของตัวเอง
//	@Tags			reviews
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Param			id		path		int					true	"Restaurant ID"
//	@Param			request	body		SaveReviewRequest	true	"Review data"
//	@Success		200		{object}	ReviewResponse
//	@Failure		400		{object}	httputil.ErrorResponse
//	@Failure		401		{object}	httputil.ErrorResponse
//	@Failure		404		{object}	httputil.ErrorResponse
//	@Router			/restaurants/{id}/reviews/me [put]
func (hdr *handler) UpdateMine(ctx *gin.Context) {
	userID, restaurantID, req, ok := readSaveRequest(ctx)
	if !ok {
		return
	}

	view, err := hdr.service.UpdateMine(ctx.Request.Context(), userID, restaurantID, req.Rating, req.Comment)
	if err != nil {
		abortWithError(ctx, err)
		return
	}

	ctx.JSON(http.StatusOK, NewReviewResponse(*view))
}

// List godoc
//
//	@Summary		รีวิวทั้งหมดของร้าน
//	@Description	ใหม่สุดก่อน แสดงชื่อผู้รีวิว ไม่แบ่งหน้า
//	@Tags			reviews
//	@Produce		json
//	@Security		BearerAuth
//	@Param			id	path		int	true	"Restaurant ID"
//	@Success		200	{object}	httputil.ListResponse[review.ReviewResponse]
//	@Failure		400	{object}	httputil.ErrorResponse
//	@Failure		401	{object}	httputil.ErrorResponse
//	@Failure		404	{object}	httputil.ErrorResponse
//	@Router			/restaurants/{id}/reviews [get]
func (hdr *handler) List(ctx *gin.Context) {
	if _, ok := reqctx.UserID(ctx.Request.Context()); !ok {
		ctx.AbortWithStatusJSON(http.StatusUnauthorized, httputil.ErrorResponse{Message: "unauthorized"})
		return
	}

	restaurantID, err := strconv.Atoi(ctx.Param("id"))
	if err != nil {
		ctx.AbortWithStatusJSON(http.StatusBadRequest, httputil.ErrorResponse{Message: "invalid request"})
		return
	}

	views, err := hdr.service.List(ctx.Request.Context(), restaurantID)
	if err != nil {
		abortWithError(ctx, err)
		return
	}

	ctx.JSON(http.StatusOK, NewListReviewsResponse(views))
}

// readSaveRequest does what writing and changing a review share: who is calling, which
// restaurant, and the body. When it returns false the error response has been sent.
func readSaveRequest(ctx *gin.Context) (userID uuid.UUID, restaurantID int, req SaveReviewRequest, ok bool) {
	userID, ok = reqctx.UserID(ctx.Request.Context())
	if !ok {
		ctx.AbortWithStatusJSON(http.StatusUnauthorized, httputil.ErrorResponse{Message: "unauthorized"})
		return uuid.Nil, 0, req, false
	}

	restaurantID, err := strconv.Atoi(ctx.Param("id"))
	if err != nil {
		ctx.AbortWithStatusJSON(http.StatusBadRequest, httputil.ErrorResponse{Message: "invalid request"})
		return uuid.Nil, 0, req, false
	}

	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.AbortWithStatusJSON(http.StatusBadRequest, httputil.ErrorResponse{Message: "invalid request"})
		return uuid.Nil, 0, req, false
	}

	return userID, restaurantID, req, true
}

// ListMine godoc
//
//	@Summary		รีวิวของฉันทุกร้าน
//	@Description	เรียงตามที่แก้ไขล่าสุดก่อน พร้อมชื่อร้าน ไม่รวมร้านที่ถูกลบแล้ว ไม่แบ่งหน้า
//	@Tags			reviews
//	@Produce		json
//	@Security		BearerAuth
//	@Success		200	{object}	httputil.ListResponse[review.MyReviewItemResponse]
//	@Failure		401	{object}	httputil.ErrorResponse
//	@Router			/reviews [get]
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

	ctx.JSON(http.StatusOK, NewListMyReviewsResponse(views))
}

// abortWithError maps a service error to the status and code the contract promises.
func abortWithError(ctx *gin.Context, err error) {
	switch {
	case errors.Is(err, ErrRestaurantNotFound):
		ctx.AbortWithStatusJSON(http.StatusNotFound, httputil.ErrorResponse{Message: "restaurant not found"})

	case errors.Is(err, ErrReviewNotFound):
		ctx.AbortWithStatusJSON(http.StatusNotFound, httputil.ErrorResponse{Message: "review not found"})

	case errors.Is(err, ErrInvalidInput):
		ctx.AbortWithStatusJSON(http.StatusBadRequest, httputil.ErrorResponse{Message: "invalid request"})

	case errors.Is(err, ErrOwnRestaurant):
		ctx.AbortWithStatusJSON(http.StatusForbidden, httputil.ErrorResponse{
			Message: "you cannot review your own restaurant",
			Code:    "cannot_review_own_restaurant",
		})

	case errors.Is(err, ErrAlreadyReviewed):
		ctx.AbortWithStatusJSON(http.StatusConflict, httputil.ErrorResponse{
			Message: "you have already reviewed this restaurant",
			Code:    "already_reviewed",
		})

	default:
		ctx.AbortWithStatusJSON(http.StatusInternalServerError, httputil.ErrorResponse{Message: "internal server error"})
	}
}
