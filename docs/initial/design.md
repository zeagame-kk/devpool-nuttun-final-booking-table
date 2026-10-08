# Booking Table MVP — Shared Design (Final Exam)

> **เอกสารต้นทาง** ย้ายมาไว้ที่ `docs/initial/` (ดัชนีอยู่ที่ [README.md](README.md)) เขียน ณ ตอนวางแผน (2026-10-08) จึงอาจต่างจากของจริงบางจุด ถ้าขัดกันให้ยึด [api/docs/API.md](../../api/docs/API.md) และโค้ดในรีโป

> วันที่: 2026-10-08 · สถานะ: **ร่างที่ผ่านการตกลงในบทสนทนา รอผู้ใช้ตรวจไฟล์**
> ใช้เป็น input ให้ Backend `to-spec` และ Frontend `to-spec` (ดู §12)
> ฐานสถาปัตยกรรม: `pea-wongnok` (เอกสาร [`reference/SYSTEM_ARCHITECTURE.md`](reference/SYSTEM_ARCHITECTURE.md), `BACKEND_ARCHITECTURE.md`, `FRONTEND_ARCHITECTURE.md` (ทั้งสามอยู่ใต้ `reference/`); ซอร์สอ้างอิงที่ `~/Desktop/day9/pea-wongnok-2026`)

**สัญลักษณ์ที่มา**
- **[โจทย์]** ข้อกำหนดจากข้อสอบ
- **[สมมติ]** ข้อสันนิษฐานที่เสนอและผู้ใช้ตอบรับในบทสนทนา
- **[ผู้ใช้เลือก]** ตัวเลือกที่ผู้ใช้ตัดสินใจเอง (ไม่ใช่ข้อบังคับของโจทย์)
- **[เพิ่มโดยผู้ใช้]** ฟีเจอร์นอกโจทย์ที่ผู้ใช้สั่งให้ทำ — รายละเอียดการออกแบบเป็น **[สมมติ-รอยืนยัน]** เพราะยังไม่ได้คุยทีละข้อ

---

## 1. จุดประสงค์และความเข้าใจร่วม

ส่งงานสอบ Final เป็น Restaurant Reservation & Review Web App (ธีม mock data: **ร้านชาบู/ปิ้งย่าง**) ที่เล็ก อ่านง่าย เทสต์ได้ และ reuse สถาปัตยกรรมของ `pea-wongnok` (Go + Gin + GORM + PostgreSQL, Keycloak, Next.js + shadcn/ui, Docker Compose)

หัวใจที่ผู้ตรวจจะดู: กฎการจองถูกต้องใน Go, กัน overbook เมื่อมีคำขอพร้อมกัน, authorization เป็นรายทรัพยากร

บัญชีหนึ่งเป็นได้ทั้งเจ้าของร้านและลูกค้า **ไม่มี role** (ใช้ ownership check)

## 2. ขอบเขต MVP

**ทำ**
- เจ้าของ: สร้าง/แก้/ลบร้านของตัวเอง, รายละเอียด, รูป, ความจุที่นั่ง, เวลาเปิดรายวัน, lead time ยกเลิก (≥ 30 นาที) [โจทย์]
- ลูกค้า: ดูรายการร้าน เรียงตามคะแนนเฉลี่ยหรือจำนวนรีวิว, จอง/แก้/ยกเลิก/ดูการจองของตัวเอง, รีวิวพร้อมคะแนน 1–5 [โจทย์]
- ค้นหาร้านตามชื่อ [เพิ่มโดยผู้ใช้]
- อัปโหลดรูปร้าน [เพิ่มโดยผู้ใช้]
- เจ้าของดูการจองของร้านตัวเอง (อ่านอย่างเดียว) [เพิ่มโดยผู้ใช้]
- ย้าย secret ไป `.env` [เพิ่มโดยผู้ใช้]

**ไม่ทำ (Out of scope)**
ลบรีวิว · หมวดหมู่ร้าน · แสดงที่นั่งว่างแบบเรียลไทม์ · เจ้าของยกเลิก/แก้การจองของลูกค้า · ขั้นอนุมัติการจอง/แจ้งเตือน/ชำระเงิน · เวลาเปิดข้ามเที่ยงคืน · timezone ต่อร้าน · role/admin · production deploy · CDN/object storage สำหรับรูป · ตัดขนาด/ย่อรูป

## 3. สถาปัตยกรรม: Reuse / Adapt / Build

| ระดับ | รายการ |
| --- | --- |
| **Reuse** (copy, เปลี่ยนชื่อ module) | `config`, `platform/{database,cache}`, `reqctx`, `httputil`, `convutil`, package `auth` และ `user`, `Dockerfile` api, test approach (mockery + testcontainers), Swagger, web: `components.json`, design tokens, `Button` |
| **Adapt** | rename `wongnok` → `bookingtable` ทั้ง Go module, compose (container/volume/DB/`APP_NAME`), client + audience mapper ใน realm JSON; **คง realm `pea`** [ผู้ใช้เลือก] · `main.go` (ถอด `recipe`, เพิ่ม 3 feature, ตั้ง CORS อนุญาต `Authorization` + origin จาก `FRONTEND_URL`) · `middleware/jwt.go` เพิ่ม `return` ที่ขาด · ใช้ `recipe` เป็นแม่แบบ `restaurant` (CRUD, 403 ownership, soft delete, `Replace` ลบลูกแล้วสร้างใหม่, `ListResponse[T]`) แต่ pagination ต้องใช้ **`Offset`** (ต้นฉบับใช้ `Order` ผิด) · ใช้ฟิลด์ `code` ของ `ErrorResponse` (ต้นฉบับไม่มีใครใช้) · คะแนนเฉลี่ยคำนวณด้วย `AVG/COUNT` ตอน query (ไม่เก็บค่า) |
| **Build — Backend** | migration 4 ตาราง · package `restaurant`, `reservation`, `review` · pure function หา peak concurrent guests · transaction ล็อก `FOR UPDATE` · helper lead time ตัวเดียว (ใช้ทั้งแก้และยกเลิก) · ตรวจเวลาเปิดด้วย `Asia/Bangkok` · image storage (disk) + static route · seed SQL · อัปเดต `API.md` |
| **Build — Frontend (แทบทั้งหมด)** | API client (fetch + Bearer + 401→refresh ที่เดียว) · `/auth/callback` + ที่เก็บ token + route guard · หน้าต่าง ๆ (§12.2) · shadcn components ที่ขาด (input, select, dialog ฯลฯ) |

บั๊ก/ข้อควรระวังในต้นฉบับที่ **ต้องจัดการ**: pagination `Order` vs `Offset`; `jwt.go` ขาด `return`; `cors.Default()` ไม่อนุญาต `Authorization`. ที่ **ตั้งใจไม่แก้**: `ResolveID` cache กลับด้าน (ช้าลงแต่ไม่ผิด และไม่เกี่ยวกับโจทย์)

## 4. Domain model

```text
users 1───* restaurants 1───* restaurant_opening_hours
  │               │
  │               ├───* reservations *───1 users
  │               └───* reviews      *───1 users
```

| ตาราง | ฟิลด์ | ข้อจำกัด |
| --- | --- | --- |
| `users` (reuse) | `id` UUID, `uid` (Keycloak sub), `email`, `name` … | ไม่แก้ |
| `restaurants` | `id`, `owner_id`→users, `name`, `address`, `description?`, `image_url?`, `seating_capacity`, `cancellation_lead_minutes`, timestamps, `deleted_at` | `name`,`address` จำเป็น; `seating_capacity >= 1` [สมมติ]; `cancellation_lead_minutes >= 30` [โจทย์]; soft delete [สมมติ] |
| `restaurant_opening_hours` | `restaurant_id`, `weekday` (0=อาทิตย์…6), `open_time`, `close_time` | PK `(restaurant_id, weekday)`; `close_time > open_time`; ไม่มีแถว = ปิดวันนั้น; ไม่มี `deleted_at` (แก้โดยลบชุดเก่าแล้ว insert ใหม่ใน transaction) [ผู้ใช้เลือก: เวลารายวัน] |
| `reservations` | `id`, `restaurant_id`, `user_id`, `start_at`, `end_at` (TIMESTAMPTZ), `guests`, `status` (`confirmed`/`cancelled`), timestamps | `end_at > start_at`, `guests >= 1`; index `(restaurant_id, start_at)`; ยกเลิก = เปลี่ยน `status` ไม่ลบแถว; ช่วงเวลาแบบ half-open `[start,end)` [สมมติ] |
| `reviews` | `id`, `restaurant_id`, `user_id`, `rating`, `comment`, timestamps | `rating` 1–5 [โจทย์]; `comment` ไม่ว่าง; UNIQUE `(user_id, restaurant_id)` [ผู้ใช้เลือก] |

- ค่าเฉลี่ย/จำนวนรีวิวไม่เก็บในตาราง
- ไม่รับ `owner_id`/`user_id` จาก client เด็ดขาด อ่านจาก `reqctx`
- `image_url` เขียนได้เฉพาะผ่าน endpoint อัปโหลด (ไม่อยู่ใน body ของ create/update)

## 5. กฎธุรกิจ (ตรวจใน Go ชั้น service)

**ข้อตกลงร่วม:** เวลาเก็บ `TIMESTAMPTZ`, แปลงเป็น `Asia/Bangkok` (ค่าคงที่ในโค้ด) ตอนเทียบเวลาเปิด–ปิด · สถานะ: 400 = input/กฎข้อมูล, 403 = ไม่ใช่เจ้าของ, 404 = ไม่พบ, 409 = ขัดแย้งกับสถานะ · กฎธุรกิจตอบ `code` ตามตาราง §6.3

### 5.1 ร้านอาหาร
| # | กฎ | ที่มา |
| --- | --- | --- |
| R1 | สร้างร้าน: เจ้าของ = ผู้เรียก; `name`,`address` จำเป็น; `seatingCapacity >= 1`; `cancellationLeadMinutes >= 30` | โจทย์ (≥30) / สมมติ |
| R2 | เวลาเปิด: ไม่เกิน 1 แถวต่อวัน, `close > open`, รูปแบบ `HH:MM`, อย่างน้อย 1 วัน | สมมติ |
| R3 | แก้/ลบ: เฉพาะเจ้าของ (คนอื่น → 403; ไม่พบ/ถูกลบ → 404); `PUT` แทนที่ทั้งก้อนรวมเวลาเปิด (ไม่แตะรูป) | โจทย์ |
| R4 | ลบ = soft delete; ถ้ามีการจอง `confirmed` ที่ `end_at > now` → 409 `restaurant_has_active_reservations` | ผู้ใช้เลือก |
| R5 | แก้ capacity/เวลาเปิด **ไม่ตรวจย้อนหลัง** กับการจองเดิม (มีผลกับการจองใหม่/แก้ไขเท่านั้น) | สมมติ |

### 5.2 การจอง (สร้าง/แก้ไข) — ทำใน transaction เดียว ตามลำดับ
1. ล็อกแถวร้านด้วย `SELECT … FOR UPDATE` แล้วอ่าน capacity/เวลาเปิด **หลังล็อก** (ไม่พบ → 404) — การแก้ร้านต้องล็อกแถวเดียวกัน [ผู้ใช้เลือกกลไกล็อก]
2. `guests >= 1`, `endAt > startAt` → 400
3. `startAt` ไม่อยู่ในอดีต → 400 `start_in_past` [โจทย์]
4. `startAt`,`endAt` อยู่วันท้องถิ่นเดียวกัน, วันนั้นร้านเปิด, ทั้งช่วงอยู่ใน `[open, close]` → 400 `outside_opening_hours` [โจทย์]
5. ดึงการจอง `confirmed` ที่ซ้อนทับ (ยกเว้น `id` ตัวเองตอนแก้) → หา **peak concurrent guests** ด้วย pure function (ตรวจที่ `startAt` ใหม่ และ `startAt` ของการจองเดิมที่ตกในช่วง); ถ้า `peak + guests > capacity` → 409 `capacity_exceeded` [โจทย์ + ผู้ใช้เลือกวิธีนับ]
6. บันทึก สถานะเริ่มต้น `confirmed` (ไม่มีขั้นอนุมัติ) [สมมติ]

### 5.3 แก้ไข/ยกเลิก/ดูการจอง
| # | กฎ | ที่มา |
| --- | --- | --- |
| B1 | เฉพาะเจ้าของการจอง (อื่น → 403) | โจทย์ |
| B2 | ต้อง `confirmed` และยังไม่เริ่ม มิฉะนั้น 409 `reservation_not_active` | สมมติ |
| B3 | ยกเลิก: ต้อง `startAtเดิม − now >= lead` (เท่ากับพอดีผ่าน) มิฉะนั้น 409 `too_late_to_cancel`; แล้ว `status = cancelled` (ไม่นับในความจุ) | โจทย์ |
| B4 | แก้ไข: เช็ก lead time เดียวกันกับ `startAt` เดิม → 409 `too_late_to_modify`; แล้วรัน §5.2 ข้อ 1–6 ด้วยค่าใหม่ (ยกเว้นการจองตัวเอง); เปลี่ยนร้านไม่ได้ | ผู้ใช้เลือก (lead time ตอนแก้) / โจทย์ (ข้อ 1–6) |
| B5 | `GET /reservations`: เฉพาะของผู้เรียก ทุกสถานะ เรียง `start_at` ใหม่→เก่า ไม่มี pagination; แสดงชื่อร้านแม้ร้านถูกลบ (ต้อง query แบบ `Unscoped`) | สมมติ |
| B6 | **เจ้าของดูการจองของร้านตัวเอง** (อ่านอย่างเดียว): เฉพาะเจ้าของร้าน (อื่น → 403); กรอง `status` ได้ (ไม่ส่ง = ทั้งหมด); เรียง `start_at` ใหม่→เก่า; แสดงชื่อลูกค้า (ไม่แสดงอีเมล); เจ้าของยกเลิก/แก้การจองของลูกค้าไม่ได้ | เพิ่มโดยผู้ใช้ / สมมติ-รอยืนยัน |

### 5.4 รีวิว
| # | กฎ | ที่มา |
| --- | --- | --- |
| V1 | `rating` จำนวนเต็ม 1–5, `comment` ไม่ว่าง → ผิด = 400 | โจทย์ / สมมติ |
| V2 | รีวิวร้านตัวเองไม่ได้ → 403 `cannot_review_own_restaurant` | โจทย์ |
| V3 | รีวิวซ้ำร้านเดิม → 409 `already_reviewed`; แก้รีวิวตัวเองผ่าน `PUT …/reviews/me` | ผู้ใช้เลือก |
| V4 | ไม่ต้องเคยจองก่อนจึงรีวิวได้ | สมมติ |

### 5.5 รายการร้าน
`GET /restaurants`: `sort=rating|reviews` (มาก→น้อย) [โจทย์], ไม่ส่ง = ร้านใหม่ก่อน, tie-break ด้วย `id`; ร้านไม่มีรีวิว = `rating {average:0,total:0}`; `page/limit/total` (default limit 12, max 100) ใช้ `Offset` [ผู้ใช้เลือก]; `mine=true` = ร้านของตัวเอง; **`name`** = ค้นหาตามชื่อ [เพิ่มโดยผู้ใช้]:
- `ILIKE '%…%'` เฉพาะ `name`, ไม่สนตัวพิมพ์, ตัดช่องว่างหัวท้าย, ว่าง = ไม่กรอง
- escape `%` `_` `\` ในคำค้น (กันตีความเป็น wildcard) [สมมติ-รอยืนยัน]
- ใช้ร่วมกับ `sort`/`mine`/`page` ได้

### 5.6 รูปร้าน [เพิ่มโดยผู้ใช้ — รายละเอียดเป็นสมมติ-รอยืนยัน]
| # | กฎ |
| --- | --- |
| I1 | อัปโหลด/ลบรูป: เฉพาะเจ้าของร้าน (อื่น → 403, ไม่พบ → 404) |
| I2 | ชนิดไฟล์ตรวจจาก **เนื้อไฟล์** (`http.DetectContentType`) ยอมรับ `image/jpeg`, `image/png`, `image/webp`; ขนาด ≤ 2 MB; ผิด → 400 `invalid_image` |
| I3 | เก็บไฟล์บน disk ที่ `UPLOAD_DIR/restaurants/{restaurantId}-{uuid}.{ext}` (ชื่อไฟล์สร้างเอง ไม่ใช้ชื่อจาก client) เก็บ `image_url` = `/uploads/restaurants/<ชื่อไฟล์>` |
| I4 | อัปโหลดซ้ำ = แทนที่ (ลบไฟล์เก่า แบบ best-effort); `DELETE` รูป → ล้าง `image_url` + ลบไฟล์ |
| I5 | ไฟล์เสิร์ฟผ่าน route สาธารณะ `GET /api/v1/uploads/*` (ไม่ผ่าน JWT เพราะ `<img>` แนบ Bearer ไม่ได้) frontend ต่อ `NEXT_PUBLIC_API_BASE_URL + imageUrl` |
| I6 | ร้านถูกลบ (soft) → ปล่อยไฟล์ไว้ ไม่ลบ |
| I7 | แยกการเขียนไฟล์ไว้หลัง interface เล็ก ๆ (`Save/Delete`) ที่ประกาศฝั่งผู้ใช้ตาม BACKEND-RULE-03 เพื่อเทสต์ด้วย `t.TempDir()` |

## 6. API contract (ทิศทาง)

**ร่วม:** base `/api/v1`; `Authorization: Bearer` ทุก endpoint ยกเว้น `/auth/*` และ `GET /uploads/*`; JSON camelCase; เวลา RFC 3339 (เวลาเปิด–ปิดเป็น `"HH:MM"`); error `{ "message", "code"? }`; ตาม convention เดิม: `POST` สร้าง → `201 {id}`, `PUT` → `200` resource เต็ม, `DELETE`/action ไม่มี body → `204`, list → `{total, results[]}`

**Reuse ไม่แก้:** `/auth/login|callback|exchange|refresh-token|logout`, `GET/PUT /users/me`

### 6.1 Endpoint ใหม่
| Method | Path | ใคร | สำเร็จ | หมายเหตุ |
| --- | --- | --- | --- | --- |
| GET | `/restaurants?name=&sort=&mine=&page=&limit=` | ทุกคน | 200 list | §5.5 |
| GET | `/restaurants/{id}` | ทุกคน | 200 | + `openingHours`, `isOwner`, `myReview` |
| POST | `/restaurants` | login | 201 `{id}` | ไม่รับ `imageUrl` |
| PUT | `/restaurants/{id}` | เจ้าของ | 200 | แทนที่ทั้งก้อนรวม `openingHours`; ไม่แตะรูป |
| DELETE | `/restaurants/{id}` | เจ้าของ | 204 | 409 `restaurant_has_active_reservations` |
| POST | `/restaurants/{id}/image` | เจ้าของ | 200 ร้านเต็ม | `multipart/form-data` ฟิลด์ `file` |
| DELETE | `/restaurants/{id}/image` | เจ้าของ | 204 | |
| GET | `/uploads/*` | สาธารณะ | 200 ไฟล์ | static |
| POST | `/restaurants/{id}/reservations` | login | 201 `{id}` | `startAt`,`endAt`,`guests` |
| GET | `/restaurants/{id}/reservations?status=` | เจ้าของร้าน | 200 `{total,results[]}` | อ่านอย่างเดียว (B6) |
| GET | `/reservations` | ตัวเอง | 200 `{total,results[]}` | B5 |
| PUT | `/reservations/{id}` | เจ้าของการจอง | 200 | body เหมือนสร้าง |
| POST | `/reservations/{id}/cancel` | เจ้าของการจอง | 204 | |
| GET | `/restaurants/{id}/reviews` | ทุกคน | 200 `{total,results[]}` | ใหม่สุดก่อน ไม่มี pagination |
| POST | `/restaurants/{id}/reviews` | ไม่ใช่เจ้าของร้าน | 201 `{id}` | `rating`,`comment` |
| PUT | `/restaurants/{id}/reviews/me` | เจ้าของรีวิว | 200 | |

ตั้งใจไม่มี: `GET /reservations/{id}` (หน้าแก้ไขใช้ข้อมูลจากรายการ), endpoint ลบรีวิว

### 6.2 รูปแบบข้อมูลหลัก
```jsonc
// Restaurant (list และ detail ใช้ฟิลด์ร่วม)
{ "id": 1, "name": "...", "address": "...", "description": "...", "imageUrl": "/uploads/restaurants/1-xxxx.jpg",
  "seatingCapacity": 40, "cancellationLeadMinutes": 60,
  "owner": {"id": "uuid", "name": "..."},
  "rating": {"average": 4.5, "total": 12},          // total = จำนวนรีวิว (รูปเดียวกับ recipe เดิม)
  // เฉพาะ detail:
  "openingHours": [{"weekday": 1, "open": "11:00", "close": "22:00"}],
  "isOwner": false, "myReview": {"id": 3, "rating": 5, "comment": "..."} }   // myReview เป็น null ได้

// Reservation (ของฉัน)
{ "id": 7, "restaurant": {"id": 1, "name": "..."}, "startAt": "...", "endAt": "...",
  "guests": 4, "status": "confirmed", "createdAt": "..." }

// Reservation (มุมมองเจ้าของร้าน)
{ "id": 7, "customer": {"id": "uuid", "name": "..."}, "startAt": "...", "endAt": "...",
  "guests": 4, "status": "confirmed", "createdAt": "..." }

// Review
{ "id": 3, "rating": 5, "comment": "...", "user": {"id": "uuid", "name": "..."}, "createdAt": "...", "updatedAt": "..." }
```

### 6.3 `code` ที่กำหนด
`start_in_past`, `outside_opening_hours`, `capacity_exceeded`, `too_late_to_cancel`, `too_late_to_modify`, `reservation_not_active`, `cannot_review_own_restaurant`, `already_reviewed`, `restaurant_has_active_reservations`, `invalid_image`

## 7. Infrastructure, config และ secret

### 7.1 Secret → `.env` [เพิ่มโดยผู้ใช้ — สมมติ-รอยืนยัน]
- `compose.yml` ใช้ `${VAR}` อ่านจาก `.env` ที่ราก (ไม่ commit); commit เฉพาะ `.env.example` (ค่าตัวอย่างที่ไม่ใช่ของจริง)
- ค่าที่ย้าย: `POSTGRES_PASSWORD` (และส่วนรหัสผ่านใน `POSTGRES_DSN`), `KC_BOOTSTRAP_ADMIN_PASSWORD`, `KEYCLOAK_CLIENT_SECRET`
- `api/.env` (สำหรับ goose: `GOOSE_DBSTRING` มีรหัสผ่าน) ยังอยู่ใน `.gitignore`; เพิ่ม `api/.env.example`
- **จุดเสี่ยงที่ต้องยืนยันตอนทำ:** client secret ปัจจุบันฝังอยู่ในไฟล์ `keycloak/import/pea-realm.json` (ถูก commit) ต้องแทนด้วย placeholder `${…}` ให้ Keycloak อ่านจาก env ตอน import (ต้องส่ง env เข้า container keycloak และ **ยืนยันว่า Keycloak 26.7 รองรับ** ถ้าไม่ได้ ต้องหาทางอื่น เช่น ตั้ง secret ผ่าน admin console แล้วไม่ export ค่านั้นกลับเข้า repo)
- hash รหัสผ่านของผู้ใช้ dev ใน realm JSON เป็นค่า dev ทิ้งไว้ได้ แต่ต้องระบุในเอกสารว่าไม่ใช่ค่า production
- โฟลเดอร์ `booking_table` ยังไม่ใช่ git repo: แนะนำ `git init` พร้อม `.gitignore` (`.env`) **ก่อน commit ครั้งแรก**

### 7.2 อัปโหลดไฟล์
- env ใหม่: `UPLOAD_DIR` (default `./uploads`); ขนาดสูงสุด 2 MB เป็นค่าคงที่ในโค้ด
- compose: named volume `bookingtable-uploads` mount เข้า api
- **ข้อควรระวัง:** image api เป็น distroless รันด้วย user `nonroot` (65532) และ named volume ใหม่จะเป็นของ root → เขียนไฟล์ไม่ได้ ต้องสร้างโฟลเดอร์ใน image ด้วย `COPY --chown=65532:65532` จาก build stage (distroless ไม่มี shell)

### 7.3 อื่น ๆ
- คง realm `pea`, client เปลี่ยนเป็น `bookingtable`; ค่า audience ใน token **ต้อง** เท่ากับ `KEYCLOAK_CLIENT_ID` มิฉะนั้นทุก request ได้ 401 (middleware ตรวจ `aud`)
- Seed: ไฟล์ SQL แยก (ไม่ใช่ goose migration) สร้างเจ้าของ/ผู้รีวิวปลอม (`uid` เช่น `seed-owner-1`, ล็อกอินไม่ได้) + ร้านชาบู/ปิ้งย่าง 4–5 ร้านพร้อมเวลาเปิด รีวิว และการจองตัวอย่าง; รันด้วยมือ
- Schema ด้วย goose เท่านั้น ห้าม AutoMigrate; integration test สร้าง schema จาก migration จริง

## 8. เคสเทสต์ที่สำคัญที่สุด

**Unit — peak concurrent (pure function ไม่ใช้ DB)**
ไม่มีการจองเดิม · ซ้อนบางส่วน · ชนกันพอดี `[start,end)` ไม่นับ · ตัวอย่าง cap 10: R1 10–12 (6), R2 12–14 (6), ใหม่ 11–13 (4) ต้อง **ผ่าน** · เท่า capacity พอดีผ่าน เกิน 1 ไม่ผ่าน · ยกเว้น `id` ตัวเองตอนแก้ · ข้ามรายการ `cancelled`

**Service (mock repo)**
นอกเวลาเปิด · วันที่ร้านปิด · `startAt`/`endAt` คนละวัน · เริ่มในอดีต · lead time พอดีผ่าน / ขาด 1 นาทีไม่ผ่าน (ทั้งแก้และยกเลิก) · คนอื่นแก้/ยกเลิกการจอง → 403 · คนอื่นแก้/ลบ/อัปโหลดรูปร้าน → 403 · คนอื่นดูการจองของร้าน → 403 · รีวิวร้านตัวเอง → 403 · รีวิวซ้ำ → 409 · rating 0/6, comment ว่าง → 400 · lead time < 30 → 400 · ลบร้านที่มีการจองค้าง → 409 · การจองที่ยกเลิก/เริ่มแล้วแก้ไม่ได้ → 409

**Integration (Postgres จริง, testcontainers)**
**จองพร้อมกัน:** cap 10, 5 คำขอ ๆ ละ 4 คน → สำเร็จได้ไม่เกิน 2 · แก้การจองเดียวกันพร้อมกัน · sort ตาม rating/reviews รวมร้านไม่มีรีวิว · หน้า 2 ของ pagination ถูกต้อง · ค้นหาชื่อ (บางส่วน/ไม่สนตัวพิมพ์/มี `%` `_`/ไม่พบ) · ร้านที่ถูกลบหายจากรายการแต่ยังแสดงในการจองเก่า · เวลาเปิดถูกแทนที่ทั้งชุดตอน `PUT`

**Handler:** mapping status + `code` · ไม่มี token → 401 · อัปโหลดไฟล์ผิดชนิด/ใหญ่เกิน → 400 `invalid_image`

**Image storage:** เขียน/ลบไฟล์ใน `t.TempDir()`; ชนิดไฟล์ดูจากเนื้อไฟล์ไม่ใช่นามสกุล

**Frontend:** ยังไม่ตัดสินใจ (ดู §10 ข้อ 2) อย่างน้อยต้องผ่าน `npm run lint`, `tsc` และเช็กลิสต์ทดสอบมือตาม flow หลัก

## 9. ลำดับ implementation ขั้นต่ำ (หัวข้อเท่านั้น ยังไม่ใช่แผน)
0. Scaffold: copy + rename + แก้ CORS/jwt + ย้าย secret ไป `.env` → `compose up` → `goose up` → **smoke test login ผ่าน compose** (ยืนยันปัญหา hostname `keycloak:8080` และ audience)
1. Backend `restaurant` (migration, CRUD, list/sort/search/pagination) + เทสต์
2. Backend `reservation` (pure function ก่อน → service → transaction ล็อก → เทสต์พร้อมกัน → มุมมองเจ้าของร้าน)
3. Backend `review`, อัปโหลดรูป + volume, seed SQL, อัปเดต `API.md`
4. Frontend (เริ่มคู่ขนานได้หลังข้อ 0 โดยยึด contract §6)

## 10. คำถามที่ยังเปิดอยู่ / สิ่งที่ต้องยืนยัน
1. รายละเอียดของ 4 ฟีเจอร์ที่ผู้ใช้เพิ่ม (§5.3 B6, §5.5 name, §5.6, §7.1) เป็นข้อสันนิษฐาน — ต้องการแก้จุดใดหรือไม่
2. Frontend: ที่เก็บ token (localStorage หรือ cookie) · ใช้ library ทำฟอร์มหรือเขียนเอง · ต้องมี automated test หรือเช็กลิสต์ทดสอบมือ → ให้ตัดสินใจใน Frontend `to-spec`
3. login ผ่าน compose ได้จริงหรือไม่ (hostname ของ Keycloak) — ยืนยันได้เฉพาะตอนรัน
4. Keycloak 26.7 รองรับ `${ENV}` ใน realm import หรือไม่ (§7.1) — ยืนยันตอนทำ
5. ไม่มีเพดานจำนวนคนต่อการจอง ระยะเวลาขั้นต่ำ/สูงสุด หรือการจองล่วงหน้าสูงสุด นอกจากกฎในโจทย์
6. คำสั่ง regenerate Swagger ยังไม่ทราบ (ต้นฉบับไม่มี script)
7. Next.js 16 มี breaking changes: ต้องอ่าน `node_modules/next/dist/docs/` ก่อนเขียน routing/data fetching (ตาม `web/AGENTS.md`)

## 11. หมายเหตุสำหรับผู้ตรวจ
โจทย์ไม่กำหนดชื่อ endpoint หรือรูปแบบ response ตายตัว (ผู้ใช้ยืนยัน) จึงยึด convention ของ `pea-wongnok` ทั้งหมด

## 12. ส่งต่อให้ `to-spec` แยก Backend / Frontend

### 12.1 Backend `to-spec` ควรหยิบ
§3 (Reuse/Adapt/Build ฝั่ง backend + บั๊กที่ต้องแก้), §4, §5 ทั้งหมด, §6, §7, §8 (unit/service/integration/handler/image), §9 ข้อ 0–3, §10 ข้อ 3–6

### 12.2 Frontend `to-spec` ควรหยิบ
- §6 (contract), §6.3 (`code` → ข้อความที่แสดงผู้ใช้), §5 เฉพาะกฎที่ UI ต้องสะท้อน (เช่น lead time, ห้ามรีวิวร้านตัวเอง ใช้ `isOwner`/`myReview`)
- **หน้าที่ต้องมี:** `/auth/callback` · รายการร้าน (ค้นหาชื่อ, เรียง rating/reviews, pagination) · รายละเอียดร้าน (รูป, เวลาเปิด, ฟอร์มจอง, รายการ+ฟอร์มรีวิว) · ร้านของฉัน (สร้าง/แก้ร้านพร้อมตัวแก้เวลาเปิดรายวัน, อัปโหลด/ลบรูป, ดูการจองของร้าน, ลบร้าน) · การจองของฉัน (แก้/ยกเลิก)
- API client: แนบ Bearer, 401→refresh ครั้งเดียวแล้ว retry, 204 ไม่ parse JSON, อัปโหลดด้วย `FormData` (ห้ามตั้ง `Content-Type` เอง), ต่อ URL รูป `API base + imageUrl`
- ระวัง `/auth/callback` ถูกเรียกซ้ำใน React Strict Mode (ticket ใช้ได้ครั้งเดียว)
- §9 ข้อ 4, §10 ข้อ 2 และ 7
