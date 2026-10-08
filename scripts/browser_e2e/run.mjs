// Real-browser walk through the checklists of docs/initial/Frontend_PLAN.md (Task 3 Step 3, Task 5-9).
// See README.md in this folder. Needs the compose stack with web on :3000 and KC_ADMIN_PASSWORD in the
// environment. Creates two throwaway Keycloak users and deletes them at the end. Prints no passwords or tokens.
import { chromium } from "playwright-core";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const WEB = process.env.WEB_URL ?? "http://localhost:3000";
const API = process.env.API_URL ?? "http://localhost:8080/api/v1";
const KC = process.env.KC_URL ?? "http://localhost:8180";
const REALM = "pea";
// Any Chrome/Chromium/Edge binary; override with CHROME_PATH (the default is the macOS Chrome).
const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

let failures = 0;
function check(ok, label, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${!ok && detail ? `  [${detail}]` : ""}`);
}

// --- Bangkok calendar helpers (independent of this machine's zone) ---------------------------------------
function bangkokDate(offsetDays) {
  const ms = Date.now() + offsetDays * 86400000;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date(ms)); // YYYY-MM-DD
}

// --- Keycloak admin --------------------------------------------------------------------------------------
async function adminHeaders() {
  const res = await fetch(`${KC}/realms/master/protocol/openid-connect/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "password", client_id: "admin-cli", username: "admin", password: process.env.KC_ADMIN_PASSWORD }),
  });
  const { access_token } = await res.json();
  return { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" };
}
async function createUser(headers, label) {
  const name = `e2e-${label}-${randomBytes(3).toString("hex")}`;
  const user = { email: `${name}@example.com`, password: randomBytes(12).toString("base64url"), firstName: label, lastName: "E2E" };
  const res = await fetch(`${KC}/admin/realms/${REALM}/users`, {
    method: "POST",
    headers,
    body: JSON.stringify({ username: user.email, email: user.email, firstName: user.firstName, lastName: user.lastName, enabled: true, emailVerified: true }),
  });
  user.id = res.headers.get("location").split("/").pop();
  await fetch(`${KC}/admin/realms/${REALM}/users/${user.id}/reset-password`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ type: "password", value: user.password, temporary: false }),
  });
  return user;
}

// --- browser helpers -------------------------------------------------------------------------------------
async function login(page, user) {
  await page.goto(WEB + "/");
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  await page.waitForURL(/keycloak\.localhost/);
  await page.fill("#username", user.email);
  await page.fill("#password", user.password);
  await page.click("#kc-login");
  await page.waitForURL(WEB + "/", { timeout: 20000 });
}
async function see(page, text, timeout = 8000) {
  try {
    await page.getByText(text).first().waitFor({ timeout });
    return true;
  } catch {
    return false;
  }
}
// Calls the API from inside the page with the stored token (setup/cleanup only, not the thing under test).
function apiCall(page, method, p, body) {
  return page.evaluate(
    async ([method, url, body]) => {
      const cred = JSON.parse(localStorage.getItem("bookingtable.credential"));
      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${cred.accessToken}`, "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      return { status: res.status, body: res.status === 204 ? null : await res.json() };
    },
    [method, API + p, body],
  );
}

const admin = await adminHeaders();
const users = [];
const extraRestaurants = [];
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const problems = [];

try {
  const A = await createUser(admin, "owner");
  const B = await createUser(admin, "customer");
  users.push(A, B);

  // The browser pretends to be in New York: every time on screen and sent must still be Bangkok time.
  const ctxA = await browser.newContext({ timezoneId: "America/New_York", locale: "th-TH" });
  const ctxB = await browser.newContext({ timezoneId: "America/New_York", locale: "th-TH" });
  const pa = await ctxA.newPage();
  const pb = await ctxB.newPage();
  for (const [who, p] of [["A", pa], ["B", pb]]) {
    p.on("pageerror", (e) => problems.push(`${who} pageerror: ${e.message}`));
    p.on("console", (m) => {
      if (m.type() === "error") problems.push(`${who} console: ${m.text().slice(0, 160)}`);
    });
  }

  // ======================= Task 3 Step 3: sign in, Strict Mode, refresh page, sign out =====================
  console.log("\n== Task 3: login ==");
  const exchanges = [];
  pa.on("request", (r) => {
    if (r.url().endsWith("/auth/exchange")) exchanges.push(r.method());
  });
  await pa.goto(WEB + "/");
  check(await see(pa, "กรุณาเข้าสู่ระบบ"), "signed out: sign-in card is shown");
  await login(pa, A);
  check(await see(pa, "ออกจากระบบ"), "signed in: header with sign-out is shown");
  check(exchanges.length === 1, "POST /auth/exchange is called exactly once (Strict Mode)", `calls=${exchanges.length}`);
  await pa.reload();
  check(await see(pa, "ออกจากระบบ"), "still signed in after refresh");
  await login(pb, B);
  check(await see(pb, "ออกจากระบบ"), "second account signs in");

  // ======================= Task 4: list, search, sort, pagination ======================================
  console.log("\n== Task 4: list ==");
  await pa.goto(WEB + "/");
  check(await see(pa, "ชาบู"), "seeded restaurants are listed");
  const seedCount = await pa.locator('main a[href^="/restaurants/"]').count();
  check(seedCount >= 5, "cards render with links", `links=${seedCount}`);

  await pa.fill('input[name="name"]', "ชาบู");
  await pa.getByRole("button", { name: "ค้นหา", exact: true }).click();
  await pa.waitForURL(/name=/);
  await pa.waitForTimeout(800);
  const titles = await pa.locator("main a.text-lg").allTextContents();
  check(titles.length > 0 && titles.every((t) => t.includes("ชาบู")), "search by name only returns matching names", JSON.stringify(titles));

  await pa.goto(WEB + "/?name=%25");
  check(await see(pa, "ไม่พบร้านที่ค้นหา"), "searching % is a plain character (no results, no error)");

  await pa.goto(WEB + "/");
  await pa.selectOption('select[aria-label="เรียงลำดับ"]', "rating");
  await pa.waitForURL(/sort=rating/);
  await pa.waitForTimeout(800);
  const ratingTexts = await pa.locator("main .grid > div").evaluateAll((cards) => cards.map((c) => (c.textContent.match(/★ ([0-9.]+)|ยังไม่มีรีวิว/) || [""])[0]));
  const nums = ratingTexts.map((t) => (t.startsWith("★") ? parseFloat(t.slice(2)) : -1));
  check(nums.every((v, i) => i === 0 || v <= nums[i - 1]), "sorted by average rating, unreviewed last", JSON.stringify(ratingTexts));
  check(ratingTexts.includes("ยังไม่มีรีวิว"), "a restaurant without reviews says ยังไม่มีรีวิว");
  await pa.reload();
  check(await pa.locator('select[aria-label="เรียงลำดับ"]').inputValue() === "rating", "sort survives a refresh (state is in the URL)");

  // Make 13+ restaurants visible so the pager has a second page (removed again at the end).
  const everyDay = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, open: "11:00", close: "22:00" }));
  for (let i = 1; i <= 9; i++) {
    const r = await apiCall(pa, "POST", "/restaurants", { name: `หน้าทดสอบ ${i}`, address: "x", seatingCapacity: 4, cancellationLeadMinutes: 30, openingHours: everyDay });
    extraRestaurants.push(r.body.id);
  }
  await pa.goto(WEB + "/");
  check(await see(pa, "หน้า 1 จาก 2"), "pager shows หน้า 1 จาก 2");
  const firstPage = await pa.locator("main a.text-lg").allTextContents();
  await pa.getByRole("button", { name: "ถัดไป" }).click();
  await pa.waitForURL(/page=2/);
  check(await see(pa, "หน้า 2 จาก 2"), "next page changes the URL and shows หน้า 2 จาก 2");
  await pa.waitForTimeout(600);
  const secondPage = await pa.locator("main a.text-lg").allTextContents();
  check(secondPage.length > 0 && secondPage.every((t) => !firstPage.includes(t)), "second page has different restaurants");
  for (const id of extraRestaurants.splice(0)) await apiCall(pa, "DELETE", `/restaurants/${id}`);

  // ======================= Task 7: owner creates a restaurant (Sunday!), picture, delete =================
  console.log("\n== Task 7: owner restaurant ==");
  const shopName = `ชาบูทดสอบ ${randomBytes(2).toString("hex")}`;
  await pa.goto(WEB + "/my/restaurants");
  check(await see(pa, "สร้างร้านใหม่"), "my restaurants page offers to create one");
  await pa.goto(WEB + "/my/restaurants/new");
  await pa.fill("#name", shopName);
  await pa.fill("#address", "99 ถ.ทดสอบ");
  await pa.fill("#capacity", "20");
  await pa.fill("#lead", "29");
  for (const box of await pa.locator('input[type="checkbox"]').all()) await box.check();
  await pa.getByRole("button", { name: "สร้างร้าน" }).click();
  check(await pa.$eval("#lead", (el) => el.validity.rangeUnderflow), "lead time 29 is blocked by the form (min 30)");
  check(new URL(pa.url()).pathname === "/my/restaurants/new", "…and nothing was submitted");
  await pa.fill("#lead", "60");
  await pa.getByRole("button", { name: "สร้างร้าน" }).click();
  await pa.waitForURL(/\/my\/restaurants\/\d+\/edit/, { timeout: 10000 });
  const shopId = pa.url().match(/restaurants\/(\d+)\/edit/)[1];
  check(await see(pa, "แก้ไขร้าน"), `created restaurant ${shopId} and landed on its edit page`);
  check((await pa.locator('input[type="checkbox"]:checked').count()) === 7, "all seven days are saved, including Sunday");

  // picture
  check(await see(pa, "ไม่มีรูป"), "no picture yet: placeholder is shown");
  await pa.setInputFiles('input[type="file"]', { name: "evil.png", mimeType: "image/png", buffer: Buffer.from("not a picture") });
  check(await see(pa, "ไฟล์รูปไม่ถูกต้อง"), "a text file called .png shows ไฟล์รูปไม่ถูกต้อง");
  await pa.setInputFiles('input[type="file"]', { name: "big.png", mimeType: "image/png", buffer: Buffer.alloc(2 * 1024 * 1024 + 1) });
  check(await see(pa, "ไฟล์รูปไม่ถูกต้อง"), "a file over 2 MB is refused before upload");
  const uploadReq = [];
  pa.on("request", (r) => {
    if (r.url().endsWith("/image") && r.method() === "POST") uploadReq.push(r.headers()["content-type"] ?? "");
  });
  await pa.setInputFiles('input[type="file"]', { name: "front.png", mimeType: "image/png", buffer: PNG });
  await pa.waitForSelector('img[alt="รูปร้าน"]', { timeout: 10000 });
  const src = await pa.getAttribute('img[alt="รูปร้าน"]', "src");
  check(src.startsWith(`${API}/uploads/restaurants/`) && src.endsWith(".png"), "picture URL = API base + imageUrl", src);
  check(/^multipart\/form-data; boundary=/.test(uploadReq[0] ?? ""), "upload is multipart with a browser-set boundary", uploadReq[0]);
  await pa.waitForFunction(() => document.querySelector('img[alt="รูปร้าน"]')?.naturalWidth > 0, null, { timeout: 8000 }).catch(() => {});
  check(await pa.evaluate(() => document.querySelector('img[alt="รูปร้าน"]')?.naturalWidth > 0), "the picture actually loads in the page");
  await pa.getByRole("button", { name: "ลบรูป" }).click();
  check(await see(pa, "ไม่มีรูป"), "deleting the picture goes back to the placeholder");
  await pa.setInputFiles('input[type="file"]', { name: "front.png", mimeType: "image/png", buffer: PNG });
  await pa.waitForSelector('img[alt="รูปร้าน"]', { timeout: 10000 });

  // edit + detail page
  await pa.fill("#description", "ชาบูหม้อไฟ ทดสอบ");
  await pa.getByRole("button", { name: "บันทึก", exact: true }).click();
  check(await see(pa, "บันทึกแล้ว"), "saving the edit shows บันทึกแล้ว");
  await pa.goto(`${WEB}/restaurants/${shopId}`);
  check(await see(pa, shopName), "detail page opens");
  const sundayRow = await pa.locator("table tr", { hasText: "อาทิตย์" }).textContent();
  check(sundayRow.includes("11:00") && sundayRow.includes("22:00"), "Sunday hours are shown on the detail page", sundayRow);
  check(await see(pa, "ร้านของคุณ ไม่สามารถรีวิวได้"), "owner sees no review form");
  check(await see(pa, "จัดการร้าน"), "owner sees the manage link");
  check((await pa.locator('img[alt="' + shopName + '"]').count()) === 1, "detail page shows the picture");

  // ======================= Task 5: customer books and reviews ============================================
  console.log("\n== Task 5: customer ==");
  const tomorrow = bangkokDate(1);
  const yesterday = bangkokDate(-1);
  const bookingBodies = [];
  pb.on("request", (r) => {
    if (r.method() === "POST" && r.url().endsWith(`/restaurants/${shopId}/reservations`)) bookingBodies.push(JSON.parse(r.postData()));
  });
  await pb.goto(WEB + "/");
  await pb.fill('input[name="name"]', shopName);
  await pb.getByRole("button", { name: "ค้นหา", exact: true }).click();
  await pb.getByRole("link", { name: shopName }).first().click();
  check(await see(pb, "จองโต๊ะ"), "customer finds the restaurant by name and opens it");
  check(await see(pb, "ยังไม่มีรีวิว"), "no reviews yet: empty state is shown");
  check((await pb.getByText("เขียนรีวิว").count()) > 0 && (await pb.getByText("ร้านของคุณ").count()) === 0, "customer sees the review form");

  async function book(page, start, end, guests) {
    await page.fill("#start", start);
    await page.fill("#end", end);
    await page.fill("#guests", String(guests));
    await page.getByRole("button", { name: "จองโต๊ะ" }).click();
  }
  await book(pb, `${tomorrow}T18:00`, `${tomorrow}T20:00`, 12);
  check(await see(pb, "จองสำเร็จ"), "12 guests 18:00-20:00 tomorrow: จองสำเร็จ");
  check(bookingBodies[0]?.startAt === `${tomorrow}T18:00:00+07:00` && bookingBodies[0]?.endAt === `${tomorrow}T20:00:00+07:00`,
    "sent times carry +07:00 even though the browser is in New York", JSON.stringify(bookingBodies[0]));
  await book(pb, `${tomorrow}T18:00`, `${tomorrow}T20:00`, 12);
  check(await see(pb, "ที่นั่งไม่พอสำหรับช่วงเวลานี้"), "another 12 at the same time: ที่นั่งไม่พอ");
  await book(pb, `${tomorrow}T20:00`, `${tomorrow}T21:00`, 12);
  check(await see(pb, "จองสำเร็จ"), "12 guests 20:00-21:00 (back to back): จองสำเร็จ");
  await book(pb, `${tomorrow}T23:00`, `${tomorrow}T23:30`, 2);
  check(await see(pb, "เวลาที่เลือกอยู่นอกเวลาเปิดทำการของร้าน"), "outside opening hours: Thai message");
  await book(pb, `${yesterday}T18:00`, `${yesterday}T19:00`, 2);
  check(await see(pb, "ไม่สามารถจองย้อนหลังได้"), "in the past: Thai message");

  // review
  async function review(page, stars, text) {
    await page.getByRole("button", { name: `${stars} ดาว` }).click();
    await page.fill('textarea[aria-label="ข้อความรีวิว"]', text);
    await page.getByRole("button", { name: /ส่งรีวิว|บันทึกการแก้ไข/ }).click();
  }
  const sendBtn = pb.getByRole("button", { name: "ส่งรีวิว" });
  check(await sendBtn.isDisabled(), "send review is disabled until a star and text are given");
  await review(pb, 4, "อร่อยดี");
  check(await see(pb, "★ 4.0"), "rating becomes ★ 4.0 after a 4-star review");
  check(await see(pb, "แก้ไขรีวิวของคุณ"), "the form switches to edit mode");
  await pb.reload();
  check(await see(pb, "แก้ไขรีวิวของคุณ") && (await pb.inputValue('textarea[aria-label="ข้อความรีวิว"]')) === "อร่อยดี", "reopening shows edit mode with the old text");
  await review(pb, 5, "อร่อยมาก");
  check(await see(pb, "★ 5.0"), "editing to 5 stars gives ★ 5.0 (1 รีวิว)");
  check((await pb.getByText("(1 รีวิว)").count()) > 0, "still one review, not two");

  // ======================= Task 6: my reservations ======================================================
  console.log("\n== Task 6: my reservations ==");
  await pb.goto(WEB + "/my/reservations");
  check(await see(pb, shopName), "my reservations lists the restaurant");
  const items = pb.locator("main ul > li");
  check((await items.count()) === 2, "two reservations", `count=${await items.count()}`);
  const firstText = await items.nth(0).textContent();
  check(/18:00|20:00|21:00/.test(firstText) && /ยืนยันแล้ว/.test(firstText), "times are shown in Bangkok time, status ยืนยันแล้ว", firstText);
  // list is newest start first: item 0 = 20:00-21:00, item 1 = 18:00-20:00
  const evening = items.filter({ hasText: "12 คน" }).filter({ hasText: "20:00" }).first();
  const early = items.filter({ hasText: "18:00" }).first();
  await early.getByRole("button", { name: "แก้ไข" }).click();
  await pb.fill(`input[type="number"]`, "10");
  await pb.getByRole("button", { name: "บันทึก", exact: true }).click();
  check(await see(pb, "10 คน"), "editing guests 12 → 10 shows the new value");
  // make the evening booking clash with the early one (10 + 12 > 20)
  await evening.getByRole("button", { name: "แก้ไข" }).click();
  const eveningItem = pb.locator("main ul > li", { has: pb.locator('input[type="number"]') });
  const dt = eveningItem.locator('input[type="datetime-local"]');
  await dt.nth(0).fill(`${tomorrow}T18:00`);
  await dt.nth(1).fill(`${tomorrow}T20:00`);
  await eveningItem.getByRole("button", { name: "บันทึก", exact: true }).click();
  check(await see(pb, "ที่นั่งไม่พอสำหรับช่วงเวลานี้"), "an edit that overfills the restaurant shows ที่นั่งไม่พอ under that item");
  await eveningItem.getByRole("button", { name: "ปิด" }).click();
  pb.once("dialog", (d) => d.accept());
  await pb.locator("main ul > li").filter({ hasText: "20:00" }).filter({ hasText: "21:00" }).getByRole("button", { name: "ยกเลิก" }).click();
  check(await see(pb, "ยกเลิกแล้ว"), "cancelling marks the booking ยกเลิกแล้ว");
  check((await pb.getByRole("button", { name: "ยกเลิก" }).count()) === 1, "its buttons are gone; the other booking keeps its cancel button");

  // ======================= Task 8: owner's view =========================================================
  console.log("\n== Task 8: owner reservations ==");
  await pa.goto(`${WEB}/my/restaurants/${shopId}/reservations`);
  check(await see(pa, "การจองของร้าน") && (await see(pa, "Customer")), "owner sees bookings with the customer's name");
  const table = await pa.locator("table").textContent();
  check(!table.includes("@"), "no email address on the page");
  await pa.selectOption('select[aria-label="กรองตามสถานะ"]', "cancelled");
  await pa.waitForTimeout(800);
  check((await pa.locator("tbody tr").count()) === 1, "filter ยกเลิกแล้ว shows one row");
  await pa.selectOption('select[aria-label="กรองตามสถานะ"]', "confirmed");
  await pa.waitForTimeout(800);
  check((await pa.locator("tbody tr").count()) === 1, "filter ยืนยันแล้ว shows one row");
  await pb.goto(`${WEB}/my/restaurants/${shopId}/reservations`);
  check(await see(pb, "คุณไม่มีสิทธิ์ทำรายการนี้"), "another user opening that URL sees คุณไม่มีสิทธิ์ทำรายการนี้");
  await pb.goto(`${WEB}/my/restaurants/${shopId}/edit`);
  check(await see(pb, "คุณไม่มีสิทธิ์แก้ร้านนี้"), "another user opening the edit page sees คุณไม่มีสิทธิ์แก้ร้านนี้");

  // ======================= Task 7 end: delete guard, then delete ========================================
  console.log("\n== delete guard ==");
  await pa.goto(WEB + "/my/restaurants");
  pa.on("dialog", (d) => d.accept());
  const card = pa.locator("main .grid > div", { hasText: shopName });
  await card.getByRole("button", { name: "ลบ" }).click();
  check(await see(pa, "ลบร้านไม่ได้ เพราะยังมีการจองที่ค้างอยู่"), "delete with an active booking: blocked with the Thai message");
  await pb.goto(WEB + "/my/reservations");
  pb.on("dialog", (d) => d.accept());
  await pb.getByRole("button", { name: "ยกเลิก" }).click();
  await pb.waitForTimeout(800);
  await pa.reload();
  await pa.locator("main .grid > div", { hasText: shopName }).getByRole("button", { name: "ลบ" }).click();
  await pa.waitForTimeout(1200);
  check((await pa.locator("main .grid > div", { hasText: shopName }).count()) === 0, "after the booking is cancelled the restaurant can be deleted");
  await pb.goto(WEB + "/my/reservations");
  check(await see(pb, shopName), "the customer still sees the deleted restaurant's name in old bookings");

  // ======================= Review focus 2 + checklist 8: expired token ==================================
  console.log("\n== expired token ==");
  const refreshCalls = [];
  pb.on("request", (r) => {
    if (r.url().endsWith("/auth/refresh-token")) refreshCalls.push(r.method());
  });
  await pb.goto(`${WEB}/restaurants/9001`); // loads two endpoints at once
  await see(pb, "ชาบูทองคำ");
  await pb.waitForTimeout(500); // let this first load finish before the token is spoiled
  await pb.evaluate(() => {
    const c = JSON.parse(localStorage.getItem("bookingtable.credential"));
    c.accessToken = "garbage";
    localStorage.setItem("bookingtable.credential", JSON.stringify(c));
  });
  refreshCalls.length = 0;
  await pb.reload();
  check(await see(pb, "ชาบูทองคำ"), "with a garbage access token the page still loads after refresh");
  check(refreshCalls.length === 1, "exactly one POST /auth/refresh-token for two concurrent 401s", `calls=${refreshCalls.length}`);
  const loginHits = [];
  pb.on("request", (r) => {
    if (r.url() === `${API}/auth/login`) loginHits.push(r.url());
  });
  await pb.evaluate(() => {
    const c = JSON.parse(localStorage.getItem("bookingtable.credential"));
    c.accessToken = "garbage";
    c.refreshToken = "garbage";
    localStorage.setItem("bookingtable.credential", JSON.stringify(c));
  });
  await pb.reload();
  // The browser still has a Keycloak SSO session, so sign-in completes by itself and lands back on the app
  // with a fresh credential. Without that session it would stop on the Keycloak form.
  await pb
    .waitForFunction(() => {
      const raw = localStorage.getItem("bookingtable.credential");
      return raw && JSON.parse(raw).accessToken !== "garbage";
    }, null, { timeout: 20000 })
    .catch(() => {});
  check(loginHits.length >= 1, "a dead refresh token sends the browser to /auth/login", `hits=${loginHits.length}`);
  const fresh = await pb.evaluate(() => JSON.parse(localStorage.getItem("bookingtable.credential") ?? "null")?.refreshToken);
  check(fresh && fresh !== "garbage", "…and (SSO session alive) the user is signed in again with a new credential");

  // ======================= fixes from the review round ==================================================
  console.log("\n== review fixes ==");
  await pa.goto(WEB + "/?page=500");
  check((await see(pa, "ไม่มีรายการในหน้านี้")) && (await see(pa, "กลับไปหน้าแรก")), "page beyond the end says ไม่มีรายการในหน้านี้ with a way back");
  await pa.getByRole("button", { name: "กลับไปหน้าแรก" }).click();
  check(await see(pa, "ชาบูทองคำ"), "…and the way back lists restaurants again");
  await pa.goto(WEB + "/?page=2000000");
  check((await see(pa, "ไม่มีรายการในหน้านี้")) && (await pa.locator('main [role="alert"]').count()) === 0, "a huge page number is clamped: no 400 error banner");

  const bookings = [];
  pb.on("request", (r) => {
    if (r.method() === "POST" && r.url().endsWith("/restaurants/9001/reservations")) bookings.push(r.url());
  });
  await pb.goto(WEB + "/restaurants/9001");
  await see(pb, "จองโต๊ะ");
  await pb.fill("#start", `${tomorrow}T20:00`);
  await pb.fill("#end", `${tomorrow}T18:00`);
  await pb.fill("#guests", "2");
  await pb.getByRole("button", { name: "จองโต๊ะ" }).click();
  check(await see(pb, "เวลาสิ้นสุดต้องหลังเวลาเริ่ม"), "end before start: explained in Thai");
  await pb.waitForTimeout(500);
  check(bookings.length === 0, "…and no request was sent");

  await pa.goto(WEB + "/my/restaurants/new");
  await pa.fill("#name", "   ");
  await pa.fill("#address", "   ");
  await pa.locator('input[type="checkbox"]').first().check();
  await pa.getByRole("button", { name: "สร้างร้าน" }).click();
  check(await see(pa, "กรุณากรอกชื่อร้านและที่อยู่"), "blank name/address: explained before sending");
  await pa.locator('input[type="checkbox"]').nth(1).check();
  await pa.fill('input[aria-label="จันทร์ เวลาเปิด"]', "");
  check(await pa.$eval('input[aria-label="จันทร์ เวลาเปิด"]', (el) => el.validity.valueMissing), "an emptied opening time is blocked by the form");

  const creates = [];
  pa.on("request", (r) => {
    if (r.method() === "POST" && r.url() === `${API}/restaurants`) creates.push(1);
  });
  await pa.goto(WEB + "/my/restaurants/new");
  const dupName = `ซ้ำทดสอบ ${randomBytes(2).toString("hex")}`;
  await pa.fill("#name", dupName);
  await pa.fill("#address", "x");
  await pa.locator('input[type="checkbox"]').first().check();
  await pa.getByRole("button", { name: "สร้างร้าน" }).dblclick();
  await pa.waitForURL(/\/my\/restaurants\/\d+\/edit/, { timeout: 10000 });
  await pa.waitForTimeout(500);
  check(creates.length === 1, "double-clicking สร้างร้าน creates one restaurant", `POSTs=${creates.length}`);
  const dupId = pa.url().match(/restaurants\/(\d+)\/edit/)[1];
  await apiCall(pa, "DELETE", `/restaurants/${dupId}`);

  // ======================= sign out =====================================================================
  console.log("\n== sign out ==");
  await pa.goto(WEB + "/");
  await pa.getByRole("button", { name: "ออกจากระบบ" }).click();
  check(await see(pa, "กรุณาเข้าสู่ระบบ"), "sign out returns to the sign-in card");
} catch (err) {
  failures++;
  console.log("FAIL  script error:", err.message);
} finally {
  // cleanup: the throwaway Keycloak users
  for (const u of users) await fetch(`${KC}/admin/realms/${REALM}/users/${u.id}`, { method: "DELETE", headers: admin });
  await browser.close();
}

if (problems.length) {
  console.log("\nBrowser console/page errors seen:");
  for (const p of [...new Set(problems)].slice(0, 12)) console.log("  - " + p);
} else console.log("\nNo console errors or page errors (including CORS) were seen.");
console.log(`extra pager-test restaurants to remove: ${extraRestaurants.join(",") || "none"}`);
console.log(failures ? `\n${failures} CHECK(S) FAILED` : "\nALL CHECKS PASSED");
process.exit(failures ? 1 : 0);
