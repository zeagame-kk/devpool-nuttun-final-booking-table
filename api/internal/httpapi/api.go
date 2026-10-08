package httpapi

import (
	"time"

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

// RegisterAPI registers the restaurant, reservation and review routes under v1.
func RegisterAPI(v1 *gin.RouterGroup, d Deps) {
}
