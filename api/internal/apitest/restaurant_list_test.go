package apitest

import (
	"fmt"
	"net/http"
	"net/url"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type listJSON struct {
	Total   int              `json:"total"`
	Results []restaurantJSON `json:"results"`
}

func names(list listJSON) []string {
	out := make([]string, len(list.Results))
	for index, item := range list.Results {
		out[index] = item.Name
	}
	return out
}

func ids(list listJSON) []int {
	out := make([]int, len(list.Results))
	for index, item := range list.Results {
		out[index] = item.ID
	}
	return out
}

func getList(t *testing.T, a *app, as uuid.UUID, query string) listJSON {
	t.Helper()

	response := a.do(as, http.MethodGet, "/restaurants"+query, nil)
	require.Equal(t, http.StatusOK, response.Code, response.Body.String())
	return decode[listJSON](t, response)
}

func TestRestaurantList_DefaultNewestFirstAndShape(t *testing.T) {
	a := newApp(t)
	owner := a.newUser("สมชาย")
	a.seedRestaurant(owner, restaurantOpts{Name: "ร้าน A"})
	a.seedRestaurant(owner, restaurantOpts{Name: "ร้าน B"})
	a.seedRestaurant(owner, restaurantOpts{Name: "ร้าน C"})

	list := getList(t, a, owner, "")

	assert.Equal(t, 3, list.Total)
	assert.Equal(t, []string{"ร้าน C", "ร้าน B", "ร้าน A"}, names(list), "newest first")
	first := list.Results[0]
	assert.Equal(t, "สมชาย", first.Owner.Name)
	assert.Equal(t, owner.String(), first.Owner.ID)
	assert.Equal(t, ratingJSON{Average: 0, Total: 0}, first.Rating, "no reviews yet")
	assert.Equal(t, 10, first.SeatingCapacity)
	assert.Nil(t, first.OpeningHours, "the list does not carry opening hours")
}

func TestRestaurantList_EmptyIsAnArrayNotNull(t *testing.T) {
	a := newApp(t)
	user := a.newUser("สมชาย")

	response := a.do(user, http.MethodGet, "/restaurants", nil)

	require.Equal(t, http.StatusOK, response.Code)
	assert.JSONEq(t, `{"total":0,"results":[]}`, response.Body.String())
}

func TestRestaurantList_Pagination(t *testing.T) {
	a := newApp(t)
	owner := a.newUser("สมชาย")
	for n := 1; n <= 15; n++ {
		a.seedRestaurant(owner, restaurantOpts{Name: fmt.Sprintf("ร้าน %02d", n)})
	}

	first := getList(t, a, owner, "?limit=10&page=1")
	second := getList(t, a, owner, "?limit=10&page=2")

	assert.Equal(t, 15, first.Total)
	assert.Equal(t, 15, second.Total)
	assert.Len(t, first.Results, 10)
	assert.Len(t, second.Results, 5)
	assert.Equal(t, "ร้าน 15", first.Results[0].Name)
	assert.Equal(t, "ร้าน 05", second.Results[0].Name, "page 2 continues where page 1 stopped")
	assert.Equal(t, "ร้าน 01", second.Results[4].Name)
	assert.NotContains(t, ids(first), ids(second)[0], "pages do not overlap")

	assert.Len(t, getList(t, a, owner, "").Results, 12, "default page size is 12")
	beyond := getList(t, a, owner, "?limit=10&page=3")
	assert.Empty(t, beyond.Results)
	assert.Equal(t, 15, beyond.Total)
}

func TestRestaurantList_InvalidParams(t *testing.T) {
	a := newApp(t)
	user := a.newUser("สมชาย")

	for _, query := range []string{
		"?limit=101", "?limit=abc", "?page=-1", "?page=abc", "?sort=name", "?mine=maybe",
		"?page=1000001", "?page=9223372036854775807", // the offset (page-1)*limit must not overflow
		"?name=a%00b", // PostgreSQL cannot store or compare a NUL byte
	} {
		response := a.do(user, http.MethodGet, "/restaurants"+query, nil)
		assert.Equal(t, http.StatusBadRequest, response.Code, query)
	}
}

func TestRestaurantList_HidesSoftDeleted(t *testing.T) {
	a := newApp(t)
	owner := a.newUser("สมชาย")
	a.seedRestaurant(owner, restaurantOpts{Name: "ยังอยู่"})
	gone := a.seedRestaurant(owner, restaurantOpts{Name: "ถูกลบ"})
	require.NoError(t, a.db.Exec("UPDATE restaurants SET deleted_at = now() WHERE id = ?", gone).Error)

	list := getList(t, a, owner, "")

	assert.Equal(t, 1, list.Total)
	assert.Equal(t, []string{"ยังอยู่"}, names(list))
}

func TestRestaurantList_RequiresAuth(t *testing.T) {
	a := newApp(t)

	assert.Equal(t, http.StatusUnauthorized, a.do(uuid.Nil, http.MethodGet, "/restaurants", nil).Code)
}

// seedRated creates four restaurants owned by owner and returns their ids by name:
//
//	A: reviews 5,4,4 (average 4.33, 3 reviews)   B: review 5 (5.0, 1)
//	C: none (0, 0)                                D: review 5 (5.0, 1)
func seedRated(a *app, owner uuid.UUID) map[string]int {
	reviewers := []uuid.UUID{a.newUser("ผู้รีวิว 1"), a.newUser("ผู้รีวิว 2"), a.newUser("ผู้รีวิว 3")}

	byName := map[string]int{}
	for _, name := range []string{"A", "B", "C", "D"} {
		byName[name] = a.seedRestaurant(owner, restaurantOpts{Name: name})
	}

	a.seedReview(byName["A"], reviewers[0], 5)
	a.seedReview(byName["A"], reviewers[1], 4)
	a.seedReview(byName["A"], reviewers[2], 4)
	a.seedReview(byName["B"], reviewers[0], 5)
	a.seedReview(byName["D"], reviewers[0], 5)

	return byName
}

func TestRestaurantList_SortByRating(t *testing.T) {
	a := newApp(t)
	owner := a.newUser("สมชาย")
	seedRated(a, owner)

	list := getList(t, a, owner, "?sort=rating")

	assert.Equal(t, []string{"B", "D", "A", "C"}, names(list), "highest average first, equal averages by id, unrated last")
	assert.Equal(t, ratingJSON{Average: 5, Total: 1}, list.Results[0].Rating)
	assert.Equal(t, ratingJSON{Average: 4.3, Total: 3}, list.Results[2].Rating, "average is rounded to one decimal")
	assert.Equal(t, ratingJSON{Average: 0, Total: 0}, list.Results[3].Rating)
}

func TestRestaurantList_SortByReviewCount(t *testing.T) {
	a := newApp(t)
	owner := a.newUser("สมชาย")
	seedRated(a, owner)

	list := getList(t, a, owner, "?sort=reviews")

	assert.Equal(t, []string{"A", "B", "D", "C"}, names(list), "most reviews first, equal counts by id")
}

func TestRestaurantList_SortComposesWithPagination(t *testing.T) {
	a := newApp(t)
	owner := a.newUser("สมชาย")
	seedRated(a, owner)

	second := getList(t, a, owner, "?sort=rating&limit=2&page=2")

	assert.Equal(t, 4, second.Total)
	assert.Equal(t, []string{"A", "C"}, names(second))
}

func TestRestaurantList_SearchByName(t *testing.T) {
	a := newApp(t)
	owner := a.newUser("สมชาย")
	for _, name := range []string{"Shabu Gold", "ชาบูทอง", "หมูกระทะ", "ปิ้งย่างทอง"} {
		a.seedRestaurant(owner, restaurantOpts{Name: name})
	}

	search := func(term string) listJSON {
		return getList(t, a, owner, "?name="+url.QueryEscape(term))
	}

	assert.Equal(t, []string{"ชาบูทอง"}, names(search("ชาบู")), "partial match")
	assert.Equal(t, []string{"Shabu Gold"}, names(search("SHABU")), "case-insensitive")
	assert.Equal(t, []string{"ปิ้งย่างทอง", "ชาบูทอง"}, names(search("ทอง")), "newest first among matches")
	assert.Equal(t, []string{"ชาบูทอง"}, names(search("  ชาบู  ")), "surrounding spaces are trimmed")
	assert.Equal(t, 4, search("   ").Total, "blank search is no filter")
	assert.Equal(t, 4, search("").Total, "empty search is no filter")

	none := a.do(owner, http.MethodGet, "/restaurants?name=zzz", nil)
	assert.JSONEq(t, `{"total":0,"results":[]}`, none.Body.String())
}

func TestRestaurantList_SearchEscapesWildcards(t *testing.T) {
	a := newApp(t)
	owner := a.newUser("สมชาย")
	for _, name := range []string{"100% beef", "plain", "a_b", "axb", `back\slash`} {
		a.seedRestaurant(owner, restaurantOpts{Name: name})
	}

	search := func(term string) []string {
		return names(getList(t, a, owner, "?name="+url.QueryEscape(term)))
	}

	assert.Equal(t, []string{"100% beef"}, search("%"), "% is a literal percent sign, not 'anything'")
	assert.Equal(t, []string{"a_b"}, search("_"), "_ is a literal underscore, not 'any one character'")
	assert.Equal(t, []string{"a_b"}, search("a_b"), "a_b must not match axb")
	assert.Equal(t, []string{`back\slash`}, search(`\`), "a backslash is literal too")
}

func TestRestaurantList_MineFilter(t *testing.T) {
	a := newApp(t)
	first := a.newUser("เจ้าของ 1")
	second := a.newUser("เจ้าของ 2")
	a.seedRestaurant(first, restaurantOpts{Name: "Alpha One"})
	a.seedRestaurant(first, restaurantOpts{Name: "Alpha Two"})
	a.seedRestaurant(second, restaurantOpts{Name: "Beta"})

	mine := getList(t, a, first, "?mine=true")
	assert.Equal(t, 2, mine.Total)
	assert.Equal(t, []string{"Alpha Two", "Alpha One"}, names(mine))

	assert.Equal(t, 3, getList(t, a, first, "").Total, "without mine every restaurant is listed")
	assert.Equal(t, 3, getList(t, a, first, "?mine=false").Total)
	assert.Equal(t, 1, getList(t, a, second, "?mine=true").Total)

	combined := getList(t, a, first, "?mine=true&name=two")
	assert.Equal(t, []string{"Alpha Two"}, names(combined), "filters combine")

	otherOwners := getList(t, a, first, "?name=beta")
	assert.Equal(t, []string{"Beta"}, names(otherOwners), "without mine, other owners' restaurants match too")
}
