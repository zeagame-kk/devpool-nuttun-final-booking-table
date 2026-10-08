# Booking Table

ระบบจองโต๊ะและรีวิวร้านชาบู/ปิ้งย่าง: เจ้าของร้านจัดการร้าน เวลาเปิด รูป และดูการจองของร้านตัวเอง
ลูกค้าค้นหา จอง แก้ไข ยกเลิก และรีวิว บัญชีเดียวเป็นได้ทั้งสองบทบาท

Go + Gin + GORM + PostgreSQL · Keycloak (OIDC) · Redis · Next.js 16 (App Router) + Tailwind + shadcn/ui
เอกสาร: [SPEC.md](SPEC.md) · [Backend_PLAN.md](Backend_PLAN.md) · [Frontend_PLAN.md](Frontend_PLAN.md) ·
[API contract](api/docs/API.md) · [โครงสร้างข้อมูลและกฎ](api/docs/ARCHITECTURE.md)

## สิ่งที่ต้องมี

- Docker (Docker Desktop หรือ Colima), Go 1.26+, [goose](https://github.com/pressly/goose)
  (`go install github.com/pressly/goose/v3/cmd/goose@latest`), Python 3 (สำหรับสคริปต์ทดสอบ)
- เบราว์เซอร์ Chrome / Edge / Firefox (Keycloak ตั้ง cookie แบบ `Secure` แม้ใช้ HTTP ซึ่งสามเบราว์เซอร์นี้ยอมรับจาก `*.localhost` แต่ Safari ไม่ยอมรับ)

## ติดตั้งและรัน

```bash
# 1) ค่าลับ: คัดลอกแล้วเปลี่ยนค่าทุกตัว (.env ไม่ถูก commit)
cp .env.example .env
cp api/.env.example api/.env       # ใช้กับ goose รหัสผ่านต้องตรงกับ POSTGRES_PASSWORD ใน .env

# 2) ขึ้นระบบ (postgres, redis, keycloak, api, web)
docker compose up -d --build

# 3) สร้างตาราง (compose ไม่รัน migration ให้)
cd api && goose up && cd ..

# 4) ข้อมูลตัวอย่าง (ไม่บังคับ รันซ้ำได้)
docker compose exec -T postgres psql -U postgres -d bookingtable -v ON_ERROR_STOP=1 < api/seed/seed.sql
```

| อะไร | ที่ไหน |
| --- | --- |
| Web | http://localhost:3000 (compose รัน `next dev` พร้อม hot reload; แผนของส่วนนี้อยู่ใน [Frontend_PLAN.md](Frontend_PLAN.md)) |
| API | http://localhost:8080/api/v1 (Swagger: http://localhost:8080/swagger/index.html) |
| เข้าสู่ระบบ | เปิด http://localhost:8080/api/v1/auth/login ด้วยเบราว์เซอร์ |
| Keycloak admin | http://localhost:8180 ผู้ใช้ `admin` รหัสผ่านคือ `KC_ADMIN_PASSWORD` ใน `.env` |
| Postgres | `localhost:5532` (ฐานข้อมูล `bookingtable`) |

ผู้ใช้ใน realm เข้าสู่ระบบด้วย **อีเมล** ข้อมูลตัวอย่างจาก seed เป็นผู้ใช้ปลอมที่ล็อกอินไม่ได้
การเริ่มต้น Keycloak ใช้ `keycloak.localhost:8180` ทั้งฝั่งเบราว์เซอร์และฝั่ง API (เพื่อให้ URL และ `iss` ใน token ตรงกัน)
โดยเบราว์เซอร์รุ่นใหม่ resolve `*.localhost` เป็น loopback เอง ไม่ต้องแก้ `/etc/hosts`

## ทดสอบ

### Backend

เทสต์ที่ `api/internal/apitest` ยิง HTTP API จริงกับ PostgreSQL จริงผ่าน testcontainers จึงต้องมี Docker รันอยู่

```bash
cd api
go vet ./...
go test ./... -count=1
```

ครั้งแรกจะดึง image `postgres:17` ทำให้ช้ากว่าปกติ เทสต์ทุกตัวใช้ container เดียวร่วมกันและล้างตารางก่อนแต่ละเทสต์
เทสต์ที่ทดสอบการแข่งกัน (จองพร้อมกัน ยกเลิกซ้ำ ลบร้านระหว่างมีคนจอง) ใช้ connection pool ที่อุ่นแล้วเพื่อให้คำขอทับกันจริง

**ถ้าใช้ Colima:** `colima start` แล้วรันได้เลย `TestMain` ตรวจเองว่าถ้าไม่มี `DOCKER_HOST` และไม่มี `/var/run/docker.sock`
จะใช้ `~/.colima/default/docker.sock` และตั้ง `TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE=/var/run/docker.sock` ให้
(Ryuk ต้อง mount socket ด้วยพาธภายใน VM) ถ้า socket อยู่ที่อื่นให้ตั้งสองตัวแปรนี้เอง
อาการถ้ายังไม่ได้ตั้ง: `panic: rootless Docker not found`

### Frontend

```bash
cd web
npm run lint
npm run typecheck     # สร้าง type ของ route ด้วย `next typegen` ก่อน แล้วรัน tsc
npm test              # Vitest เฉพาะโฟลเดอร์ lib/ รันด้วย TZ=America/New_York เพื่อจับโค้ดที่พึ่งเขตเวลาของเครื่อง
npm run build
```

เทสต์ครอบเฉพาะตรรกะที่เสี่ยงใน `web/lib` (API client + refresh token, แปลงเวลา Asia/Bangkok, แปลง error code เป็นข้อความไทย, ตัวแก้เวลาเปิด)
หน้าและคอมโพเนนต์ตรวจด้วย lint, type check, build และเช็กลิสต์ทดสอบมือใน [Frontend_PLAN.md](Frontend_PLAN.md) Task 9

### ทดสอบกับระบบที่รันอยู่ (end-to-end)

`scripts/smoke_api.py` สร้างผู้ใช้ชั่วคราวใน Keycloak (เจ้าของและลูกค้า) ล็อกอินจริงตามขั้นตอน (API → Keycloak → callback → ticket → token)
แล้วไล่ flow หลักด้วย HTTP: สร้างร้าน อัปโหลดรูป จอง รีวิว ลบร้าน จากนั้นลบผู้ใช้ชั่วคราวทิ้ง ไม่พิมพ์ token หรือรหัสผ่าน

```bash
docker compose up -d --build && (cd api && goose up)
set -a; . ./.env; set +a
python3 -I scripts/smoke_api.py
```

## งานประจำ

| ทำอะไร | คำสั่ง |
| --- | --- |
| migration ใหม่ | `cd api && goose create <ชื่อ> sql` แล้วเติม `-- +goose Up/Down` |
| ย้อน migration | `cd api && goose down` |
| สร้าง Swagger ใหม่ | `cd api && swag init -g cmd/api/main.go -o docs --parseInternal --parseDependency` (`go install github.com/swaggo/swag/cmd/swag@v1.16.6` ตรงกับเวอร์ชันใน `go.mod` แม้ `swag --version` จะยังพิมพ์ v1.16.4 เพราะค่าคงที่ในโค้ดของ swag ไม่ได้ถูกอัปเดต) |
| รีเซ็ต Keycloak เป็นค่าตั้งต้น | ดูคำสั่งใต้ตาราง |

รีเซ็ต Keycloak (ชื่อ volume ขึ้นกับชื่อโฟลเดอร์โปรเจกต์ ตรวจด้วย `docker volume ls`):

```bash
docker compose down
docker volume rm "$(docker volume ls -q | grep keycloak-data)"
docker compose up -d
```

เอกสาร API ที่เขียนมือ ([api/docs/API.md](api/docs/API.md)) คือสัญญาที่ Frontend ต้องทำตาม ถ้าเปลี่ยนพฤติกรรมให้แก้ที่นั่นพร้อมกัน

## แก้ปัญหา

- **ล็อกอินแล้วเบราว์เซอร์เปิด `keycloak:8080` ไม่ได้ / 401 ตอนแลก token:** ตรวจว่า `KEYCLOAK_BASE_URL` ของ api ใน `compose.yml`
  คือ `http://keycloak.localhost:8180` และ api มี `extra_hosts: keycloak.localhost:host-gateway`
- **401 จากทุก endpoint หลังล็อกอิน:** audience ใน realm (`bookingtable`) ต้องตรงกับ `KEYCLOAK_CLIENT_ID`
  ถ้าเคยแก้ realm JSON ต้องรีเซ็ต volume ของ Keycloak (ดูตารางด้านบน) เพราะ import ทำเฉพาะตอน volume ว่าง
- **`docker compose` บอกว่าขาดตัวแปร:** ยังไม่ได้ `cp .env.example .env`
- **อัปโหลดรูปแล้ว `permission denied`:** image ของ api รันด้วยผู้ใช้ nonroot โฟลเดอร์ `/app/uploads` ต้องเป็นของผู้ใช้นั้น
  (Dockerfile ทำให้แล้วด้วย `COPY --chown`) ถ้าเคยสร้าง volume `bookingtable-uploads` ก่อนแก้ ให้ลบ volume แล้วขึ้นใหม่
- **ที่ Colima หน่วยความจำไม่พอ:** stack นี้ใช้ราว 0.7 GB ตอนรัน และราว 3 GB ในช่วงที่รัน web, build image และ testcontainers พร้อมกัน
  `colima stop && colima start --memory 4` เพียงพอ

## ข้อควรรู้เรื่องความปลอดภัย

ค่าใน `.env` และ `realm` ที่ import เป็นค่าสำหรับพัฒนาเท่านั้น (Keycloak ทำงานโหมด `start-dev` ผ่าน HTTP, `pea-realm.json`
ยังมีรหัสผ่านแบบ hash ของผู้ใช้ dev และ key ของ realm ที่มากับโปรเจกต์ต้นแบบ) ห้ามนำไปใช้จริง
