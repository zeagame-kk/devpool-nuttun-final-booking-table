package apitest

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/textproto"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"bookingtable/internal/httpapi"
	"bookingtable/internal/httputil"
	"bookingtable/internal/reqctx"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/wait"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// One PostgreSQL container is shared by every test in the package; newApp
// truncates the tables so each test starts from an empty database.
var testDB *gorm.DB

// Fixed clock: Monday 2026-10-12 09:00 in Bangkok (weekday 1).
var (
	bangkok  = time.FixedZone("ICT", 7*3600)
	fixedNow = time.Date(2026, 10, 12, 9, 0, 0, 0, bangkok)
)

// useColimaIfNeeded points testcontainers at Colima's socket when Docker is not at the
// default location, so `go test` works without exporting variables by hand. Variables set
// by the caller always win.
func useColimaIfNeeded() {
	if os.Getenv("DOCKER_HOST") != "" {
		return
	}
	if _, err := os.Stat("/var/run/docker.sock"); err == nil {
		return
	}

	home, err := os.UserHomeDir()
	if err != nil {
		return
	}
	socket := filepath.Join(home, ".colima", "default", "docker.sock")
	if _, err := os.Stat(socket); err != nil {
		return
	}

	os.Setenv("DOCKER_HOST", "unix://"+socket)
	// The Ryuk reaper container bind-mounts the socket by its path inside the Colima VM.
	if os.Getenv("TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE") == "" {
		os.Setenv("TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE", "/var/run/docker.sock")
	}
}

func TestMain(m *testing.M) {
	ctx := context.Background()
	useColimaIfNeeded()

	container, db, err := startPostgres(ctx)
	if err != nil {
		fmt.Fprintln(os.Stderr, "apitest: start postgres:", err)
		os.Exit(1)
	}
	testDB = db

	code := m.Run()

	if err := container.Terminate(ctx); err != nil {
		fmt.Fprintln(os.Stderr, "apitest: terminate postgres:", err)
	}
	os.Exit(code)
}

func startPostgres(ctx context.Context) (testcontainers.Container, *gorm.DB, error) {
	script, cleanup, err := writeMigrationScript()
	if err != nil {
		return nil, nil, err
	}
	defer cleanup()

	container, err := testcontainers.GenericContainer(ctx, testcontainers.GenericContainerRequest{
		ContainerRequest: testcontainers.ContainerRequest{
			Image:        "postgres:17",
			ExposedPorts: []string{"5432/tcp"},
			Env: map[string]string{
				"POSTGRES_DB":       "bookingtable_test",
				"POSTGRES_USER":     "postgres",
				"POSTGRES_PASSWORD": "postgres",
			},
			Files: []testcontainers.ContainerFile{{
				HostFilePath:      script,
				ContainerFilePath: "/docker-entrypoint-initdb.d/001_migrations.sql",
				FileMode:          0o644,
			}},
			// The image restarts the server after running init scripts, so wait for the second "ready".
			WaitingFor: wait.ForAll(
				wait.ForLog("database system is ready to accept connections").WithOccurrence(2),
				wait.ForListeningPort("5432/tcp"),
			),
		},
		Started: true,
	})
	if err != nil {
		return nil, nil, err
	}

	host, err := container.Host(ctx)
	if err != nil {
		return container, nil, err
	}
	port, err := container.MappedPort(ctx, "5432/tcp")
	if err != nil {
		return container, nil, err
	}

	dsn := fmt.Sprintf("host=%s port=%s user=postgres password=postgres dbname=bookingtable_test sslmode=disable", host, port.Port())
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		return container, nil, err
	}

	// database/sql keeps only 2 idle connections by default. Concurrency tests would then open
	// their connections one after another and never really overlap.
	sqlDB, err := db.DB()
	if err != nil {
		return container, nil, err
	}
	sqlDB.SetMaxIdleConns(32)

	return container, db, nil
}

// writeMigrationScript concatenates the "-- +goose Up" half of every migration so the
// container builds the schema from the real migration files.
func writeMigrationScript() (path string, cleanup func(), err error) {
	paths, err := filepath.Glob(filepath.Join("..", "..", "migrations", "*.sql"))
	if err != nil {
		return "", nil, err
	}
	if len(paths) == 0 {
		return "", nil, fmt.Errorf("no migrations found")
	}

	var statements []string
	for _, p := range paths {
		contents, err := os.ReadFile(p)
		if err != nil {
			return "", nil, err
		}
		up, _, _ := strings.Cut(string(contents), "-- +goose Down")
		up = strings.TrimPrefix(strings.TrimSpace(up), "-- +goose Up")
		statements = append(statements, strings.TrimSpace(up))
	}

	dir, err := os.MkdirTemp("", "bookingtable-migrations-")
	if err != nil {
		return "", nil, err
	}
	path = filepath.Join(dir, "migrations.sql")
	if err := os.WriteFile(path, []byte(strings.Join(statements, "\n\n")), 0o600); err != nil {
		return "", nil, err
	}

	return path, func() { _ = os.RemoveAll(dir) }, nil
}

// app is one test's view of the API: a router wired like production, a fixed clock and a
// private upload directory.
type app struct {
	t         *testing.T
	db        *gorm.DB
	router    *gin.Engine
	now       time.Time
	uploadDir string
}

func newApp(t *testing.T) *app {
	t.Helper()

	require.NoError(t, testDB.Exec(
		"TRUNCATE reviews, reservations, restaurant_opening_hours, restaurants, users RESTART IDENTITY CASCADE",
	).Error)

	a := &app{t: t, db: testDB, now: fixedNow, uploadDir: t.TempDir()}

	gin.SetMode(gin.TestMode)
	router := gin.New()
	httpapi.RegisterAPI(router.Group("/api/v1"), httpapi.Deps{
		DB:        testDB,
		Auth:      fakeAuth,
		Now:       func() time.Time { return a.now },
		UploadDir: a.uploadDir,
	})
	a.router = router

	return a
}

// fakeAuth replaces the Keycloak JWT middleware: the caller is whoever the
// X-Test-User header names, and no header means 401.
func fakeAuth(ctx *gin.Context) {
	id, err := uuid.Parse(ctx.GetHeader("X-Test-User"))
	if err != nil {
		ctx.AbortWithStatusJSON(http.StatusUnauthorized, httputil.ErrorResponse{Message: "unauthorized"})
		return
	}

	ctx.Request = ctx.Request.WithContext(reqctx.WithUserID(ctx.Request.Context(), id))
	ctx.Next()
}

func (a *app) setNow(now time.Time) { a.now = now }

// warmPool opens n connections at the same moment and leaves them idle, so that the next n
// simultaneous requests all start immediately instead of waiting for a connection to be made.
func (a *app) warmPool(n int) {
	a.t.Helper()

	var wg sync.WaitGroup
	for range n {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_ = a.db.Exec("SELECT pg_sleep(0.1)").Error
		}()
	}
	wg.Wait()
}

// do sends a JSON request as the given user (uuid.Nil = no credentials). path is relative
// to /api/v1. A string body is sent as-is so tests can send malformed JSON.
func (a *app) do(as uuid.UUID, method, path string, body any) *httptest.ResponseRecorder {
	a.t.Helper()

	var reader io.Reader
	switch b := body.(type) {
	case nil:
	case string:
		reader = strings.NewReader(b)
	default:
		raw, err := json.Marshal(b)
		require.NoError(a.t, err)
		reader = bytes.NewReader(raw)
	}

	req := httptest.NewRequest(method, "/api/v1"+path, reader)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if as != uuid.Nil {
		req.Header.Set("X-Test-User", as.String())
	}

	return a.serve(req)
}

// upload sends a multipart request with one file in the "file" field.
func (a *app) upload(as uuid.UUID, path, filename string, content []byte) *httptest.ResponseRecorder {
	a.t.Helper()

	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)
	header := textproto.MIMEHeader{}
	header.Set("Content-Disposition", fmt.Sprintf(`form-data; name="file"; filename=%q`, filename))
	part, err := writer.CreatePart(header)
	require.NoError(a.t, err)
	_, err = part.Write(content)
	require.NoError(a.t, err)
	require.NoError(a.t, writer.Close())

	req := httptest.NewRequest(http.MethodPost, "/api/v1"+path, &buf)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	if as != uuid.Nil {
		req.Header.Set("X-Test-User", as.String())
	}

	return a.serve(req)
}

func (a *app) serve(req *http.Request) *httptest.ResponseRecorder {
	rec := httptest.NewRecorder()
	a.router.ServeHTTP(rec, req)
	return rec
}

// decode unmarshals a recorded response body into T.
func decode[T any](t *testing.T, rec *httptest.ResponseRecorder) T {
	t.Helper()

	var out T
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &out), "body: %s", rec.Body.String())
	return out
}

func (a *app) newUser(name string) uuid.UUID {
	a.t.Helper()

	id := uuid.New()
	require.NoError(a.t, a.db.Exec(
		"INSERT INTO users (id, email, name, uid) VALUES (?, ?, ?, ?)",
		id, id.String()+"@example.com", name, "uid-"+id.String(),
	).Error)

	return id
}

// restaurantOpts describes a seeded restaurant; zero values mean the default
// (name "ร้านทดสอบ", capacity 10, lead 60, open every day 11:00-22:00).
type restaurantOpts struct {
	Name           string
	Capacity       int
	LeadMinutes    int
	ClosedWeekdays []int
	ImageURL       string
}

func (a *app) seedRestaurant(owner uuid.UUID, o restaurantOpts) int {
	a.t.Helper()

	if o.Name == "" {
		o.Name = "ร้านทดสอบ"
	}
	if o.Capacity == 0 {
		o.Capacity = 10
	}
	if o.LeadMinutes == 0 {
		o.LeadMinutes = 60
	}

	var id int
	require.NoError(a.t, a.db.Raw(
		`INSERT INTO restaurants (owner_id, name, address, seating_capacity, cancellation_lead_minutes, image_url)
		 VALUES (?, ?, 'ที่อยู่ทดสอบ', ?, ?, NULLIF(?, '')) RETURNING id`,
		owner, o.Name, o.Capacity, o.LeadMinutes, o.ImageURL,
	).Scan(&id).Error)

	closed := map[int]bool{}
	for _, weekday := range o.ClosedWeekdays {
		closed[weekday] = true
	}
	for weekday := 0; weekday < 7; weekday++ {
		if closed[weekday] {
			continue
		}
		require.NoError(a.t, a.db.Exec(
			"INSERT INTO restaurant_opening_hours (restaurant_id, weekday, open_time, close_time) VALUES (?, ?, '11:00', '22:00')",
			id, weekday,
		).Error)
	}

	return id
}

func (a *app) seedReview(restaurantID int, userID uuid.UUID, rating int) {
	a.t.Helper()

	require.NoError(a.t, a.db.Exec(
		"INSERT INTO reviews (restaurant_id, user_id, rating, comment) VALUES (?, ?, ?, 'รีวิวทดสอบ')",
		restaurantID, userID, rating,
	).Error)
}

func (a *app) seedReservation(restaurantID int, userID uuid.UUID, start, end time.Time, guests int, status string) int {
	a.t.Helper()

	var id int
	require.NoError(a.t, a.db.Raw(
		`INSERT INTO reservations (restaurant_id, user_id, start_at, end_at, guests, status)
		 VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
		restaurantID, userID, start, end, guests, status,
	).Scan(&id).Error)

	return id
}
