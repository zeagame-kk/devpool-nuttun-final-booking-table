package httputil

// ListResponse is the {total, results} envelope every list endpoint returns.
type ListResponse[T any] struct {
	Total   int64 `json:"total"`
	Results []T   `json:"results"`
}

type ErrorResponse struct {
	Message string `json:"message,omitempty"`
	Code    string `json:"code,omitempty"`
}
