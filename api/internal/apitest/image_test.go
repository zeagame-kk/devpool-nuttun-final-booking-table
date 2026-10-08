package apitest

import (
	"bytes"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"strconv"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// maxImageBytes is the documented upload limit: 2 MB.
const maxImageBytes = 2 << 20

// Files are made of the real signature bytes each format starts with, padded to the wanted size.
func padded(signature []byte, size int) []byte {
	if size < len(signature) {
		size = len(signature)
	}
	return append(append([]byte{}, signature...), bytes.Repeat([]byte{0x2a}, size-len(signature))...)
}

func pngFile(size int) []byte  { return padded([]byte("\x89PNG\r\n\x1a\n"), size) }
func jpegFile(size int) []byte { return padded([]byte("\xff\xd8\xff\xe0\x00\x10JFIF"), size) }
func webpFile(size int) []byte { return padded([]byte("RIFF\x00\x00\x00\x00WEBPVP8 "), size) }
func gifFile(size int) []byte  { return padded([]byte("GIF89a"), size) }

func imagePath(restaurantID int) string {
	return "/restaurants/" + strconv.Itoa(restaurantID) + "/image"
}

func imageURLOf(t *testing.T, a *app, viewer uuid.UUID, restaurantID int) *string {
	t.Helper()

	return decode[restaurantJSON](t, a.do(viewer, http.MethodGet, "/restaurants/"+strconv.Itoa(restaurantID), nil)).ImageURL
}

func TestImageUpload_Success(t *testing.T) {
	a := newApp(t)
	owner := a.newUser("เจ้าของ")
	restaurantID := a.seedRestaurant(owner, restaurantOpts{})
	content := pngFile(1024)

	response := a.upload(owner, imagePath(restaurantID), "front.png", content)

	require.Equal(t, http.StatusOK, response.Code, response.Body.String())
	got := decode[restaurantJSON](t, response)
	require.NotNil(t, got.ImageURL)
	assert.Regexp(t, regexp.MustCompile(`^/uploads/restaurants/`+strconv.Itoa(restaurantID)+`-[0-9a-f-]{36}\.png$`), *got.ImageURL)
	assert.Equal(t, got.ImageURL, imageURLOf(t, a, owner, restaurantID), "the detail page shows it too")

	stored, err := os.ReadFile(filepath.Join(a.uploadDir, "restaurants", path.Base(*got.ImageURL)))
	require.NoError(t, err)
	assert.Equal(t, content, stored)

	t.Run("served to anyone without credentials", func(t *testing.T) {
		served := a.do(uuid.Nil, http.MethodGet, *got.ImageURL, nil)

		assert.Equal(t, http.StatusOK, served.Code)
		assert.Equal(t, content, served.Body.Bytes())
		assert.Equal(t, "image/png", served.Header().Get("Content-Type"))
		assert.Equal(t, "nosniff", served.Header().Get("X-Content-Type-Options"))
	})
}

func TestImageUpload_AcceptsJpegPngAndWebp(t *testing.T) {
	cases := []struct {
		name    string
		content []byte
		suffix  string
	}{
		{"jpeg", jpegFile(512), ".jpg"},
		{"png", pngFile(512), ".png"},
		{"webp", webpFile(512), ".webp"},
		{"exactly the size limit", pngFile(maxImageBytes), ".png"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			a := newApp(t)
			owner := a.newUser("เจ้าของ")
			restaurantID := a.seedRestaurant(owner, restaurantOpts{})

			// The extension comes from the content, whatever the client calls the file.
			response := a.upload(owner, imagePath(restaurantID), "whatever.bin", tc.content)

			require.Equal(t, http.StatusOK, response.Code, response.Body.String())
			assert.Regexp(t, regexp.MustCompile(`\`+tc.suffix+`$`), *decode[restaurantJSON](t, response).ImageURL)
		})
	}
}

func TestImageUpload_ReplacingDeletesTheOldFile(t *testing.T) {
	a := newApp(t)
	owner := a.newUser("เจ้าของ")
	restaurantID := a.seedRestaurant(owner, restaurantOpts{})

	first := *decode[restaurantJSON](t, a.upload(owner, imagePath(restaurantID), "a.png", pngFile(100))).ImageURL
	second := *decode[restaurantJSON](t, a.upload(owner, imagePath(restaurantID), "b.jpg", jpegFile(100))).ImageURL

	assert.NotEqual(t, first, second)
	assert.Equal(t, []string{path.Base(second)}, a.storedImages(), "only the new file is kept")
	assert.Equal(t, http.StatusNotFound, a.do(uuid.Nil, http.MethodGet, first, nil).Code)
	assert.Equal(t, http.StatusOK, a.do(uuid.Nil, http.MethodGet, second, nil).Code)
}

// What matters is what the bytes are, not what the client says they are: a file called .png that
// is really text, an empty file and an oversized file must all be refused.
func TestImageUpload_RejectsSpoofedEmptyAndOversized(t *testing.T) {
	cases := []struct {
		name     string
		filename string
		content  []byte
	}{
		{"text called .png", "evil.png", []byte("this is not a picture")},
		{"html called .jpg", "page.jpg", []byte("<html><script>alert(1)</script></html>")},
		{"script called .webp", "run.webp", []byte("#!/bin/sh\nrm -rf /\n")},
		{"svg is not allowed", "logo.svg", []byte(`<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>`)},
		{"gif is a picture but not an allowed one", "party.gif", gifFile(100)},
		{"empty file", "empty.png", nil},
		{"one byte over 2 MB", "huge.png", pngFile(maxImageBytes + 1)},
		{"far over 2 MB", "enormous.png", pngFile(5 << 20)},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			a := newApp(t)
			owner := a.newUser("เจ้าของ")
			restaurantID := a.seedRestaurant(owner, restaurantOpts{})

			response := a.upload(owner, imagePath(restaurantID), tc.filename, tc.content)

			assertRejected(t, response, http.StatusBadRequest, "invalid_image")
			assert.Empty(t, a.storedImages(), "nothing is written for a rejected upload")
			assert.Nil(t, imageURLOf(t, a, owner, restaurantID))
		})
	}

	t.Run("no file in the request", func(t *testing.T) {
		a := newApp(t)
		owner := a.newUser("เจ้าของ")
		restaurantID := a.seedRestaurant(owner, restaurantOpts{})

		wrongField := a.uploadField(owner, imagePath(restaurantID), "picture", "a.png", pngFile(100))
		notMultipart := a.do(owner, http.MethodPost, imagePath(restaurantID), map[string]any{"file": "abc"})

		assert.Equal(t, http.StatusBadRequest, wrongField.Code)
		assert.Equal(t, http.StatusBadRequest, notMultipart.Code)
		assert.Empty(t, a.storedImages())
	})

	t.Run("a bad upload keeps the picture the restaurant already has", func(t *testing.T) {
		a := newApp(t)
		owner := a.newUser("เจ้าของ")
		restaurantID := a.seedRestaurant(owner, restaurantOpts{})
		good := *decode[restaurantJSON](t, a.upload(owner, imagePath(restaurantID), "a.png", pngFile(100))).ImageURL

		assertRejected(t, a.upload(owner, imagePath(restaurantID), "b.png", []byte("nope")), http.StatusBadRequest, "invalid_image")

		assert.Equal(t, good, *imageURLOf(t, a, owner, restaurantID))
		assert.Equal(t, []string{path.Base(good)}, a.storedImages())
	})
}

func TestImageUpload_NeverUsesTheClientsFileName(t *testing.T) {
	a := newApp(t)
	owner := a.newUser("เจ้าของ")
	restaurantID := a.seedRestaurant(owner, restaurantOpts{})

	response := a.upload(owner, imagePath(restaurantID), "../../evil.png", pngFile(100))

	require.Equal(t, http.StatusOK, response.Code, response.Body.String())
	stored := a.storedImages()
	require.Len(t, stored, 1)
	assert.NotContains(t, stored[0], "evil")
	assert.Regexp(t, regexp.MustCompile(`^`+strconv.Itoa(restaurantID)+`-[0-9a-f-]{36}\.png$`), stored[0])

	_, err := os.Stat(filepath.Join(filepath.Dir(a.uploadDir), "evil.png"))
	assert.True(t, os.IsNotExist(err), "nothing is written outside the upload folder")
}

func TestImageUpload_OnlyTheOwner(t *testing.T) {
	a := newApp(t)
	owner := a.newUser("เจ้าของ")
	stranger := a.newUser("คนอื่น")
	restaurantID := a.seedRestaurant(owner, restaurantOpts{})

	assert.Equal(t, http.StatusForbidden, a.upload(stranger, imagePath(restaurantID), "a.png", pngFile(100)).Code)
	assert.Empty(t, a.storedImages(), "a forbidden upload is not stored")

	// Who may upload is decided before the file is even looked at, so a bad file or no file at
	// all cannot turn a 403 or 404 into a 400.
	assert.Equal(t, http.StatusForbidden, a.upload(stranger, imagePath(restaurantID), "a.png", []byte("not a picture")).Code)
	assert.Equal(t, http.StatusForbidden, a.uploadField(stranger, imagePath(restaurantID), "picture", "a.png", pngFile(100)).Code)
	assert.Equal(t, http.StatusForbidden, a.upload(stranger, imagePath(restaurantID), "huge.png", pngFile(5<<20)).Code)
	assert.Equal(t, http.StatusNotFound, a.upload(owner, imagePath(9999), "a.png", []byte("not a picture")).Code)
	assert.Equal(t, http.StatusNotFound, a.upload(owner, imagePath(9999), "a.png", pngFile(100)).Code)
	assert.Equal(t, http.StatusBadRequest, a.upload(owner, "/restaurants/abc/image", "a.png", pngFile(100)).Code)
	assert.Equal(t, http.StatusUnauthorized, a.upload(uuid.Nil, imagePath(restaurantID), "a.png", pngFile(100)).Code)
}

func TestImageRemove(t *testing.T) {
	a := newApp(t)
	owner := a.newUser("เจ้าของ")
	stranger := a.newUser("คนอื่น")
	restaurantID := a.seedRestaurant(owner, restaurantOpts{})
	uploaded := *decode[restaurantJSON](t, a.upload(owner, imagePath(restaurantID), "a.png", pngFile(100))).ImageURL

	assert.Equal(t, http.StatusForbidden, a.do(stranger, http.MethodDelete, imagePath(restaurantID), nil).Code)
	assert.NotNil(t, imageURLOf(t, a, owner, restaurantID), "a stranger cannot remove it")

	response := a.do(owner, http.MethodDelete, imagePath(restaurantID), nil)

	assert.Equal(t, http.StatusNoContent, response.Code, response.Body.String())
	assert.Nil(t, imageURLOf(t, a, owner, restaurantID))
	assert.Empty(t, a.storedImages(), "the file is deleted too")
	assert.Equal(t, http.StatusNotFound, a.do(uuid.Nil, http.MethodGet, uploaded, nil).Code)

	assert.Equal(t, http.StatusNoContent, a.do(owner, http.MethodDelete, imagePath(restaurantID), nil).Code, "removing nothing is fine")
	assert.Equal(t, http.StatusNotFound, a.do(owner, http.MethodDelete, imagePath(9999), nil).Code)
	assert.Equal(t, http.StatusUnauthorized, a.do(uuid.Nil, http.MethodDelete, imagePath(restaurantID), nil).Code)
}

func TestImageUpload_DeletingTheRestaurantKeepsTheFile(t *testing.T) {
	a := newApp(t)
	owner := a.newUser("เจ้าของ")
	restaurantID := a.seedRestaurant(owner, restaurantOpts{})
	uploaded := *decode[restaurantJSON](t, a.upload(owner, imagePath(restaurantID), "a.png", pngFile(100))).ImageURL

	require.Equal(t, http.StatusNoContent, a.do(owner, http.MethodDelete, "/restaurants/"+strconv.Itoa(restaurantID), nil).Code)

	assert.Equal(t, []string{path.Base(uploaded)}, a.storedImages(), "soft delete leaves the file alone")
}

func TestUploadsRoute_OnlyServesFilesInsideTheFolder(t *testing.T) {
	a := newApp(t)
	owner := a.newUser("เจ้าของ")
	restaurantID := a.seedRestaurant(owner, restaurantOpts{})
	uploaded := *decode[restaurantJSON](t, a.upload(owner, imagePath(restaurantID), "a.png", pngFile(100))).ImageURL
	secret := filepath.Join(filepath.Dir(a.uploadDir), "secret.txt")
	require.NoError(t, os.WriteFile(secret, []byte("do not serve"), 0o600))

	// The router tidies up ".." before the static handler sees a path, so most of the traversal
	// attempts below never reach it; they are kept as a regression guard in case that changes.
	// The directory listing and missing-file cases do exercise the static handler itself.
	for _, target := range []string{
		"/uploads/restaurants/",            // a directory listing
		"/uploads/",                        // the folder itself
		"/uploads/restaurants/missing.png", // nothing there
		"/uploads/../secret.txt",           // classic traversal
		"/uploads/restaurants/../../secret.txt",
		"/uploads/..%2fsecret.txt",
		"/uploads/%2e%2e/secret.txt",
	} {
		response := a.do(uuid.Nil, http.MethodGet, target, nil)

		assert.NotEqual(t, http.StatusOK, response.Code, target)
		assert.NotContains(t, response.Body.String(), "do not serve", target)
	}

	assert.Equal(t, http.StatusOK, a.do(uuid.Nil, http.MethodGet, uploaded, nil).Code, "the real file is still served")
}
