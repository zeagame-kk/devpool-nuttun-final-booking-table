package restaurant

import (
	"context"
	"errors"
	"io"
	"net/http"
	"strconv"

	"bookingtable/internal/httputil"
	"bookingtable/internal/reqctx"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type Service interface {
	Create(ctx context.Context, ownerID uuid.UUID, restaurant Restaurant) (*Restaurant, error)
	Get(ctx context.Context, id int, viewerID uuid.UUID) (*Restaurant, error)
	Replace(ctx context.Context, id int, userID uuid.UUID, restaurant Restaurant) (*Restaurant, error)
	Delete(ctx context.Context, id int, userID uuid.UUID) error
	SetImage(ctx context.Context, id int, userID uuid.UUID, file io.Reader) (*Restaurant, error)
	RemoveImage(ctx context.Context, id int, userID uuid.UUID) error
	List(ctx context.Context, viewerID uuid.UUID, query ListQuery) ([]Restaurant, int64, error)
}

type handler struct {
	service Service
}

func NewHandler(service Service) *handler {
	return &handler{service: service}
}

// Create godoc
//
//	@Summary		สร้างร้านอาหาร
//	@Description	ผู้ใช้ที่ยืนยันตัวตนแล้วจะเป็นเจ้าของร้าน รูปร้านตั้งผ่าน endpoint อัปโหลดเท่านั้น
//	@Tags			restaurants
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Param			request	body		SaveRestaurantRequest	true	"Restaurant data"
//	@Success		201		{object}	CreateRestaurantResponse
//	@Failure		400		{object}	httputil.ErrorResponse
//	@Failure		401		{object}	httputil.ErrorResponse
//	@Router			/restaurants [post]
func (hdr *handler) Create(ctx *gin.Context) {
	ownerID, ok := reqctx.UserID(ctx.Request.Context())
	if !ok {
		ctx.AbortWithStatusJSON(http.StatusUnauthorized, httputil.ErrorResponse{Message: "unauthorized"})
		return
	}

	var req SaveRestaurantRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.AbortWithStatusJSON(http.StatusBadRequest, httputil.ErrorResponse{Message: "invalid request"})
		return
	}

	restaurant, err := hdr.service.Create(ctx.Request.Context(), ownerID, req.ToRestaurant())
	if err != nil {
		if errors.Is(err, ErrInvalidInput) {
			ctx.AbortWithStatusJSON(http.StatusBadRequest, httputil.ErrorResponse{Message: "invalid request"})
			return
		}

		ctx.AbortWithStatusJSON(http.StatusInternalServerError, httputil.ErrorResponse{Message: "internal server error"})
		return
	}

	ctx.JSON(http.StatusCreated, NewCreateRestaurantResponse(*restaurant))
}

// List godoc
//
//	@Summary		รายการร้านอาหาร
//	@Description	ค้นหาตามชื่อ เรียงตามคะแนนเฉลี่ยหรือจำนวนรีวิว กรองเฉพาะร้านของตัวเอง และแบ่งหน้า
//	@Tags			restaurants
//	@Produce		json
//	@Security		BearerAuth
//	@Param			name	query		string	false	"Search by name"
//	@Param			sort	query		string	false	"rating or reviews (default: newest first)"
//	@Param			mine	query		bool	false	"Only my restaurants"
//	@Param			page	query		int		false	"Page (default 1)"
//	@Param			limit	query		int		false	"Page size (default 12, max 100)"
//	@Success		200		{object}	httputil.ListResponse[RestaurantResponse]
//	@Failure		400		{object}	httputil.ErrorResponse
//	@Failure		401		{object}	httputil.ErrorResponse
//	@Router			/restaurants [get]
func (hdr *handler) List(ctx *gin.Context) {
	viewerID, ok := reqctx.UserID(ctx.Request.Context())
	if !ok {
		ctx.AbortWithStatusJSON(http.StatusUnauthorized, httputil.ErrorResponse{Message: "unauthorized"})
		return
	}

	var query ListQuery
	if err := ctx.ShouldBindQuery(&query); err != nil {
		ctx.AbortWithStatusJSON(http.StatusBadRequest, httputil.ErrorResponse{Message: "invalid request"})
		return
	}

	restaurants, total, err := hdr.service.List(ctx.Request.Context(), viewerID, query)
	if err != nil {
		if errors.Is(err, ErrInvalidInput) {
			ctx.AbortWithStatusJSON(http.StatusBadRequest, httputil.ErrorResponse{Message: "invalid request"})
			return
		}

		ctx.AbortWithStatusJSON(http.StatusInternalServerError, httputil.ErrorResponse{Message: "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, NewListRestaurantsResponse(restaurants, total))
}

// Get godoc
//
//	@Summary		ดูรายละเอียดร้านอาหาร
//	@Tags			restaurants
//	@Produce		json
//	@Security		BearerAuth
//	@Param			id	path		int	true	"Restaurant ID"
//	@Success		200	{object}	RestaurantDetailResponse
//	@Failure		400	{object}	httputil.ErrorResponse
//	@Failure		401	{object}	httputil.ErrorResponse
//	@Failure		404	{object}	httputil.ErrorResponse
//	@Router			/restaurants/{id} [get]
func (hdr *handler) Get(ctx *gin.Context) {
	viewerID, ok := reqctx.UserID(ctx.Request.Context())
	if !ok {
		ctx.AbortWithStatusJSON(http.StatusUnauthorized, httputil.ErrorResponse{Message: "unauthorized"})
		return
	}

	id, err := strconv.Atoi(ctx.Param("id"))
	if err != nil {
		ctx.AbortWithStatusJSON(http.StatusBadRequest, httputil.ErrorResponse{Message: "invalid request"})
		return
	}

	restaurant, err := hdr.service.Get(ctx.Request.Context(), id, viewerID)
	if err != nil {
		if errors.Is(err, ErrRestaurantNotFound) {
			ctx.AbortWithStatusJSON(http.StatusNotFound, httputil.ErrorResponse{Message: "restaurant not found"})
			return
		}

		ctx.AbortWithStatusJSON(http.StatusInternalServerError, httputil.ErrorResponse{Message: "internal server error"})
		return
	}

	ctx.JSON(http.StatusOK, NewRestaurantDetailResponse(*restaurant, viewerID))
}

// Replace godoc
//
//	@Summary		แทนที่ข้อมูลร้านอาหารทั้งก้อน
//	@Description	เฉพาะเจ้าของร้าน แทนที่รายละเอียดและเวลาเปิดทั้งชุด ไม่แตะรูปร้าน
//	@Tags			restaurants
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Param			id		path		int						true	"Restaurant ID"
//	@Param			request	body		SaveRestaurantRequest	true	"Restaurant data"
//	@Success		200		{object}	RestaurantDetailResponse
//	@Failure		400		{object}	httputil.ErrorResponse
//	@Failure		401		{object}	httputil.ErrorResponse
//	@Failure		403		{object}	httputil.ErrorResponse
//	@Failure		404		{object}	httputil.ErrorResponse
//	@Router			/restaurants/{id} [put]
func (hdr *handler) Replace(ctx *gin.Context) {
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

	var req SaveRestaurantRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.AbortWithStatusJSON(http.StatusBadRequest, httputil.ErrorResponse{Message: "invalid request"})
		return
	}

	restaurant, err := hdr.service.Replace(ctx.Request.Context(), id, userID, req.ToRestaurant())
	if err != nil {
		switch {
		case errors.Is(err, ErrRestaurantNotFound):
			ctx.AbortWithStatusJSON(http.StatusNotFound, httputil.ErrorResponse{Message: "restaurant not found"})

		case errors.Is(err, ErrForbidden):
			ctx.AbortWithStatusJSON(http.StatusForbidden, httputil.ErrorResponse{Message: "forbidden"})

		case errors.Is(err, ErrInvalidInput):
			ctx.AbortWithStatusJSON(http.StatusBadRequest, httputil.ErrorResponse{Message: "invalid request"})

		default:
			ctx.AbortWithStatusJSON(http.StatusInternalServerError, httputil.ErrorResponse{Message: "internal server error"})
		}
		return
	}

	ctx.JSON(http.StatusOK, NewRestaurantDetailResponse(*restaurant, userID))
}

// Delete godoc
//
//	@Summary		ลบร้านอาหาร
//	@Description	เฉพาะเจ้าของร้าน เป็น soft delete
//	@Tags			restaurants
//	@Security		BearerAuth
//	@Param			id	path	int	true	"Restaurant ID"
//	@Success		204
//	@Failure		400	{object}	httputil.ErrorResponse
//	@Failure		401	{object}	httputil.ErrorResponse
//	@Failure		403	{object}	httputil.ErrorResponse
//	@Failure		404	{object}	httputil.ErrorResponse
//	@Failure		409	{object}	httputil.ErrorResponse
//	@Router			/restaurants/{id} [delete]
func (hdr *handler) Delete(ctx *gin.Context) {
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

	if err := hdr.service.Delete(ctx.Request.Context(), id, userID); err != nil {
		switch {
		case errors.Is(err, ErrRestaurantNotFound):
			ctx.AbortWithStatusJSON(http.StatusNotFound, httputil.ErrorResponse{Message: "restaurant not found"})

		case errors.Is(err, ErrForbidden):
			ctx.AbortWithStatusJSON(http.StatusForbidden, httputil.ErrorResponse{Message: "forbidden"})

		case errors.Is(err, ErrHasActiveReservations):
			ctx.AbortWithStatusJSON(http.StatusConflict, httputil.ErrorResponse{
				Message: "restaurant has active reservations",
				Code:    "restaurant_has_active_reservations",
			})

		default:
			ctx.AbortWithStatusJSON(http.StatusInternalServerError, httputil.ErrorResponse{Message: "internal server error"})
		}
		return
	}

	ctx.Status(http.StatusNoContent)
}

// SetImage godoc
//
//	@Summary		อัปโหลดรูปร้าน
//	@Description	เฉพาะเจ้าของร้าน multipart ฟิลด์ file รับ JPEG, PNG, WebP ไม่เกิน 2 MB ตรวจชนิดจากเนื้อไฟล์ และแทนที่รูปเดิม
//	@Tags			restaurants
//	@Accept			mpfd
//	@Produce		json
//	@Security		BearerAuth
//	@Param			id		path		int		true	"Restaurant ID"
//	@Param			file	formData	file	true	"Picture (JPEG, PNG or WebP, at most 2 MB)"
//	@Success		200		{object}	RestaurantDetailResponse
//	@Failure		400		{object}	httputil.ErrorResponse
//	@Failure		401		{object}	httputil.ErrorResponse
//	@Failure		403		{object}	httputil.ErrorResponse
//	@Failure		404		{object}	httputil.ErrorResponse
//	@Router			/restaurants/{id}/image [post]
func (hdr *handler) SetImage(ctx *gin.Context) {
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

	// Refuse to even read a request body much larger than the picture limit (the extra megabyte
	// is room for the multipart framing).
	ctx.Request.Body = http.MaxBytesReader(ctx.Writer, ctx.Request.Body, MaxImageBytes+(1<<20))

	header, err := ctx.FormFile("file")
	if err != nil {
		abortInvalidImage(ctx)
		return
	}

	file, err := header.Open()
	if err != nil {
		abortInvalidImage(ctx)
		return
	}
	defer file.Close()

	restaurant, err := hdr.service.SetImage(ctx.Request.Context(), id, userID, file)
	if err != nil {
		abortWithImageError(ctx, err)
		return
	}

	ctx.JSON(http.StatusOK, NewRestaurantDetailResponse(*restaurant, userID))
}

// RemoveImage godoc
//
//	@Summary		ลบรูปร้าน
//	@Tags			restaurants
//	@Security		BearerAuth
//	@Param			id	path	int	true	"Restaurant ID"
//	@Success		204
//	@Failure		400	{object}	httputil.ErrorResponse
//	@Failure		401	{object}	httputil.ErrorResponse
//	@Failure		403	{object}	httputil.ErrorResponse
//	@Failure		404	{object}	httputil.ErrorResponse
//	@Router			/restaurants/{id}/image [delete]
func (hdr *handler) RemoveImage(ctx *gin.Context) {
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

	if err := hdr.service.RemoveImage(ctx.Request.Context(), id, userID); err != nil {
		abortWithImageError(ctx, err)
		return
	}

	ctx.Status(http.StatusNoContent)
}

func abortInvalidImage(ctx *gin.Context) {
	ctx.AbortWithStatusJSON(http.StatusBadRequest, httputil.ErrorResponse{
		Message: "invalid image: send a JPEG, PNG or WebP of at most 2 MB in the 'file' field",
		Code:    "invalid_image",
	})
}

func abortWithImageError(ctx *gin.Context, err error) {
	switch {
	case errors.Is(err, ErrRestaurantNotFound):
		ctx.AbortWithStatusJSON(http.StatusNotFound, httputil.ErrorResponse{Message: "restaurant not found"})

	case errors.Is(err, ErrForbidden):
		ctx.AbortWithStatusJSON(http.StatusForbidden, httputil.ErrorResponse{Message: "forbidden"})

	case errors.Is(err, ErrInvalidImage):
		abortInvalidImage(ctx)

	default:
		ctx.AbortWithStatusJSON(http.StatusInternalServerError, httputil.ErrorResponse{Message: "internal server error"})
	}
}
