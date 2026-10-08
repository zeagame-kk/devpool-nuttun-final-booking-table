# Booking Table — Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** สร้างเว็บฝั่งผู้ใช้ (Next.js) ของระบบจองโต๊ะและรีวิวร้านชาบู/ปิ้งย่าง: ล็อกอินผ่าน Keycloak, เลือกดู/ค้นหา/เรียงร้าน, จอง/แก้/ยกเลิก, รีวิว, และเจ้าของจัดการร้าน/รูป/เวลาเปิด/ดูการจองของร้านตัวเอง

**Architecture:** App Router ของ Next 16 เป็น client component เป็นหลัก (ทุก endpoint ต้องใช้ Bearer token จึงไม่มีข้อมูลสาธารณะให้ SSR). ทุกการเรียก API ผ่าน `apiFetch` ตัวเดียวที่แนบ Bearer, จัดการ 401→refresh ครั้งเดียวแล้ว retry, และไม่ parse JSON เมื่อได้ 204. ตรรกะที่เสี่ยง (API client, แปลงเวลา, แปลง error, ตัวแก้เวลาเปิด) แยกเป็นฟังก์ชันใน `lib/` ที่มี Vitest ครอบ; หน้า/คอมโพเนนต์ตรวจด้วย lint + type check + build + เช็กลิสต์ทดสอบมือ

**Tech Stack:** Next.js 16.3.4 (App Router) · React 19.2.8 · TypeScript strict · Tailwind CSS v4 · shadcn/ui (style `base-nova`, `@base-ui/react`) · Vitest (เฉพาะ `lib/`) · ไม่ใช้ library ฟอร์ม/state/HTTP เพิ่ม (ใช้ `useState` + `fetch`)

**Spec:** `SPEC.md` (ภาพรวม) และ `docs/superpowers/specs/2026-10-08-booking-table-mvp-design.md` (API §6, ข้อกำหนด frontend §12.2) — ผู้ implement ต้องอ่านทั้งสองไฟล์ และ `Backend_PLAN.md` สำหรับ contract ที่ backend ให้จริง

**การตัดสินใจที่ spec ปล่อยไว้ (ตัดสินในแผนนี้ แก้ได้):** (1) เก็บ credential ใน `localStorage` (ง่ายที่สุด; แลกกับความเสี่ยง XSS ซึ่งยอมรับได้สำหรับงานสอบ) · (2) ฟอร์มเขียนเองด้วย `useState` ไม่ใช้ library · (3) เพิ่ม Vitest เฉพาะ `lib/` เพราะ logic refresh token/แปลงเวลาเสี่ยงและทดสอบได้โดยไม่ต้องมี DOM

## Global Constraints

- ก่อนเขียน routing/data fetching ต้องอ่านเอกสารที่ติดมากับแพ็กเกจ `web/node_modules/next/dist/docs/` (ตาม `web/AGENTS.md`). ข้อที่ตรวจแล้ว: `params` ของ page เป็น `Promise` → ในคอมโพเนนต์ client ใช้ `useParams()` จาก `next/navigation`; `useSearchParams` ต้องอยู่ใต้ `<Suspense>`; middleware ถูกเปลี่ยนชื่อเป็น `proxy` (แผนนี้ไม่ใช้)
- `NEXT_PUBLIC_API_BASE_URL` = `http://localhost:8080/api/v1` (URL ที่ browser เรียกได้ ไม่ใช่ `http://api:8080`); ห้ามใส่ secret ใน `NEXT_PUBLIC_*`
- ทุก request ยกเว้น `/auth/*` และไฟล์รูป ต้องแนบ `Authorization: Bearer <accessToken>`; 204 ห้าม `res.json()`; อัปโหลดใช้ `FormData` และห้ามตั้ง `Content-Type` เอง
- Login ต้อง navigate ทั้งหน้าไป `{API_BASE}/auth/login` (ห้าม fetch); หน้า `/auth/callback` แลก `ticket` ครั้งเดียว (ticket ใช้ได้ครั้งเดียว อายุ 30 วินาที)
- เวลาเปิด–ปิดเป็นข้อความ `"HH:MM"`; weekday 0=อาทิตย์…6; การจองส่ง/รับ RFC 3339; เขตเวลาแสดงผลและป้อนข้อมูลคงที่ `Asia/Bangkok` (UTC+7 ไม่มี DST) ไม่ขึ้นกับเขตเวลาของ browser
- ข้อความผิดพลาดจาก backend ใช้ `code` ใน `{message, code?}` แปลงเป็นข้อความไทย; ค่า `code` ที่ต้องรองรับ: `start_in_past`, `outside_opening_hours`, `capacity_exceeded`, `too_late_to_cancel`, `too_late_to_modify`, `reservation_not_active`, `cannot_review_own_restaurant`, `already_reviewed`, `restaurant_has_active_reservations`, `invalid_image`
- UI ภาษาไทย ธีมร้านชาบู/ปิ้งย่าง (ไม่มีฟิลด์หมวดหมู่); ใช้ design token เดิม (`bg-primary`, `text-muted-foreground` ฯลฯ) ห้าม hardcode สี
- Import ภายในโปรเจกต์ใช้ alias `@/…`; คอมโพเนนต์ใช้ named export; ปุ่มใช้ `Button` จาก `@/components/bases/button` (size `small|medium|large`), primitive อื่นที่เพิ่มด้วย shadcn อยู่ใน `@/components/ui/*`
- รูปแสดงด้วย `<img>` ธรรมดา (มี `// eslint-disable-next-line @next/next/no-img-element`) โดย URL = `API_BASE + imageUrl`; `imageUrl` เป็น `null` ต้องแสดง placeholder ไม่ใช่รูปเสีย
- ร้านที่ผู้ใช้เป็นเจ้าของ ใช้ `isOwner` จาก detail ตัดสินปุ่ม ห้ามเทียบ id เอง
- Commit message ปิดท้ายด้วย `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`

## Review Focus

1. **React Strict Mode เรียก effect ซ้ำในหน้า `/auth/callback`** → ต้องแลก ticket ครั้งเดียว มิฉะนั้นครั้งที่สองได้ 401 และผู้ใช้เห็นว่าล็อกอินล้มเหลว (Task 3: ตรวจใน dev server ว่า `POST /auth/exchange` ถูกเรียกครั้งเดียว)
2. **คำขอ 401 พร้อมกันหลายตัว** (เช่นหน้าที่โหลด 2 endpoint) → ต้อง refresh ครั้งเดียว ไม่ใช่สองครั้ง (refresh token หมุนแล้วครั้งที่สองจะล้ม) (Task 2: `refreshes once for concurrent 401s`)
3. **เขตเวลาของ browser ไม่ใช่ไทย** → ค่า `datetime-local` ต้องแปลงเป็น `+07:00` เสมอ; สคริปต์เทสต์รันด้วย `TZ=America/New_York` เพื่อจับโค้ดที่พึ่งเขตเวลาท้องถิ่น (Task 1: `datetime.test.ts`)
4. **ตัวแก้เวลาเปิดต้องไม่ทิ้งวันอาทิตย์ (weekday 0)** — ค่า 0 เป็น falsy ใน JS (Task 1: `opening-hours.test.ts › keeps Sunday`)
5. **สถานะว่าง** — ร้านไม่มีรีวิว/ไม่มีรูป/รายการจองว่าง/ค้นหาไม่พบ ต้องแสดงข้อความ ไม่ใช่หน้าว่างหรือ error (Task 4–8 เช็กลิสต์ใน Task 9)

---

## File Structure (ภายใต้ `booking_table/web/`)

```text
lib/        types.ts  datetime.ts  errors.ts  opening-hours.ts  auth-store.ts  api.ts  auth.ts   (+ *.test.ts ข้างไฟล์)
hooks/      use-credential.ts  use-async.ts
components/ auth-guard.tsx  site-header.tsx  error-alert.tsx  pager.tsx  star-picker.tsx
            restaurant-card.tsx  restaurant-form.tsx  opening-hours-editor.tsx  image-uploader.tsx
            reservation-form.tsx  review-section.tsx   ui/ (shadcn)  bases/button.tsx (เดิม)
app/        layout.tsx (แก้)  page.tsx (รายการร้าน)  auth/callback/page.tsx
            restaurants/[id]/page.tsx  my/reservations/page.tsx
            my/restaurants/page.tsx  my/restaurants/new/page.tsx
            my/restaurants/[id]/edit/page.tsx  my/restaurants/[id]/reservations/page.tsx
vitest.config.ts
```

ลำดับพึ่งพา backend: Task 1–2 ไม่ต้องมี backend · Task 3 ต้องมี Backend Task 0–1 · Task 4 ← Backend Task 5 · Task 5 ← Backend Task 4, 7, 10 · Task 6 ← Task 8 · Task 7 ← Task 4, 11 · Task 8 ← Task 9

---

### Task 0: เตรียมโปรเจกต์ web

**Files:** Modify `web/package.json` · Create `web/vitest.config.ts`, `web/components/ui/{input,label,textarea,card,badge}.tsx` (ผ่าน shadcn CLI)

**Interfaces:** Produces: สคริปต์ `npm test` (= `TZ=America/New_York vitest run`), alias `@` ใน Vitest ชี้ราก `web/`, primitive `Input`, `Label`, `Textarea`, `Card`, `Badge`

- [ ] **Step 1: อ่านเอกสาร Next 16** — เปิดและอ่านใน `web/node_modules/next/dist/docs/01-app/`: `page.md` (params), `use-search-params.md`, `use-params.md`, `link.md`, `use-router.md`; จดข้อที่ต่างจากความรู้เดิมไว้ใน `web/NOTES.md` (ไม่เกิน 15 บรรทัด)
- [ ] **Step 2: ติดตั้ง** `cd web && npm ci && npm i -D vitest@^3` แล้วเพิ่ม script `"test": "TZ=America/New_York vitest run"` และ `"typecheck": "tsc --noEmit"`
- [ ] **Step 3: `vitest.config.ts`** — `environment: "node"`, `include: ["lib/**/*.test.ts"]`, alias `@` → `__dirname`
- [ ] **Step 4: เพิ่ม primitive** `npx shadcn@latest add input label textarea card badge` (base-nova) แล้วตรวจว่าไฟล์อยู่ใน `components/ui/`
- [ ] **Step 5: Verify baseline** — Run: `npm run lint && npm run typecheck && npm run build`; Expected: ผ่านทั้งหมด (หน้า demo เดิมยังอยู่; `npm test` ยังไม่ต้องรันเพราะยังไม่มีไฟล์เทสต์)
- [ ] **Step 6: Commit** `chore(web): add vitest and shadcn primitives`

---

### Task 1: lib ชุดบริสุทธิ์ — types, datetime, errors, opening-hours

**Files:** Create `web/lib/types.ts`, `web/lib/datetime.ts`, `web/lib/errors.ts`, `web/lib/opening-hours.ts` และเทสต์ `web/lib/{datetime,errors,opening-hours}.test.ts`

**Interfaces:**
- Produces `types.ts`: `Credential{accessToken,refreshToken,bearerType:string; expiresAt:string}` · `OpeningHour{weekday:number; open:string; close:string}` · `Rating{average:number; total:number}` · `Person{id:string; name:string}` · `RestaurantSummary{id:number; name; address:string; description:string|null; imageUrl:string|null; seatingCapacity:number; cancellationLeadMinutes:number; owner:Person; rating:Rating}` · `RestaurantDetail = RestaurantSummary & {openingHours:OpeningHour[]; isOwner:boolean; myReview:{id:number; rating:number; comment:string}|null}` · `ListResponse<T>{total:number; results:T[]}` · `MyReservation{id:number; restaurant:{id:number;name:string}; startAt:string; endAt:string; guests:number; status:"confirmed"|"cancelled"; createdAt:string}` · `OwnerReservation{id:number; customer:Person; startAt; endAt:string; guests:number; status:"confirmed"|"cancelled"; createdAt:string}` · `Review{id:number; rating:number; comment:string; user:Person; createdAt:string; updatedAt:string}` · `SaveRestaurantInput{name;address:string; description?:string; seatingCapacity:number; cancellationLeadMinutes:number; openingHours:OpeningHour[]}` · `SaveReservationInput{startAt:string; endAt:string; guests:number}`
- Produces `datetime.ts`: `toApiDateTime(local: string): string` (`"2026-10-12T18:00"` → `"2026-10-12T18:00:00+07:00"`) · `fromApiDateTime(iso: string): string` (instant ใด ๆ → `"YYYY-MM-DDTHH:mm"` ตามเวลาไทย) · `formatThaiDateTime(iso: string): string` (ใช้ `Intl.DateTimeFormat("th-TH", {timeZone:"Asia/Bangkok", dateStyle:"medium", timeStyle:"short"})`) · `WEEKDAY_LABELS: string[]` = `["อาทิตย์","จันทร์","อังคาร","พุธ","พฤหัสบดี","ศุกร์","เสาร์"]`
- Produces `errors.ts`: `messageForError(err: unknown): string` — ถ้า `err` มี `code` ที่รู้จักคืนข้อความตามตารางด้านล่าง; ไม่มี code → ตาม `status` (400 "ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง", 401 "กรุณาเข้าสู่ระบบอีกครั้ง", 403 "คุณไม่มีสิทธิ์ทำรายการนี้", 404 "ไม่พบข้อมูลที่ต้องการ", 409 "ทำรายการไม่ได้ในสถานะปัจจุบัน", อื่น ๆ/ไม่ใช่ ApiError "เกิดข้อผิดพลาด กรุณาลองใหม่ภายหลัง")
  | code | ข้อความ |
  | --- | --- |
  | `start_in_past` | ไม่สามารถจองย้อนหลังได้ |
  | `outside_opening_hours` | เวลาที่เลือกอยู่นอกเวลาเปิดทำการของร้าน |
  | `capacity_exceeded` | ที่นั่งไม่พอสำหรับช่วงเวลานี้ |
  | `too_late_to_cancel` | เลยกำหนดเวลาที่ยกเลิกได้แล้ว |
  | `too_late_to_modify` | เลยกำหนดเวลาที่แก้ไขได้แล้ว |
  | `reservation_not_active` | การจองนี้ถูกยกเลิกหรือเริ่มไปแล้ว |
  | `cannot_review_own_restaurant` | ไม่สามารถรีวิวร้านของตัวเองได้ |
  | `already_reviewed` | คุณรีวิวร้านนี้ไปแล้ว |
  | `restaurant_has_active_reservations` | ลบร้านไม่ได้ เพราะยังมีการจองที่ค้างอยู่ |
  | `invalid_image` | ไฟล์รูปไม่ถูกต้อง (รองรับ JPG, PNG, WebP ขนาดไม่เกิน 2 MB) |
- Produces `opening-hours.ts`: `type DayRow{weekday:number; enabled:boolean; open:string; close:string}` · `emptyDayRows(): DayRow[]` (7 แถว weekday 0–6, `enabled:false`, `open:"11:00"`, `close:"22:00"`) · `rowsFromHours(hours: OpeningHour[]): DayRow[]` · `rowsToHours(rows: DayRow[]): OpeningHour[]` (เฉพาะ `enabled`, เรียง weekday) · `validateRows(rows: DayRow[]): string | null` (คืนข้อความไทยตัวแรกที่ผิด: ไม่มีวันเปิดเลย → "ต้องเปิดอย่างน้อย 1 วัน"; วันเปิดที่ `close <= open` → "เวลาปิดต้องหลังเวลาเปิด (<ชื่อวัน>)"; ไม่ผิด → `null`)
- `ApiError` ถูกนิยามใน Task 2; `messageForError` ตรวจรูปร่าง (`{status:number; code?:string}`) เพื่อไม่พึ่งลำดับ task — ให้ import type เท่านั้นเมื่อ Task 2 เสร็จ หรือใช้ type guard ท้องถิ่น

- [ ] **Step 1: เขียนเทสต์ที่ล้มเหลว**
  - `datetime.test.ts`: `toApiDateTime("2026-10-12T18:00") === "2026-10-12T18:00:00+07:00"`; `fromApiDateTime("2026-10-12T11:00:00Z") === "2026-10-12T18:00"`; `fromApiDateTime("2026-10-12T18:00:00+07:00") === "2026-10-12T18:00"`; `fromApiDateTime("2026-10-12T17:30:00Z") === "2026-10-13T00:30"` (ข้ามวัน); round-trip `fromApiDateTime(toApiDateTime(x)) === x` สำหรับ `"2026-10-12T00:00"` และ `"2026-12-31T23:59"` (ทุกเคสต้องผ่านภายใต้ `TZ=America/New_York`); `WEEKDAY_LABELS[0] === "อาทิตย์"` และยาว 7
  - `errors.test.ts`: ทุก `code` ในตารางได้ข้อความตรงตัว; `{status:409}` ไม่มี code → "ทำรายการไม่ได้ในสถานะปัจจุบัน"; `{status:404, code:"unknown_code"}` → ข้อความของ 404; `new Error("x")` และ `undefined` → "เกิดข้อผิดพลาด กรุณาลองใหม่ภายหลัง"
  - `opening-hours.test.ts`: `emptyDayRows()` ยาว 7 weekday 0..6; `keeps Sunday`: `rowsToHours(rowsFromHours([{weekday:0,open:"11:00",close:"22:00"}]))` เท่ากับอินพุต; `rowsToHours` ไม่รวมวัน disabled และเรียง weekday; `validateRows` — ทุกวัน disabled → "ต้องเปิดอย่างน้อย 1 วัน"; วันจันทร์ open "22:00" close "11:00" → ข้อความมี "จันทร์"; ปิด == เปิด → ผิด; ชุดที่ถูกต้อง → `null`
- [ ] **Step 2: Run** `npm test`; Expected: FAIL (module ไม่พบ)
- [ ] **Step 3: Implement** ทั้งสี่ไฟล์ตาม Interfaces — `toApiDateTime` ต่อสตริง (`+":00+07:00"`) ไม่ใช้ `Date` ท้องถิ่น; `fromApiDateTime` ใช้ `new Date(iso).getTime() + 7*3600*1000` แล้วอ่านด้วย `toISOString().slice(0,16)`
- [ ] **Step 4: Run** `npm test && npm run typecheck`; Expected: PASS
- [ ] **Step 5: Commit** `feat(web): pure helpers for time, errors and opening hours`

---

### Task 2: API client และ auth store

**Files:** Create `web/lib/auth-store.ts`, `web/lib/api.ts`, `web/lib/auth.ts`, `web/lib/api.test.ts`

**Interfaces:**
- Consumes: `Credential` (Task 1)
- Produces `auth-store.ts` (ไม่ import ไฟล์อื่นในโปรเจกต์นอกจาก `types.ts` เพื่อกัน import วน): `interface AuthStore { get(): Credential | null; set(c: Credential): void; clear(): void }` · `localStorageAuthStore: AuthStore` (เก็บ credential ทั้งก้อนเป็น JSON ใต้คีย์เดียว `bookingtable.credential`; ครอบ try/catch ทุกการเข้าถึง; SSR-safe → `get()` คืน `null` เมื่อไม่มี `window` หรือ JSON เสีย; `set/clear` แจ้ง `window.dispatchEvent(new Event("bookingtable:auth"))`)
- Produces `auth.ts` (import จาก `api.ts` และ `auth-store.ts`): `startLogin(): void` (`window.location.href = API_BASE + "/auth/login"`) · `exchangeTicket(ticket: string): Promise<Credential>` (`POST /auth/exchange` ด้วย `auth:false` แล้ว `localStorageAuthStore.set`) · `logout(): Promise<void>` (`POST /auth/logout {refreshToken}` แบบ best-effort ไม่ว่าสำเร็จหรือไม่แล้ว `clear`)
- Produces `api.ts`: `API_BASE: string` (`process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080/api/v1"`) · `class ApiError extends Error { status: number; code?: string }` · `interface ApiDeps { fetchFn: typeof fetch; store: AuthStore; baseUrl: string; onAuthLost: () => void }` · `createApiFetch(deps: ApiDeps): <T>(path: string, init?: { method?: string; body?: unknown | FormData; auth?: boolean }) => Promise<T>` · `apiFetch` = `createApiFetch` ด้วยค่าจริง (`store` = `localStorageAuthStore`; `onAuthLost` = `store.clear()` แล้วตั้ง `window.location.href` ไป `API_BASE + "/auth/login"` ตรง ๆ ไม่ import `auth.ts`) · `assetUrl(imageUrl: string | null): string | null` (ต่อกับ `API_BASE`)
- พฤติกรรมของ `apiFetch`: `body` เป็น `FormData` → ส่งตรงไม่ตั้ง `Content-Type`; อื่น ๆ → `JSON.stringify` + `Content-Type: application/json`; `auth !== false` และมี token → แนบ `Authorization: Bearer`; ตอบ 204 → คืน `undefined`; `!res.ok` → โยน `ApiError` (อ่าน `{message, code}` จาก body ถ้าอ่านได้); ได้ 401 ขณะส่ง token → เรียก refresh (`POST /auth/refresh-token {refreshToken}` ไม่แนบ token) แบบ **single-flight** (promise ตัวเดียวที่ใช้ร่วม) → เก็บ credential ใหม่ → ส่งคำขอเดิมซ้ำครั้งเดียว; refresh ล้มเหลวหรือไม่มี refreshToken → `store.clear()`, `onAuthLost()`, โยน `ApiError(401)`

- [ ] **Step 1: เขียน `api.test.ts` ที่ล้มเหลว** (ใช้ `fetchFn` ปลอมด้วย `vi.fn` และ store ในหน่วยความจำ; `baseUrl:"http://api.test/v1"`):
  - `attaches bearer token`: header `Authorization` = `Bearer t1`; ไม่มี token → ไม่มี header
  - `returns undefined for 204 without parsing json`: response ปลอมที่ `json()` โยน error → ไม่เรียก `json()`, ผลลัพธ์ `undefined`
  - `maps error body to ApiError`: 409 `{message:"x", code:"capacity_exceeded"}` → reject ด้วย `ApiError` ที่ `status===409`, `code==="capacity_exceeded"`, `message==="x"`; body อ่านไม่ได้ → `status` ถูกต้องและ `code` เป็น `undefined`
  - `sends FormData without content-type`: ไม่มี header `Content-Type` ในคำขอ และ `body` เป็นอินสแตนซ์เดิม
  - `sends json with content-type`: body ถูก stringify
  - `refreshes once and retries on 401`: คำขอแรก 401 → refresh คืน credential ใหม่ → คำขอซ้ำใช้ `Bearer t2` → สำเร็จ; `store.get().accessToken === "t2"`; `fetchFn` ถูกเรียกรวม 3 ครั้ง
  - `refreshes once for concurrent 401s` (Review Focus 2): ยิงสองคำขอพร้อมกันที่ได้ 401 ทั้งคู่ → คำขอไปที่ `/auth/refresh-token` ครั้งเดียว และทั้งสองสำเร็จ
  - `clears store and calls onAuthLost when refresh fails`: refresh ตอบ 401 → `store.get()` เป็น `null`, `onAuthLost` ถูกเรียกครั้งเดียว, reject ด้วย `ApiError` status 401; ไม่ retry ซ้ำวนไม่รู้จบ
  - `does not refresh when auth is false`: เรียก `auth:false` ได้ 401 → ไม่เรียก refresh
- [ ] **Step 2: Run** `npm test`; Expected: FAIL
- [ ] **Step 3: Implement** `auth-store.ts`, `api.ts`, `auth.ts` ตาม Interfaces (ทิศทาง import: `auth.ts` → `api.ts` → `auth-store.ts`; ห้ามย้อนกลับ)
- [ ] **Step 4: Run** `npm test && npm run typecheck && npm run lint`; Expected: PASS
- [ ] **Step 5: Commit** `feat(web): api client with refresh and auth store`

---

### Task 3: ระบบล็อกอิน, header และ layout

**Files:** Create `web/hooks/use-credential.ts`, `web/hooks/use-async.ts`, `web/components/{auth-guard,site-header,error-alert}.tsx`, `web/app/auth/callback/page.tsx` · Modify `web/app/layout.tsx`, `web/app/page.tsx` (ชั่วคราวเป็น placeholder "ร้านทั้งหมด" ภายใต้ guard)

**Interfaces:**
- Consumes: `localStorageAuthStore`, `startLogin`, `exchangeTicket`, `logout` (Task 2)
- Produces: `useCredential(): Credential | null | undefined` (`undefined` ก่อน mount; ฟัง event `bookingtable:auth` และ `storage` ด้วย `useSyncExternalStore`) · `useAsync<T>(fn: () => Promise<T>, deps: unknown[]): { data: T | undefined; error: unknown; loading: boolean; reload: () => void }` · `<AuthGuard>{children}</AuthGuard>` (ก่อน mount ไม่แสดงอะไร; ไม่มี credential → การ์ด "กรุณาเข้าสู่ระบบ" + ปุ่ม `startLogin`) · `<SiteHeader/>` (ลิงก์ "ร้านทั้งหมด" `/`, "ร้านของฉัน" `/my/restaurants`, "การจองของฉัน" `/my/reservations`, ปุ่ม "ออกจากระบบ"; แสดงเมื่อมี credential) · `<ErrorAlert error={unknown}/>` (ใช้ `messageForError`; ไม่มี error → ไม่แสดง)

- [ ] **Step 1: `app/auth/callback/page.tsx`** — client component; ห่อเนื้อหาที่ใช้ `useSearchParams` ด้วย `<Suspense>`; อ่าน `ticket`; ใช้ `useRef` เป็น flag กันการแลกซ้ำ (Review Focus 1); สำเร็จ → `router.replace("/")`; ไม่มี ticket หรือแลกล้มเหลว → แสดง `ErrorAlert` และปุ่ม "เข้าสู่ระบบอีกครั้ง"
- [ ] **Step 2: `layout.tsx`** — `lang="th"`, `metadata.title = "Booking Table"`, ใส่ `<SiteHeader/>` และ `<main className="mx-auto w-full max-w-5xl flex-1 p-4">`; ลบ demo เดิมใน `page.tsx`
- [ ] **Step 3: Verify (ต้องมี backend ตาม Backend Task 0–1 รันอยู่)** — Run: `npm run lint && npm run typecheck && npm run build`; Expected: ผ่าน. จากนั้น `npm run dev` แล้วเปิด `http://localhost:3000`: ไม่ล็อกอิน → เห็นการ์ดให้ล็อกอิน → กด → Keycloak → กลับมาที่ `/` เห็น header; เปิด DevTools › Network: **`POST /auth/exchange` ต้องถูกเรียกครั้งเดียว** (dev มี Strict Mode); รีเฟรชหน้ายังล็อกอินอยู่; "ออกจากระบบ" แล้วเห็นการ์ดล็อกอิน
- [ ] **Step 4: Commit** `feat(web): login flow, auth guard and header`

---

### Task 4: หน้ารายการร้าน (ค้นหา / เรียง / แบ่งหน้า)

**Files:** Create `web/components/{restaurant-card,pager}.tsx` · Modify `web/app/page.tsx`

**Interfaces:**
- Consumes: `apiFetch`, `assetUrl`, `ListResponse<RestaurantSummary>`, `useAsync`, `AuthGuard`, `ErrorAlert`
- Produces: `<RestaurantCard restaurant={RestaurantSummary} actions?={ReactNode}/>` (รูปหรือ placeholder, ชื่อ, ที่อยู่, "ที่นั่ง N", คะแนน `★ 4.3 (12 รีวิว)` หรือ "ยังไม่มีรีวิว" เมื่อ `rating.total === 0`, ลิงก์ไป `/restaurants/{id}`) · `<Pager page total limit onChange/>` (ปุ่ม ก่อนหน้า/ถัดไป และ "หน้า X จาก Y"; ซ่อนเมื่อ Y ≤ 1)

- [ ] **Step 1: Implement `app/page.tsx`** — สถานะอยู่ใน URL (`name`, `sort` ∈ `""|rating|reviews`, `page`) ผ่าน `useSearchParams` ใต้ `<Suspense>`; ฟอร์มค้นหา (submit แล้วตั้ง `name`, reset `page=1`), `<select>` เรียงลำดับ ("ใหม่ล่าสุด" / "คะแนนเฉลี่ย" / "จำนวนรีวิว"), เรียก `GET /restaurants?name=&sort=&page=&limit=12`, แสดงกริด `RestaurantCard`; ผลว่าง → "ไม่พบร้านที่ค้นหา"; โหลดอยู่ → "กำลังโหลด…"
- [ ] **Step 2: Verify (ต้องมี Backend Task 5 + seed)** — Run: `npm run lint && npm run typecheck && npm run build`; Expected: ผ่าน. เช็กมือ: ค้นหา "ชาบู" ได้ร้านที่ชื่อมีคำนั้น; ค้นหา `%` ไม่ทำให้ผลเพี้ยน; เรียงตามคะแนนเฉลี่ยร้านที่ไม่มีรีวิวอยู่ท้ายและแสดง "ยังไม่มีรีวิว"; ปุ่มหน้าถัดไปเปลี่ยน URL และได้ร้านชุดใหม่ไม่ซ้ำ; รีเฟรชแล้วสถานะการค้นหาคงอยู่
- [ ] **Step 3: Commit** `feat(web): restaurant list page`

---

### Task 5: หน้ารายละเอียดร้าน (ข้อมูล + จอง + รีวิว)

**Files:** Create `web/app/restaurants/[id]/page.tsx`, `web/components/{reservation-form,review-section,star-picker}.tsx`

**Interfaces:**
- Consumes: `RestaurantDetail`, `Review`, `ListResponse<Review>`, `SaveReservationInput`, `toApiDateTime`, `WEEKDAY_LABELS`, `messageForError`/`ErrorAlert`, `useAsync`
- Produces: `<ReservationForm restaurantId={number} onCreated={() => void}/>` (ฟิลด์ `<input type="datetime-local">` เริ่ม/สิ้นสุด และจำนวนคน `min=1`; submit → `POST /restaurants/{id}/reservations` ด้วย `toApiDateTime`; สำเร็จ → ข้อความ "จองสำเร็จ" + ลิงก์ `/my/reservations`; ล้มเหลว → `ErrorAlert`; ปุ่มปิดระหว่างส่ง) · `<StarPicker value onChange/>` (1–5) · `<ReviewSection restaurantId isOwner myReview reviews onChanged/>` (รายการรีวิว: ชื่อ, ดาว, ข้อความ, วันที่; ถ้า `isOwner` แสดงข้อความ "ร้านของคุณ ไม่สามารถรีวิวได้" แทนฟอร์ม; ไม่ใช่เจ้าของ: ฟอร์มดาว+ข้อความ — มี `myReview` → โหมดแก้ไข `PUT /restaurants/{id}/reviews/me`, ไม่มี → `POST /restaurants/{id}/reviews`; ข้อความว่างให้ปุ่มส่งปิด)

- [ ] **Step 1: Implement หน้า** — `useParams()` อ่าน `id`; โหลด `GET /restaurants/{id}` และ `GET /restaurants/{id}/reviews` พร้อมกัน; แสดง: รูป/placeholder, ชื่อ, ที่อยู่, คำอธิบาย (ถ้ามี), ที่นั่ง, "ยกเลิกได้ล่วงหน้าอย่างน้อย N นาที", ตารางเวลาเปิด 7 วัน (วันที่ไม่มีใน `openingHours` = "ปิด"), คะแนน; ถ้า `isOwner` มีลิงก์ "จัดการร้าน" ไป `/my/restaurants/{id}/edit`; 404 → "ไม่พบร้านนี้"
- [ ] **Step 2: Verify (ต้องมี Backend Task 4, 7, 10)** — Run: `npm run lint && npm run typecheck && npm run build`; Expected: ผ่าน. เช็กมือด้วยสองบัญชี (เจ้าของ/ลูกค้า): (ก) จอง 18:00–20:00 สำเร็จ; (ข) จองนอกเวลาเปิดเห็น "เวลาที่เลือกอยู่นอกเวลาเปิดทำการของร้าน"; (ค) จองเกินที่นั่งเห็น "ที่นั่งไม่พอสำหรับช่วงเวลานี้"; (ง) ลูกค้ารีวิว 5 ดาวแล้วคะแนนร้านอัปเดต และเปิดใหม่ฟอร์มเป็นโหมดแก้ไขพร้อมค่าเดิม; (จ) เจ้าของไม่เห็นฟอร์มรีวิว; (ฉ) ร้านไม่มีรีวิว/ไม่มีรูปไม่ทำให้หน้าพัง
- [ ] **Step 3: Commit** `feat(web): restaurant detail with reservation and reviews`

---

### Task 6: หน้าการจองของฉัน (ดู / แก้ / ยกเลิก)

**Files:** Create `web/app/my/reservations/page.tsx`

**Interfaces:**
- Consumes: `MyReservation`, `ListResponse`, `formatThaiDateTime`, `fromApiDateTime`, `toApiDateTime`, `SaveReservationInput`, `ErrorAlert`, `Badge`

- [ ] **Step 1: Implement** — `GET /reservations` แสดงรายการ (ชื่อร้านเป็นลิงก์ `/restaurants/{id}`, ช่วงเวลา `formatThaiDateTime`, จำนวนคน, `Badge` สถานะ "ยืนยันแล้ว"/"ยกเลิกแล้ว"); ว่าง → "ยังไม่มีการจอง"; รายการ `confirmed` ที่ `startAt` ยังไม่ถึง เท่านั้นที่มีปุ่ม "แก้ไข" (เปิดฟอร์มในตัว: datetime-local เริ่ม/สิ้นสุดตั้งค่าเริ่มต้นด้วย `fromApiDateTime`, จำนวนคน; บันทึกด้วย `PUT /reservations/{id}`) และ "ยกเลิก" (`window.confirm("ยืนยันการยกเลิกการจอง?")` แล้ว `POST /reservations/{id}/cancel` ซึ่งตอบ 204); error แสดงใต้รายการนั้น ไม่ใช่ทั้งหน้า; หลังสำเร็จ reload รายการ
- [ ] **Step 2: Verify (ต้องมี Backend Task 8)** — Run: lint/typecheck/build ผ่าน. เช็กมือ: แก้เวลาแล้วเห็นค่าใหม่; แก้ให้ชนความจุเห็นข้อความ `capacity_exceeded`; ยกเลิกภายใน lead time เห็น "เลยกำหนดเวลาที่ยกเลิกได้แล้ว" และรายการยังเป็นยืนยันแล้ว; ยกเลิกสำเร็จแล้วป้ายเป็น "ยกเลิกแล้ว" และปุ่มหาย; ร้านที่ถูกลบยังเห็นชื่อร้านในรายการเก่า
- [ ] **Step 3: Commit** `feat(web): my reservations page`

---

### Task 7: ร้านของฉัน — รายการ / สร้าง / แก้ / ลบ / รูป

**Files:** Create `web/app/my/restaurants/page.tsx`, `web/app/my/restaurants/new/page.tsx`, `web/app/my/restaurants/[id]/edit/page.tsx`, `web/components/{restaurant-form,opening-hours-editor,image-uploader}.tsx`

**Interfaces:**
- Consumes: `RestaurantSummary`, `RestaurantDetail`, `SaveRestaurantInput`, `DayRow`/`emptyDayRows`/`rowsFromHours`/`rowsToHours`/`validateRows`, `WEEKDAY_LABELS`, `assetUrl`, `apiFetch`
- Produces: `<OpeningHoursEditor rows={DayRow[]} onChange={(rows: DayRow[]) => void}/>` (7 แถว: ชื่อวัน, checkbox เปิด, `<input type="time">` เปิด/ปิด ปิดการแก้เมื่อไม่เปิด) · `<RestaurantForm initial?={RestaurantDetail} onSubmit={(input: SaveRestaurantInput) => Promise<void>}/>` (ฟิลด์: ชื่อ*, ที่อยู่*, คำอธิบาย, จำนวนที่นั่ง* `min=1`, ยกเลิกได้ล่วงหน้า (นาที)* `min=30`, ตัวแก้เวลาเปิด; ตรวจ `validateRows` ก่อนส่ง; ส่งเฉพาะ `rowsToHours`) · `<ImageUploader restaurantId imageUrl onChanged/>` (แสดงรูปปัจจุบัน/placeholder; `<input type="file" accept="image/jpeg,image/png,image/webp">`; ตรวจ ≤ 2 MB ฝั่ง client ก่อนส่ง; อัปโหลด `POST /restaurants/{id}/image` ด้วย `FormData` ฟิลด์ `file`; ปุ่ม "ลบรูป" → `DELETE /restaurants/{id}/image`)

- [ ] **Step 1: หน้ารายการ** `GET /restaurants?mine=true&limit=100` ใช้ `RestaurantCard` โดยส่ง `actions` = ปุ่ม "แก้ไข" (`/my/restaurants/{id}/edit`), "ดูการจอง" (`/my/restaurants/{id}/reservations`), "ลบ" (`confirm` แล้ว `DELETE /restaurants/{id}`; 409 แสดง `restaurant_has_active_reservations`); ว่าง → "คุณยังไม่มีร้าน" + ปุ่ม "สร้างร้านใหม่"
- [ ] **Step 2: หน้าสร้าง** — `POST /restaurants` (ตอบ `{id}`) แล้ว `router.push("/my/restaurants/{id}/edit")` เพื่อให้อัปโหลดรูปต่อ (รูปต้องมี id ก่อน)
- [ ] **Step 3: หน้าแก้** — โหลด `GET /restaurants/{id}`; ถ้า `isOwner === false` แสดง "คุณไม่มีสิทธิ์แก้ร้านนี้"; ฟอร์มบันทึกด้วย `PUT /restaurants/{id}` (ตอบ 200 ร้านเต็ม → แสดง "บันทึกแล้ว"); ใต้ฟอร์มมี `ImageUploader`
- [ ] **Step 4: Verify (ต้องมี Backend Task 4, 11)** — Run: lint/typecheck/build ผ่าน. เช็กมือ: สร้างร้านโดยเปิดเฉพาะวันอาทิตย์และจันทร์ (ตรวจว่าวันอาทิตย์ถูกบันทึก — Review Focus 4) ลองบันทึก "ยกเลิกได้ล่วงหน้า" 29 แล้วเห็นว่าถูกกัน (ทั้ง client และ server); แก้เวลาเปิดแล้วหน้ารายละเอียดร้านแสดงตาม; อัปโหลด PNG แล้วรูปขึ้นทั้งหน้าแก้และหน้ารายละเอียด; อัปโหลดไฟล์ข้อความที่ตั้งชื่อ `.png` เห็น "ไฟล์รูปไม่ถูกต้อง…"; ลบรูปแล้วกลับเป็น placeholder; ลบร้านที่มีการจองค้างเห็นข้อความกัน แล้วหลังยกเลิกการจองลบได้
- [ ] **Step 5: Commit** `feat(web): owner restaurant management with image upload`

---

### Task 8: การจองของร้าน (มุมมองเจ้าของ)

**Files:** Create `web/app/my/restaurants/[id]/reservations/page.tsx`

**Interfaces:** Consumes: `OwnerReservation`, `ListResponse`, `formatThaiDateTime`, `ErrorAlert`, `Badge`

- [ ] **Step 1: Implement** — `useParams()` อ่าน `id`; `<select>` กรองสถานะ ("ทั้งหมด" ไม่ส่ง `status` / "ยืนยันแล้ว" `confirmed` / "ยกเลิกแล้ว" `cancelled`); `GET /restaurants/{id}/reservations?status=`; ตาราง: ชื่อลูกค้า, ช่วงเวลา, จำนวนคน, สถานะ; อ่านอย่างเดียว (ไม่มีปุ่มแก้/ยกเลิก); ว่าง → "ยังไม่มีการจอง"; 403/404 แสดงด้วย `ErrorAlert`; ลิงก์กลับ "ร้านของฉัน"
- [ ] **Step 2: Verify (ต้องมี Backend Task 9)** — Run: lint/typecheck/build ผ่าน. เช็กมือ: เจ้าของเห็นการจองของลูกค้าพร้อมชื่อ (ไม่มีอีเมลบนหน้า); กรองสถานะถูกต้อง; ผู้ใช้อื่นเปิด URL นี้ตรง ๆ เห็น "คุณไม่มีสิทธิ์ทำรายการนี้"
- [ ] **Step 3: Commit** `feat(web): owner reservation list`

---

### Task 9: ตรวจรวมและเช็กลิสต์ทดสอบมือ

**Files:** Modify `README.md` (ราก, หัวข้อ Frontend) หากจำเป็น

- [ ] **Step 1: ตรวจอัตโนมัติ** — Run: `cd web && npm run lint && npm run typecheck && npm test && npm run build`; Expected: ทั้งหมดผ่าน
- [ ] **Step 2: ตรวจใน compose** — Run: `docker compose up -d --build` แล้วเปิด `http://localhost:3000`; Expected: ใช้งานผ่านคอนเทนเนอร์ `web` ได้เหมือน `npm run dev` (ตัวแปร `NEXT_PUBLIC_API_BASE_URL` ถูกส่งเข้ามา) และไม่มี error CORS ใน Console
- [ ] **Step 3: เช็กลิสต์ทดสอบมือด้วยบัญชีผู้ใช้สองคน (A เจ้าของ, B ลูกค้า) หลังรัน seed**:
  1. A สร้างร้านชาบู (เปิดจันทร์–ศุกร์ 11:00–22:00, 20 ที่นั่ง, ยกเลิกล่วงหน้า 60 นาที) → อัปโหลดรูป → ร้านขึ้นหน้ารายการ
  2. B ค้นหาชื่อร้าน → เปิดรายละเอียด → จองพรุ่งนี้ 18:00–20:00 จำนวน 12 คน สำเร็จ
  3. B จอง 18:00–20:00 อีก 12 คน → เห็น "ที่นั่งไม่พอ…"; จอง 20:00–21:00 12 คน → สำเร็จ (ต่อกันพอดีไม่ชน)
  4. B แก้การจองแรกเป็น 10 คน → สำเร็จ; ยกเลิกการจองที่สอง → สำเร็จเมื่อยังเกินเวลา lead time
  5. B รีวิว 4 ดาว → คะแนนร้านเป็น 4.0 (1 รีวิว); แก้เป็น 5 ดาว → 5.0 (1 รีวิว); รีวิวซ้ำผ่านฟอร์มไม่ได้ (เป็นโหมดแก้ไข)
  6. A เปิดร้านตัวเอง → ไม่มีฟอร์มรีวิว; ดู "ดูการจอง" เห็นการจองของ B พร้อมชื่อ
  7. A ลบร้านขณะมีการจองค้าง → ถูกกัน; B ยกเลิกการจอง → A ลบร้านสำเร็จ → ร้านหายจากรายการ แต่ B ยังเห็นชื่อร้านในการจองเก่า
  8. จำลอง token หมดอายุ: ใน DevTools › Application › Local Storage แก้ค่า `accessToken` ภายใน JSON ของคีย์ `bookingtable.credential` เป็นข้อความมั่ว (คง `refreshToken` เดิม) แล้วรีเฟรช → หน้ายังโหลดข้อมูลได้เองหลัง refresh (Network เห็น `/auth/refresh-token` หนึ่งครั้ง); แก้ `refreshToken` เป็นข้อความมั่วด้วยแล้วรีเฟรช → ถูกพาไปล็อกอินใหม่
  9. เปลี่ยนเขตเวลาของระบบ/Chrome (DevTools › Sensors › Location/Timezone) เป็นนิวยอร์ก → เวลาที่แสดงและที่ส่งยังเป็นเวลาไทย
- [ ] **Step 4: Commit** `chore(web): final verification notes`
