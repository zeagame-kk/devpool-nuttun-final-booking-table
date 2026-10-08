# Next 16 notes (จาก node_modules/next/dist/docs/01-app)

- `params` และ `searchParams` ของ `page.tsx` เป็น `Promise` (ต้อง `await` หรือ `use()`); ในคอมโพเนนต์ client ใช้ `useParams<{ id: string }>()` จาก `next/navigation` แทน
- `useSearchParams()` คืน `URLSearchParams` แบบอ่านอย่างเดียว; ตอน `next build` หน้า static ที่เรียกมันต้องอยู่ใต้ `<Suspense>` ไม่งั้น build ล้ม (dev ไม่เตือน)
- เปลี่ยน query: สร้าง `new URLSearchParams(searchParams.toString())` แล้ว `router.push(pathname + "?" + qs)`
- `useRouter` นำเข้าจาก `next/navigation` (ไม่ใช่ `next/router`); มี `push`, `replace`, `refresh`, `back`
- `<Link>` เป็นวิธีนำทางหลัก; ใช้ `useRouter` เมื่อต้องนำทางหลัง async เท่านั้น
- เอกสารบอกชื่อ `middleware` เปลี่ยนเป็น `proxy` (แผนนี้ไม่ใช้)
- `PageProps<'/route'>` เป็น helper global (สร้างตอน `next dev`/`build`/`next typegen`)
- ทุกหน้าในโปรเจกต์นี้เป็น client component (`"use client"`) เพราะทุก endpoint ต้องใช้ Bearer token
