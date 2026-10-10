package apitest

import (
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type reviewJSON struct {
	ID        int       `json:"id"`
	Rating    int       `json:"rating"`
	Comment   string    `json:"comment"`
	User      person    `json:"user"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type reviewListJSON struct {
	Total   int          `json:"total"`
	Results []reviewJSON `json:"results"`
}

func reviewsPath(restaurantID int) string {
	return "/restaurants/" + strconv.Itoa(restaurantID) + "/reviews"
}

func reviewBody(rating any, comment any) map[string]any {
	return map[string]any{"rating": rating, "comment": comment}
}

func (a *app) writeReview(as uuid.UUID, restaurantID int, rating int, comment string) *httptest.ResponseRecorder {
	a.t.Helper()

	return a.do(as, http.MethodPost, reviewsPath(restaurantID), reviewBody(rating, comment))
}

func countReviews(t *testing.T, a *app) int64 {
	t.Helper()

	var n int64
	require.NoError(t, a.db.Raw("SELECT count(*) FROM reviews").Scan(&n).Error)
	return n
}

func TestReviewCreate_Success(t *testing.T) {
	a := newApp(t)
	owner := a.newUser("เจ้าของ")
	customer := a.newUser("สมศรี")
	other := a.newUser("คนอื่น")
	restaurantID := a.seedRestaurant(owner, restaurantOpts{})

	// No reservation is needed to review.
	created := a.writeReview(customer, restaurantID, 5, "น้ำซุปอร่อยมาก")

	require.Equal(t, http.StatusCreated, created.Code, created.Body.String())
	reviewID := decode[idJSON](t, created).ID
	require.Positive(t, reviewID)

	asReviewer := decode[restaurantJSON](t, a.do(customer, http.MethodGet, "/restaurants/"+strconv.Itoa(restaurantID), nil))
	assert.Equal(t, ratingJSON{Average: 5, Total: 1}, asReviewer.Rating)
	require.NotNil(t, asReviewer.MyReview)
	assert.Equal(t, myReviewJSON{ID: reviewID, Rating: 5, Comment: "น้ำซุปอร่อยมาก"}, *asReviewer.MyReview)

	asOther := decode[restaurantJSON](t, a.do(other, http.MethodGet, "/restaurants/"+strconv.Itoa(restaurantID), nil))
	assert.Nil(t, asOther.MyReview, "someone else's review is not 'my review'")
	assert.Equal(t, ratingJSON{Average: 5, Total: 1}, asOther.Rating)
}

func TestReviewCreate_Validation(t *testing.T) {
	cases := map[string]map[string]any{
		"rating 0":             reviewBody(0, "ดี"),
		"rating 6":             reviewBody(6, "ดี"),
		"rating negative":      reviewBody(-1, "ดี"),
		"rating fractional":    reviewBody(3.5, "ดี"),
		"rating as string":     reviewBody("5", "ดี"),
		"rating missing":       {"comment": "ดี"},
		"comment empty":        reviewBody(5, ""),
		"comment blank":        reviewBody(5, "   \n\t"),
		"comment missing":      {"rating": 5},
		"comment with NUL":     reviewBody(5, "ดี\x00มาก"),
		"comment not a string": reviewBody(5, 42),
	}

	for name, body := range cases {
		t.Run(name, func(t *testing.T) {
			a := newApp(t)
			owner := a.newUser("เจ้าของ")
			customer := a.newUser("ลูกค้า")
			restaurantID := a.seedRestaurant(owner, restaurantOpts{})

			response := a.do(customer, http.MethodPost, reviewsPath(restaurantID), body)

			assert.Equal(t, http.StatusBadRequest, response.Code, response.Body.String())
			assert.Zero(t, countReviews(t, a))
		})
	}

	t.Run("boundary ratings 1 and 5 are accepted", func(t *testing.T) {
		a := newApp(t)
		owner := a.newUser("เจ้าของ")
		restaurantID := a.seedRestaurant(owner, restaurantOpts{})

		assert.Equal(t, http.StatusCreated, a.writeReview(a.newUser("ก"), restaurantID, 1, "แย่").Code)
		assert.Equal(t, http.StatusCreated, a.writeReview(a.newUser("ข"), restaurantID, 5, "ดีเยี่ยม").Code)
	})

	t.Run("malformed json and bad restaurant id", func(t *testing.T) {
		a := newApp(t)
		customer := a.newUser("ลูกค้า")

		assert.Equal(t, http.StatusBadRequest, a.do(customer, http.MethodPost, reviewsPath(1), `{"rating":`).Code)
		assert.Equal(t, http.StatusBadRequest, a.do(customer, http.MethodPost, "/restaurants/abc/reviews", reviewBody(5, "ดี")).Code)
	})
}

func TestReviewCreate_NotOnYourOwnRestaurant(t *testing.T) {
	a := newApp(t)
	owner := a.newUser("เจ้าของ")
	restaurantID := a.seedRestaurant(owner, restaurantOpts{})

	response := a.writeReview(owner, restaurantID, 5, "ร้านฉันดีที่สุด")

	assertRejected(t, response, http.StatusForbidden, "cannot_review_own_restaurant")
	assert.Zero(t, countReviews(t, a))
}

func TestReviewCreate_OnlyOncePerRestaurant(t *testing.T) {
	a := newApp(t)
	owner := a.newUser("เจ้าของ")
	customer := a.newUser("ลูกค้า")
	restaurantID := a.seedRestaurant(owner, restaurantOpts{})
	otherRestaurant := a.seedRestaurant(owner, restaurantOpts{Name: "อีกร้าน"})
	require.Equal(t, http.StatusCreated, a.writeReview(customer, restaurantID, 5, "ดี").Code)

	assertRejected(t, a.writeReview(customer, restaurantID, 1, "เปลี่ยนใจ"), http.StatusConflict, "already_reviewed")
	assert.Equal(t, http.StatusCreated, a.writeReview(customer, otherRestaurant, 4, "อีกร้านก็ดี").Code, "one review per restaurant, not one in total")
	assert.Equal(t, int64(2), countReviews(t, a))
}

// The same customer submits the review ten times at once. The database's unique key decides who
// wins, and every loser must get a clean 409, not a 500 from the constraint violation.
func TestReviewCreate_ConcurrentDuplicatesYieldOneReview(t *testing.T) {
	a := newApp(t)
	owner := a.newUser("เจ้าของ")
	customer := a.newUser("ลูกค้า")
	restaurantID := a.seedRestaurant(owner, restaurantOpts{})

	const requests = 10
	a.warmPool(requests)
	responses := make([]*httptest.ResponseRecorder, requests)
	runTogether(requests, func(index int) {
		responses[index] = a.writeReview(customer, restaurantID, 5, "ดี")
	})

	created, duplicates := 0, 0
	for _, response := range responses {
		switch response.Code {
		case http.StatusCreated:
			created++
		case http.StatusConflict:
			assert.Equal(t, "already_reviewed", decode[errorJSON](t, response).Code)
			duplicates++
		default:
			t.Errorf("unexpected status %d: %s", response.Code, response.Body.String())
		}
	}
	assert.Equal(t, 1, created)
	assert.Equal(t, requests-1, duplicates)
	assert.Equal(t, int64(1), countReviews(t, a))
}

func TestReviewCreate_RestaurantMissingOrDeleted(t *testing.T) {
	a := newApp(t)
	owner := a.newUser("เจ้าของ")
	customer := a.newUser("ลูกค้า")
	deleted := a.seedRestaurant(owner, restaurantOpts{})
	require.NoError(t, a.db.Exec("UPDATE restaurants SET deleted_at = now() WHERE id = ?", deleted).Error)

	assert.Equal(t, http.StatusNotFound, a.writeReview(customer, 9999, 5, "ดี").Code)
	assert.Equal(t, http.StatusNotFound, a.writeReview(customer, deleted, 5, "ดี").Code)
}

func TestReviewUpdateMine(t *testing.T) {
	setup := func(t *testing.T) (a *app, owner, customer uuid.UUID, restaurantID int) {
		t.Helper()
		a = newApp(t)
		owner = a.newUser("เจ้าของ")
		customer = a.newUser("สมศรี")
		restaurantID = a.seedRestaurant(owner, restaurantOpts{})
		return a, owner, customer, restaurantID
	}
	mine := func(restaurantID int) string { return reviewsPath(restaurantID) + "/me" }

	t.Run("changes rating and comment, and the restaurant's average follows", func(t *testing.T) {
		a, _, customer, restaurantID := setup(t)
		friend := a.newUser("เพื่อน")
		created := a.writeReview(customer, restaurantID, 5, "ดี")
		require.Equal(t, http.StatusCreated, created.Code)
		require.Equal(t, http.StatusCreated, a.writeReview(friend, restaurantID, 3, "พอใช้").Code)

		response := a.do(customer, http.MethodPut, mine(restaurantID), reviewBody(2, "ครั้งหลังแย่ลง"))

		require.Equal(t, http.StatusOK, response.Code, response.Body.String())
		got := decode[reviewJSON](t, response)
		assert.Equal(t, decode[idJSON](t, created).ID, got.ID, "same review, updated in place")
		assert.Equal(t, 2, got.Rating)
		assert.Equal(t, "ครั้งหลังแย่ลง", got.Comment)
		assert.Equal(t, "สมศรี", got.User.Name)
		assert.Equal(t, customer.String(), got.User.ID)
		assert.False(t, got.UpdatedAt.Before(got.CreatedAt))

		detail := decode[restaurantJSON](t, a.do(customer, http.MethodGet, "/restaurants/"+strconv.Itoa(restaurantID), nil))
		assert.Equal(t, ratingJSON{Average: 2.5, Total: 2}, detail.Rating, "(2 + 3) / 2, still two reviews")
		assert.Equal(t, int64(2), countReviews(t, a))

		friendsOwn := decode[restaurantJSON](t, a.do(friend, http.MethodGet, "/restaurants/"+strconv.Itoa(restaurantID), nil))
		assert.Equal(t, myReviewJSON{ID: friendsOwn.MyReview.ID, Rating: 3, Comment: "พอใช้"}, *friendsOwn.MyReview, "the other review is untouched")
	})

	t.Run("nothing to update before reviewing", func(t *testing.T) {
		a, _, customer, restaurantID := setup(t)

		assert.Equal(t, http.StatusNotFound, a.do(customer, http.MethodPut, mine(restaurantID), reviewBody(4, "ดี")).Code)
	})

	t.Run("the owner has no review to update", func(t *testing.T) {
		a, owner, _, restaurantID := setup(t)

		assert.Equal(t, http.StatusNotFound, a.do(owner, http.MethodPut, mine(restaurantID), reviewBody(4, "ดี")).Code)
	})

	t.Run("same validation as creating", func(t *testing.T) {
		a, _, customer, restaurantID := setup(t)
		require.Equal(t, http.StatusCreated, a.writeReview(customer, restaurantID, 5, "ดี").Code)

		for _, body := range []map[string]any{reviewBody(0, "ดี"), reviewBody(6, "ดี"), reviewBody(5, ""), reviewBody(5, "  ")} {
			assert.Equal(t, http.StatusBadRequest, a.do(customer, http.MethodPut, mine(restaurantID), body).Code)
		}
		stored := decode[restaurantJSON](t, a.do(customer, http.MethodGet, "/restaurants/"+strconv.Itoa(restaurantID), nil))
		assert.Equal(t, 5, stored.MyReview.Rating, "rejected updates change nothing")
	})

	t.Run("missing restaurant", func(t *testing.T) {
		a, _, customer, _ := setup(t)

		assert.Equal(t, http.StatusNotFound, a.do(customer, http.MethodPut, mine(9999), reviewBody(4, "ดี")).Code)
		assert.Equal(t, http.StatusBadRequest, a.do(customer, http.MethodPut, "/restaurants/abc/reviews/me", reviewBody(4, "ดี")).Code)
	})
}

func TestReviewList(t *testing.T) {
	a := newApp(t)
	owner := a.newUser("เจ้าของ")
	first := a.newUser("สมศรี")
	second := a.newUser("สมหมาย")
	viewer := a.newUser("คนดู")
	restaurantID := a.seedRestaurant(owner, restaurantOpts{})
	otherRestaurant := a.seedRestaurant(owner, restaurantOpts{Name: "อีกร้าน"})

	require.Equal(t, http.StatusCreated, a.writeReview(first, restaurantID, 5, "รีวิวแรก").Code)
	require.Equal(t, http.StatusCreated, a.writeReview(second, restaurantID, 3, "รีวิวสอง").Code)
	require.Equal(t, http.StatusCreated, a.writeReview(first, otherRestaurant, 1, "ร้านอื่น").Code)

	response := a.do(viewer, http.MethodGet, reviewsPath(restaurantID), nil)

	require.Equal(t, http.StatusOK, response.Code, response.Body.String())
	list := decode[reviewListJSON](t, response)
	assert.Equal(t, 2, list.Total, "only this restaurant's reviews")
	require.Len(t, list.Results, 2)
	assert.Equal(t, "รีวิวสอง", list.Results[0].Comment, "newest first")
	assert.Equal(t, "สมหมาย", list.Results[0].User.Name)
	assert.Equal(t, "รีวิวแรก", list.Results[1].Comment)
	assert.Equal(t, "สมศรี", list.Results[1].User.Name)
	assert.NotContains(t, response.Body.String(), "@", "reviewers are shown by name, never by email")

	t.Run("no reviews is an empty array", func(t *testing.T) {
		empty := a.seedRestaurant(owner, restaurantOpts{Name: "ร้านใหม่"})

		assert.JSONEq(t, `{"total":0,"results":[]}`, a.do(viewer, http.MethodGet, reviewsPath(empty), nil).Body.String())
	})

	t.Run("missing restaurant", func(t *testing.T) {
		assert.Equal(t, http.StatusNotFound, a.do(viewer, http.MethodGet, reviewsPath(9999), nil).Code)
		assert.Equal(t, http.StatusBadRequest, a.do(viewer, http.MethodGet, "/restaurants/abc/reviews", nil).Code)
	})
}

func TestReview_RequiresAuth(t *testing.T) {
	a := newApp(t)

	assert.Equal(t, http.StatusUnauthorized, a.do(uuid.Nil, http.MethodPost, reviewsPath(1), reviewBody(5, "ดี")).Code)
	assert.Equal(t, http.StatusUnauthorized, a.do(uuid.Nil, http.MethodPut, reviewsPath(1)+"/me", reviewBody(5, "ดี")).Code)
	assert.Equal(t, http.StatusUnauthorized, a.do(uuid.Nil, http.MethodGet, reviewsPath(1), nil).Code)
}

type reviewOfMineJSON struct {
	ID         int       `json:"id"`
	Rating     int       `json:"rating"`
	Comment    string    `json:"comment"`
	Restaurant restRef   `json:"restaurant"`
	CreatedAt  time.Time `json:"createdAt"`
	UpdatedAt  time.Time `json:"updatedAt"`
}

type restRef struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

func TestReviewListMine(t *testing.T) {
	a := newApp(t)
	owner := a.newUser("เจ้าของ")
	me := a.newUser("ฉัน")
	someoneElse := a.newUser("คนอื่น")
	first := a.seedRestaurant(owner, restaurantOpts{Name: "ร้านแรก"})
	second := a.seedRestaurant(owner, restaurantOpts{Name: "ร้านสอง"})
	gone := a.seedRestaurant(owner, restaurantOpts{Name: "ร้านที่ปิดไปแล้ว"})
	a.seedReview(first, me, 4)
	a.seedReview(second, me, 2)
	a.seedReview(gone, me, 5)
	a.seedReview(first, someoneElse, 1)
	require.NoError(t, a.db.Exec("UPDATE restaurants SET deleted_at = now() WHERE id = ?", gone).Error)
	// Make the order depend on the last edit, not on the order of insertion.
	require.NoError(t, a.db.Exec("UPDATE reviews SET updated_at = ? WHERE restaurant_id = ? AND user_id = ?", mondayAt(10, 0), first, me).Error)
	require.NoError(t, a.db.Exec("UPDATE reviews SET updated_at = ? WHERE restaurant_id = ? AND user_id = ?", mondayAt(8, 0), second, me).Error)

	t.Run("only my reviews, newest edit first, with the restaurant's name", func(t *testing.T) {
		response := a.do(me, http.MethodGet, "/reviews", nil)

		require.Equal(t, http.StatusOK, response.Code, response.Body.String())
		list := decode[struct {
			Total   int                `json:"total"`
			Results []reviewOfMineJSON `json:"results"`
		}](t, response)
		require.Equal(t, 2, list.Total, "someone else's review and a deleted restaurant's review are left out")
		require.Len(t, list.Results, 2)
		assert.Equal(t, restRef{ID: first, Name: "ร้านแรก"}, list.Results[0].Restaurant)
		assert.Equal(t, 4, list.Results[0].Rating)
		assert.Equal(t, "รีวิวทดสอบ", list.Results[0].Comment)
		assert.Equal(t, restRef{ID: second, Name: "ร้านสอง"}, list.Results[1].Restaurant)
	})

	t.Run("a user with no reviews gets an empty array, not null", func(t *testing.T) {
		response := a.do(owner, http.MethodGet, "/reviews", nil)

		require.Equal(t, http.StatusOK, response.Code)
		assert.JSONEq(t, `{"total":0,"results":[]}`, response.Body.String())
	})

	t.Run("needs credentials", func(t *testing.T) {
		response := a.do(uuid.Nil, http.MethodGet, "/reviews", nil)

		assert.Equal(t, http.StatusUnauthorized, response.Code)
	})
}
