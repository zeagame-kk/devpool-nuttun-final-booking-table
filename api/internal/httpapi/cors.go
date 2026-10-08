package httpapi

import (
	"net/http"

	"github.com/gin-contrib/cors"
)

// CORSConfig allows only the frontend origin and the headers the API needs.
// cors.Default() is not enough: it does not allow the Authorization header,
// so browsers reject cross-origin calls that carry a Bearer token.
func CORSConfig(frontendURL string) cors.Config {
	return cors.Config{
		AllowOrigins: []string{frontendURL},
		AllowMethods: []string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete, http.MethodOptions},
		AllowHeaders: []string{"Authorization", "Content-Type"},
	}
}
