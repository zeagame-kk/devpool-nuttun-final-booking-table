package httpapi

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

const frontendURL = "http://localhost:3000"

func newCORSRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)

	router := gin.New()
	router.Use(cors.New(CORSConfig(frontendURL)))
	router.GET("/x", func(ctx *gin.Context) { ctx.Status(http.StatusOK) })

	return router
}

func preflight(router *gin.Engine, origin string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodOptions, "/x", nil)
	req.Header.Set("Origin", origin)
	req.Header.Set("Access-Control-Request-Method", http.MethodGet)
	req.Header.Set("Access-Control-Request-Headers", "authorization")

	response := httptest.NewRecorder()
	router.ServeHTTP(response, req)

	return response
}

func TestCORS_PreflightAllowsAuthorizationFromFrontend(t *testing.T) {
	response := preflight(newCORSRouter(), frontendURL)

	assert.Equal(t, http.StatusNoContent, response.Code)
	assert.Equal(t, frontendURL, response.Header().Get("Access-Control-Allow-Origin"))
	assert.Contains(t, strings.ToLower(response.Header().Get("Access-Control-Allow-Headers")), "authorization")
}

func TestCORS_PreflightRejectsOtherOrigins(t *testing.T) {
	response := preflight(newCORSRouter(), "http://evil.example")

	assert.Empty(t, response.Header().Get("Access-Control-Allow-Origin"))
}

func TestCORS_AllowsWriteMethods(t *testing.T) {
	response := preflight(newCORSRouter(), frontendURL)
	methods := response.Header().Get("Access-Control-Allow-Methods")

	for _, method := range []string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete} {
		assert.Contains(t, methods, method)
	}
}
