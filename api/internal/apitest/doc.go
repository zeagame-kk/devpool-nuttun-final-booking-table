// Package apitest holds the HTTP-seam tests: requests go through the Gin router
// registered by httpapi.RegisterAPI, backed by the real service and repository
// code and a real PostgreSQL container. There is no production code here.
package apitest
