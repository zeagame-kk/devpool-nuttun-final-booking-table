# Booking Table

ระบบจองโต๊ะและรีวิวร้านชาบู/ปิ้งย่าง (Go + Gin + GORM + PostgreSQL, Keycloak, Next.js)
สเปกอยู่ที่ [SPEC.md](SPEC.md) และแผนงานอยู่ที่ [Backend_PLAN.md](Backend_PLAN.md) / [Frontend_PLAN.md](Frontend_PLAN.md)

> README นี้ยังเป็นฉบับย่อ ขั้นตอนติดตั้งและรันระบบทั้งชุดจะเขียนเพิ่มตอนจบ Backend Task 12

## รันเทสต์ (backend)

เทสต์ที่ `api/internal/apitest` ยิง HTTP API จริงกับ PostgreSQL จริงผ่าน testcontainers จึงต้องมี Docker รันอยู่

```bash
cd api
go test ./... -count=1
```

### ถ้าใช้ Colima

1. เริ่ม Docker: `colima start`
2. ไม่ต้องตั้งตัวแปรเอง: `TestMain` ใน `apitest` ตรวจเองว่าถ้าไม่มี `DOCKER_HOST` และไม่มี `/var/run/docker.sock` จะใช้ `~/.colima/default/docker.sock` และตั้ง `TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE=/var/run/docker.sock` ให้ (Ryuk ต้อง mount socket ด้วยพาธภายใน VM)
3. ถ้า socket ของคุณอยู่ที่อื่น ให้ตั้งเอง: `export DOCKER_HOST=unix:///path/to/docker.sock TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE=/var/run/docker.sock`

อาการที่เจอถ้ายังไม่ได้ตั้ง: `panic: rootless Docker not found` ตอนเริ่ม `TestMain`

ครั้งแรกจะดึง image `postgres:17` ทำให้ช้ากว่าปกติ เทสต์ทุกตัวใช้ container เดียวร่วมกันและล้างตารางก่อนแต่ละเทสต์
