# web

หน้าบ้านของ Booking Table: Next.js 16 (App Router) + TypeScript + Tailwind v4 + shadcn/ui ทุกหน้าเป็น client component
เพราะทุก endpoint ต้องใช้ Bearer token ภาพรวมของทั้งระบบ วิธีรัน และการล็อกอินอยู่ใน [README หลัก](../README.md)

Next 16 ต่างจากรุ่นที่คุ้นเคยหลายจุด อ่านบันทึกสั้น ๆ ใน [NOTES.md](NOTES.md) และเอกสารใน `node_modules/next/dist/docs/` ก่อนแก้ routing

## คำสั่ง

```bash
npm ci
npm run dev          # http://localhost:3000 (ใน compose รันให้แล้ว)
npm run lint
npm run typecheck    # สร้าง type ของ route ด้วย `next typegen` ก่อน แล้วรัน tsc
npm test             # Vitest เฉพาะ lib/ รันด้วย TZ=America/New_York
npm run build
```

## โครงสร้าง

```text
app/          หน้าและ layout (รายการร้าน, รายละเอียดร้าน, /my/reservations, /my/restaurants/..., /auth/callback)
components/   คอมโพเนนต์ของหน้า; bases/ = Button; ui/ = primitive จาก shadcn
hooks/        use-credential (สถานะล็อกอิน), use-async (โหลดข้อมูล)
lib/          ตรรกะที่ไม่ผูกกับหน้า: api client + refresh token, auth store, เวลา Asia/Bangkok, ข้อความ error, ตัวแก้เวลาเปิด (มี *.test.ts ข้างไฟล์)
```

ค่าที่ browser ต้องรู้มีตัวเดียวคือ `NEXT_PUBLIC_API_BASE_URL` (ค่าเริ่มต้น `http://localhost:8080/api/v1`) ห้ามใส่ความลับในตัวแปร `NEXT_PUBLIC_*`
