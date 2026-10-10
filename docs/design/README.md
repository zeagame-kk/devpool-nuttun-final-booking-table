# ชุดส่งดีไซน์ (design hand-off)

รวมทุกอย่างที่ต้องส่งให้ Claude Design (หรือนักออกแบบคนไหนก็ได้) ไว้ที่เดียว

| ไฟล์/โฟลเดอร์ | คืออะไร |
| --- | --- |
| [brief.md](brief.md) | **เริ่มที่นี่** โจทย์ ทิศทาง รายการหน้า ข้อมูลที่มีจริง ข้อจำกัด และสิ่งที่อยากได้กลับมา |
| [tokens.md](tokens.md) | สี ตัวอักษร ระยะ และ component ที่มีอยู่แล้ว (ค่าจริงจากโค้ด) |
| `screens/` | ภาพหน้าจอปัจจุบัน 29 ภาพ: เดสก์ท็อป 1200px (22 ภาพ) และมือถือ 390px (7 ภาพ ชื่อขึ้นต้น `m`) รวมสถานะ โหลด/ผิดพลาด/ว่าง/เต็ม/ปิด |
| `assets/` | ไอคอนแอป 512px, โลโก้หัวเว็บ 96px และรูปร้านตัวอย่าง 5 รูป (เครดิตช่างภาพอยู่ใน `restaurant-photos/CREDITS.md`) |

## วิธีส่ง

1. วางข้อความใน `brief.md` เป็นโจทย์ (แก้ส่วน "2. ทิศทางที่ขอ" ให้ตรงกับที่อยากได้ก่อน)
2. แนบ `screens/` ทั้งโฟลเดอร์ ถ้าแนบได้จำกัด ให้เลือกชุดหลัก: `01`, `03`, `05`, `05b`, `05c`, `07`, `08`, `09`, `12`, `m02`, `m03`
3. แนบ `assets/app-icon-512.png` กับ `restaurant-photos/` และวางข้อความใน `tokens.md`
4. ของที่ได้กลับมา ให้เอามาใช้ผ่าน `web/app/globals.css` (token) และ `web/components/` (component) ตามที่ section 8 ของ brief ขอ

ห้ามส่ง: ไฟล์ `.env`, รหัสผ่าน, ข้อมูลผู้ใช้จริง (ภาพใน `screens/` ใช้ผู้ใช้และร้านสมมติทั้งหมด)

## สร้างภาพหน้าจอใหม่

เมื่อหน้าตาเปลี่ยน ถ่ายใหม่ด้วยสคริปต์เดียว (ต้องมี stack รันอยู่ และ Chrome):

```bash
set -a; . ./.env; set +a
node scripts/browser_e2e/design_screens.mjs
```

สคริปต์สร้างผู้ใช้ทดลอง 3 คนใน Keycloak กับร้านและการจองสมมติ ถ่ายภาพ แล้วลบสิ่งที่ API ลบได้ (ยกเลิกการจอง ลบรูปและร้าน ลบผู้ใช้ใน Keycloak)
แต่ **รีวิว การจองที่ยกเลิกแล้ว และแถวใน `users` ลบผ่าน API ไม่ได้** ทุกแถวของสคริปต์ใช้อีเมล `e2e-design-*@example.com` ให้ล้างด้วย SQL ตามนี้หลังรันทุกครั้ง:

```bash
docker compose exec -T postgres psql -U postgres -d bookingtable -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
DELETE FROM reservations WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'e2e-design-%@example.com')
   OR restaurant_id IN (SELECT id FROM restaurants WHERE owner_id IN (SELECT id FROM users WHERE email LIKE 'e2e-design-%@example.com'));
DELETE FROM reviews WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'e2e-design-%@example.com')
   OR restaurant_id IN (SELECT id FROM restaurants WHERE owner_id IN (SELECT id FROM users WHERE email LIKE 'e2e-design-%@example.com'));
DELETE FROM restaurant_opening_hours WHERE restaurant_id IN (SELECT id FROM restaurants WHERE owner_id IN (SELECT id FROM users WHERE email LIKE 'e2e-design-%@example.com'));
DELETE FROM restaurants WHERE owner_id IN (SELECT id FROM users WHERE email LIKE 'e2e-design-%@example.com');
DELETE FROM users WHERE email LIKE 'e2e-design-%@example.com';
COMMIT;
SQL
```

สคริปต์จองร้านตัวอย่างของ seed (9001 และ 9002) ไว้ 2 รายการด้วย ซึ่งถูกยกเลิกตอนจบและลบโดย SQL ข้างบน ร้านตัวอย่างจึงกลับเป็นข้อมูลของ seed
