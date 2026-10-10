// Screenshots of every screen and state, for the design hand-off in docs/design/screens.
//   set -a; . ./.env; set +a; node scripts/browser_e2e/design_screens.mjs
// Needs the compose stack (web on :3000) and KC_ADMIN_PASSWORD. It creates three throwaway Keycloak users and a
// couple of demo restaurants with bookings and reviews (so full / almost full / closed hours exist), takes the
// pictures, then removes what it can through the API. Rows it cannot remove (cancelled bookings, reviews, the
// users table entries) are named e2e-design-* and are deleted with SQL, see docs/design/README.md.
import { chromium } from "playwright-core";
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "../..");
const OUT = path.join(ROOT, "docs/design/screens");
const SEED_IMAGES = path.join(ROOT, "api/seed/images");
const WEB = process.env.WEB_URL ?? "http://localhost:3000";
const API = process.env.API_URL ?? "http://localhost:8080/api/v1";
const KC = process.env.KC_URL ?? "http://localhost:8180";
const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const REALM = "pea";

// sharp (a dependency of Next.js) only shrinks the PNGs; without it they are written as they come.
let sharp = null;
try {
  sharp = createRequire(import.meta.url)(path.join(ROOT, "web/node_modules/sharp"));
} catch {
  console.log("sharp not found: screenshots are saved uncompressed");
}

fs.mkdirSync(OUT, { recursive: true });
const written = [];
async function shot(page, name, { full = true } = {}) {
  await page.waitForFunction(() => [...document.images].every((img) => img.complete), null, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(500);
  // The round "N" of Next's dev tools is not part of the design.
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  const buffer = await page.screenshot({ fullPage: full });
  const file = path.join(OUT, `${name}.png`);
  if (sharp) await sharp(buffer).png({ compressionLevel: 9, palette: true, quality: 90 }).toFile(file);
  else fs.writeFileSync(file, buffer);
  written.push(`${name}.png`);
}

function bangkokDate(offsetDays) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date(Date.now() + offsetDays * 86400000));
}
const weekdayOf = (key) => new Date(`${key}T00:00:00Z`).getUTCDay(); // 0 = Sunday
const offsetOf = (key) => [0, 1, 2, 3, 4, 5, 6, 7, 8].findIndex((offset) => bangkokDate(offset) === key);
// The restaurant page's day strip: today is tile 0.
const pickDay = (page, key) => page.getByRole("group", { name: "เลือกวัน" }).getByRole("button").nth(offsetOf(key)).click();

async function adminHeaders() {
  const res = await fetch(`${KC}/realms/master/protocol/openid-connect/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "password", client_id: "admin-cli", username: "admin", password: process.env.KC_ADMIN_PASSWORD }),
  });
  return { Authorization: `Bearer ${(await res.json()).access_token}`, "Content-Type": "application/json" };
}
async function createUser(headers, label, firstName, lastName) {
  const email = `e2e-design-${label}-${randomBytes(3).toString("hex")}@example.com`;
  const user = { email, password: randomBytes(12).toString("base64url") };
  const res = await fetch(`${KC}/admin/realms/${REALM}/users`, {
    method: "POST",
    headers,
    body: JSON.stringify({ username: email, email, firstName, lastName, enabled: true, emailVerified: true }),
  });
  user.id = res.headers.get("location").split("/").pop();
  await fetch(`${KC}/admin/realms/${REALM}/users/${user.id}/reset-password`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ type: "password", value: user.password, temporary: false }),
  });
  return user;
}
async function login(page, user) {
  await page.goto(WEB + "/");
  await page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
  await page.waitForURL(/keycloak\.localhost/);
  await page.fill("#username", user.email);
  await page.fill("#password", user.password);
  await page.click("#kc-login");
  await page.waitForURL(WEB + "/", { timeout: 20000 });
}
// Calls the API from inside the page with its stored token (setup and cleanup only).
const apiCall = (page, method, p, body) =>
  page.evaluate(
    async ([method, url, body]) => {
      const cred = JSON.parse(localStorage.getItem("bookingtable.credential"));
      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${cred.accessToken}`, "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const text = await res.text();
      return { status: res.status, body: text ? JSON.parse(text) : null };
    },
    [method, API + p, body],
  );
const uploadPicture = (page, restaurantId, file) =>
  page.evaluate(
    async ([url, base64]) => {
      const cred = JSON.parse(localStorage.getItem("bookingtable.credential"));
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const form = new FormData();
      form.append("file", new Blob([bytes], { type: "image/jpeg" }), "photo.jpg");
      const res = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${cred.accessToken}` }, body: form });
      return res.status;
    },
    [`${API}/restaurants/${restaurantId}/image`, fs.readFileSync(path.join(SEED_IMAGES, file)).toString("base64")],
  );
const must = (result, what) => {
  if (result.status >= 300) throw new Error(`${what} failed: ${result.status} ${JSON.stringify(result.body)}`);
  return result.body;
};

const admin = await adminHeaders();
const users = [];
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const desktop = { viewport: { width: 1200, height: 800 }, locale: "th-TH", timezoneId: "Asia/Bangkok" };
const phone = { viewport: { width: 390, height: 800 }, locale: "th-TH", timezoneId: "Asia/Bangkok" };
let pa, pb;
const made = { restaurants: [], reservationsB: [], reservationA: null };

try {
  const A = await createUser(admin, "owner", "สมชาย", "เจ้าของร้าน");
  const B = await createUser(admin, "customer", "สมศรี", "ใจดี");
  const C = await createUser(admin, "newcomer", "มานะ", "มาใหม่");
  users.push(A, B, C);

  const out = await browser.newContext(desktop);
  const ctxA = await browser.newContext(desktop);
  const ctxB = await browser.newContext(desktop);
  const ctxC = await browser.newContext(desktop);
  const po = await out.newPage();
  pa = await ctxA.newPage();
  pb = await ctxB.newPage();
  const pc = await ctxC.newPage();
  await login(pa, A);
  await login(pb, B);
  await login(pc, C);

  // ---- demo data -------------------------------------------------------------------------------------------
  const nonSundays = [1, 2, 3, 4, 5, 6, 7, 8].map(bangkokDate).filter((key) => weekdayOf(key) !== 0);
  const [day, day2] = nonSundays;
  const sunday = [1, 2, 3, 4, 5, 6, 7].map(bangkokDate).find((key) => weekdayOf(key) === 0);
  const hours = (days, open, close) => days.map((weekday) => ({ weekday, open, close }));

  const r1 = must(
    await apiCall(pa, "POST", "/restaurants", {
      name: "ชาบูริมคลอง",
      address: "88 ถ.เจริญกรุง แขวงบางรัก กรุงเทพฯ",
      description: "ชาบูหม้อไฟ น้ำซุปเข้มข้น เนื้อสดส่งทุกเช้า นั่งริมคลองบรรยากาศดี",
      seatingCapacity: 10,
      cancellationLeadMinutes: 60,
      openingHours: hours([1, 2, 3, 4, 5, 6], "11:00", "22:00"), // closed on Sunday
    }),
    "create restaurant 1",
  ).id;
  const r2 = must(
    await apiCall(pa, "POST", "/restaurants", {
      name: "ปิ้งย่างเตาถ่านลุงแดง",
      address: "12 ซ.อารีย์ 4 แขวงสามเสนใน กรุงเทพฯ",
      description: "หมูหมักสูตรเด็ด ย่างเตาถ่าน เสิร์ฟพร้อมน้ำจิ้มแจ่ว",
      seatingCapacity: 24,
      cancellationLeadMinutes: 120,
      openingHours: hours([0, 1, 2, 3, 4, 5, 6], "10:00", "23:00"),
    }),
    "create restaurant 2",
  ).id;
  made.restaurants.push(r1, r2);
  await uploadPicture(pa, r1, "9001-seed.jpg");
  await uploadPicture(pa, r2, "9004-seed.jpg");

  const book = (page, restaurantId, d, from, to, guests) =>
    apiCall(page, "POST", `/restaurants/${restaurantId}/reservations`, { startAt: `${d}T${from}:00+07:00`, endAt: `${d}T${to}:00+07:00`, guests });
  // r1 on `day`: 18-20 has 6 (B), 19-20 adds 4 (A) -> 19:00 is full, 20-21 has 7 -> almost full
  made.reservationsB.push(must(await book(pb, r1, day, "18:00", "20:00", 6), "B books 18-20").id);
  made.reservationsB.push(must(await book(pb, r1, day, "20:00", "21:00", 7), "B books 20-21").id);
  made.reservationA = must(await book(pa, r1, day, "19:00", "20:00", 4), "A books 19-20").id;
  // B: one more confirmed booking at a seed restaurant, and two that get cancelled (one at r1, one at a seed restaurant)
  made.reservationsB.push(must(await book(pb, 9001, day, "12:00", "13:00", 2), "B books 9001").id);
  const cancelledSeed = must(await book(pb, 9002, day, "18:00", "19:00", 2), "B books 9002").id;
  const cancelledOwn = must(await book(pb, r1, day2, "12:00", "13:00", 2), "B books r1 day2").id;
  for (const id of [cancelledSeed, cancelledOwn]) must(await apiCall(pb, "POST", `/reservations/${id}/cancel`), "B cancels");
  made.reservationsB.push(cancelledSeed, cancelledOwn);
  must(await apiCall(pb, "POST", `/restaurants/${r1}/reviews`, { rating: 4, comment: "น้ำซุปเข้มข้นดี เนื้อสด แต่รอคิวนานนิดหน่อย" }), "B reviews r1");
  must(await apiCall(pb, "POST", `/restaurants/${r2}/reviews`, { rating: 5, comment: "หมูหมักได้รสมาก เตาถ่านหอม พนักงานบริการดี" }), "B reviews r2");

  // ---- signed out ------------------------------------------------------------------------------------------
  console.log("signed out");
  await po.goto(WEB + "/");
  await po.getByText("Find a table. Find your food.").waitFor();
  await shot(po, "01-landing");
  await po.goto(WEB + "/no-such-page");
  await po.getByText("404 — Table Not Found").waitFor();
  await shot(po, "02-not-found");

  // ---- customer with history (B) ---------------------------------------------------------------------------
  console.log("customer");
  await pb.goto(WEB + "/");
  await pb.getByText("การจองถัดไปของคุณ").waitFor();
  await pb.getByText("ร้านคะแนนสูงสุด").waitFor();
  await shot(pb, "03-home");
  await pb.goto(WEB + "/?name=zzz");
  await pb.getByText("ไม่พบร้านที่ค้นหา").first().waitFor();
  await shot(pb, "04-home-search-empty");
  await pb.goto(WEB + "/my/profile");
  await pb.getByText("น้ำซุปเข้มข้นดี").waitFor();
  await shot(pb, "07-profile");
  await pb.goto(WEB + "/my/reservations");
  await pb.getByText("ยกเลิกแล้ว").first().waitFor();
  await shot(pb, "10-my-reservations");
  await pb.getByRole("button", { name: "แก้ไข" }).first().click();
  await pb.getByRole("button", { name: "บันทึก", exact: true }).waitFor();
  await shot(pb, "10b-my-reservations-editing");

  // ---- owner (A) -------------------------------------------------------------------------------------------
  console.log("owner");
  await pa.goto(`${WEB}/restaurants/${r1}`);
  await pa.getByText("ร้านของคุณ ไม่สามารถรีวิวได้").waitFor();
  await pickDay(pa, day);
  await pa.getByText("เต็ม", { exact: true }).first().waitFor();
  await shot(pa, "06-restaurant-owner-view");
  await pa.goto(WEB + "/my/restaurants");
  await pa.getByText("ปิ้งย่างเตาถ่านลุงแดง").first().waitFor();
  await shot(pa, "08-my-restaurants");
  await pa.goto(`${WEB}/my/restaurants/${r1}/reservations`);
  await pa.getByText("สมศรี").first().waitFor();
  await shot(pa, "09-owner-reservations");
  await pa.goto(WEB + "/my/restaurants/new");
  await pa.getByRole("button", { name: "สร้างร้าน" }).waitFor();
  await shot(pa, "11-restaurant-form-new");
  await pa.goto(`${WEB}/my/restaurants/${r1}/edit`);
  await pa.waitForSelector('img[alt="รูปร้าน"]');
  await shot(pa, "12-restaurant-form-edit");

  // ---- newcomer without any data (C) -----------------------------------------------------------------------
  console.log("newcomer");
  await pc.goto(`${WEB}/restaurants/${r1}`);
  await pc.getByText("ช่วงว่าง").first().waitFor();
  await shot(pc, "05a-restaurant-today");
  await pickDay(pc, day);
  await pc.getByText("เต็ม", { exact: true }).first().waitFor();
  await shot(pc, "05-restaurant-customer-view");
  await pc.getByRole("button", { name: /^11:00–12:00/ }).click();
  await pc.waitForTimeout(700);
  await shot(pc, "05b-restaurant-slot-picked");
  // 18:00 for two hours reaches into the full 19:00 hour: five guests cannot be seated
  await pc.getByRole("button", { name: /^18:00–/ }).click();
  await pc.getByRole("button", { name: "2 ชม." }).click();
  for (let i = 0; i < 3; i++) await pc.getByRole("button", { name: "เพิ่มจำนวนคน" }).click();
  await pc.getByRole("button", { name: "จองโต๊ะ" }).click();
  await pc.getByText("ที่นั่งไม่พอสำหรับช่วงเวลานี้").first().waitFor();
  await shot(pc, "05c-restaurant-booking-error");
  await pickDay(pc, sunday);
  await pc.getByText("ร้านปิดวันอาทิตย์").waitFor();
  await shot(pc, "13-availability-closed-day");
  await pc.goto(WEB + "/my/reservations");
  await pc.getByText("ยังไม่มีการจอง").waitFor();
  await shot(pc, "15-empty-my-reservations");
  await pc.goto(WEB + "/my/restaurants");
  await pc.getByText("คุณยังไม่มีร้าน").waitFor();
  await shot(pc, "16-empty-my-restaurants");
  await pc.goto(WEB + "/my/profile");
  await pc.getByText("ยังไม่ได้เขียนรีวิว").waitFor();
  await shot(pc, "17-profile-empty");
  // loading: hold the list request back so the skeleton is on screen
  await pc.route(/\/api\/v1\/restaurants\?/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    await route.continue().catch(() => {});
  });
  await pc.goto(WEB + "/");
  await pc.getByLabel("กำลังโหลดรายการร้าน").waitFor();
  await shot(pc, "18-home-loading", { full: false });
  await pc.unroute(/\/api\/v1\/restaurants\?/);
  // error: the list request fails
  await pc.route(/\/api\/v1\/restaurants\?/, (route) => route.abort());
  await pc.goto(WEB + "/");
  await pc.getByRole("button", { name: "ลองอีกครั้ง" }).first().waitFor();
  await shot(pc, "19-home-error", { full: false });
  await pc.unroute(/\/api\/v1\/restaurants\?/);

  // ---- phone (390px) ---------------------------------------------------------------------------------------
  console.log("phone");
  const mOut = await browser.newContext(phone);
  const mp = await mOut.newPage();
  await mp.goto(WEB + "/");
  await mp.getByText("Find a table. Find your food.").waitFor();
  await shot(mp, "m01-landing");
  for (const [name, ctx, url, wait] of [
    ["m02-home", ctxB, "/", "การจองถัดไปของคุณ"],
    ["m03-restaurant", ctxC, `/restaurants/${r1}`, "ช่วงว่าง"],
    ["m04-profile", ctxB, "/my/profile", "น้ำซุปเข้มข้นดี"],
    ["m05-my-restaurants", ctxA, "/my/restaurants", "ปิ้งย่างเตาถ่านลุงแดง"],
    ["m06-owner-reservations", ctxA, `/my/restaurants/${r1}/reservations`, "สมศรี"],
    ["m07-restaurant-form", ctxA, "/my/restaurants/new", "สร้างร้าน"],
  ]) {
    const context = await browser.newContext({ ...phone, storageState: await ctx.storageState() });
    const page = await context.newPage();
    await page.goto(WEB + url);
    await page.getByText(wait).first().waitFor();
    if (name === "m03-restaurant") {
      await pickDay(page, day);
      await page.getByText("เต็ม", { exact: true }).first().waitFor();
    }
    await shot(page, name);
    await context.close();
  }
} catch (err) {
  console.log("SCRIPT ERROR:", err.message);
  process.exitCode = 1;
} finally {
  // Give back what the API lets us give back; the rest is named e2e-design-* (see docs/design/README.md).
  try {
    for (const id of made.reservationsB) await apiCall(pb, "POST", `/reservations/${id}/cancel`);
    if (made.reservationA) await apiCall(pa, "POST", `/reservations/${made.reservationA}/cancel`);
    for (const id of made.restaurants) {
      await apiCall(pa, "DELETE", `/restaurants/${id}/image`);
      await apiCall(pa, "DELETE", `/restaurants/${id}`);
    }
  } catch (err) {
    console.log("cleanup through the API failed:", err.message);
  }
  for (const user of users) await fetch(`${KC}/admin/realms/${REALM}/users/${user.id}`, { method: "DELETE", headers: admin });
  await browser.close();
}
console.log(`${written.length} screenshots in docs/design/screens:`);
for (const name of written) console.log("  " + name);
