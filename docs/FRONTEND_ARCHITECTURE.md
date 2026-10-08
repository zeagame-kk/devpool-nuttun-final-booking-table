# Frontend Architecture

> วิเคราะห์จาก `web/` — **สิ่งที่ต้องรู้ก่อนอ่าน:** ตอนนี้ `web/` เป็น **Next.js scaffold + design-system เริ่มต้น** ยังไม่มี routing เกินหน้า `/`,
> ไม่มี API client, ไม่มี auth, ไม่มี state management, ไม่มี form/validation และไม่มี test
> ดังนั้นเอกสารนี้แยกเนื้อหาเป็น 2 ประเภทอย่างชัดเจน:
>
> - **[exists]** — มีอยู่จริงในโค้ดของ `web/` (มี path อ้างอิง)
> - **[contract]** — สิ่งที่ frontend *ต้องทำตาม* เพราะ backend กำหนดไว้ (`api/docs/API.md`, `api/internal/auth/*`) แต่ **ยังไม่ได้ implement** ใน `web/`
>
> ส่วนที่ไม่มีหลักฐานทั้งสองแบบ = **UNKNOWN**. ไม่มีค่า secret ในเอกสารนี้
> เอกสารคู่กัน: [SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md) · [BACKEND_ARCHITECTURE.md](BACKEND_ARCHITECTURE.md)

---

## 1. Overview

| หัวข้อ | สถานะ |
| --- | --- |
| Framework | Next.js 16.3.4, **App Router** (`web/app/`) **[exists]** |
| Rendering | Server Components เป็น default (`components.json` → `"rsc": true`); ยังไม่มี `"use client"` component ใดๆ **[exists]** |
| Styling | Tailwind CSS v4 + CSS variables (design tokens) **[exists]** |
| Component system | shadcn/ui style `base-nova` บน `@base-ui/react` + `class-variance-authority` **[exists]** |
| หน้าที่มี | `/` เท่านั้น (`app/page.tsx` — ยังเป็นหน้า demo ของ create-next-app + ปุ่มทดลอง) **[exists]** |
| API layer / Auth / State / Forms | ไม่มี **[contract] เท่านั้น** |

รัน: `npm run dev` (port 3000) — ใน compose คือ `web` service (dev server + bind mount, `web/Dockerfile`)

⚠️ `web/AGENTS.md` เตือนไว้ชัดว่า *"This is NOT the Next.js you know … read the relevant guide in `node_modules/next/dist/docs/` before writing any code"* — Next.js 16 มี breaking changes; ก่อนเขียน routing/data fetching/middleware ให้เปิดเอกสารในโฟลเดอร์นั้น (ไม่ได้อ่านใน phase นี้ → รายละเอียด API ของ Next 16 **UNKNOWN**)

---

## 2. Technology Stack

| Technology | Evidence | Purpose |
| --- | --- | --- |
| Next.js `16.3.4` | `web/package.json`, `web/next.config.ts` (config ว่าง) | framework, App Router |
| React `19.2.8` + react-dom | `web/package.json` | UI |
| TypeScript `^5`, `strict: true` | `web/tsconfig.json` | type safety |
| Path alias `@/*` → `./*` | `web/tsconfig.json` (`paths`) | import เช่น `@/components/bases/button` |
| Tailwind CSS `^4` + `@tailwindcss/postcss` | `web/package.json`, `web/postcss.config.mjs`, `web/app/globals.css` (`@import "tailwindcss"`) | styling (ไม่มี `tailwind.config.*` — `components.json` → `"config": ""`) |
| `tw-animate-css`, `shadcn/tailwind.css` | `web/app/globals.css`, `web/package.json` | animation utilities / shadcn base styles |
| shadcn CLI `^4.21.0`, style `base-nova`, base color `neutral`, icon lib `lucide` | `web/components.json`, `web/package.json` | generator + config ของ component |
| `@base-ui/react ^1.8.0` | `web/components/ui/button.tsx` (`@base-ui/react/button`) | headless primitives (แทน Radix) |
| `class-variance-authority` | `web/components/*/button.tsx` (`cva`) | variants ของ component |
| `cn` (npm package) | `web/lib/utils.ts` (`export { cn } from "cn"`), `web/components/*/button.tsx` (`import { cn } from "cn"`) | ฟังก์ชันรวม className — ⚠ เป็นแพ็กเกจ `cn` ไม่ใช่ `clsx + tailwind-merge` แบบมาตรฐานของ shadcn; พฤติกรรมการ merge class ที่ชนกัน **UNKNOWN** (ยังไม่ได้ตรวจแพ็กเกจ) |
| `lucide-react ^1.43.0` | `web/package.json` | icons (ยังไม่ถูก import ในโค้ด) |
| `next/font/google` — Geist, Geist_Mono | `web/app/layout.tsx` | ฟอนต์ |
| ESLint 9 + `eslint-config-next` (core-web-vitals + typescript) | `web/eslint.config.mjs` | lint (`npm run lint`) |
| npm + `package-lock.json`; Node 24 (Docker) | `web/Dockerfile` (`node:24-alpine`, `npm ci`) | package manager / runtime |
| HTTP client | **UNKNOWN — insufficient evidence** (ไม่มี axios/ky/swr/react-query ใน `package.json`; `api/docs/API.md` เอ่ยถึง "axios" เป็นข้อความอธิบายเท่านั้น) | — |
| State management | **UNKNOWN** | — |
| Form / validation (react-hook-form, zod ฯลฯ) | **UNKNOWN** — ไม่มี dependency | — |
| Auth library | **ไม่มี** (ไม่มี `keycloak-js`, `next-auth`, `oidc-client`) | — |
| Testing (jest/vitest/playwright) | **UNKNOWN** — ไม่มี dependency/script | — |

---

## 3. Application Entry Point

| ไฟล์ | บทบาท |
| --- | --- |
| `web/app/layout.tsx` | **Root layout** — โหลดฟอนต์ Geist/Geist Mono เป็น CSS variable (`--font-geist-sans`, `--font-geist-mono`), import `./globals.css`, ครอบ `<html lang="en" className="… h-full antialiased">` + `<body className="min-h-full flex flex-col">`; ใช้ type `LayoutProps<"/">` (typed route helper ของ Next 16); `metadata` ยังเป็นค่า default ("Create Next App") |
| `web/app/page.tsx` | หน้า `/` (Server Component) — demo + ปุ่มทดลองทุก variant |
| `web/app/globals.css` | Tailwind entry + design tokens (ดู §6) |
| `web/next.config.ts` | ว่าง (ไม่มี rewrites/proxy/env) |

ลำดับ: Next ใช้ `app/layout.tsx` ห่อ `app/page.tsx` → ไม่มี providers (ไม่มี auth/query provider) ใน layout

---

## 4. Directory Structure

```text
web/
├── app/                      # App Router
│   ├── layout.tsx            # root layout (fonts, globals.css)
│   ├── page.tsx              # "/"
│   ├── globals.css           # Tailwind + tokens
│   └── favicon.ico
├── components/
│   ├── ui/button.tsx         # ไฟล์ที่ shadcn CLI สร้าง (size: default/xs/sm/lg/icon*)
│   └── bases/button.tsx      # ฉบับปรับแต่งของโปรเจกต์ (size: small/medium/large)
├── lib/utils.ts              # re-export cn
├── public/                   # svg ของ create-next-app (file, globe, next, vercel, window)
├── components.json           # shadcn config + aliases
├── next.config.ts · tsconfig.json · eslint.config.mjs · postcss.config.mjs
├── Dockerfile · .dockerignore · .gitignore
├── AGENTS.md (+ CLAUDE.md → @AGENTS.md) · README.md (ของ create-next-app)
└── package.json · package-lock.json
```

Alias ที่ประกาศไว้ใน `components.json` (**[exists]** แต่หลายโฟลเดอร์ยังไม่ถูกสร้าง):

| alias | → | สถานะ |
| --- | --- | --- |
| `@/components` | `components/` | มี |
| `@/components/ui` | `components/ui/` | มี (`button.tsx`) |
| `@/lib`, `@/lib/utils` | `lib/` | มี (`utils.ts`) |
| `@/hooks` | `hooks/` | **ยังไม่มีโฟลเดอร์** |

> `git status` ณ ต้นเซสชัน: `web/components/`, `web/lib/`, `web/components.json` เป็น untracked และ `app/globals.css`, `app/page.tsx`, `package*.json` เป็น modified → งานฝั่ง web ยังไม่ commit

---

## 5. Routing

**[exists]** App Router แบบ file-based: ไฟล์ `app/page.tsx` = route `/`. ไม่มี route อื่น, ไม่มี nested route, ไม่มี route group, ไม่มี `middleware.ts`/`proxy.ts`, ไม่มี `loading.tsx`/`error.tsx`/`not-found.tsx`

**[contract] route ที่ backend คาดหวังให้ frontend มี:**

| Route | เหตุผล | หลักฐาน |
| --- | --- | --- |
| `/auth/callback` | Backend redirect มาที่ `{FRONTEND_URL}/auth/callback?ticket=<ticket>` หลัง login สำเร็จ — ต้องอ่าน `ticket` แล้ว `POST /auth/exchange` | `api/internal/auth/service.go` (`HandleCallback`), `api/docs/API.md` §Auth |
| ปุ่ม/ลิงก์ login | ต้อง navigate ทั้งหน้า (ไม่ใช่ fetch) ไปที่ `{API}/auth/login` | `api/docs/API.md` (`GET /auth/login`) |
| หลัง logout | Keycloak client อนุญาต post-logout redirect `http://localhost:3000/*` | `keycloak/import/pea-realm.json` (`post.logout.redirect.uris`) |

Public vs Protected route และ route guard: **UNKNOWN** (ไม่มีโค้ด) — backend บังคับ auth ทุก endpoint ยกเว้น `/auth/*` ดังนั้นหน้าที่แสดงข้อมูลสูตรอาหารต้องมี token ก่อนทั้งหมด

---

## 6. Layout System

**[exists]**
- มี layout เดียว: root layout (`app/layout.tsx`) — ไม่มี nested layout/ไม่มี navbar/sidebar/footer
- `<body>` เป็น flex column เต็มจอ (`min-h-full flex flex-col`) → หน้าลูกใช้ `flex-1` ได้ (`page.tsx` ทำแบบนี้)
- Dark mode: `@custom-variant dark (&:is(.dark *))` → ใช้ class `.dark` (ไม่มีตัวสลับธีมในโค้ด)

**Design tokens (`app/globals.css`)**
- `@theme inline` map ตัวแปร → utility ของ Tailwind (`--color-primary: var(--primary)` ฯลฯ, radius scale จาก `--radius: 0.625rem`)
- `:root` ตั้งค่า: `--primary` เป็นโทนม่วงแดง `hsl(310 93% 34%)`, `--accent` ส้ม `hsl(35 100% 55%)`, มี token เพิ่มเฉพาะโปรเจกต์ (`--primary-hover`, `--primary-subtle`, `--primary-border`, `--accent-subtle`, `--accent-strong`, `--destructive-strong`, `--destructive-subtle`, `--success`, `--success-subtle`, `--border-subtle`) นอกเหนือจากชุดมาตรฐานของ shadcn (`--background`, `--card`, `--sidebar-*`, `--chart-*` …)
- `.dark` ให้ค่าเฉพาะชุดมาตรฐานของ shadcn (oklch) — **token เพิ่มเอง (`--primary-hover`, `--success` ฯลฯ) ยังไม่มีค่า dark** (**[exists]** ในไฟล์ — ยืนยันจากการอ่านบล็อก `.dark`)
- `@layer base`: `* { border-border outline-ring/50 }`, `body { bg-background text-foreground }`, `html { font-sans }`

ข้อสังเกต: `@theme inline` มี `--font-sans: var(--font-sans)` (อ้างตัวเอง) ขณะที่ `layout.tsx` ตั้งตัวแปรชื่อ `--font-geist-sans` → ฟอนต์ Geist อาจไม่ถูกผูกกับ `font-sans` (**needs manual verification** ในเบราว์เซอร์) — diff ใน `git diff web/app/globals.css` แสดงว่าบรรทัดนี้เดิมเป็น `var(--font-geist-sans)` ก่อนรัน shadcn init

---

## 7. Pages

| Route | ไฟล์ | หน้าที่ปัจจุบัน |
| --- | --- | --- |
| `/` | `web/app/page.tsx` | Server Component; ยังเป็นหน้าต้อนรับของ create-next-app + `<Button>` 6 variant (`default/destructive/ghost/link/outline/secondary`) ที่ import จาก `@/components/bases/button` เพื่อลอง design system |

หน้าอื่นทั้งหมด (recipe list/detail/form, profile, auth callback): **ยังไม่มี** — ดู §15 สำหรับหน้าที่ backend รองรับแล้ว

---

## 8. Components

แบ่งตามที่โค้ดมีอยู่จริง:

| ประเภท | ที่ | รายการ | บทบาท |
| --- | --- | --- | --- |
| UI primitives จาก shadcn (generated) | `components/ui/` | `button.tsx` | สร้างโดย `shadcn add button` (ตาม `components.json` alias `ui`) — ห่อ `@base-ui/react/button` ด้วย `cva` |
| Project base components (customized) | `components/bases/` | `button.tsx` | สำเนาที่ปรับแล้ว: size เปลี่ยนเป็น `small | medium | large` (สูง 34/40/48px), default size = `medium`; **หน้าจริงของโปรเจกต์ import จากที่นี่** (`page.tsx`) |
| Layout components | — | ไม่มี | |
| Feature components | — | ไม่มี | |

รูปแบบ component ที่เห็น (ใช้เป็นแบบอย่างได้ — ทั้งสองไฟล์เหมือนกัน):

```tsx
const buttonVariants = cva("<base classes>", { variants: { variant: {...}, size: {...} }, defaultVariants: {...} });
function Button({ className, variant = "default", size = "medium", ...props }:
  ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return <ButtonPrimitive data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}
export { Button, buttonVariants };
```

- มี `data-slot="button"` (convention ของ shadcn ใช้ style ผ่าน attribute)
- Named export (`export { Button, buttonVariants }`) ไม่ใช่ default export
- Server-compatible (ไม่มี `"use client"` — primitive ของ base-ui จัดการเอง; ถ้าเพิ่ม state/handler ในหน้าต้องเพิ่ม `"use client"` ตามกฎ React **[ทั่วไป ไม่ได้มีหลักฐานใน repo]**)
- ความแตกต่างระหว่าง `ui/` กับ `bases/`: **โครงสร้างโฟลเดอร์สองชั้นนี้เป็น convention ของผู้เขียน** (`components.json` ระบุเฉพาะ `ui`); เจตนาที่แน่ชัดของ `bases/` = **UNKNOWN** — อนุมานว่าเป็นชั้น "ปรับแต่งให้เข้ากับแบรนด์" ที่ครอบ/คัดลอกจาก `ui/`

---

## 9. State Management

| ประเภท | สถานะ |
| --- | --- |
| Local state | ไม่มีตัวอย่าง (ไม่มี `useState` ใน repo) |
| Global state | **UNKNOWN** — ไม่มี store/context/provider |
| Server state (fetch/cache) | **UNKNOWN** — ไม่มี react-query/swr; Next.js App Router รองรับ fetch ใน Server Component แต่ไม่มีตัวอย่างที่ใช้ |
| Authentication state | **UNKNOWN** — ไม่มี. **[contract]**: backend ส่ง `Credential {accessToken, refreshToken, bearerType, expiresAt}` กลับมาเป็น JSON (ไม่ set cookie) → frontend ต้องเลือกที่เก็บเอง |

ข้อจำกัดจากฝั่ง backend ที่ต้องคำนึงเมื่อเลือกวิธีเก็บ token:
- `/auth/exchange` คืน token ใน body (`api/internal/auth/handler.go` `Exchange`) → ถ้าจะใช้ Server Components/route handler อ่าน token ต้องให้ frontend เขียนลง cookie เอง (backend ไม่ทำให้)
- Access token อายุ 3600 วินาที (`pea-realm.json` `accessTokenLifespan`); `expiresAt` มีใน credential → ใช้ตัดสินใจ refresh ได้

---

## 10. API Layer

**[exists]:** ไม่มี. ไม่พบ fetch wrapper, axios instance, service หรือ hook ใดๆ ใน `web/` — และไม่มีโค้ดอ่าน `NEXT_PUBLIC_API_BASE_URL`

**[contract]** สิ่งที่ API layer ต้องรองรับ:

| หัวข้อ | ข้อกำหนดจาก backend | หลักฐาน |
| --- | --- | --- |
| Base URL | `NEXT_PUBLIC_API_BASE_URL` = `http://localhost:8080/api/v1` (ฝั่ง browser; comment ใน `compose.yml` ระบุว่าห้ามใช้ `http://api:8080`) | `compose.yml` (web.environment) |
| Auth header | `Authorization: Bearer <accessToken>` ทุก endpoint ยกเว้น `/auth/*` | `api/docs/API.md`, `api/internal/middleware/jwt.go` |
| Content-Type | `application/json` | `api/docs/API.md` |
| Response error | `{ "message": "..." }` + HTTP status | `api/internal/httputil/response.go` |
| 401 | token หาย/ไม่ถูกต้อง/หมดอายุ/ไม่มี user ในระบบ → ลอง `POST /auth/refresh-token {refreshToken}` ครั้งเดียวแล้ว retry; ถ้าไม่สำเร็จให้กลับไป login | `api/docs/API.md` §refresh-token (อนุมานลำดับการ retry) |
| 204 | ไม่มี body ต้องไม่ `res.json()` | `favorite`, `unfavorite`, `rating`, `delete`, `logout` |
| IDs | recipe id เป็น number, user id เป็น string UUID | `api/docs/API.md` |
| ⚠ CORS | ต้องเรียกข้าม origin (3000→8080) แต่ API ใช้ `cors.Default()` ที่ไม่อนุญาต header `Authorization` → ต้องแก้ฝั่ง API หรือใช้ proxy ของ Next (`rewrites`) — ดู SYSTEM §15 ข้อ 7 (**needs manual verification**) |

เส้นทางที่ควรเป็น (รูปแบบสถาปัตยกรรมที่ **[contract]** บังคับให้เกิด — ไม่ใช่โค้ดที่มีอยู่):

```text
Page / Component
      ↓
(Hook / service)      ← ยังไม่มี; ที่วางตาม components.json alias: @/hooks, @/lib
      ↓
API client (base URL + Bearer + 401→refresh)   ← ยังไม่มี
      ↓
Backend endpoint (/api/v1/...)
```

Endpoint ที่ใช้ได้แล้วฝั่ง backend (เรียกจาก frontend): ดูตาราง routes ใน [BACKEND_ARCHITECTURE.md §6](BACKEND_ARCHITECTURE.md). ยังไม่มี: `GET /difficulties`, `GET /durations` (ต้องสำหรับ dropdown ในฟอร์มสร้างสูตร — ปัจจุบันค่าที่ใช้ได้คือ `easy|medium|hard` และ `10m|30m|60m|long` ตาม migration seed)

---

## 11. Authentication

**[exists]:** ไม่มีโค้ด auth ใน `web/`.

**[contract] วงจรชีวิตที่ frontend ต้อง implement** (backend-driven flow; ลำดับยืนยันจาก `api/internal/auth/service.go`):

```text
ผู้ใช้เปิดแอป
   ↓  ตรวจว่ามี token ที่ยังไม่หมดอายุไหม  (วิธีเก็บ/ตรวจ: UNKNOWN)
   ├─ มี  → เรียก API ด้วย Bearer token
   └─ ไม่มี → ผู้ใช้กด Login
            ↓
   window.location → {API}/auth/login              (navigate ทั้งหน้า ไม่ใช่ fetch)
            ↓ 302
   Keycloak (realm pea) — ผู้ใช้กรอก username/password
            ↓ 302
   {API}/auth/callback?code&state  (backend จัดการเอง ผู้ใช้ไม่เห็น)
            ↓ 302
   {FRONTEND_URL}/auth/callback?ticket=<ticket>    ← หน้านี้ frontend ต้องมี
            ↓
   POST {API}/auth/exchange {ticket}               (ticket หมดอายุใน 30 วินาที ใช้ได้ครั้งเดียว)
            ↓
   ได้ {accessToken, refreshToken, bearerType, expiresAt}
            ↓
   เก็บ credential (ที่ไหน: UNKNOWN) → redirect ไปหน้าหลัก
            ↓
   ทุก request: Authorization: Bearer <accessToken>
            ↓
   ใกล้หมดอายุ/401 → POST /auth/refresh-token {refreshToken} → credential ชุดใหม่
            ↓
   Logout → POST /auth/logout {refreshToken} (204) → ลบ credential ฝั่ง client
```

ข้อควรระวัง:
- ห้ามเรียก `/auth/login` ด้วย `fetch` — เป็น redirect chain ไป Keycloak (`API.md`)
- ถ้า `/auth/callback` ถูก render ซ้ำ (React Strict Mode ใน dev เรียก effect 2 ครั้ง) การเรียก `exchange` ครั้งที่สองจะได้ 401 เพราะ ticket ใช้ได้ครั้งเดียว (`GETDEL`) — ต้องกันการเรียกซ้ำ (อนุมานจาก `auth/repository.go`, ไม่ได้ทดสอบ)
- User ใหม่ถูกสร้างในตาราง `users` ตอน callback (ไม่ใช่ตอน exchange) → หลัง login แล้ว API ที่ต้อง JWT จะหา user เจอ
- Redirect URI ที่ลงทะเบียนใน Keycloak คือของ **API** ไม่ใช่ frontend — frontend ไม่ต้องลงทะเบียน redirect URI ใหม่ แต่ต้องตั้ง `FRONTEND_URL` ฝั่ง API ให้ตรงกับ origin จริง

---

## 12. Error Handling

**[exists]:** ไม่มี (`error.tsx`, `not-found.tsx`, `global-error.tsx` ไม่มี; ไม่มี error boundary/toast)

**[contract]** รูปแบบ error ที่ต้องแปลงเป็น UI:

| Status | ความหมาย (จาก backend) |
| --- | --- |
| 400 | input ไม่ถูกต้อง (`message` อาจเป็น `"invalid request"` หรือข้อความ validator) |
| 401 | token ไม่ถูกต้อง/หมดอายุ → refresh หรือ login ใหม่ |
| 403 | ไม่ใช่เจ้าของสูตร (Replace/Delete) |
| 404 | ไม่พบ (`recipe not found`, `user not found`) |
| 500 / 502 | ข้อผิดพลาดฝั่ง server / Keycloak |

---

## 13. Environment Configuration

| ตัวแปร | ที่ตั้ง | ใช้ในโค้ด `web/` หรือไม่ |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | `compose.yml` → service `web` | **ไม่** (ยังไม่มีโค้ดอ่าน) — prefix `NEXT_PUBLIC_` ทำให้ถูก inline ใน client bundle ตอน build/dev |
| `NODE_ENV` | `compose.yml` (`development`) | Next จัดการเอง |
| `.env*` | ถูก ignore ใน `web/.gitignore` และ `web/.dockerignore` (เว้น `.env.example`) | ไม่พบ `.env.example` ใน repo |

ข้อควรรู้: ค่า `NEXT_PUBLIC_*` ถูก bake ตอน dev server เริ่ม/ตอน build — เปลี่ยนใน compose แล้วต้องรีสตาร์ท container (กฎของ Next ทั่วไป, ไม่ได้ทดสอบ)
Secret ห้ามใส่ใน `NEXT_PUBLIC_*` (backend ถือ client secret เองอยู่แล้ว — frontend ไม่เคยเห็น)

---

## 14. Naming and Coding Conventions

จากไฟล์ที่มี (ตัวอย่างน้อย — ระบุเฉพาะที่เห็นจริง):

| หัวข้อ | Convention | หลักฐาน |
| --- | --- | --- |
| ชื่อไฟล์ component | `kebab-case` / ชื่อสั้น (`button.tsx`) | `components/*/button.tsx` |
| ชื่อ component / export | PascalCase, **named export** | `export { Button, buttonVariants }` |
| ไฟล์ของ Next | `layout.tsx`, `page.tsx` (ตามข้อกำหนด App Router) | `web/app/` |
| Import alias | `@/…` เสมอสำหรับของในโปรเจกต์ | `page.tsx` (`@/components/bases/button`) |
| Variant | `cva` + `VariantProps` | `components/*/button.tsx` |
| Class merging | `cn(...)` | `components/*/button.tsx` |
| Styling | Tailwind utility + token (`bg-primary`, `text-muted-foreground`) ไม่ใช้ค่าสีตรงใน component ของ design-system | `components/ui/button.tsx` |
| Quotes/semicolons | **ไม่สม่ำเสมอ** — `ui/button.tsx` (shadcn) ไม่มี `;`, `bases/button.tsx` มี `;`, `page.tsx` import ไม่ใส่ช่องว่างใน `{Button}`; ไม่พบ Prettier config | ไฟล์เหล่านั้น |
| Lint | `eslint-config-next` (core-web-vitals + typescript) | `web/eslint.config.mjs` |
| คอมเมนต์ใน config | ภาษาไทยใน `compose.yml`; Dockerfile ภาษาอังกฤษ | — |

---

## 15. End-to-End Feature Examples

เนื่องจากฝั่ง web ยังไม่มี feature — ตัวอย่างด้านล่างคือ **"เส้นทางที่ frontend ต้องเดิน"** โดยอ้างไฟล์ฝั่ง backend จริง ส่วนไฟล์ฝั่ง web ระบุเป็น *(ต้องสร้าง)*

### Feature A — Login

```text
หน้า (ต้องสร้าง) เช่น app/login/page.tsx หรือ header  →  <Button> จาก @/components/bases/button  [exists]
   ↓ window.location.href = `${API_BASE}/auth/login`
GET /api/v1/auth/login                (api/cmd/api/main.go:121 → auth.handler.Login)
   ↓ 302 → Keycloak → 302 → /api/v1/auth/callback (auth.handler.Callback → service.HandleCallback)
   ↓ 302 → {FRONTEND_URL}/auth/callback?ticket=…
app/auth/callback/page.tsx  (ต้องสร้าง)  →  อ่าน ticket
   ↓ POST /api/v1/auth/exchange {ticket}   (auth.handler.Exchange → service.ExchangeTicket → Redis GETDEL)
เก็บ credential (UNKNOWN) → ไปหน้าสูตรอาหาร
```

### Feature B — แสดงรายการสูตรอาหาร (ค้นหา + กรอง + เพจ)

```text
app/recipes/page.tsx  (ต้องสร้าง)  ← query: name, difficulty, favorite, sort, page, limit
   ↓
API client (ต้องสร้าง)  GET /recipes?…  + Bearer
   ↓
api/cmd/api/main.go:137 → middleware.JWT → recipe.handler.GetRecipes → service.List → repository.List
   ↓
200 {"total": n, "results": [{id,name,description,imageUrl,difficulty{id,name},duration{id,name},
                              ingredients[],instructions[],creator{id,name},isFavorite,rating{average,total},createdAt,updatedAt}]}
   ↓
Component รายการ/การ์ด (ต้องสร้าง) — ใช้ Button/ตัวกรองจาก design system
```

### Feature C — สร้างสูตร

```text
ฟอร์ม (ต้องสร้าง) ฟิลด์: name, description, imageUrl?, difficultyId, durationId, ingredients[{description}], instructions[{description}]
   ↓ POST /recipes + Bearer   (ตรวจสอบ required/url ฝั่ง client ให้ตรงกับ binding tag ใน api/internal/recipe/dto.go — เครื่องมือ validation ฝั่ง client: UNKNOWN)
   ↓ main.go:136 → recipe.handler.Create → service.Create → repository.Create (transaction)
   ↓ 201 {"id": 42}  → นำทางไป /recipes/42
```

---

## 16. Frontend Architecture Rules

กฎที่ **มีหลักฐานซ้ำในโค้ดจริง** ของ `web/` ได้เพียงไม่กี่ข้อ (โค้ดน้อย). กฎจากสัญญา backend ติดป้าย [contract]

```text
FRONTEND-RULE-01  Component ของ design-system ใช้ cva + cn + token (ไม่ hardcode สี)
Evidence: web/components/ui/button.tsx, web/components/bases/button.tsx, web/app/globals.css
Implementation: tokens (globals.css) → cva variants → <Component variant size />

FRONTEND-RULE-02  หน้า (page) import component ของโปรเจกต์จาก @/components/bases/* ไม่ใช่ ui/ ตรงๆ
Evidence: web/app/page.tsx (import { Button } from "@/components/bases/button")
หมายเหตุ: เป็นข้อสังเกตจากตัวอย่างเดียว — ความแน่นอน: ต่ำ

FRONTEND-RULE-03  ใช้ path alias @/* สำหรับ import ภายในโปรเจกต์
Evidence: web/tsconfig.json (paths), web/components.json (aliases), web/app/page.tsx

FRONTEND-RULE-04  เพิ่ม primitive ใหม่ด้วย shadcn CLI ตาม components.json (style base-nova, icon lucide, aliases)
Evidence: web/components.json, web/components/ui/button.tsx (มี data-slot ตามรูปแบบ shadcn)

FRONTEND-RULE-05 [contract]  หน้าไม่เรียก HTTP ตรง — ควรผ่านชั้น API client ที่แนบ Bearer และจัดการ 401/refresh ที่เดียว
Evidence: ข้อกำหนดของ backend (api/docs/API.md: ทุก endpoint ต้อง Bearer; refresh แยก endpoint) — ไม่มีโค้ด implement; เป็นคำแนะนำจากข้อจำกัด ไม่ใช่ pattern ที่มีอยู่

FRONTEND-RULE-06 [contract]  Login ต้องเป็นการ navigate ทั้งหน้าไป {API}/auth/login และมีหน้า /auth/callback เพื่อแลก ticket
Evidence: api/internal/auth/service.go (HandleCallback), api/docs/API.md

FRONTEND-RULE-07 [contract]  ห้ามใส่ secret ใน NEXT_PUBLIC_*; frontend ไม่ถือ Keycloak client secret
Evidence: compose.yml (secret อยู่ที่ service api เท่านั้น), api/internal/config/keycloak.go
```

---

## 17. How to Add a New Page / Feature

ขั้นตอนต่อไปนี้ **สกัดจากสิ่งที่ repo ตั้งไว้แล้ว** (`components.json`, App Router, alias) — ขั้นตอนที่ต้องใช้ส่วนที่ยังไม่มีในโค้ดจะระบุเป็น *(ยังไม่มีแบบอย่าง)*

```text
0. อ่านเอกสาร Next.js ที่ node_modules/next/dist/docs/ ก่อน (ตาม web/AGENTS.md)

1. สร้าง route         web/app/<route>/page.tsx          (ไฟล์ = route; export default function)
   └ ต้องการ layout เฉพาะส่วน → web/app/<route>/layout.tsx  (ใช้ type LayoutProps<"/<route>"> ตามแบบ layout.tsx)

2. เพิ่ม UI primitive   npx shadcn@latest add <name>      → ได้ไฟล์ใน web/components/ui/<name>.tsx (ตาม components.json)
   └ ปรับให้เข้าแบรนด์   คัดลอก/ปรับเป็น web/components/bases/<name>.tsx  (ตามที่ทำกับ button)

3. สร้าง feature component  web/components/<feature>/*.tsx   (โฟลเดอร์ feature: ยังไม่มีแบบอย่าง — แนะนำให้ตั้งชื่อ kebab-case + named export)

4. เชื่อม API           (ยังไม่มีแบบอย่าง) สร้าง client ใน web/lib/ (alias @/lib) และ hook ใน web/hooks/ (alias @/hooks — ต้องสร้างโฟลเดอร์เอง)
   └ ใช้ NEXT_PUBLIC_API_BASE_URL + Bearer ตาม §10; ใช้ DTO ตาม api/docs/API.md

5. Validation ฟอร์ม     (ยังไม่มีแบบอย่าง / เครื่องมือ UNKNOWN) ให้กฎตรงกับ binding tag ใน api/internal/<feature>/dto.go

6. Auth guard           (ยังไม่มีแบบอย่าง) หน้าที่เรียก endpoint ที่ต้อง JWT ต้องมี token ก่อน

7. ตรวจ                npm run lint  ·  npm run dev (หรือ docker compose up web)  ·  เปิด http://localhost:3000/<route>

8. Styling              ใช้ token/utility (bg-primary, text-muted-foreground, …) ไม่ hardcode สี; ถ้าเพิ่ม token ใหม่ ให้ใส่ทั้ง :root และ .dark ใน app/globals.css
```

---

## 18. Important Files

| ไฟล์ | ทำไมสำคัญ |
| --- | --- |
| `web/AGENTS.md` | คำเตือนเรื่อง Next.js 16 breaking changes |
| `web/app/layout.tsx` | root layout / ฟอนต์ / จุดวาง provider ในอนาคต |
| `web/app/globals.css` | design tokens + Tailwind v4 theme |
| `web/components.json` | shadcn config + alias |
| `web/components/bases/button.tsx` | แบบอย่าง component ของโปรเจกต์ |
| `web/components/ui/button.tsx` | แบบอย่างที่ shadcn สร้าง |
| `web/lib/utils.ts` | `cn` |
| `web/tsconfig.json` | alias `@/*` |
| `web/Dockerfile` + `compose.yml` (service `web`) | วิธีรันใน container |
| `api/docs/API.md` | **สัญญาที่ frontend ต้องทำตาม** |
| `api/internal/auth/service.go` | ลำดับ login ที่ฝั่ง frontend ต้องรองรับ |

---

## 19. Reusable Patterns

| Pattern | ที่ | เอาไปใช้ |
| --- | --- | --- |
| shadcn + base-ui + cva + design tokens | `web/components.json`, `components/ui/*`, `globals.css` | เป็นฐาน design system ของ Final Project ได้ทันที (เปลี่ยน token สี/radius) |
| ชั้น `ui/` (generated) + `bases/` (brand-customized) | `web/components/` | แยกของที่ CLI สร้างออกจากของที่ปรับเอง เพื่อ re-generate ได้โดยไม่ทับงาน |
| Token สีเพิ่มเอง (primary-hover/subtle, accent-subtle, success) | `globals.css` | ใช้เป็นรายชื่อ token ตั้งต้น (อย่าลืมค่า dark) |
| Dev container + bind mount + anonymous volumes | `web/Dockerfile`, `compose.yml` | hot-reload ใน Docker |
| Typed `LayoutProps<"/">` | `app/layout.tsx` | typed routes ของ Next 16 |
| (contract) ticket-exchange login | backend | ไม่ต้องใช้ OIDC lib ฝั่ง browser |

ยังไม่มีแบบอย่างที่ reuse ได้: API client, auth provider, route guard, form, data table, toast/error UI

---

## 20. Unknowns

| หัวข้อ | สถานะ |
| --- | --- |
| HTTP client ที่จะใช้ (fetch / axios) | UNKNOWN |
| ที่เก็บ token (memory / localStorage / cookie) และวิธีให้ Server Components เห็น token | UNKNOWN |
| Route guard / `middleware.ts` (หรือชื่อใหม่ใน Next 16) | UNKNOWN — ต้องอ่าน `node_modules/next/dist/docs/` |
| State management / data fetching library | UNKNOWN |
| Form + validation library | UNKNOWN |
| Testing ฝั่ง frontend | UNKNOWN |
| เจตนาของโฟลเดอร์ `components/bases/` | UNKNOWN (อนุมานเท่านั้น) |
| พฤติกรรม `cn` จากแพ็กเกจ `cn` (มี tailwind-merge หรือไม่) | UNKNOWN — ยังไม่ได้ตรวจแพ็กเกจ |
| ฟอนต์ Geist ผูกกับ `font-sans` จริงหรือไม่ (`--font-sans: var(--font-sans)`) | UNKNOWN — needs manual verification |
| CORS ระหว่าง `:3000` → `:8080` กับ header `Authorization` | UNKNOWN — needs manual verification (ดู SYSTEM §15) |
| Production build/deploy ของ web (Dockerfile เป็น dev image เท่านั้น) | UNKNOWN |
| ดีไซน์/หน้าจอที่ตั้งใจให้มี (wireframe) | UNKNOWN — ไม่มีในรีโป |
