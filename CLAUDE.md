# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Table Not Found (formerly Booking Table; internal identifiers such as the DB, Keycloak client and Go module are still `bookingtable`): a table-reservation and review app for shabu/grill restaurants (Go + Gin + GORM + PostgreSQL API, Next.js 16 frontend, Keycloak login, Redis, Docker Compose).
One account is both owner and customer; there are no roles. The docs and UI copy are in Thai. Read `README.md` for setup and `ARCHITECTURE.md` for the full system picture.

## Commands

Everything runs through Docker Compose; migrations are **not** run on start.

```bash
cp .env.example .env && cp api/.env.example api/.env     # first time (api/.env is only for goose)
docker compose up -d --build                             # postgres, redis, keycloak, api, web
(cd api && goose up)                                     # apply migrations
docker compose exec -T postgres psql -U postgres -d bookingtable -v ON_ERROR_STOP=1 < api/seed/seed.sql && ./scripts/seed_images.sh   # optional sample data
```

API (`cd api`), tests start a real `postgres:17` with testcontainers, so Docker (Colima) must be running:

```bash
go build ./... && go vet ./...
go test ./... -count=1
go test ./internal/apitest -run TestReservationCreate_Capacity -count=1   # one test
go test ./internal/reservation -run TestPeakGuests -count=1               # pure unit tests need no Docker
swag init -g cmd/api/main.go -o docs --parseInternal --parseDependency    # regenerate Swagger after changing handler annotations
```

Web (`cd web`; each is a separate command, `typecheck` runs `next typegen` first because route types are generated):

```bash
npm run lint
npm run typecheck
npm test                                                  # Vitest, only web/lib, runs with TZ=America/New_York on purpose
TZ=America/New_York npx vitest run lib/api.test.ts -t "refreshes once"   # one test file / test name
npm run build
```

Against the running stack (both create throwaway Keycloak users and need `KC_ADMIN_PASSWORD`):

```bash
set -a; . ./.env; set +a
python3 -I scripts/smoke_api.py              # API flow over HTTP
node scripts/browser_e2e/run.mjs             # real Chrome walk-through (`cd scripts/browser_e2e && npm ci` once; see its README)
```

## Architecture (the parts that span files)

- **Login is owned by the API.** `api` is the OAuth client of Keycloak: `/auth/login` → Keycloak → `/auth/callback` (the API exchanges the code with the client secret, upserts the `users` row, stores a one-time 30 s **ticket** in Redis) → redirects to the web `/auth/callback?ticket=` → web `POST /auth/exchange` gets the tokens. Tokens never appear in a URL. `middleware.JWT` verifies the Bearer token and maps its `sub` to `users.id`; handlers read the user with `reqctx.UserID`. Never accept an owner/user id from a request body or query.
- **Backend layering:** per feature (`restaurant`, `reservation`, `review`, `auth`, `user`) `handler → service → repository`; interfaces are declared by the consumer; errors are sentinel values (`error.go`) wrapped with `%w` and mapped to `{message, code?}` once, in the handler. `main.go` wires auth/user itself, but restaurant/reservation/review routes are wired in `httpapi.RegisterAPI`, which the HTTP-seam tests (`internal/apitest`) also call, so tests and production share handlers (they differ only in `Deps`: real JWT + clock vs. an `X-Test-User` header + a fixed clock).
- **Booking correctness is the core invariant.** Every create/change/cancel of a reservation (and restaurant delete) runs in `reservation.repository.InTx`, which takes `SELECT … FOR UPDATE` on the restaurant row *before* reading hours/capacity. Capacity uses `PeakGuests` (most guests present at one moment over half-open `[start, end)` intervals, not a sum). Opening hours are judged in `Asia/Bangkok` whatever offset the client sends. Do not add a reservation write path that skips `InTx`. `GET /restaurants/{id}/availability` reuses `PeakGuests` but reads **without** the lock: it is a display snapshot, never a basis for accepting a booking.
- **Schema** changes only through goose migrations in `api/migrations`; the `CHECK`/`UNIQUE` constraints repeat the Go rules as a last line of defence (e.g. duplicate reviews are caught by the unique key, error `23505`, not by check-then-insert). The test harness runs the `Up` part of every migration file.
- **Pictures** are files on a volume (`UPLOAD_DIR`), not DB rows: type is sniffed from the bytes, the server picks the name, and they are served publicly under `/api/v1/uploads/…` (an `<img>` cannot send a Bearer token). `seed.sql` only sets `image_url`; `scripts/seed_images.sh` copies the files.
- **Frontend:** every page is a client component. All HTTP goes through `apiFetch` (`web/lib/api.ts`): Bearer header, 204 without `json()`, `FormData` without a `Content-Type`, and on 401 a **single-flight** refresh (the refresh token rotates) then one retry. Import direction is `auth.ts → api.ts → auth-store.ts → types.ts`, never backwards. Times in the UI and in requests are Bangkok time (`toApiDateTime` appends `+07:00`), independent of the browser's zone. The restaurant list keeps `name`/`sort`/`page` in the URL.

## Conventions that are easy to get wrong

- **API contract:** `api/docs/API.md` is the hand-written contract the frontend follows; change it in the same commit as any behaviour change. `docs/initial/` (spec, plans, course reference docs) is historical and may disagree with the code: trust the code and `api/docs/*`.
- **Next 16 is not the Next you know** (`params` is a Promise, `useSearchParams` needs `<Suspense>`, etc.). Read the relevant guide in `web/node_modules/next/dist/docs/` and `web/NOTES.md` before writing routing/data-fetching code (see `web/AGENTS.md`).
- **Web style:** `@/…` imports for project files, named exports for components, `Button` from `@/components/bases/button`, shadcn primitives in `components/ui/`, Thai UI strings, and design tokens only (no hard-coded colours; use `text-primary-strong` for blue text and `bg-primary-subtle` for soft fills; tokens live in `web/app/globals.css`).
- **Tests:** add behaviour tests at the HTTP seam in `api/internal/apitest` (real Postgres, no repository mocks); concurrency tests must really overlap (`warmPool` + `runTogether`). Go mocks are generated with `mockery` only (`api/.mockery.yml`). Web tests are limited to pure logic in `web/lib`.
- Run build, vet, lint and tests as separate commands (a pipe hides the exit code).

## Environment gotchas

- Needs Docker; with **Colima** run `colima start` first (tests auto-detect its socket). Leave unrelated `wongnok-*` containers alone.
- Sign in with Chrome/Edge/Firefox, by **email**, through `keycloak.localhost:8180` (the URL and the token `iss` must match). Safari cannot sign in. Registration is off and seed users are fake: create a user in the Keycloak admin (realm `pea`) to log in.
- On Colima the `web` container (`next dev` on a bind mount) can miss file edits: `docker compose restart web`.
- Secrets live only in the git-ignored `.env`/`api/.env`; never print or commit them.

## Git

Use `git checkout -b` branches, not git worktrees. There is no remote configured; do not merge into `main` or push unless asked. The AI skill folders (`.agents`, `.claude`, `skills-lock.json`) are git-ignored on purpose.
