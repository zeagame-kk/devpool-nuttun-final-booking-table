package httpapi

import (
	"time"

	"bookingtable/internal/reservation"
	"bookingtable/internal/restaurant"
	"bookingtable/internal/review"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// Deps is everything the booking routes need. main.go and the HTTP-seam tests
// build it differently (real JWT middleware and clock vs. a fake user header and
// a fixed clock) but wire the same routes through RegisterAPI.
type Deps struct {
	DB        *gorm.DB
	Auth      gin.HandlerFunc
	Now       func() time.Time
	UploadDir string
}

// RegisterAPI registers the booking routes under v1 (restaurants, reservations and reviews).
//
// Unlike the auth and user routes, which main.go wires itself, these are wired here so the
// production server and the HTTP-seam tests build exactly the same handlers.
func RegisterAPI(v1 *gin.RouterGroup, d Deps) {
	restaurantHandler := restaurant.NewHandler(restaurant.NewService(restaurant.NewRepository(d.DB), d.Now))
	reviewHandler := review.NewHandler(review.NewService(review.NewRepository(d.DB)))
	reservationHandler := reservation.NewHandler(reservation.NewService(reservation.NewRepository(d.DB), d.Now))

	restaurants := v1.Group("/restaurants")
	restaurants.Use(d.Auth)
	restaurants.POST("", restaurantHandler.Create)
	restaurants.GET("", restaurantHandler.List)
	restaurants.GET("/:id", restaurantHandler.Get)
	restaurants.PUT("/:id", restaurantHandler.Replace)
	restaurants.DELETE("/:id", restaurantHandler.Delete)
	restaurants.POST("/:id/reservations", reservationHandler.Create)
	restaurants.GET("/:id/reservations", reservationHandler.ListForRestaurant)
	restaurants.POST("/:id/reviews", reviewHandler.Create)
	restaurants.GET("/:id/reviews", reviewHandler.List)
	restaurants.PUT("/:id/reviews/me", reviewHandler.UpdateMine)

	reservations := v1.Group("/reservations")
	reservations.Use(d.Auth)
	reservations.GET("", reservationHandler.ListMine)
	reservations.PUT("/:id", reservationHandler.Update)
	reservations.POST("/:id/cancel", reservationHandler.Cancel)
}
