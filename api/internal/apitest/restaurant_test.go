package apitest

import (
	"net/http"
	"strconv"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type person struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type openingHourJSON struct {
	Weekday int    `json:"weekday"`
	Open    string `json:"open"`
	Close   string `json:"close"`
}

type restaurantJSON struct {
	ID                      int               `json:"id"`
	Name                    string            `json:"name"`
	Address                 string            `json:"address"`
	Description             *string           `json:"description"`
	ImageURL                *string           `json:"imageUrl"`
	SeatingCapacity         int               `json:"seatingCapacity"`
	CancellationLeadMinutes int               `json:"cancellationLeadMinutes"`
	Owner                   person            `json:"owner"`
	Rating                  ratingJSON        `json:"rating"`
	OpeningHours            []openingHourJSON `json:"openingHours"`
	IsOwner                 bool              `json:"isOwner"`
	MyReview                *myReviewJSON     `json:"myReview"`
}

type ratingJSON struct {
	Average float64 `json:"average"`
	Total   int     `json:"total"`
}

type myReviewJSON struct {
	ID      int    `json:"id"`
	Rating  int    `json:"rating"`
	Comment string `json:"comment"`
}

type idJSON struct {
	ID int `json:"id"`
}

type errorJSON struct {
	Message string `json:"message"`
	Code    string `json:"code"`
}

func restaurantBody() map[string]any {
	return map[string]any{
		"name":                    "ชาบูทอง",
		"address":                 "12 ถ.สุขุมวิท กรุงเทพ",
		"seatingCapacity":         40,
		"cancellationLeadMinutes": 60,
		"openingHours":            []map[string]any{{"weekday": 1, "open": "11:00", "close": "22:00"}},
	}
}

func TestRestaurantCreate_Success(t *testing.T) {
	a := newApp(t)
	owner := a.newUser("สมชาย")
	other := a.newUser("สมหญิง")

	created := a.do(owner, http.MethodPost, "/restaurants", restaurantBody())
	require.Equal(t, http.StatusCreated, created.Code, created.Body.String())
	id := decode[idJSON](t, created).ID
	require.Positive(t, id)

	asOwner := a.do(owner, http.MethodGet, "/restaurants/"+strconv.Itoa(id), nil)
	require.Equal(t, http.StatusOK, asOwner.Code, asOwner.Body.String())
	got := decode[restaurantJSON](t, asOwner)

	assert.Equal(t, id, got.ID)
	assert.Equal(t, "ชาบูทอง", got.Name)
	assert.Equal(t, "12 ถ.สุขุมวิท กรุงเทพ", got.Address)
	assert.Equal(t, 40, got.SeatingCapacity)
	assert.Equal(t, 60, got.CancellationLeadMinutes)
	assert.Equal(t, owner.String(), got.Owner.ID)
	assert.Equal(t, "สมชาย", got.Owner.Name)
	assert.Equal(t, []openingHourJSON{{Weekday: 1, Open: "11:00", Close: "22:00"}}, got.OpeningHours)
	assert.Nil(t, got.ImageURL, "no image until one is uploaded")
	assert.Equal(t, ratingJSON{Average: 0, Total: 0}, got.Rating)
	assert.True(t, got.IsOwner)
	assert.Nil(t, got.MyReview)

	asOther := decode[restaurantJSON](t, a.do(other, http.MethodGet, "/restaurants/"+strconv.Itoa(id), nil))
	assert.False(t, asOther.IsOwner)
}

// mutated returns a valid restaurant body after applying change.
func mutated(change func(body map[string]any)) map[string]any {
	body := restaurantBody()
	change(body)
	return body
}

func countRestaurants(t *testing.T, a *app) int64 {
	t.Helper()

	var n int64
	require.NoError(t, a.db.Raw("SELECT count(*) FROM restaurants").Scan(&n).Error)
	return n
}

func TestRestaurantCreate_SundayWeekdayZeroAccepted(t *testing.T) {
	a := newApp(t)
	owner := a.newUser("สมชาย")

	body := mutated(func(b map[string]any) {
		b["openingHours"] = []map[string]any{{"weekday": 0, "open": "11:00", "close": "22:00"}}
	})
	created := a.do(owner, http.MethodPost, "/restaurants", body)
	require.Equal(t, http.StatusCreated, created.Code, created.Body.String())

	got := decode[restaurantJSON](t, a.do(owner, http.MethodGet, "/restaurants/"+strconv.Itoa(decode[idJSON](t, created).ID), nil))
	assert.Equal(t, []openingHourJSON{{Weekday: 0, Open: "11:00", Close: "22:00"}}, got.OpeningHours)
}

func TestRestaurantCreate_Validation(t *testing.T) {
	cases := map[string]func(body map[string]any){
		"lead time 29":          func(b map[string]any) { b["cancellationLeadMinutes"] = 29 },
		"lead time missing":     func(b map[string]any) { delete(b, "cancellationLeadMinutes") },
		"capacity 0":            func(b map[string]any) { b["seatingCapacity"] = 0 },
		"capacity negative":     func(b map[string]any) { b["seatingCapacity"] = -5 },
		"capacity as string":    func(b map[string]any) { b["seatingCapacity"] = "40" },
		"name missing":          func(b map[string]any) { delete(b, "name") },
		"name empty":            func(b map[string]any) { b["name"] = "" },
		"name blank":            func(b map[string]any) { b["name"] = "   " },
		"address missing":       func(b map[string]any) { delete(b, "address") },
		"address blank":         func(b map[string]any) { b["address"] = "  " },
		"opening hours missing": func(b map[string]any) { delete(b, "openingHours") },
		"opening hours empty":   func(b map[string]any) { b["openingHours"] = []map[string]any{} },
		"weekday 7":             func(b map[string]any) { b["openingHours"] = hours(7, "11:00", "22:00") },
		"weekday negative":      func(b map[string]any) { b["openingHours"] = hours(-1, "11:00", "22:00") },
		"weekday missing":       func(b map[string]any) { b["openingHours"] = []map[string]any{{"open": "11:00", "close": "22:00"}} },
		"weekday twice": func(b map[string]any) {
			b["openingHours"] = append(hours(1, "11:00", "22:00"), hours(1, "12:00", "21:00")...)
		},
		"open without leading zero": func(b map[string]any) { b["openingHours"] = hours(1, "9:00", "22:00") },
		"close 24:00":               func(b map[string]any) { b["openingHours"] = hours(1, "11:00", "24:00") },
		"open not a time":           func(b map[string]any) { b["openingHours"] = hours(1, "ab:cd", "22:00") },
		"close equal to open":       func(b map[string]any) { b["openingHours"] = hours(1, "11:00", "11:00") },
		"close before open":         func(b map[string]any) { b["openingHours"] = hours(1, "22:00", "11:00") },
		"name over 255 characters":  func(b map[string]any) { b["name"] = strings.Repeat("ก", 256) },
		"capacity beyond int32":     func(b map[string]any) { b["seatingCapacity"] = 2147483648 },
		"lead time beyond int32":    func(b map[string]any) { b["cancellationLeadMinutes"] = 2147483648 },
		"NUL byte in name":          func(b map[string]any) { b["name"] = "ชาบู\x00ทอง" },
		"NUL byte in address":       func(b map[string]any) { b["address"] = "ที่อยู่\x00" },
		"NUL byte in description":   func(b map[string]any) { b["description"] = "คำอธิบาย\x00" },
	}

	for name, change := range cases {
		t.Run(name, func(t *testing.T) {
			a := newApp(t)
			owner := a.newUser("สมชาย")

			response := a.do(owner, http.MethodPost, "/restaurants", mutated(change))

			assert.Equal(t, http.StatusBadRequest, response.Code, response.Body.String())
			assert.Zero(t, countRestaurants(t, a), "nothing is saved for an invalid request")
		})
	}

	t.Run("malformed json", func(t *testing.T) {
		a := newApp(t)
		owner := a.newUser("สมชาย")

		assert.Equal(t, http.StatusBadRequest, a.do(owner, http.MethodPost, "/restaurants", `{"name":`).Code)
	})

	t.Run("boundary values are accepted", func(t *testing.T) {
		a := newApp(t)
		owner := a.newUser("สมชาย")

		response := a.do(owner, http.MethodPost, "/restaurants", mutated(func(b map[string]any) {
			b["cancellationLeadMinutes"] = 30
			b["seatingCapacity"] = 1
			b["openingHours"] = hours(6, "00:00", "23:59")
			b["name"] = strings.Repeat("ก", 255)
		}))

		assert.Equal(t, http.StatusCreated, response.Code, response.Body.String())
	})
}

func hours(weekday int, open, close string) []map[string]any {
	return []map[string]any{{"weekday": weekday, "open": open, "close": close}}
}

func TestRestaurantCreate_IgnoresClientOwnerAndImage(t *testing.T) {
	a := newApp(t)
	owner := a.newUser("สมชาย")
	someoneElse := a.newUser("สมหญิง")

	body := mutated(func(b map[string]any) {
		b["ownerId"] = someoneElse.String()
		b["imageUrl"] = "https://example.com/evil.png"
	})
	created := a.do(owner, http.MethodPost, "/restaurants", body)
	require.Equal(t, http.StatusCreated, created.Code, created.Body.String())

	got := decode[restaurantJSON](t, a.do(owner, http.MethodGet, "/restaurants/"+strconv.Itoa(decode[idJSON](t, created).ID), nil))
	assert.Equal(t, owner.String(), got.Owner.ID)
	assert.Nil(t, got.ImageURL)
}

func TestRestaurant_RequiresAuth(t *testing.T) {
	a := newApp(t)

	for _, route := range []struct{ method, path string }{
		{http.MethodPost, "/restaurants"},
		{http.MethodGet, "/restaurants/1"},
	} {
		response := a.do(uuid.Nil, route.method, route.path, nil)
		assert.Equal(t, http.StatusUnauthorized, response.Code, route.method+" "+route.path)
	}
}

func TestRestaurantGet_NotFoundAndInvalidID(t *testing.T) {
	a := newApp(t)
	owner := a.newUser("สมชาย")
	deleted := a.seedRestaurant(owner, restaurantOpts{})
	require.NoError(t, a.db.Exec("UPDATE restaurants SET deleted_at = now() WHERE id = ?", deleted).Error)

	assert.Equal(t, http.StatusNotFound, a.do(owner, http.MethodGet, "/restaurants/9999", nil).Code)
	assert.Equal(t, http.StatusNotFound, a.do(owner, http.MethodGet, "/restaurants/"+strconv.Itoa(deleted), nil).Code, "soft-deleted restaurant")
	assert.Equal(t, http.StatusBadRequest, a.do(owner, http.MethodGet, "/restaurants/abc", nil).Code)
}

func TestRestaurantReplace(t *testing.T) {
	replacement := func() map[string]any {
		return map[string]any{
			"name":                    "ชาบูใหม่",
			"address":                 "99 ถ.พระราม 4",
			"description":             "น้ำซุปเข้มข้น",
			"seatingCapacity":         80,
			"cancellationLeadMinutes": 45,
			"openingHours": []map[string]any{
				{"weekday": 3, "open": "10:00", "close": "20:00"},
				{"weekday": 2, "open": "12:00", "close": "21:30"},
			},
		}
	}

	t.Run("owner replaces everything and the image is untouched", func(t *testing.T) {
		a := newApp(t)
		owner := a.newUser("สมชาย")
		id := a.seedRestaurant(owner, restaurantOpts{ImageURL: "/uploads/restaurants/1-abc.png"})

		response := a.do(owner, http.MethodPut, "/restaurants/"+strconv.Itoa(id), replacement())
		require.Equal(t, http.StatusOK, response.Code, response.Body.String())
		got := decode[restaurantJSON](t, response)

		assert.Equal(t, id, got.ID)
		assert.Equal(t, "ชาบูใหม่", got.Name)
		assert.Equal(t, "99 ถ.พระราม 4", got.Address)
		require.NotNil(t, got.Description)
		assert.Equal(t, "น้ำซุปเข้มข้น", *got.Description)
		assert.Equal(t, 80, got.SeatingCapacity)
		assert.Equal(t, 45, got.CancellationLeadMinutes)
		assert.Equal(t, []openingHourJSON{
			{Weekday: 2, Open: "12:00", Close: "21:30"},
			{Weekday: 3, Open: "10:00", Close: "20:00"},
		}, got.OpeningHours, "the old seven days are gone and the new set is ordered by weekday")
		require.NotNil(t, got.ImageURL)
		assert.Equal(t, "/uploads/restaurants/1-abc.png", *got.ImageURL)
		assert.True(t, got.IsOwner)

		again := decode[restaurantJSON](t, a.do(owner, http.MethodGet, "/restaurants/"+strconv.Itoa(id), nil))
		assert.Equal(t, got.OpeningHours, again.OpeningHours, "what PUT returned is what is stored")
	})

	t.Run("omitting the description clears it", func(t *testing.T) {
		a := newApp(t)
		owner := a.newUser("สมชาย")
		id := a.seedRestaurant(owner, restaurantOpts{})
		require.Equal(t, http.StatusOK, a.do(owner, http.MethodPut, "/restaurants/"+strconv.Itoa(id), replacement()).Code)

		body := replacement()
		delete(body, "description")
		got := decode[restaurantJSON](t, a.do(owner, http.MethodPut, "/restaurants/"+strconv.Itoa(id), body))

		assert.Nil(t, got.Description)
	})

	t.Run("another user is forbidden and nothing changes", func(t *testing.T) {
		a := newApp(t)
		owner := a.newUser("สมชาย")
		other := a.newUser("สมหญิง")
		id := a.seedRestaurant(owner, restaurantOpts{Name: "ร้านเดิม"})

		response := a.do(other, http.MethodPut, "/restaurants/"+strconv.Itoa(id), replacement())

		assert.Equal(t, http.StatusForbidden, response.Code)
		got := decode[restaurantJSON](t, a.do(owner, http.MethodGet, "/restaurants/"+strconv.Itoa(id), nil))
		assert.Equal(t, "ร้านเดิม", got.Name)
		assert.Len(t, got.OpeningHours, 7)
	})

	t.Run("unknown or deleted restaurant is 404", func(t *testing.T) {
		a := newApp(t)
		owner := a.newUser("สมชาย")
		deleted := a.seedRestaurant(owner, restaurantOpts{})
		require.NoError(t, a.db.Exec("UPDATE restaurants SET deleted_at = now() WHERE id = ?", deleted).Error)

		assert.Equal(t, http.StatusNotFound, a.do(owner, http.MethodPut, "/restaurants/9999", replacement()).Code)
		assert.Equal(t, http.StatusNotFound, a.do(owner, http.MethodPut, "/restaurants/"+strconv.Itoa(deleted), replacement()).Code)
	})

	t.Run("invalid body is 400 and nothing changes", func(t *testing.T) {
		a := newApp(t)
		owner := a.newUser("สมชาย")
		id := a.seedRestaurant(owner, restaurantOpts{Name: "ร้านเดิม"})

		body := replacement()
		body["cancellationLeadMinutes"] = 29
		assert.Equal(t, http.StatusBadRequest, a.do(owner, http.MethodPut, "/restaurants/"+strconv.Itoa(id), body).Code)

		body = replacement()
		body["openingHours"] = hours(1, "22:00", "11:00")
		assert.Equal(t, http.StatusBadRequest, a.do(owner, http.MethodPut, "/restaurants/"+strconv.Itoa(id), body).Code)

		got := decode[restaurantJSON](t, a.do(owner, http.MethodGet, "/restaurants/"+strconv.Itoa(id), nil))
		assert.Equal(t, "ร้านเดิม", got.Name)
		assert.Len(t, got.OpeningHours, 7, "a rejected replacement keeps the old opening hours")
	})

	t.Run("requires auth", func(t *testing.T) {
		a := newApp(t)

		assert.Equal(t, http.StatusUnauthorized, a.do(uuid.Nil, http.MethodPut, "/restaurants/1", replacement()).Code)
	})
}

func TestRestaurantDelete(t *testing.T) {
	t.Run("owner soft-deletes and the restaurant disappears", func(t *testing.T) {
		a := newApp(t)
		owner := a.newUser("สมชาย")
		id := a.seedRestaurant(owner, restaurantOpts{})

		response := a.do(owner, http.MethodDelete, "/restaurants/"+strconv.Itoa(id), nil)

		assert.Equal(t, http.StatusNoContent, response.Code, response.Body.String())
		assert.Empty(t, response.Body.String())
		assert.Equal(t, http.StatusNotFound, a.do(owner, http.MethodGet, "/restaurants/"+strconv.Itoa(id), nil).Code)

		var softDeleted int64
		require.NoError(t, a.db.Raw("SELECT count(*) FROM restaurants WHERE id = ? AND deleted_at IS NOT NULL", id).Scan(&softDeleted).Error)
		assert.Equal(t, int64(1), softDeleted, "the row is kept, only marked deleted")

		assert.Equal(t, http.StatusNotFound, a.do(owner, http.MethodDelete, "/restaurants/"+strconv.Itoa(id), nil).Code, "deleting twice")
	})

	t.Run("another user is forbidden", func(t *testing.T) {
		a := newApp(t)
		owner := a.newUser("สมชาย")
		other := a.newUser("สมหญิง")
		id := a.seedRestaurant(owner, restaurantOpts{})

		assert.Equal(t, http.StatusForbidden, a.do(other, http.MethodDelete, "/restaurants/"+strconv.Itoa(id), nil).Code)
		assert.Equal(t, http.StatusOK, a.do(owner, http.MethodGet, "/restaurants/"+strconv.Itoa(id), nil).Code, "still there")
	})

	t.Run("unknown id, bad id and missing credentials", func(t *testing.T) {
		a := newApp(t)
		owner := a.newUser("สมชาย")

		assert.Equal(t, http.StatusNotFound, a.do(owner, http.MethodDelete, "/restaurants/9999", nil).Code)
		assert.Equal(t, http.StatusBadRequest, a.do(owner, http.MethodDelete, "/restaurants/abc", nil).Code)
		assert.Equal(t, http.StatusUnauthorized, a.do(uuid.Nil, http.MethodDelete, "/restaurants/1", nil).Code)
	})
}
