package restaurant

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"
)

// ImageStorage keeps the picture files. The service decides the names; the storage writes and
// removes them and knows where they are served from.
type ImageStorage interface {
	Save(name string, content io.Reader) error
	Delete(name string) error
	URL(name string) string
	NameFromURL(url string) (name string, ok bool)
}

type Repository interface {
	Create(ctx context.Context, restaurant Restaurant) (*Restaurant, error)
	FindByID(ctx context.Context, id int, viewerID uuid.UUID) (*Restaurant, error)
	Replace(ctx context.Context, restaurant Restaurant) error
	DeleteIfNoActiveReservations(ctx context.Context, id int, now time.Time) error
	List(ctx context.Context, viewerID uuid.UUID, query ListQuery) ([]Restaurant, int64, error)
	SetImageURL(ctx context.Context, id int, imageURL *string) error
}

type service struct {
	repository Repository
	images     ImageStorage
	now        func() time.Time
}

func NewService(repo Repository, images ImageStorage, now func() time.Time) *service {
	return &service{repository: repo, images: images, now: now}
}

func (svc *service) Create(ctx context.Context, ownerID uuid.UUID, restaurant Restaurant) (*Restaurant, error) {
	if err := validate(restaurant); err != nil {
		return nil, err
	}

	restaurant.OwnerID = ownerID

	created, err := svc.repository.Create(ctx, restaurant)
	if err != nil {
		return nil, fmt.Errorf("create restaurant: %w", err)
	}

	return created, nil
}

func (svc *service) List(ctx context.Context, viewerID uuid.UUID, query ListQuery) ([]Restaurant, int64, error) {
	if hasNUL(query.Name) {
		return nil, 0, ErrInvalidInput
	}

	query.Ensure()

	restaurants, total, err := svc.repository.List(ctx, viewerID, query)
	if err != nil {
		return nil, 0, fmt.Errorf("list restaurants: %w", err)
	}

	return restaurants, total, nil
}

func (svc *service) Get(ctx context.Context, id int, viewerID uuid.UUID) (*Restaurant, error) {
	restaurant, err := svc.repository.FindByID(ctx, id, viewerID)
	if err != nil {
		return nil, fmt.Errorf("get restaurant: %w", err)
	}

	return restaurant, nil
}

func (svc *service) Replace(ctx context.Context, id int, userID uuid.UUID, restaurant Restaurant) (*Restaurant, error) {
	if _, err := svc.findOwned(ctx, id, userID); err != nil {
		return nil, fmt.Errorf("replace restaurant: %w", err)
	}

	if err := validate(restaurant); err != nil {
		return nil, err
	}

	restaurant.ID = id
	if err := svc.repository.Replace(ctx, restaurant); err != nil {
		return nil, fmt.Errorf("replace restaurant: %w", err)
	}

	replaced, err := svc.repository.FindByID(ctx, id, userID)
	if err != nil {
		return nil, fmt.Errorf("replace restaurant: %w", err)
	}

	return replaced, nil
}

func (svc *service) Delete(ctx context.Context, id int, userID uuid.UUID) error {
	if _, err := svc.findOwned(ctx, id, userID); err != nil {
		return fmt.Errorf("delete restaurant: %w", err)
	}

	if err := svc.repository.DeleteIfNoActiveReservations(ctx, id, svc.now()); err != nil {
		return fmt.Errorf("delete restaurant: %w", err)
	}

	return nil
}

// MaxImageBytes is the largest picture accepted.
const MaxImageBytes = 2 << 20

// imageExtensions maps what the bytes of a picture say it is to the file extension we store
// it under. Anything else, SVG and GIF included, is refused.
var imageExtensions = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/webp": ".webp",
}

// CheckOwner reports whether userID may change the restaurant: ErrRestaurantNotFound or
// ErrForbidden if not. The picture handler asks this before it reads the upload at all.
func (svc *service) CheckOwner(ctx context.Context, id int, userID uuid.UUID) error {
	if _, err := svc.findOwned(ctx, id, userID); err != nil {
		return fmt.Errorf("check restaurant owner: %w", err)
	}

	return nil
}

// SetImage replaces the restaurant's picture. The type is decided from the content (never the
// client's file name or content type), and the file is stored under a name made here.
func (svc *service) SetImage(ctx context.Context, id int, userID uuid.UUID, file io.Reader) (*Restaurant, error) {
	existing, err := svc.findOwned(ctx, id, userID)
	if err != nil {
		return nil, fmt.Errorf("set restaurant image: %w", err)
	}

	// Read one byte past the limit: that is how an oversized file is told from one that fits.
	data, err := io.ReadAll(io.LimitReader(file, MaxImageBytes+1))
	if err != nil {
		var tooLarge *http.MaxBytesError
		if errors.As(err, &tooLarge) {
			return nil, ErrInvalidImage
		}

		return nil, fmt.Errorf("read image: %w", err)
	}
	if len(data) == 0 || len(data) > MaxImageBytes {
		return nil, ErrInvalidImage
	}

	extension, allowed := imageExtensions[http.DetectContentType(data)]
	if !allowed {
		return nil, ErrInvalidImage
	}

	name := fmt.Sprintf("%d-%s%s", id, uuid.NewString(), extension)
	if err := svc.images.Save(name, bytes.NewReader(data)); err != nil {
		return nil, fmt.Errorf("set restaurant image: %w", err)
	}

	imageURL := svc.images.URL(name)
	if err := svc.repository.SetImageURL(ctx, id, &imageURL); err != nil {
		svc.removeFile(ctx, name)
		return nil, fmt.Errorf("set restaurant image: %w", err)
	}
	svc.removeFileAt(ctx, existing.ImageURL)

	updated, err := svc.repository.FindByID(ctx, id, userID)
	if err != nil {
		return nil, fmt.Errorf("set restaurant image: %w", err)
	}

	return updated, nil
}

// RemoveImage clears the restaurant's picture and deletes the file. Having no picture already
// is fine.
func (svc *service) RemoveImage(ctx context.Context, id int, userID uuid.UUID) error {
	existing, err := svc.findOwned(ctx, id, userID)
	if err != nil {
		return fmt.Errorf("remove restaurant image: %w", err)
	}

	if err := svc.repository.SetImageURL(ctx, id, nil); err != nil {
		return fmt.Errorf("remove restaurant image: %w", err)
	}
	svc.removeFileAt(ctx, existing.ImageURL)

	return nil
}

// removeFileAt deletes the file a stored image URL points to, if it is one of ours.
func (svc *service) removeFileAt(ctx context.Context, imageURL *string) {
	if imageURL == nil {
		return
	}

	if name, ok := svc.images.NameFromURL(*imageURL); ok {
		svc.removeFile(ctx, name)
	}
}

// removeFile is best effort: a file that cannot be deleted is logged, and does not fail the
// request that has already changed the database.
func (svc *service) removeFile(ctx context.Context, name string) {
	if err := svc.images.Delete(name); err != nil {
		slog.WarnContext(ctx, "could not delete restaurant image file", "name", name, "error", err)
	}
}

// findOwned loads an active restaurant and checks that userID owns it: ErrRestaurantNotFound
// if there is none, ErrForbidden if it belongs to someone else.
func (svc *service) findOwned(ctx context.Context, id int, userID uuid.UUID) (*Restaurant, error) {
	restaurant, err := svc.repository.FindByID(ctx, id, userID)
	if err != nil {
		return nil, err
	}

	if restaurant.OwnerID != userID {
		return nil, ErrForbidden
	}

	return restaurant, nil
}

// validate holds the rules the binding tags cannot express. PostgreSQL text cannot contain a
// NUL byte, so one in any text field would otherwise surface as a 500.
func validate(restaurant Restaurant) error {
	if strings.TrimSpace(restaurant.Name) == "" || strings.TrimSpace(restaurant.Address) == "" {
		return ErrInvalidInput
	}

	if hasNUL(restaurant.Name) || hasNUL(restaurant.Address) {
		return ErrInvalidInput
	}
	if restaurant.Description != nil && hasNUL(*restaurant.Description) {
		return ErrInvalidInput
	}

	return validateOpeningHours(restaurant.OpeningHours)
}

func hasNUL(text string) bool { return strings.ContainsRune(text, 0) }

var hhmmPattern = regexp.MustCompile(`^([01]\d|2[0-3]):[0-5]\d$`)

// validateOpeningHours requires at least one day, one entry per weekday, "HH:MM" times and
// close after open. Zero-padded "HH:MM" strings compare correctly as text.
func validateOpeningHours(hours []OpeningHour) error {
	if len(hours) == 0 {
		return ErrInvalidOpeningHours
	}

	seen := make(map[int]bool, len(hours))
	for _, hour := range hours {
		if hour.Weekday < 0 || hour.Weekday > 6 || seen[hour.Weekday] {
			return ErrInvalidOpeningHours
		}
		seen[hour.Weekday] = true

		if !hhmmPattern.MatchString(hour.OpenTime) || !hhmmPattern.MatchString(hour.CloseTime) {
			return ErrInvalidOpeningHours
		}
		if hour.CloseTime <= hour.OpenTime {
			return ErrInvalidOpeningHours
		}
	}

	return nil
}
