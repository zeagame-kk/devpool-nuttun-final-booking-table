# Booking Table

ระบบจองโต๊ะและรีวิวร้านชาบู/ปิ้งย่าง ทำเป็น Final Exam MVP บัญชีเดียวเป็นได้ทั้งเจ้าของร้านและลูกค้า

- **เจ้าของร้าน:** สร้าง/แก้/ลบร้านของตัวเอง ใส่รายละเอียด รูป จำนวนที่นั่ง เวลาเปิดปิดรายวัน และเวลาที่ยกเลิกได้ล่วงหน้า (อย่างน้อย 30 นาที)
  ดูรายการจองของร้านตัวเอง (อ่านอย่างเดียว) ลบร้านที่ยังมีการจองค้างอยู่ไม่ได้
- **ลูกค้า:** ค้นหาร้านตามชื่อ เรียงตามคะแนนเฉลี่ยหรือจำนวนรีวิว แบ่งหน้า จอง แก้ ยกเลิก และดูการจองของตัวเอง เขียนรีวิว (ข้อความ + ดาว 1–5)
  รีวิวร้านตัวเองไม่ได้ ดู **ช่วงว่างรายชั่วโมง** ของร้านก่อนจอง (กดช่วงที่ว่างแล้วเติมเวลาในฟอร์มให้)
- **หน้าส่วนตัว:** หัวเว็บแสดงว่าใครล็อกอินอยู่ หน้า `/my/profile` แสดงข้อมูล (แก้คำแนะนำตัวได้) สถิติการใช้งาน การจองถัดไป และรีวิวที่เขียนไว้
  ส่วนหน้า `/` สำหรับคนที่ยังไม่ล็อกอินเป็นหน้าแนะนำระบบ ส่วนคนที่ล็อกอินแล้วเห็นการจองถัดไปและร้านคะแนนสูงสุดเหนือรายการร้าน
  เจ้าของร้านเห็นสถิติการจองของร้านตัวเอง (วันนี้ กำลังจะถึง แขกที่จะมา ยกเลิก)
- **กฎการจอง** ตรวจใน Go ทั้งหมด: อยู่ในเวลาเปิด (เวลาไทย), ห้ามเริ่มย้อนหลัง, คนที่อยู่พร้อมกันเกินที่นั่งไม่ได้,
  การแก้ไม่นับที่นั่งเดิมของตัวเองซ้ำ, ยกเลิก/แก้ได้ภายในเวลาที่ร้านกำหนด และคำขอพร้อมกันจะไม่ทำให้จองเกิน (ล็อกแถวร้านต่อหนึ่งการเปลี่ยนแปลง)

Go + Gin + GORM + PostgreSQL · Keycloak (OIDC) · Redis · Next.js 16 (App Router) + TypeScript + Tailwind v4 + shadcn/ui · Docker Compose

## สิ่งที่ต้องมี

- Docker (Docker Desktop หรือ Colima), Go 1.26+, [goose](https://github.com/pressly/goose)
  (`go install github.com/pressly/goose/v3/cmd/goose@latest`), Node.js 20+ (ถ้าจะรันเทสต์หน้าเว็บนอก Docker), Python 3 (สำหรับ smoke test)
- เบราว์เซอร์ Chrome / Edge / Firefox (Keycloak ตั้ง cookie แบบ `Secure` แม้ใช้ HTTP ซึ่งสามเบราว์เซอร์นี้ยอมรับจาก `*.localhost` แต่ Safari ไม่ยอมรับ)

## เริ่มใช้งาน

```bash
# 1) ค่าลับ: คัดลอกแล้วเปลี่ยนค่าทุกตัว (.env ไม่ถูก commit)
cp .env.example .env
cp api/.env.example api/.env       # ใช้กับ goose รหัสผ่านต้องตรงกับ POSTGRES_PASSWORD ใน .env

# 2) ขึ้นระบบ (postgres, redis, keycloak, api, web)
docker compose up -d --build

# 3) สร้างตาราง (compose ไม่รัน migration ให้)
cd api && goose up && cd ..

# 4) ข้อมูลตัวอย่าง (ไม่บังคับ รันซ้ำได้): ร้าน 5 ร้านพร้อมรีวิวและการจอง แล้วใส่รูปของร้านลง volume
docker compose exec -T postgres psql -U postgres -d bookingtable -v ON_ERROR_STOP=1 < api/seed/seed.sql
./scripts/seed_images.sh
```

รูปของร้านตัวอย่างเป็นรูปประกอบฟรีจาก Unsplash (ไม่ใช่รูปของร้านจริง) เครดิตช่างภาพอยู่ใน [api/seed/images/CREDITS.md](api/seed/images/CREDITS.md)
ถ้าข้ามขั้นตอน `seed_images.sh` ร้านตัวอย่างจะแสดงกล่อง "ไม่มีรูป" แทน

| อะไร | ที่ไหน |
| --- | --- |
| Web | http://localhost:3000 (compose รัน `next dev` พร้อม hot reload) |
| API | http://localhost:8080/api/v1 (Swagger: http://localhost:8080/swagger/index.html) |
| Keycloak admin | http://localhost:8180 ผู้ใช้ `admin` รหัสผ่านคือ `KC_ADMIN_PASSWORD` ใน `.env` |
| Postgres | `localhost:5532` (ฐานข้อมูล `bookingtable`) |

## ล็อกอินครั้งแรก

realm `pea` **ปิดการสมัครสมาชิกเอง** และผู้ใช้จากข้อมูลตัวอย่างเป็นบัญชีปลอมที่ล็อกอินไม่ได้ ต้องสร้างผู้ใช้ใน Keycloak ก่อน:

1. เปิด http://localhost:8180 เข้าด้วย `admin` แล้วเลือก realm **pea** (มุมซ้ายบน)
2. Users → Add user: ใส่อีเมล เปิด *Email verified* แล้ว Create
3. แท็บ Credentials → Set password: ใส่รหัสผ่าน ปิด *Temporary*
4. เปิด http://localhost:3000 กด "เข้าสู่ระบบ" แล้วล็อกอินด้วย **อีเมล** กับรหัสผ่านนั้น

อยากลองทั้งสองบทบาท ให้สร้างสองบัญชีแล้วล็อกอินคนละหน้าต่าง (หน้าต่างปกติกับ Incognito)
Keycloak ใช้ `keycloak.localhost:8180` ทั้งฝั่งเบราว์เซอร์และฝั่ง API (เพื่อให้ URL และ `iss` ใน token ตรงกัน)
เบราว์เซอร์รุ่นใหม่ resolve `*.localhost` เป็น loopback เอง ไม่ต้องแก้ `/etc/hosts`

> **ถ้าใช้ Colima:** การแก้ไฟล์ใน `web/` อาจไม่ถูกจับผ่าน bind mount ถ้าหน้าไม่ตรงกับโค้ด ให้ `docker compose restart web`

## โครงสร้างโปรเจกต์

```text
api/        Go API: cmd/api (main), internal/{restaurant,reservation,review,auth,user,storage,httpapi,...},
            migrations/ (goose), seed/ (ข้อมูลและรูปตัวอย่าง), docs/ (API.md, ARCHITECTURE.md, TESTING.md, swagger)
web/        Next.js: app/ (หน้า), components/, hooks/, lib/ (ตรรกะและเทสต์) ดู web/README.md
keycloak/   realm snapshot ที่ import ตอน compose ขึ้น (ดู keycloak/README.md)
scripts/    smoke_api.py, seed_images.sh, browser_e2e/ (ทดสอบด้วยเบราว์เซอร์จริง)
docs/initial/   เอกสารต้นทาง: โจทย์, design, SPEC, แผน backend/frontend, เอกสารอ้างอิงจากคอร์ส
compose.yml     postgres, redis, keycloak, api, web
ARCHITECTURE.md สถาปัตยกรรมทั้งระบบ (ภาพรวม service, ล็อกอิน, กฎการจอง, frontend)
```

## ทดสอบ

มี 4 ชั้น เรียงจากเร็วไปช้า

**1. Backend (Go)** — เทสต์ที่ `api/internal/apitest` ยิง HTTP API จริงกับ PostgreSQL จริงผ่าน testcontainers จึงต้องมี Docker รันอยู่

```bash
cd api
go vet ./...
go test ./... -count=1
```

ครั้งแรกจะดึง image `postgres:17` ทำให้ช้ากว่าปกติ เทสต์ทุกตัวใช้ container เดียวร่วมกันและล้างตารางก่อนแต่ละเทสต์
เทสต์ที่ทดสอบการแข่งกัน (จองพร้อมกัน ยกเลิกซ้ำ ลบร้านระหว่างมีคนจอง) ใช้ connection pool ที่อุ่นแล้วเพื่อให้คำขอทับกันจริง

ถ้าใช้ Colima: `colima start` แล้วรันได้เลย `TestMain` ตรวจเองว่าถ้าไม่มี `DOCKER_HOST` และไม่มี `/var/run/docker.sock`
จะใช้ `~/.colima/default/docker.sock` และตั้ง `TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE=/var/run/docker.sock` ให้
(Ryuk ต้อง mount socket ด้วยพาธภายใน VM) ถ้า socket อยู่ที่อื่นให้ตั้งสองตัวแปรนี้เอง อาการถ้ายังไม่ได้ตั้ง: `panic: rootless Docker not found`

**2. Frontend (Vitest + lint + build)**

```bash
cd web
npm run lint
npm run typecheck     # สร้าง type ของ route ด้วย `next typegen` ก่อน แล้วรัน tsc
npm test              # Vitest เฉพาะโฟลเดอร์ lib/ รันด้วย TZ=America/New_York เพื่อจับโค้ดที่พึ่งเขตเวลาของเครื่อง
npm run build
```

เทสต์ครอบเฉพาะตรรกะที่เสี่ยงใน `web/lib` (API client + refresh token, แปลงเวลา Asia/Bangkok, แปลง error code เป็นข้อความไทย, ตัวแก้เวลาเปิด)
ส่วนหน้าและคอมโพเนนต์ตรวจด้วย lint, type check, build และข้อ 3

**3. เบราว์เซอร์จริง** — `scripts/browser_e2e` ขับ Chrome จริงไล่ตั้งแต่ล็อกอินผ่าน Keycloak ค้นหา จอง รีวิว จัดการร้านและรูป จนถึง token หมดอายุ
(ราว 100 ข้อ โดยตั้งเขตเวลาของ browser เป็น New York เพื่อยืนยันว่าเวลายังเป็นเวลาไทย) วิธีรันอยู่ใน [scripts/browser_e2e/README.md](scripts/browser_e2e/README.md)

**4. Smoke test ของ API ที่รันอยู่** — `scripts/smoke_api.py` สร้างผู้ใช้ชั่วคราวใน Keycloak (เจ้าของและลูกค้า) ล็อกอินจริงตามขั้นตอน
(API → Keycloak → callback → ticket → token) แล้วไล่ flow หลักด้วย HTTP: สร้างร้าน อัปโหลดรูป จอง รีวิว ลบร้าน จากนั้นลบผู้ใช้ชั่วคราวทิ้ง
ไม่พิมพ์ token หรือรหัสผ่าน

```bash
docker compose up -d --build && (cd api && goose up)
set -a; . ./.env; set +a
python3 -I scripts/smoke_api.py
```

## เอกสาร

| ไฟล์ | คืออะไร |
| --- | --- |
| [ARCHITECTURE.md](ARCHITECTURE.md) | สถาปัตยกรรมทั้งระบบ: service, ล็อกอิน, กฎการจองและการล็อก, frontend, คอนฟิก, ความปลอดภัย, การตัดสินใจและข้อจำกัด |
| [api/docs/API.md](api/docs/API.md) | สัญญาของ API ที่ใช้จริง (เขียนมือ) Frontend ต้องทำตามนี้ ถ้าเปลี่ยนพฤติกรรมให้แก้ที่นี่พร้อมกัน |
| [api/docs/ARCHITECTURE.md](api/docs/ARCHITECTURE.md) | โครงสร้างข้อมูล กฎการจอง และวิธีกันจองเกิน |
| [api/docs/TESTING.md](api/docs/TESTING.md) | แนวทางเขียนเทสต์ฝั่ง Go |
| [web/README.md](web/README.md), [web/NOTES.md](web/NOTES.md) | โครงสร้างหน้าบ้านและข้อสังเกตของ Next 16 |
| [docs/initial/](docs/initial/README.md) | ที่มาของงาน: โจทย์ การตัดสินใจตอน brainstorming SPEC และแผน (บันทึกประวัติ อาจต่างจากของจริงบางจุด) |

สกิล AI ที่ใช้ตอนพัฒนา (`/implement`, `/tdd`, `/code-review` จาก mattpocock/skills) ติดตั้งแยกในเครื่องและไม่ได้อยู่ใน repo นี้

## งานประจำ

| ทำอะไร | คำสั่ง |
| --- | --- |
| migration ใหม่ | `cd api && goose create <ชื่อ> sql` แล้วเติม `-- +goose Up/Down` |
| ย้อน migration | `cd api && goose down` |
| สร้าง Swagger ใหม่ | `cd api && swag init -g cmd/api/main.go -o docs --parseInternal --parseDependency` (`go install github.com/swaggo/swag/cmd/swag@v1.16.6` ตรงกับเวอร์ชันใน `go.mod` แม้ `swag --version` จะยังพิมพ์ v1.16.4 เพราะค่าคงที่ในโค้ดของ swag ไม่ได้ถูกอัปเดต) |
| ใส่รูปตัวอย่างใหม่ | `./scripts/seed_images.sh` (หลังรัน `seed.sql`) |
| รีเซ็ต Keycloak เป็นค่าตั้งต้น | ดูคำสั่งใต้ตาราง |

รีเซ็ต Keycloak (ชื่อ volume ขึ้นกับชื่อโฟลเดอร์โปรเจกต์ ตรวจด้วย `docker volume ls`):

```bash
docker compose down
docker volume rm "$(docker volume ls -q | grep keycloak-data)"
docker compose up -d
```

## แก้ปัญหา

- **ล็อกอินแล้วเบราว์เซอร์เปิด `keycloak:8080` ไม่ได้ / 401 ตอนแลก token:** ตรวจว่า `KEYCLOAK_BASE_URL` ของ api ใน `compose.yml`
  คือ `http://keycloak.localhost:8180` และ api มี `extra_hosts: keycloak.localhost:host-gateway`
- **401 จากทุก endpoint หลังล็อกอิน:** audience ใน realm (`bookingtable`) ต้องตรงกับ `KEYCLOAK_CLIENT_ID`
  ถ้าเคยแก้ realm JSON ต้องรีเซ็ต volume ของ Keycloak (ดูด้านบน) เพราะ import ทำเฉพาะตอน volume ว่าง
- **ล็อกอินไม่ได้ด้วยผู้ใช้ตัวอย่าง:** ถูกแล้ว ผู้ใช้จาก seed เป็นบัญชีปลอม ดู "ล็อกอินครั้งแรก"
- **`docker compose` บอกว่าขาดตัวแปร:** ยังไม่ได้ `cp .env.example .env`
- **อัปโหลดรูปแล้ว `permission denied`:** image ของ api รันด้วยผู้ใช้ nonroot โฟลเดอร์ `/app/uploads` ต้องเป็นของผู้ใช้นั้น
  (Dockerfile ทำให้แล้วด้วย `COPY --chown`) ถ้าเคยสร้าง volume `bookingtable-uploads` ก่อนแก้ ให้ลบ volume แล้วขึ้นใหม่
- **ร้านตัวอย่างไม่มีรูปทั้งที่ seed แล้ว:** ยังไม่ได้รัน `./scripts/seed_images.sh` (ต้องรันหลังขึ้น stack)
- **ที่ Colima หน่วยความจำไม่พอ:** stack นี้ใช้ราว 0.7 GB ตอนรัน และราว 3 GB ในช่วงที่รัน web, build image และ testcontainers พร้อมกัน
  `colima stop && colima start --memory 4` เพียงพอ

## ข้อควรรู้เรื่องความปลอดภัย

ค่าใน `.env` และ `realm` ที่ import เป็นค่าสำหรับพัฒนาเท่านั้น (Keycloak ทำงานโหมด `start-dev` ผ่าน HTTP, `pea-realm.json`
ยังมีรหัสผ่านแบบ hash ของผู้ใช้ dev และ key ของ realm ที่มากับโปรเจกต์ต้นแบบ) ห้ามนำไปใช้จริง
Web เก็บ token ใน `localStorage` (เลือกเพราะง่ายที่สุดสำหรับงานสอบ แลกกับความเสี่ยง XSS) ถ้าจะใช้จริงควรเปลี่ยนเป็น cookie แบบ HttpOnly
