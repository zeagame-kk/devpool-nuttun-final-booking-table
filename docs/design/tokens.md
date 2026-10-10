# Design tokens และ component ที่มีอยู่ตอนนี้

> **สถานะก่อนออกแบบใหม่ (เก็บไว้เป็นส่วนของชุดส่งดีไซน์)** ค่าและ component ปัจจุบันอยู่ใน [DESIGN.md](../../DESIGN.md) ที่ root ไฟล์นี้อาจไม่ตรงกับโค้ดแล้ว

ค่าทั้งหมดมาจากโค้ดจริง (`web/app/globals.css`, `web/components/`) ถ้าจะเสนอค่าใหม่ ให้ใช้ **ชื่อ token เดิม** เพื่อให้เอาไปแทนใน `globals.css` ได้ตรง ๆ

## สี (โหมดสว่าง ซึ่งเป็นโหมดเดียวที่ใช้จริง)

| Token | ค่า | ใช้กับ |
| --- | --- | --- |
| `--background` | `#f0f2f5` | พื้นหลังหน้า (เทาอ่อน ให้การ์ดสีขาวเด่น) |
| `--foreground` | `#050505` | ตัวหนังสือหลัก |
| `--card` | `hsl(0 0% 100%)` (ขาว) | การ์ด หัวเว็บ ฟอร์ม |
| `--primary` | `#0866ff` | ปุ่มหลัก, focus ring (ตัวหนังสือขาวบนสีนี้ 4.8:1) |
| `--primary-hover` | `#0759e0` | (กำหนดไว้ ยังไม่ได้ใช้ใน Button: ตอนนี้ใช้ `bg-primary/80`) |
| `--primary-strong` | `#1568d8` | ตัวหนังสือสีฟ้าบนพื้นอ่อน เช่น ลิงก์ ชื่อแบรนด์ ตัวเลขสถิติ (5.3:1 บนขาว) |
| `--primary-subtle` | `#e7f3ff` | พื้นสีฟ้าอ่อน เช่น ช่วงว่าง hero ของหน้าแรก วงกลมไอคอน |
| `--primary-border` | `#cfe3ff` | ขอบของช่วงที่ว่าง |
| `--secondary` / `--muted` | `#e4e6eb` | ปุ่มรอง, skeleton, badge สถานะ "ยกเลิกแล้ว" |
| `--muted-foreground` | `#65676b` | ข้อความรอง คำอธิบาย |
| `--accent` | `hsl(35 100% 55%)` | (ส้ม) ใช้น้อยมาก |
| `--accent-strong` | `hsl(35 100% 35%)` | ดาวรีวิว ตัวหนังสือสถานะ "ใกล้เต็ม" |
| `--accent-subtle` | `hsl(36 100% 93%)` | พื้นช่วง "ใกล้เต็ม" |
| `--destructive` | `hsl(0 74% 51%)` | ข้อผิดพลาด ปุ่มลบ ช่วง "เต็ม" |
| `--success` | `hsl(157 78% 27%)` | ข้อความ "จองสำเร็จ" |
| `--border` / `--input` | `#ced0d4` | เส้นขอบ ช่องกรอก |
| `--ring` | `#0866ff` | วง focus |

สีฟ้าของไอคอนแอปคือประมาณ `#1262ee` ต่างจาก `--primary` เล็กน้อย ถ้าจะรวมให้เป็นสีเดียวต้องเลือกค่าเดียวแล้วแก้ทั้งสองที่

โหมดมืด (`.dark`) มีค่าติดมากับ shadcn แต่ **ไม่ได้ออกแบบและไม่มีปุ่มสลับ** ไม่ต้องออกแบบรอบนี้

## ตัวอักษรและระยะ

- ฟอนต์: **Noto Sans Thai** (โหลดผ่าน `next/font`, รองรับไทย + ละติน), ตัวเลขใช้ฟอนต์เดียวกัน
- ขนาดที่ใช้ตอนนี้: `text-xs` (12), `text-sm` (14, ข้อความทั่วไป), `text-base` (16), `text-lg` (18, หัวข้อส่วน), `text-xl` (20), `text-2xl` (24, หัวหน้า), `text-3xl`/`4xl` (หัวข้อ landing)
- น้ำหนัก: ปกติ, `font-medium`, `font-semibold`, `font-bold` (เฉพาะ landing)
- เนื้อหากว้างสูงสุด `max-w-5xl` (1024px) กึ่งกลาง ขอบข้าง 16px (`p-4`), ช่องไฟระหว่างส่วน 16–32px
- มุมโค้ง: `--radius` = 10px, ค่าอนุพันธ์ `lg`=10px, `xl`=14px, `2xl`=18px, การ์ดใช้ `xl`
- เงา: ไม่มี ใช้เส้นขอบบาง ๆ (`ring-1 ring-foreground/10`) แทน
- breakpoint ตาม Tailwind: `sm` 640, `md` 768, `lg` 1024 (รายการร้าน 1 → 2 → 3 คอลัมน์)

## Component ที่มีอยู่แล้ว (ใช้ซ้ำได้ ไม่ต้องสร้างใหม่)

| Component | ที่อยู่ | หมายเหตุ |
| --- | --- | --- |
| `Button` | `components/bases/button.tsx` | variant: default, outline, secondary, ghost, destructive, link; ขนาด: small 34px, medium 40px, large 48px |
| `Card` | `components/ui/card.tsx` | พื้นขาว มุม `xl` ขอบ ring บาง ระยะใน 16px |
| `Badge` | `components/ui/badge.tsx` | ใช้เป็นป้ายสถานะการจอง ("ยืนยันแล้ว" ฟ้าอ่อน / "ยกเลิกแล้ว" เทา) |
| `Input`, `Textarea`, `Label` | `components/ui/` | `Input` สูง 32px ทุกที่ ส่วนปุ่มขนาดกลางและ `select` (เรียงลำดับ/กรองสถานะ ใช้ `<select>` ของเบราว์เซอร์) สูง 40px จึงไม่เท่ากันในแถวค้นหา |
| `Skeleton` | `components/ui/skeleton.tsx` | กล่องเทาเต้นเป็นจังหวะระหว่างโหลด |
| `EmptyState` | `components/empty-state.tsx` | ไอคอนในวงกลมฟ้าอ่อน + หัวข้อ + คำอธิบาย + ปุ่ม |
| `StatCard` | `components/stat-card.tsx` | ป้าย + ตัวเลขใหญ่สีฟ้า + คำอธิบายสั้น |
| `ErrorAlert` | `components/error-alert.tsx` | แถบสีแดงอ่อน + ปุ่ม "ลองอีกครั้ง" |
| `RestaurantCard` | `components/restaurant-card.tsx` | รูป 160px + ชื่อ ที่อยู่ คะแนน ที่นั่ง |
| `UserAvatar` | `components/user-avatar.tsx` | วงกลมตัวอักษรย่อ หรือรูป |
| `SiteHeader` | `components/site-header.tsx` | โลโก้ + ชื่อ, เมนู 3 ลิงก์, ชื่อผู้ใช้, ออกจากระบบ |
| `AvailabilityPanel` | `components/availability-panel.tsx` | ตารางช่วงว่างรายชั่วโมง 3 สถานะ (ว่าง/ใกล้เต็ม/เต็ม) + ช่องที่ผ่านไปแล้ว |
| ไอคอน | `lucide-react` | ใช้อยู่แล้ว (ไม่ต้องเพิ่ม library) |

Primitive ของ shadcn ที่ยัง **ไม่มี** (ถ้าดีไซน์ต้องใช้ ให้บอกชัดว่าเพิ่ม): select, tabs, dialog, avatar, separator, tooltip, toast
