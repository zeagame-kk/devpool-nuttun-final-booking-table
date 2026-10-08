# Booking Table — Backend Implementation Plan

> **เอกสารต้นทาง** ย้ายมาไว้ที่ `docs/initial/` (ดัชนีอยู่ที่ [README.md](README.md)) เขียน ณ ตอนวางแผน (2026-10-08) จึงอาจต่างจากของจริงบางจุด ถ้าขัดกันให้ยึด [api/docs/API.md](../../api/docs/API.md) และโค้ดในรีโป

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** สร้าง REST API ระบบจองโต๊ะและรีวิวร้านชาบู/ปิ้งย่าง (ร้าน, การจอง, รีวิว, รูปร้าน) บนสถาปัตยกรรมของ `pea-wongnok` พร้อมกฎการจองที่ตรวจใน Go และกัน overbook เมื่อมีคำขอพร้อมกัน

**Architecture:** Feature package แยกชั้น Handler → Service → Repository (GORM) ตามแม่แบบ `recipe` เดิม, ตรวจสิทธิ์ความเป็นเจ้าของใน service, ตัวตนผู้ใช้อ่านจาก `reqctx` เท่านั้น. การจองทำใน transaction ที่ล็อกแถวร้าน (`SELECT … FOR UPDATE`) แล้วตรวจกฎทั้งหมดด้วย Go. เทสต์หลักอยู่ที่ seam เดียวคือ HTTP API (Gin router + service + repository จริง + Postgres จริงด้วย testcontainers) บวกฟังก์ชัน pure หาจำนวนคนสูงสุดพร้อมกัน

**Tech Stack:** Go 1.26 · Gin · GORM + PostgreSQL 17 · goose (migration) · Keycloak 26.7 (OIDC, reuse เดิม) · Redis (reuse เดิม) · testify + testcontainers-go · Docker Compose

**Spec:** `docs/initial/SPEC.md` (ภาพรวม/เคสเทสต์) และ `docs/initial/design.md` (รายละเอียดกฎ §5, API §6) — ผู้ implement ต้องอ่านทั้งสองไฟล์. ซอร์สต้นฉบับที่ copy: `/Users/nuttun.k/Desktop/day9/pea-wongnok-2026` (อ่านอย่างเดียว)

## Global Constraints

- Go module ชื่อ `bookingtable`; client Keycloak `bookingtable`; **คง realm `pea`** และผู้ใช้ dev เดิม
- Base path `/api/v1`; JSON camelCase; เวลา RFC 3339; เวลาเปิด–ปิดเป็นข้อความ `"HH:MM"` (regex `^([01]\d|2[0-3]):[0-5]\d$`)
- ตัวตนผู้ใช้/เจ้าของมาจาก `reqctx.UserID` เท่านั้น ห้ามรับ `ownerId`/`userId` จาก client
- เขตเวลาคงที่ `Asia/Bangkok` (weekday 0=อาทิตย์…6) ใช้เฉพาะตอนเทียบเวลาเปิด–ปิด; เวลาเก็บ `TIMESTAMPTZ`
- ช่วงเวลาการจองแบบ half-open `[start, end)`; ต้องเริ่ม/จบวันท้องถิ่นเดียวกัน
- `cancellationLeadMinutes >= 30`, `seatingCapacity >= 1`, `guests >= 1`, `rating` จำนวนเต็ม 1–5, `comment` ไม่ว่าง
- Status: 400 input/กฎข้อมูล · 401 token · 403 ไม่ใช่เจ้าของ · 404 ไม่พบ · 409 ขัดกับสถานะ; กฎธุรกิจตอบ `code` ใน `httputil.ErrorResponse`: `start_in_past`, `outside_opening_hours`, `capacity_exceeded`, `too_late_to_cancel`, `too_late_to_modify`, `reservation_not_active`, `cannot_review_own_restaurant`, `already_reviewed`, `restaurant_has_active_reservations`, `invalid_image`
- Convention ตอบกลับ: `POST` สร้าง → `201 {id}`; `PUT` → `200` resource เต็ม; `DELETE`/action ไม่มี body → `204`; list → `{total, results[]}`; คะแนนเป็น `rating: {average, total}` (`average` ปัด 1 ตำแหน่ง, `total` = จำนวนรีวิว)
- Schema เปลี่ยนด้วย goose migration เท่านั้น ห้าม AutoMigrate; ทุก repository method รับ `ctx` ก่อนและใช้ `WithContext(ctx)`
- ห้ามรัน `mockery` ใหม่ (seam เทสต์ไม่ใช้ mock ของ feature ใหม่; `mocks_test.go` เดิมของ `auth`/`user`/`middleware` คงไว้)
- Commit message ปิดท้ายด้วยบรรทัด `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`
- เทสต์ที่ใช้ testcontainers ต้องมี Docker รันอยู่; ไม่ใช้ `t.Parallel()` ใน `apitest`

## Review Focus

อินพุต/เงื่อนไขที่ spec ไม่ได้พูดตรง ๆ แต่มีโอกาสพังมากสุด (แต่ละข้อมีเทสต์กำกับใน task ที่ระบุ):
1. **`weekday: 0` (วันอาทิตย์) ต้องผ่าน** — `binding:"required"` กับ `int` จะปฏิเสธค่า 0 → ใช้ `*int` (Task 4: `TestRestaurantCreate_SundayWeekdayZeroAccepted`)
2. **ขอบเวลาเปิด–ปิดพอดี** — เริ่ม 11:00/จบ 22:00 ผ่าน, จบ 22:01 ไม่ผ่าน (Task 7: `TestReservationCreate_OpeningBoundaries`)
3. **เวลาที่ client ส่งเป็น UTC ข้ามวันท้องถิ่น** — `…T14:00:00Z`–`…T16:00:00Z` = 21:00–23:00 น. ไทย → `outside_opening_hours` (Task 7: `TestReservationCreate_UTCInputConvertedToBangkok`)
4. **คำค้นที่เป็น wildcard** — `name=%` และ `name=_` ต้องแมตช์เฉพาะตัวอักษรจริง ส่วน `name=` ว่าง/ช่องว่างล้วน = ไม่กรอง (Task 5: `TestRestaurantList_SearchEscapesWildcards`)
5. **ไฟล์ปลอมนามสกุล** — ไฟล์ข้อความตั้งชื่อ `.png`, ไฟล์ 0 ไบต์, ไฟล์เกิน 2 MB ต้อง 400 `invalid_image` (Task 11: `TestImageUpload_RejectsSpoofedEmptyAndOversized`)

---

## File Structure (ภายใต้ `booking_table/`)

```text
compose.yml  .env.example  .gitignore  keycloak/import/pea-realm.json
api/
  cmd/api/main.go                       # แก้: ถอด recipe, เรียก httpapi.RegisterAPI, ตั้ง CORS
  migrations/                           # 121 users (เดิม) + 4 ไฟล์ใหม่ (Task 3)
  internal/
    config/upload.go                    # ใหม่ (Task 11)
    httpapi/{api.go,cors.go,cors_test.go}  # รวมการลงทะเบียน route ของ feature ใหม่ (seam ของเทสต์)
    restaurant/{model,dto,error,handler,service,repository}.go
    reservation/{model,dto,error,handler,service,repository,peak,leadtime}.go + peak_test.go, leadtime_test.go
    review/{model,dto,error,handler,service,repository}.go
    storage/local.go                    # เขียน/ลบไฟล์รูป (Task 11)
    apitest/{doc.go,harness_test.go,*_test.go}   # เทสต์ HTTP seam
  seed/seed.sql                         # Task 12
  docs/API.md                           # เขียนใหม่ (Task 12)
```

หน้าที่: `httpapi` = จุดต่อสายเดียวที่ main.go และเทสต์ใช้ร่วมกัน; แต่ละ feature package ไม่ import กันเอง (ข้อมูลข้ามตารางใช้ query ตรงบนชื่อตารางด้วย struct ท้องถิ่น)

---

### Task 0: Scaffold — copy, rename, ถอด recipe, smoke test login

**Files:** Create/Modify ทั้งโครง `api/`, `compose.yml`, `keycloak/`, `web/` (copy), `.gitignore` · Modify `api/cmd/api/main.go`, `api/.mockery.yml`, `api/internal/config/app.go`, `keycloak/import/pea-realm.json`

**Interfaces:** Produces: โครงที่ `go build ./...` ผ่านภายใต้ module `bookingtable` และระบบ login ผ่าน compose ได้ (ทุก task หลังจากนี้และแผน Frontend พึ่งพา)

- [ ] **Step 1: `git init` ใน `booking_table/` และสร้าง `.gitignore`** (เนื้อหาจากต้นฉบับ + `.env`, `uploads/`, `node_modules/`, `.next/`, `web/.env.local`); commit เอกสารเดิม (`SPEC.md`, `docs/`, `*_PLAN.md`) เป็น commit แรก `docs: add spec and plans`
- [ ] **Step 2: copy ซอร์ส** ด้วย `rsync -a --exclude node_modules --exclude .next --exclude .DS_Store --exclude /.git --exclude /docs --exclude /.agents --exclude /.claude --exclude /skills-lock.json --exclude /.gitignore /Users/nuttun.k/Desktop/day9/pea-wongnok-2026/ ./` (ใช้ `/docs` แบบ anchored เพื่อไม่ทับ `docs/` ของโปรเจกต์และไม่ตัด `api/docs`); ลบ `api/.agents`, `api/.claude`, `api/skills-lock.json` ถ้ามี
- [ ] **Step 3: ถอด recipe** — ลบ `api/internal/recipe/`, migration `…122`–`…128` (เหลือเฉพาะ `…121_create_users.sql`), และบรรทัดสร้าง/ลงทะเบียน recipe ใน `main.go` (`recipeRepo`, `recipeService`, `recipeHandler`, `recipeGroup…`)
- [ ] **Step 4: rename** `wongnok` → `bookingtable` ด้วย `sed -i '' 's/wongnok/bookingtable/g; s/Wongnok/BookingTable/g'` กับ: `api/go.mod`, ทุกไฟล์ `api/**/*.go`, `api/.mockery.yml`, `api/AGENTS.md`, `compose.yml` (container/volume/`POSTGRES_DB`/DSN/`APP_NAME`/`KEYCLOAK_CLIENT_ID`), `keycloak/import/pea-realm.json` (clientId, `bookingtable-audience`, `included.client.audience`, key ใน roles), `keycloak/README.md`. **ห้ามแตะ** ค่า `pea`
- [ ] **Step 5: Verify rename** — Run: `grep -ri wongnok . --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=docs --exclude=SPEC.md --exclude=*_PLAN.md`; Expected: ไม่มีผลลัพธ์
- [ ] **Step 6: Verify build** — Run: `cd api && go build ./... && go vet ./... && go test ./internal/user/... ./internal/config/...`; Expected: ผ่านทั้งหมด (ถ้า `main.go` อ้าง `bookingtable/docs` ที่ยัง generate จาก recipe ให้คงไว้ก่อน)
- [ ] **Step 7: ติดตั้ง goose** `go install github.com/pressly/goose/v3/cmd/goose@latest`; สร้าง `api/.env` (ถูก ignore) ตั้ง `GOOSE_MIGRATION_DIR=./migrations`, `GOOSE_DRIVER=postgres`, `GOOSE_DBSTRING=postgres://postgres:<รหัสผ่านใน compose>@localhost:5532/bookingtable?sslmode=disable`
- [ ] **Step 8: Smoke test login** — Run: `docker compose up -d --build postgres redis keycloak api` แล้ว `cd api && goose up`. เปิด `http://localhost:8080/api/v1/auth/login` ในเบราว์เซอร์ ล็อกอินด้วยผู้ใช้ dev (ดู `keycloak/README.md`) → จะถูกพาไป `http://localhost:3000/auth/callback?ticket=…` (404 เพราะ web ยังไม่ทำ ไม่เป็นไร) → คัดลอก ticket ภายใน 30 วินาที: `curl -s -X POST localhost:8080/api/v1/auth/exchange -H 'Content-Type: application/json' -d '{"ticket":"<ticket>"}'` แล้ว `curl -s -H "Authorization: Bearer <accessToken>" localhost:8080/api/v1/users/me`; Expected: ได้ 200 พร้อมอีเมลผู้ใช้. **ผลที่พบจริง (B1):** `KEYCLOAK_BASE_URL=http://keycloak:8080` ทำให้ API ส่ง browser ไป `keycloak:8080` ซึ่งใช้ไม่ได้ และการเพิ่ม `127.0.0.1 keycloak` ใน `/etc/hosts` ก็ไม่พอ เพราะพอร์ต 8080 บน host คือ API ไม่ใช่ Keycloak (8180) → แก้ใน `compose.yml` โดยให้ API ใช้ `KEYCLOAK_BASE_URL=http://keycloak.localhost:8180` (host:port เดียวกับที่ browser ใช้ ทำให้ `iss` ตรงกัน) พร้อม `extra_hosts: ["keycloak.localhost:host-gateway"]` ที่ service api; browser รุ่นใหม่ resolve `*.localhost` เป็น loopback เอง ไม่ต้องแก้ `/etc/hosts`; Keycloak ตั้ง cookie เป็น `Secure` แม้ใช้ HTTP ซึ่ง Chrome/Edge/Firefox ยอมรับจาก `*.localhost` แต่ Safari ไม่ยอมรับ จึงให้ใช้ Chrome/Edge/Firefox และจดไว้ใน `README`; ผู้ใช้ใน realm ล็อกอินด้วย **อีเมล** (`registrationEmailAsUsername: true`). ถ้าได้ 401 ให้ตรวจว่า audience ใน realm JSON เท่ากับ `KEYCLOAK_CLIENT_ID` (ถ้า volume Keycloak เก่ามีอยู่ต้อง `docker compose down -v` แล้วขึ้นใหม่เพื่อ import realm ใหม่)
- [ ] **Step 9: Commit** `chore: scaffold bookingtable from pea-wongnok`

---

### Task 1: ย้าย secret ไป `.env`

**Files:** Modify `compose.yml`, `keycloak/import/pea-realm.json`, `.gitignore` · Create `.env.example`, `api/.env.example`

**Interfaces:** Produces: ตัวแปร `POSTGRES_PASSWORD`, `KC_ADMIN_PASSWORD`, `KEYCLOAK_CLIENT_SECRET` ที่ compose อ่านจาก `.env` ที่ราก (ใช้ไวยากรณ์ `${VAR:?ข้อความ}` เพื่อ fail เมื่อไม่ตั้งค่า); ทุก task หลังจากนี้ใช้ `.env` นี้

- [ ] **Step 1: เขียน `.env.example`** (ค่าตัวอย่างไม่ใช่ของจริง; `POSTGRES_PASSWORD` ใช้เฉพาะอักขระที่ปลอดภัยใน URL เพราะแทรกใน DSN) และ `api/.env.example` สำหรับ `GOOSE_*`; สร้าง `.env` จริงจากตัวอย่างด้วยค่าที่คุณตั้งเอง
- [ ] **Step 2: แก้ `compose.yml`** — แทนรหัสผ่าน postgres/Keycloak admin/client secret และรหัสผ่านใน `POSTGRES_DSN` ด้วย `${…}`; ส่ง `KEYCLOAK_CLIENT_SECRET` เข้า container keycloak ด้วย
- [ ] **Step 3: แก้ `pea-realm.json`** — ค่า `secret` ของ client `bookingtable` เป็น `${KEYCLOAK_CLIENT_SECRET}`
- [ ] **Step 4: Verify ไม่มี secret เดิมเหลือ** — อ่านรหัสผ่าน Postgres และ client secret เดิมจาก `compose.yml` ของต้นฉบับ (`/Users/nuttun.k/Desktop/day9/pea-wongnok-2026/compose.yml`) ใส่ตัวแปรเชลล์ `OLD_PW` และ `OLD_SECRET` (ห้ามเขียนค่าจริงลงไฟล์ใดใน repo นี้ เพราะจะติดประวัติ git) แล้ว Run: `docker compose config | grep -cF "$OLD_PW"` และ `grep -rnF "$OLD_SECRET" . --exclude-dir=.git --exclude-dir=node_modules`; Expected: ทั้งสองไม่พบ (0 / ไม่มีผลลัพธ์; หมายเหตุ: `.env` ที่คุณสร้างเองต้องไม่ตรงกับค่าเดิม)
- [ ] **Step 5: Verify login ยังใช้ได้กับ secret จาก env** — Run: `docker compose down -v && docker compose up -d --build` → `goose up` → ทำ Task 0 Step 8 ซ้ำ; Expected: `/users/me` ตอบ 200. **ถ้า Keycloak ไม่แทนค่า `${…}` ใน realm import** (จะเห็น 401 จาก token exchange) → fallback: ลบฟิลด์ `secret` ออกจาก client ใน JSON, ขึ้นระบบ, คัดลอก secret ที่ Keycloak สุ่มจาก Admin Console (Clients → bookingtable → Credentials) ใส่ `.env` แล้ว `docker compose up -d api`; จดวิธีนี้ใน README
- [ ] **Step 6: Commit** `chore: move secrets to .env`

---

### Task 2: CORS และแก้ JWT middleware

**Files:** Create `api/internal/httpapi/cors.go`, `api/internal/httpapi/cors_test.go` · Modify `api/cmd/api/main.go`, `api/internal/middleware/jwt.go`

**Interfaces:** Produces: `func CORSConfig(frontendURL string) cors.Config` (package `httpapi`; ใช้ `github.com/gin-contrib/cors`)

- [ ] **Step 1: เขียนเทสต์ที่ล้มเหลว** `TestCORS_PreflightAllowsAuthorizationFromFrontendOnly` — สร้าง `gin.New()` + `cors.New(CORSConfig("http://localhost:3000"))` + route `GET /x`; ส่ง `OPTIONS /x` ด้วย `Origin: http://localhost:3000`, `Access-Control-Request-Method: GET`, `Access-Control-Request-Headers: authorization` → assert status 204, `Access-Control-Allow-Origin == "http://localhost:3000"`, `Access-Control-Allow-Headers` มี `Authorization` (ไม่สนตัวพิมพ์); เคส origin อื่น `http://evil.example` → ไม่มี `Access-Control-Allow-Origin`; เคส `POST` และ `PUT`, `DELETE` อยู่ใน `Access-Control-Allow-Methods`
- [ ] **Step 2: Run** `cd api && go test ./internal/httpapi -run TestCORS -v`; Expected: FAIL (undefined: CORSConfig)
- [ ] **Step 3: Implement `CORSConfig`** — `AllowOrigins: [frontendURL]`, `AllowMethods: GET,POST,PUT,DELETE,OPTIONS`, `AllowHeaders: Authorization, Content-Type`
- [ ] **Step 4: ใช้ใน `main.go`** แทน `cors.Default()` โดยอ่าน `cfg.Keycloak.FrontendURL`
- [ ] **Step 5: แก้ `middleware/jwt.go`** — เพิ่ม `return` หลัง `AbortWithStatusJSON(401, "user not found")`
- [ ] **Step 6: Run** `go test ./internal/httpapi -v && go build ./...`; Expected: PASS (JWT fix ไม่มีเทสต์หน่วยเพราะ verifier เป็น concrete type — พิสูจน์ด้วย Task 0 smoke test เดิมที่ยังผ่าน)
- [ ] **Step 7: Commit** `fix: explicit CORS config and JWT early return`

---

### Task 3: Migration 4 ตาราง + harness เทสต์ HTTP seam

**Files:** Create `api/migrations/<ts>_create_restaurants.sql`, `…_create_restaurant_opening_hours.sql`, `…_create_reservations.sql`, `…_create_reviews.sql` (สร้างด้วย `goose create <ชื่อ> sql`) · `api/internal/httpapi/api.go` · `api/internal/apitest/doc.go`, `harness_test.go`, `schema_test.go` · Modify `main.go`

**Interfaces:**
- Produces (SQL): ตามสเปก §4 — `restaurants(id SERIAL PK, owner_id UUID NOT NULL→users, name VARCHAR(255) NOT NULL, address TEXT NOT NULL, description TEXT, image_url TEXT, seating_capacity INT CHECK >=1, cancellation_lead_minutes INT CHECK >=30, created_at/updated_at TIMESTAMPTZ DEFAULT now(), deleted_at)`; `restaurant_opening_hours(restaurant_id→restaurants, weekday SMALLINT CHECK 0..6, open_time TIME, close_time TIME, CHECK close_time > open_time, PK(restaurant_id, weekday))`; `reservations(id SERIAL PK, restaurant_id, user_id, start_at, end_at TIMESTAMPTZ, guests INT CHECK >=1, status VARCHAR(20) DEFAULT 'confirmed' CHECK IN ('confirmed','cancelled'), created_at, updated_at, CHECK end_at > start_at)` + index `(restaurant_id, start_at)`, `(user_id, start_at)`; `reviews(id SERIAL PK, restaurant_id, user_id, rating SMALLINT CHECK 1..5, comment TEXT CHECK (btrim(comment) <> ''), created_at, updated_at, UNIQUE(user_id, restaurant_id))`. ทุกไฟล์มี `-- +goose Up` / `-- +goose Down`
- Produces (Go): `type Deps struct { DB *gorm.DB; Auth gin.HandlerFunc; Now func() time.Time; UploadDir string }` และ `func RegisterAPI(v1 *gin.RouterGroup, d Deps)` ใน `httpapi` (task นี้ลงทะเบียนยังไม่มี route; task ถัดไปเพิ่ม)
- Produces (harness, package `apitest`): `func newApp(t *testing.T) *app` (ล้างตารางด้วย `TRUNCATE reviews, reservations, restaurant_opening_hours, restaurants, users RESTART IDENTITY CASCADE`, เวลาปัจจุบันจำลอง = `2026-10-12T09:00:00+07:00` วันจันทร์, สร้าง `gin.Engine` ที่ใช้ `Auth` ปลอมอ่าน header `X-Test-User` เป็น UUID แล้วใส่ด้วย `reqctx.WithUserID`; ไม่มี header → 401); `(a *app) setNow(time.Time)`; `(a *app) newUser(name string) uuid.UUID`; `(a *app) do(as uuid.UUID, method, path string, body any) *httptest.ResponseRecorder` (`as == uuid.Nil` = ไม่ส่ง header); `(a *app) upload(as uuid.UUID, path, filename string, content []byte) *httptest.ResponseRecorder` (multipart ฟิลด์ `file`); `(a *app) seedRestaurant(owner uuid.UUID, o restaurantOpts) int` โดย `type restaurantOpts struct { Name string; Capacity, LeadMinutes int; ClosedWeekdays []int; ImageURL string }` (ค่าศูนย์ = default: ชื่อ "ร้านทดสอบ", capacity 10, lead 60, เปิดทุกวัน 11:00–22:00 ยกเว้นวันใน `ClosedWeekdays`); `(a *app) seedReview(restaurantID int, userID uuid.UUID, rating int)`; `(a *app) seedReservation(restaurantID int, userID uuid.UUID, start, end time.Time, guests int, status string) int`
- ใช้ container Postgres ตัวเดียวต่อ package ผ่าน `TestMain` (image `postgres:17`) สร้าง schema จากไฟล์ `../../migrations/*.sql` ส่วน `-- +goose Up` (ใช้วิธีเดียวกับ `writeMigrationScript` ของต้นฉบับ)

- [ ] **Step 1: เขียน `schema_test.go` ที่ล้มเหลว** — `TestSchema_ConstraintsRejectInvalidRows`: ตารางตัวอย่าง (INSERT ตรง ๆ ด้วย SQL) ต้อง error สำหรับ: `cancellation_lead_minutes=29`, `seating_capacity=0`, `weekday=7`, `close_time <= open_time`, `end_at <= start_at`, `guests=0`, `status='pending'`, `rating=6`, `comment='  '`, รีวิวซ้ำ `(user_id, restaurant_id)`; และ INSERT ที่ถูกต้อง (`lead=30`, `weekday=0`) ต้องผ่าน
- [ ] **Step 2: Run** `cd api && go test ./internal/apitest -run TestSchema -v`; Expected: FAIL (ตารางไม่มี)
- [ ] **Step 3: เขียน migration 4 ไฟล์** ตาม Interfaces ด้านบน (ลำดับ timestamp: restaurants → opening_hours → reservations → reviews) และ harness ตาม Interfaces
- [ ] **Step 4: เขียน `httpapi/api.go`** และเรียก `httpapi.RegisterAPI(v1, httpapi.Deps{DB: db, Auth: middleware.JWT(oidcVerifer, userService), Now: time.Now, UploadDir: ""})` ใน `main.go` (UploadDir ใส่จริงใน Task 11)
- [ ] **Step 5: Run** `go test ./internal/apitest -run TestSchema -v && go build ./...`; Expected: PASS
- [ ] **Step 6: Commit** `feat: add schema migrations and http test harness`

---

### Task 4: Restaurant — สร้าง / ดูรายละเอียด / แก้ / ลบ

**Files:** Create `api/internal/restaurant/{model,dto,error,handler,service,repository}.go`, `api/internal/apitest/restaurant_test.go` · Modify `api/internal/httpapi/api.go`

**Interfaces:**
- Produces (Go, package `restaurant`):
  - `type Restaurant struct` (ID int, OwnerID uuid.UUID, Owner user.User, Name, Address string, Description, ImageURL *string, SeatingCapacity, CancellationLeadMinutes int, OpeningHours []OpeningHour, `AverageRating float64` และ `ReviewCount int64` (read-only จาก aggregate: `gorm:"->;column:…"`), `MyReview *MyReview gorm:"-"`, timestamps, `DeletedAt gorm.DeletedAt`); `type OpeningHour struct { RestaurantID int; Weekday int; OpenTime, CloseTime string }` พร้อม `TableName() "restaurant_opening_hours"` (PK `(RestaurantID, Weekday)`); `type MyReview struct { ID, Rating int; Comment string }`
  - Errors: `ErrRestaurantNotFound`, `ErrForbidden`, `ErrInvalidOpeningHours`, `ErrHasActiveReservations`, `ErrInvalidImage`
  - `handler.go` ประกาศ `Service` interface: `Create(ctx, ownerID uuid.UUID, r Restaurant) (*Restaurant, error)` · `Get(ctx, id int, viewerID uuid.UUID) (*Restaurant, error)` · `Replace(ctx, id int, userID uuid.UUID, r Restaurant) (*Restaurant, error)` · `Delete(ctx, id int, userID uuid.UUID) error` (task ถัดไปเพิ่ม `List`, `SetImage`, `RemoveImage`)
  - DTO: `SaveRestaurantRequest{Name, Address string (required); Description *string; SeatingCapacity int (required,min=1); CancellationLeadMinutes int (required,min=30); OpeningHours []OpeningHourRequest (required,min=1,dive)}`; `OpeningHourRequest{Weekday *int (required,min=0,max=6); Open, Close string (required)}`; response ตามสเปก §6.2 (`isOwner`, `myReview` เฉพาะ detail)
  - `NewService(repo Repository, now func() time.Time) *service` (Task 11 เพิ่มพารามิเตอร์ `images ImageStorage` เป็นตัวกลาง → `NewService(repo, images, now)`)
  - `validateOpeningHours([]OpeningHour) error` → `ErrInvalidOpeningHours` เมื่อ weekday ซ้ำ, รูปแบบไม่ตรง regex, หรือ `close <= open`
- Routes: `POST /restaurants`, `GET /restaurants/:id`, `PUT /restaurants/:id`, `DELETE /restaurants/:id` ใต้ group ที่ใช้ `Deps.Auth`

- [ ] **Step 1: เขียนเทสต์ใน `restaurant_test.go`** (ทุกเคสใช้ `newApp`; body ตัวอย่างหลัก: `{"name":"ชาบูทอง","address":"12 ถ.สุขุมวิท กรุงเทพ","seatingCapacity":40,"cancellationLeadMinutes":60,"openingHours":[{"weekday":1,"open":"11:00","close":"22:00"}]}`):
  - `TestRestaurantCreate_Success`: 201 `{id}` แล้ว GET → 200 `owner.id` = ผู้สร้าง, `openingHours[0] == {weekday:1, open:"11:00", close:"22:00"}`, `imageUrl` เป็น `null`, `rating == {average:0, total:0}`, `isOwner:true` (เจ้าของ) / `false` (คนอื่น), `myReview: null`
  - `TestRestaurantCreate_SundayWeekdayZeroAccepted` (Review Focus 1): `weekday:0` → 201
  - `TestRestaurantCreate_Validation` (ตาราง → ทุกเคส 400): lead 29, capacity 0, name ว่าง/หายไป, address หายไป, `openingHours: []`, `weekday: 7`, weekday ซ้ำ, `open:"9:00"`, `close:"24:00"`, `close:"11:00"` เท่ากับ open, `close < open`; และ lead 30 → 201
  - `TestRestaurantCreate_IgnoresClientOwnerAndImage`: body ใส่ `ownerId` ของคนอื่นและ `imageUrl` → owner ที่บันทึกคือผู้เรียก, `imageUrl` ยังเป็น null
  - `TestRestaurant_RequiresAuth`: ไม่มี header → 401 ทั้ง 4 route
  - `TestRestaurantGet_NotFound`: id ไม่มี → 404; ร้านที่ถูกลบ → 404
  - `TestRestaurantReplace`: เจ้าของ PUT ด้วยเวลาเปิดชุดใหม่ (weekday 2) → 200 และ GET แล้ว weekday 1 หายไป; คนอื่น → 403; id ไม่มี → 404; ค่า `imageUrl` (seed ด้วย SQL) ไม่เปลี่ยนหลัง PUT
  - `TestRestaurantDelete`: เจ้าของ → 204 แล้ว GET → 404; คนอื่น → 403; id ไม่มี → 404
- [ ] **Step 2: Run** `go test ./internal/apitest -run 'TestRestaurant' -v`; Expected: FAIL (route ไม่มี → 404)
- [ ] **Step 3: Implement** package `restaurant` ตามแม่แบบ `recipe` เดิม — `Replace` ใน repository ทำ transaction: ลบ `restaurant_opening_hours` ของร้านทั้งชุดแล้ว insert ใหม่ (วิธีเดียวกับ `Replace` ของ recipe) และไม่แตะ `image_url`; `Get` เติม aggregate (`AVG`/`COUNT` จากตาราง `reviews`) และ `MyReview` ด้วย query ตรงบนตาราง `reviews` (struct ท้องถิ่น ไม่ import package review); soft delete; ownership เทียบ `OwnerID != userID` → `ErrForbidden`; handler map error ด้วย `errors.Is` ตาม pattern เดิม; ลงทะเบียน route ใน `RegisterAPI`
- [ ] **Step 4: Run** คำสั่งเดิม; Expected: PASS
- [ ] **Step 5: Commit** `feat: restaurant create, read, replace, delete`

---

### Task 5: Restaurant — รายการ (ค้นหา / เรียง / mine / แบ่งหน้า)

**Files:** Modify `restaurant/{dto,handler,service,repository}.go`, `apitest/restaurant_list_test.go` (ใหม่)

**Interfaces:**
- Consumes: Task 4 (`Restaurant`, `Service`, `seedRestaurant`, `seedReview`)
- Produces: `Service.List(ctx, viewerID uuid.UUID, q ListQuery) ([]Restaurant, int64, error)`; `type ListQuery struct { Pagination; Name string form:"name"; Sort string form:"sort" binding:"omitempty,oneof=rating reviews"; Mine *bool form:"mine" }` โดย `Pagination` คัดจาก recipe (`page` default 1, `limit` default 12, สูงสุด 100 → เกิน 100 = 400); `ListResponse[T]{Total int64 json:"total"; Results []T json:"results"}` (ผลว่างต้องเป็น `[]` ไม่ใช่ `null`)
- Route: `GET /restaurants`

- [ ] **Step 1: เขียนเทสต์ใน `restaurant_list_test.go`**:
  - `TestRestaurantList_SortByRating`: ร้าน A รีวิว 5,4,4 (average 4.3), B รีวิว 5 (5.0), C ไม่มีรีวิว → `sort=rating` ได้ลำดับ B, A, C; `rating.average` ของ A = `4.3`; ค่าเท่ากันเรียงตาม id น้อยก่อน
  - `TestRestaurantList_SortByReviewCount`: ลำดับ A(3), B(1), C(0)
  - `TestRestaurantList_DefaultNewestFirst`: ไม่ส่ง sort → `created_at` ใหม่ก่อน
  - `TestRestaurantList_InvalidSort_400`; `limit=101` → 400
  - `TestRestaurantList_SearchByName`: บางส่วน ("ชาบู"), ไม่สนตัวพิมพ์ ("SHABU" แมตช์ "Shabu Gold"), ไม่พบ → `total:0, results:[]`
  - `TestRestaurantList_SearchEscapesWildcards` (Review Focus 4): ร้าน "100% beef" และ "plain" — `name=%` ได้เฉพาะแรก, `name=_` ไม่แมตช์ "plain" (ชื่อไม่มี `_`); `name=` และ `name=%20%20` (ช่องว่างล้วน) → ได้ทุกร้าน
  - `TestRestaurantList_MineFilter`: `mine=true` เฉพาะของตัวเอง; ไม่ส่ง = ทุกร้าน
  - `TestRestaurantList_Pagination`: 15 ร้าน `limit=10&page=2` → 5 รายการ, `total:15`, id ไม่ซ้ำกับหน้า 1 (กันบั๊ก `Order` ของต้นฉบับ)
  - `TestRestaurantList_HidesSoftDeleted`
- [ ] **Step 2: Run** `go test ./internal/apitest -run TestRestaurantList -v`; Expected: FAIL
- [ ] **Step 3: Implement repository `List`** — `LEFT JOIN` กับ subquery `SELECT restaurant_id, AVG(rating) AS avg_rating, COUNT(*) AS review_count FROM reviews GROUP BY restaurant_id` และ `COALESCE(...,0)`; order: `rating` → `average_rating DESC, restaurants.id ASC`, `reviews` → `review_count DESC, restaurants.id ASC`, default → `restaurants.created_at DESC, restaurants.id ASC`; **ใช้ `Offset((page-1)*limit).Limit(limit)`**; ชื่อ: trim แล้วถ้าไม่ว่างใช้ `name ILIKE ? ESCAPE '\'` โดย escape `\`, `%`, `_` ด้วย `strings.NewReplacer`; `Preload("Owner")` และ `OpeningHours` ไม่จำเป็นในรายการ; `rating.average` ปัด 1 ตำแหน่งใน DTO
- [ ] **Step 4: Run** คำสั่งเดิม; Expected: PASS
- [ ] **Step 5: Commit** `feat: restaurant list with search, sort, mine, pagination`

---

### Task 6: ฟังก์ชัน pure — จำนวนคนพร้อมกันสูงสุด

**Files:** Create `api/internal/reservation/peak.go`, `api/internal/reservation/peak_test.go`, `api/internal/reservation/leadtime.go`, `api/internal/reservation/leadtime_test.go`

**Interfaces:**
- Produces: `type Booking struct { Start, End time.Time; Guests int }` · `func PeakGuests(existing []Booking, candidate Booking) int` — คืนค่าสูงสุดของ (จำนวนคนของ `existing` ที่ active ณ จุดตรวจ + `candidate.Guests`) โดยจุดตรวจคือ `candidate.Start` และ `Start` ของ `existing` ทุกรายการที่ตกใน `[candidate.Start, candidate.End)`; booking active ที่เวลา t เมื่อ `Start <= t < End` (half-open) · `func leadTimeOK(start, now time.Time, leadMinutes int) bool` คือ `start.Sub(now) >= time.Duration(leadMinutes)*time.Minute` (ตั้งชื่อ `leadTimeOK`)

- [ ] **Step 1: เขียน `peak_test.go` (table-driven)** ใช้วันที่ `2026-10-12` เวลาอ้างเป็นชั่วโมง; ทุกเคสผ่านฟังก์ชันเดียว `PeakGuests`:

  | ชื่อเคส | existing | candidate | คาดหวัง |
  | --- | --- | --- | --- |
  | no existing | — | 11–13 (4) | 4 |
  | spec example | 10–12 (6), 12–14 (6) | 11–13 (4) | 10 |
  | back-to-back not overlapping | 10–12 (6) | 12–14 (4) | 4 |
  | full overlap sums | 10–12 (6), 11–13 (3) | 11–12 (4) | 13 |
  | existing starts inside candidate | 12–14 (5) | 11–13 (4) | 9 |
  | existing ends before candidate | 08–10 (9) | 11–13 (4) | 4 |
  | many small stack | 11–12 (2), 11–12 (2), 11–12 (2) | 11–13 (1) | 7 |

  และ `leadtime_test.go`: `leadTimeOK` ที่ start−now = 60 นาทีพอดี (lead 60) → true; 59 นาที → false; 61 นาที → true
- [ ] **Step 2: Run** `go test ./internal/reservation -v`; Expected: FAIL (undefined)
- [ ] **Step 3: Implement** ทั้งสองฟังก์ชัน (loop จุดตรวจ ไม่ต้อง sort)
- [ ] **Step 4: Run** คำสั่งเดิม; Expected: PASS
- [ ] **Step 5: Commit** `feat: peak concurrent guests and lead time helpers`

---

### Task 7: Reservation — สร้าง (กฎครบ + ล็อก + กันจองพร้อมกัน)

**Files:** Create `reservation/{model,dto,error,handler,service,repository}.go`, `apitest/reservation_create_test.go` · Modify `httpapi/api.go`

**Interfaces:**
- Consumes: Task 6 (`PeakGuests`, `Booking`), Task 3 (`Deps.Now`), harness
- Produces (package `reservation`):
  - `type Reservation struct` (ID, RestaurantID int, UserID uuid.UUID, StartAt, EndAt time.Time, Guests int, Status string, timestamps; read-only `RestaurantName`, `CustomerName string` ผ่าน `gorm:"->;column:…"`); ค่าคงที่ `StatusConfirmed = "confirmed"`, `StatusCancelled = "cancelled"`
  - `type Input struct { StartAt, EndAt time.Time; Guests int }`; DTO `SaveReservationRequest{StartAt time.Time (required), EndAt time.Time (required), Guests int (required,min=1)}`
  - Errors (พร้อม code ที่ handler ตอบ): `ErrRestaurantNotFound`, `ErrForbidden`, `ErrInvalidInput`(400), `ErrStartInPast`, `ErrOutsideOpeningHours`, `ErrCapacityExceeded`, `ErrTooLateToCancel`, `ErrTooLateToModify`, `ErrNotActive`
  - Repository (ประกาศใน `service.go`): `InTx(ctx, restaurantID int, fn func(tx TxRepo) error) error` — เริ่ม transaction, `SELECT … FOR UPDATE` แถว `restaurants` ที่ `deleted_at IS NULL` (ไม่พบ → `ErrRestaurantNotFound`), เรียก `fn`; `TxRepo` มี `Restaurant() RestaurantInfo` (`{ID, Capacity, LeadMinutes int; Hours map[int]DayHours}`, `DayHours{OpenMin, CloseMin int}` = นาทีหลังเที่ยงคืนท้องถิ่น), `Overlapping(ctx, start, end time.Time, excludeID int) ([]Booking, error)` (เฉพาะ `confirmed`, `start_at < end AND end_at > start`), `Reservation(ctx, id int) (*Reservation, error)`, `Create(ctx, Reservation) (*Reservation, error)`, `Save(ctx, Reservation) (*Reservation, error)`
  - `Service.Create(ctx, userID uuid.UUID, restaurantID int, in Input) (*Reservation, error)`; `NewService(repo Repository, now func() time.Time)`; ตัวแปรโซนเวลา `bangkok` โหลดด้วย `time.LoadLocation("Asia/Bangkok")` พร้อม `import _ "time/tzdata"`
- Route: `POST /restaurants/:id/reservations`

ลำดับใน `Create` (ภายใน `InTx`): (1) `EndAt` ไม่หลัง `StartAt` → `ErrInvalidInput` · (2) `StartAt` ก่อน `now()` → `ErrStartInPast` · (3) แปลงเป็น `bangkok`; วันที่ท้องถิ่นของ start/end ต่างกัน, หรือ weekday ไม่มีใน `Hours`, หรือนอก `[OpenMin, CloseMin]` → `ErrOutsideOpeningHours` · (4) `PeakGuests(Overlapping(...), Booking{start,end,guests}) > Capacity` → `ErrCapacityExceeded` · (5) `Create`

- [ ] **Step 1: เขียนเทสต์ใน `reservation_create_test.go`** (ร้านค่า default: capacity 10, lead 60, เปิดทุกวัน 11:00–22:00; now = จันทร์ 2026-10-12 09:00+07:00; ช่วงเวลาเขียนเป็น `2026-10-12T18:00:00+07:00`):
  - `TestReservationCreate_Success`: 18:00–20:00 (4 คน) → 201 `{id}`; แถวใน DB `status='confirmed'`
  - `TestReservationCreate_Validation` → 400: guests 0, end = start, end < start, body ไม่ครบ
  - `TestReservationCreate_StartInPast`: 08:00 วันเดียวกัน → 400 `start_in_past`
  - `TestReservationCreate_OpeningBoundaries` (Review Focus 2): 11:00–22:00 → 201; 10:59–12:00 → 400 `outside_opening_hours`; 21:00–22:01 → 400 `outside_opening_hours`
  - `TestReservationCreate_ClosedDay`: ร้านไม่มีแถวของวันอังคาร → จอง 2026-10-13 12:00–13:00 → 400 `outside_opening_hours`
  - `TestReservationCreate_CrossMidnight`: 2026-10-12 21:00 → 2026-10-13 01:00 → 400 `outside_opening_hours`
  - `TestReservationCreate_UTCInputConvertedToBangkok` (Review Focus 3): `2026-10-12T14:00:00Z`–`2026-10-12T16:00:00Z` (=21:00–23:00 ไทย) → 400 `outside_opening_hours`; และ `2026-10-12T11:00:00Z`–`…13:00:00Z` (=18:00–20:00 ไทย) → 201
  - `TestReservationCreate_Capacity`: seed 6 คน 18:00–20:00; ขอ 4 คนช่วงเดียวกัน → 201; ขอ 5 → 409 `capacity_exceeded`; guests 11 (เกินความจุทั้งร้าน) → 409 `capacity_exceeded`
  - `TestReservationCreate_SpecExample`: ความจุ 10; seed 12:00–14:00 (6 คน) และ 14:00–16:00 (6 คน) แล้วขอ 13:00–15:00 (4 คน) → 201 (ผลรวมที่ซ้อนทับคือ 16 แต่ค่าสูงสุดพร้อมกันคือ 10)
  - `TestReservationCreate_IgnoresCancelled`: seed 10 คน `status='cancelled'` → ขอ 10 คนผ่าน
  - `TestReservationCreate_RestaurantMissingOrDeleted`: → 404
  - `TestReservationCreate_ConcurrentRequestsNeverOverbook`: ความจุ 10, 5 goroutines พร้อมกัน (ใช้ `sync.WaitGroup` + channel เริ่มพร้อมกัน) ต่างผู้ใช้ ขอ 4 คนช่วง 18:00–20:00 → จำนวน 201 ต้องเท่ากับ 2, ที่เหลือ 409 `capacity_exceeded`, และ `SELECT SUM(guests) FROM reservations WHERE status='confirmed'` = 8
- [ ] **Step 2: Run** `go test ./internal/apitest -run TestReservationCreate -v`; Expected: FAIL
- [ ] **Step 3: Implement** package + ลงทะเบียน route; handler map error: `ErrInvalidInput` → 400 (ไม่มี code), `ErrStartInPast`/`ErrOutsideOpeningHours` → 400 + code, `ErrCapacityExceeded` → 409 + code, `ErrRestaurantNotFound` → 404; `RegisterAPI` ส่ง `d.Now` เข้า `NewService`
- [ ] **Step 4: Run** คำสั่งเดิมด้วย `-count=3` (ยืนยันเทสต์ concurrency นิ่ง); Expected: PASS ทุกรอบ
- [ ] **Step 5: Commit** `feat: reservation create with locking and capacity rules`

---

### Task 8: Reservation — แก้ไข / ยกเลิก / รายการของฉัน

**Files:** Modify `reservation/{service,repository,handler,error}.go`, `httpapi/api.go` · Create `apitest/reservation_manage_test.go`

**Interfaces:**
- Consumes: Task 7 (`InTx`, `TxRepo`, errors), Task 6 (`leadTimeOK`)
- Produces: error ใหม่ `ErrReservationNotFound` (→ 404) · `Service.Update(ctx, userID uuid.UUID, id int, in Input) (*Reservation, error)` · `Service.Cancel(ctx, userID uuid.UUID, id int) error` · `Service.ListMine(ctx, userID uuid.UUID) ([]Reservation, error)` · Repository เพิ่ม `FindByID(ctx, id int) (*Reservation, error)` (ไม่พบ → `ErrReservationNotFound`) และ `ListByUser(ctx, userID uuid.UUID) ([]Reservation, error)` (JOIN `restaurants` เพื่อเติม `RestaurantName` — JOIN ไม่กรอง soft delete จึงยังเห็นชื่อร้านที่ถูกลบ; เรียง `start_at DESC`)
- Routes: `PUT /reservations/:id`, `POST /reservations/:id/cancel`, `GET /reservations`

ลำดับของ `Update`/`Cancel`: `FindByID` → ไม่ใช่เจ้าของ → `ErrForbidden` → `InTx(restaurantID)` แล้วอ่านซ้ำด้วย `tx.Reservation(id)` → สถานะไม่ใช่ `confirmed` หรือ `StartAt` ไม่หลัง `now()` → `ErrNotActive` → `leadTimeOK(เดิม.StartAt, now, LeadMinutes)` เท่านั้นจึงผ่าน มิฉะนั้น `ErrTooLateToModify`/`ErrTooLateToCancel` → (`Update`) รัน step 1–5 ของ Task 7 ด้วยค่าใหม่โดย `Overlapping(..., excludeID=id)` แล้ว `Save` (ห้ามเปลี่ยน `RestaurantID`/`UserID`); (`Cancel`) ตั้ง `Status = cancelled` แล้ว `Save`

- [ ] **Step 1: เขียนเทสต์ใน `reservation_manage_test.go`** (lead 60 นาที; seed การจอง 11:00–12:00 วันจันทร์ 2026-10-12 ของผู้ใช้ U; now เริ่มที่ 09:00):
  - `TestReservationCancel_LeadTimeBoundary`: `setNow(10:00)` (ห่าง 60 นาทีพอดี) → 204 และ DB `cancelled`; seed ใหม่แล้ว `setNow(10:01)` → 409 `too_late_to_cancel`
  - `TestReservationUpdate_LeadTimeBoundary`: now 10:00 → 200; now 10:01 → 409 `too_late_to_modify` (คำนวณจากเวลาเริ่ม**เดิม** แม้ body ย้ายไปวันหลัง)
  - `TestReservation_OtherUserForbidden`: ผู้ใช้อื่น PUT/cancel → 403; id ไม่มี → 404
  - `TestReservationCancel_TwiceConflicts`: ครั้งที่สอง → 409 `reservation_not_active`; และ `TestReservationCancel_ConcurrentDoubleCancel`: ยิง 2 คำขอพร้อมกัน → 204 หนึ่งครั้ง, 409 หนึ่งครั้ง
  - `TestReservationUpdate_NotActive`: ยกเลิกแล้ว → PUT 409 `reservation_not_active`; `setNow(12:30)` (เริ่มไปแล้ว) → 409 `reservation_not_active`
  - `TestReservationUpdate_ExcludesOwnAllocation`: ร้านความจุ 10 มีการจองนี้ 10 คน → เลื่อนเป็น 12:00–13:00 (10 คน) → 200; เพิ่มเป็น 11 คน → 409 `capacity_exceeded`; ย้ายไปชนกับการจองของคนอื่น 6 คน แล้วขอ 5 คน → 409
  - `TestReservationUpdate_RechecksAllRules`: ย้ายไปนอกเวลาเปิด → 400 `outside_opening_hours`; ย้ายไปอดีต → 400 `start_in_past`
  - `TestReservationCancel_FreesCapacity`: ร้านเต็ม → ผู้ใช้ A ยกเลิก → ผู้ใช้ B จองช่วงเดียวกันได้ 201
  - `TestReservationListMine`: เฉพาะของผู้เรียก ทั้ง `confirmed`/`cancelled` เรียง `startAt` ใหม่→เก่า, มี `restaurant.name`; หลังลบร้านด้วย SQL (`UPDATE restaurants SET deleted_at=now()`) ยังเห็นรายการและชื่อร้าน; ผลว่าง → `results:[]`
- [ ] **Step 2: Run** `go test ./internal/apitest -run TestReservation -v`; Expected: FAIL (route ไม่มี)
- [ ] **Step 3: Implement** ตามลำดับด้านบน; handler map `ErrTooLateTo…`/`ErrNotActive` → 409 + code, `ErrForbidden` → 403, `ErrReservationNotFound` → 404
- [ ] **Step 4: Run** คำสั่งเดิม; Expected: PASS (รวมเทสต์ Task 7)
- [ ] **Step 5: Commit** `feat: reservation update, cancel, list mine`

---

### Task 9: มุมมองเจ้าของร้าน + กันลบร้านที่มีการจองค้าง

**Files:** Modify `reservation/{service,repository,handler,dto}.go`, `restaurant/{service,repository}.go`, `httpapi/api.go` · Create `apitest/owner_view_test.go`

**Interfaces:**
- Consumes: Task 4–8
- Produces: `reservation.Service.ListForRestaurant(ctx, ownerID uuid.UUID, restaurantID int, status string) ([]Reservation, error)` (ตรวจเจ้าของร้านด้วย query ตรงบน `restaurants.owner_id`; ไม่ใช่เจ้าของ → `ErrForbidden`; ไม่พบ → `ErrRestaurantNotFound`; `status` ว่าง = ทั้งหมด, ค่าอื่นนอกจาก `confirmed`/`cancelled` → `ErrInvalidInput` ใช้ 400); response ต่อรายการ `{id, customer:{id,name}, startAt, endAt, guests, status, createdAt}` (JOIN `users` เติม `CustomerName`; **ไม่มีอีเมล**) · `restaurant` repository เพิ่ม `HasActiveReservations(ctx, id int, now time.Time) (bool, error)` (`status='confirmed' AND end_at > now`) และ `Delete` ใช้ `now` ที่รับมาใน `restaurant.NewService(repo, now)` (ส่ง `d.Now` จาก `RegisterAPI`) → `ErrHasActiveReservations` → 409 `restaurant_has_active_reservations`
- Route: `GET /restaurants/:id/reservations?status=`

- [ ] **Step 1: เขียนเทสต์ใน `owner_view_test.go`**:
  - `TestOwnerReservations_ListsWithCustomerName`: เจ้าของเห็นการจองของลูกค้า 2 คน มี `customer.name`; body ทั้งก้อนไม่มีอีเมลของลูกค้า (`assert.NotContains(body, "@")`); เรียง `startAt` ใหม่→เก่า; `?status=cancelled` กรองถูก; `?status=pending` → 400
  - `TestOwnerReservations_OnlyOwner`: ผู้ใช้อื่น (แม้เป็นลูกค้าที่จองร้านนั้น) → 403; ร้านไม่มี → 404
  - `TestRestaurantDelete_BlockedByActiveReservation`: มีการจอง `confirmed` อนาคต → 409 `restaurant_has_active_reservations` (ร้านยังอยู่); ยกเลิกการจองแล้ว DELETE → 204
  - `TestRestaurantDelete_PastOrCancelledReservationsDoNotBlock`: การจองที่ `end_at` ก่อน now (seed) และอันที่ cancelled → DELETE 204
  - `TestRestaurantReplace_DoesNotRevalidateExistingReservations` (กฎ R5): ร้านมีการจองวันจันทร์ 18:00–20:00; PUT ลดความจุเหลือ 1 และตัดเวลาเปิดวันจันทร์ออก → 200 และการจองเดิมยัง `confirmed`
- [ ] **Step 2: Run** `go test ./internal/apitest -run 'TestOwnerReservations|TestRestaurantDelete|TestRestaurantReplace_DoesNot' -v`; Expected: FAIL
- [ ] **Step 3: Implement** ตามด้านบน (ปรับ `RegisterAPI` ให้ส่ง `d.Now` เข้า `restaurant.NewService`)
- [ ] **Step 4: Run** `go test ./internal/apitest -v`; Expected: PASS ทั้งแพ็กเกจ
- [ ] **Step 5: Commit** `feat: owner reservation view and delete guard`

---

### Task 10: Reviews

**Files:** Create `review/{model,dto,error,handler,service,repository}.go`, `apitest/review_test.go` · Modify `httpapi/api.go`

**Interfaces:**
- Consumes: harness, Task 4 (`isOwner`/`myReview` ในรายละเอียดร้าน)
- Produces (package `review`): `type Review struct` (ID, RestaurantID int, UserID uuid.UUID, Rating int, Comment string, `UserName string` read-only, timestamps); `Service`: `Create(ctx, userID uuid.UUID, restaurantID int, rating int, comment string) (*Review, error)` · `UpdateMine(ctx, userID uuid.UUID, restaurantID int, rating int, comment string) (*Review, error)` · `List(ctx, restaurantID int) ([]Review, error)`; Errors: `ErrRestaurantNotFound`, `ErrOwnRestaurant`, `ErrAlreadyReviewed`, `ErrReviewNotFound`; DTO `SaveReviewRequest{Rating int (required,min=1,max=5); Comment string (required)}` + กฎ trim: comment หลัง trim ว่าง → 400; response ตามสเปก §6.2
- Routes: `POST /restaurants/:id/reviews`, `PUT /restaurants/:id/reviews/me`, `GET /restaurants/:id/reviews`

- [ ] **Step 1: เขียนเทสต์ใน `review_test.go`**:
  - `TestReviewCreate_Success`: 201 `{id}`; GET `/restaurants/{id}` → `rating == {average:5, total:1}` และ `myReview == {id, rating:5, comment}` ของผู้รีวิว, ของคนอื่น `myReview:null`
  - `TestReviewCreate_Validation` → 400: rating 0, 6, `3.5`, `"5"` (string), comment ว่าง, comment `"   "`
  - `TestReviewCreate_OwnRestaurant`: เจ้าของรีวิวร้านตัวเอง → 403 `cannot_review_own_restaurant`
  - `TestReviewCreate_Duplicate`: ครั้งที่สอง → 409 `already_reviewed`; และ `TestReviewCreate_ConcurrentDuplicate`: ผู้ใช้เดียวกันยิง POST พร้อมกัน 2 ครั้ง → 201 หนึ่งครั้ง 409 หนึ่งครั้ง และมีแถวใน DB เพียงหนึ่งแถว
  - `TestReviewCreate_RestaurantMissingOrDeleted` → 404
  - `TestReviewUpdateMine`: แก้ rating/comment → 200 resource เต็ม และค่าเฉลี่ยของร้านเปลี่ยน; ยังไม่เคยรีวิว → 404; ผู้ใช้อื่นแก้ของตัวเองไม่กระทบรีวิวคนแรก; PUT ด้วยค่าไม่ถูกต้อง → 400
  - `TestReviewList`: ใหม่สุดก่อน มี `user.name`; ร้านไม่มีรีวิว → `total:0, results:[]`; ร้านไม่มี → 404
  - `TestReview_RequiresAuth` → 401
- [ ] **Step 2: Run** `go test ./internal/apitest -run TestReview -v`; Expected: FAIL
- [ ] **Step 3: Implement** — `Create` ตรวจเจ้าของร้านด้วย query ตรงบน `restaurants`; ชน unique `(user_id, restaurant_id)` แปลงเป็น `ErrAlreadyReviewed` โดยตรวจ `pgconn.PgError` code `23505` (ห้ามใช้ check-then-insert เพราะ `TestReviewCreate_ConcurrentDuplicate` ต้องผ่าน); ไม่มี endpoint ลบ
- [ ] **Step 4: Run** `go test ./internal/apitest -v`; Expected: PASS
- [ ] **Step 5: Commit** `feat: restaurant reviews`

---

### Task 11: อัปโหลดรูปร้าน

**Files:** Create `api/internal/storage/local.go`, `api/internal/storage/local_test.go`, `api/internal/config/upload.go`, `apitest/image_test.go` · Modify `config/config.go`, `restaurant/{service,handler,repository,dto}.go`, `httpapi/api.go`, `main.go`, `api/Dockerfile`, `compose.yml`

**Interfaces:**
- Produces: `config.Upload{ Dir string env:"UPLOAD_DIR" envDefault:"./uploads" validate:"required" }` (เพิ่มใน `Config`) · `storage.Local` พร้อม `NewLocal(dir string) *Local`, `(*Local) Save(name string, r io.Reader) error` (เขียนที่ `<dir>/restaurants/<name>` สร้างโฟลเดอร์ถ้าไม่มี), `(*Local) Delete(name string) error` (ไม่มีไฟล์ = ไม่ error) · `restaurant` ประกาศ interface ฝั่งผู้ใช้ `ImageStorage { Save(name string, r io.Reader) error; Delete(name string) error }`; `Service.SetImage(ctx, id int, userID uuid.UUID, file io.Reader) (*Restaurant, error)` และ `Service.RemoveImage(ctx, id int, userID uuid.UUID) error`; `const MaxImageBytes = 2 << 20`; `restaurant.NewService(repo, images ImageStorage, now func() time.Time)`
- Routes: `POST /restaurants/:id/image` (multipart ฟิลด์ `file` → 200 ร้านเต็ม), `DELETE /restaurants/:id/image` (204), `GET /uploads/*` (สาธารณะ ไม่ผ่าน `Auth`; ใช้ `v1.Static("/uploads", d.UploadDir)`) — `image_url` ที่เก็บ = `/uploads/restaurants/<restaurantId>-<uuid>.<ext>` โดย ext จาก MIME (`image/jpeg`→`.jpg`, `image/png`→`.png`, `image/webp`→`.webp`) ชื่อไฟล์ไม่ใช้ชื่อจาก client

- [ ] **Step 1: เขียนเทสต์** — `local_test.go`: `TestLocal_SaveCreatesDirAndDeleteIsIdempotent` (ใช้ `t.TempDir()`); `image_test.go` (harness ตั้ง `UploadDir = t.TempDir()`; ไฟล์ทดสอบสร้างจากไบต์จริง เช่น header PNG `\x89PNG\r\n\x1a\n…`, JPEG `\xff\xd8\xff…`, WebP `RIFF….WEBPVP8 `):
  - `TestImageUpload_Success`: เจ้าของอัปโหลด PNG → 200 `imageUrl` ขึ้นต้น `/uploads/restaurants/` ลงท้าย `.png`; ไฟล์มีอยู่ใน `UploadDir`; `GET {imageUrl}` (ไม่ส่ง header) → 200 ได้ไบต์เดิม
  - `TestImageUpload_ReplaceDeletesOldFile`: อัปโหลดซ้ำ → URL เปลี่ยน, ไฟล์เก่าหาย
  - `TestImageUpload_RejectsSpoofedEmptyAndOversized` (Review Focus 5): เนื้อข้อความ ชื่อ `evil.png` → 400 `invalid_image`; ไฟล์ 0 ไบต์ → 400 `invalid_image`; PNG header + padding รวม `MaxImageBytes+1` ไบต์ → 400 `invalid_image`; ไม่ส่งฟิลด์ `file` → 400; ทุกกรณีไม่มีไฟล์เขียนค้าง
  - `TestImageUpload_OnlyOwner`: ผู้ใช้อื่น → 403; ร้านไม่มี → 404; ไม่ส่ง token → 401
  - `TestImageRemove`: เจ้าของ DELETE → 204, `imageUrl` เป็น null, ไฟล์หาย; ผู้ใช้อื่น → 403
  - `TestImageUpload_SoftDeletedRestaurantKeepsFile`: ลบร้านแล้วไฟล์ยังอยู่
- [ ] **Step 2: Run** `go test ./internal/storage ./internal/apitest -run 'TestLocal|TestImage' -v`; Expected: FAIL
- [ ] **Step 3: Implement** — ตรวจชนิดด้วย `http.DetectContentType` จาก 512 ไบต์แรก (ยอมเฉพาะสามชนิดที่กำหนด); อ่านไฟล์ด้วย `io.LimitReader(file, MaxImageBytes+1)` แล้วถ้าอ่านได้เกิน `MaxImageBytes` → `ErrInvalidImage`; ลำดับ: บันทึกไฟล์ใหม่ → อัปเดต `image_url` → ลบไฟล์เก่า (best-effort, ล้มเหลวไม่ทำให้คำขอล้ม)
- [ ] **Step 4: Dockerfile + compose** — ใน build stage สร้าง `/out/uploads` และ `COPY --from=builder --chown=65532:65532 /out/uploads /app/uploads`; compose: named volume `bookingtable-uploads:/app/uploads`, `UPLOAD_DIR: /app/uploads` ที่ service api
- [ ] **Step 5: Verify** — Run: `go test ./internal/... -v` แล้ว `docker compose up -d --build api` และอัปโหลดรูปจริงด้วย `curl -F file=@<รูป>.png -H "Authorization: Bearer <token>" localhost:8080/api/v1/restaurants/<id>/image`; Expected: 200 และเปิด `http://localhost:8080/api/v1<imageUrl>` เห็นรูป (ถ้า error permission denied แปลว่า `--chown` ไม่ถูกใช้)
- [ ] **Step 6: Commit** `feat: restaurant image upload`

---

### Task 12: Seed, เอกสาร API และตรวจรวม

**Files:** Create `api/seed/seed.sql` · Rewrite `api/docs/API.md` · Modify `api/docs/` (swagger) · Create/Modify `README.md` (ราก)

**Interfaces:** Consumes: ทุก task; Produces: ข้อมูลตัวอย่างและเอกสารสำหรับ Frontend

- [ ] **Step 1: เขียน `seed.sql`** — INSERT ผู้ใช้ปลอม `uid` = `seed-owner-1`, `seed-owner-2`, `seed-user-1..3` (อีเมล `@example.com`), ร้านชาบู/ปิ้งย่าง 5 ร้าน (ชื่อ/ที่อยู่ภาษาไทย, ความจุหลากหลาย, `cancellationLeadMinutes` 30–120, เวลาเปิดรายวันไม่เหมือนกันและมีร้านที่ปิดบางวัน), รีวิว 8–10 รายการ (บางร้านไม่มีรีวิว), การจองตัวอย่างอนาคต 3–4 รายการ (ใช้ `now() + interval` ให้คงอยู่ในเวลาเปิด); ใช้ได้ซ้ำโดยเริ่มด้วย `DELETE … WHERE uid LIKE 'seed-%'` ตามลำดับตาราง
- [ ] **Step 2: Verify seed** — Run: `docker compose exec -T postgres psql -U postgres -d bookingtable < api/seed/seed.sql` สองครั้งติดกัน; Expected: ไม่มี error และ `GET /restaurants?sort=rating` (ใช้ token) คืนร้านครบตามลำดับ
- [ ] **Step 3: เขียน `api/docs/API.md` ใหม่** ตามสเปก §6 (ตาราง endpoint, ตัวอย่าง JSON ทุกรูปแบบ, ตาราง `code`/status, วิธีอัปโหลด/ต่อ URL รูป) และลบ swagger annotation ของ recipe ที่ค้าง; รัน `swag init -g cmd/api/main.go -o docs` (ติดตั้งด้วย `go install github.com/swaggo/swag/cmd/swag@v1.16.6`) แล้ว `go build ./...` — ถ้า annotation ของ handler ใหม่ไม่ครบ ให้เติมตามแบบ recipe เดิมเฉพาะ summary/Router
- [ ] **Step 4: เขียน README ราก** — ขั้นตอน `cp .env.example .env`, `docker compose up -d --build`, `goose up`, รัน seed, ทางแก้ปัญหา hostname Keycloak ที่พบใน Task 0, วิธีรันเทสต์
- [ ] **Step 5: ตรวจรวม** — Run: `cd api && go vet ./... && go test ./... -count=1`; Expected: ทุกแพ็กเกจ PASS; แล้วไล่เช็กสเปก §5 ทีละข้อ (R1–R5, §5.2, B1–B6, V1–V4, I1–I7) ว่ามีเทสต์ที่ผ่านคู่กัน
- [ ] **Step 6: Commit** `docs: api contract, seed data, readme`
