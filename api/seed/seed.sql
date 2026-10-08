-- Sample data: five shabu / yakiniku restaurants with opening hours, reviews and bookings.
--
--   docker compose exec -T postgres psql -U postgres -d bookingtable -v ON_ERROR_STOP=1 < api/seed/seed.sql
--
-- Safe to run again: it removes what an earlier run created (and any bookings or reviews that
-- other users added to these restaurants) and inserts it afresh, so the sample reservations are
-- always "tomorrow". The sample people (uid 'seed-...') cannot log in; real accounts are
-- created by logging in through Keycloak.
--
-- The pictures are files, not rows: after this, run scripts/seed_images.sh to put them in the upload volume.
--
-- Run it after `goose up`. It is not a migration: it must never run in production.

BEGIN;

-- ---------------------------------------------------------------- clear earlier seed data
DELETE FROM reviews
WHERE restaurant_id BETWEEN 9001 AND 9005
   OR user_id IN (SELECT id FROM users WHERE uid LIKE 'seed-%');

DELETE FROM reservations
WHERE restaurant_id BETWEEN 9001 AND 9005
   OR user_id IN (SELECT id FROM users WHERE uid LIKE 'seed-%');

DELETE FROM restaurant_opening_hours WHERE restaurant_id BETWEEN 9001 AND 9005;

DELETE FROM restaurants
WHERE id BETWEEN 9001 AND 9005
   OR owner_id IN (SELECT id FROM users WHERE uid LIKE 'seed-%');

DELETE FROM users WHERE uid LIKE 'seed-%';

-- ---------------------------------------------------------------- people
INSERT INTO users (id, email, name, uid) VALUES
  ('5eed0000-0000-4000-8000-000000000001', 'seed-owner-1@example.com', 'คุณสมชาย เจ้าของร้าน', 'seed-owner-1'),
  ('5eed0000-0000-4000-8000-000000000002', 'seed-owner-2@example.com', 'คุณวิไล เจ้าของร้าน',   'seed-owner-2'),
  ('5eed0000-0000-4000-8000-000000000003', 'seed-user-1@example.com',  'สมศรี',                  'seed-user-1'),
  ('5eed0000-0000-4000-8000-000000000004', 'seed-user-2@example.com',  'สมหมาย',                 'seed-user-2'),
  ('5eed0000-0000-4000-8000-000000000005', 'seed-user-3@example.com',  'นภัส',                   'seed-user-3');

-- ---------------------------------------------------------------- restaurants (ids 9001-9005)
INSERT INTO restaurants (id, owner_id, name, address, description, image_url, seating_capacity, cancellation_lead_minutes) VALUES
  (9001, '5eed0000-0000-4000-8000-000000000001', 'ชาบูทองคำ',
         '123 ถ.สุขุมวิท แขวงคลองเตย กรุงเทพฯ',
         'ชาบูหม้อไฟ น้ำซุปกระดูกหมูเคี่ยว 12 ชั่วโมง เนื้อสดส่งทุกเช้า',
         '/uploads/restaurants/9001-seed.jpg', 40, 60),
  (9002, '5eed0000-0000-4000-8000-000000000001', 'หมูกระทะบ้านสวน',
         '45/6 ซ.ลาดพร้าว 71 แขวงลาดพร้าว กรุงเทพฯ',
         'หมูกระทะบรรยากาศสวน นั่งสบาย มีมุมสำหรับครอบครัว',
         '/uploads/restaurants/9002-seed.jpg', 60, 120),
  (9003, '5eed0000-0000-4000-8000-000000000002', 'ยากินิกุโตเกียว',
         '8 ถ.เพชรบุรีตัดใหม่ แขวงมักกะสัน กรุงเทพฯ',
         'ปิ้งย่างสไตล์ญี่ปุ่น เนื้อวากิวคัดพิเศษ เตาถ่านไร้ควัน',
         '/uploads/restaurants/9003-seed.jpg', 24, 90),
  (9004, '5eed0000-0000-4000-8000-000000000002', 'ปิ้งย่างลุงหนวด',
         '77 ถ.นิมมานเหมินท์ ต.สุเทพ เชียงใหม่',
         'ปิ้งย่างเตาถ่านสไตล์เหนือ เปิดเฉพาะวันพุธถึงอาทิตย์',
         '/uploads/restaurants/9004-seed.jpg', 30, 30),
  (9005, '5eed0000-0000-4000-8000-000000000001', 'ชาบูหม้อไฟเจ้าเก่า',
         '19 ถ.ท่าพระจันทร์ แขวงพระบรมมหาราชวัง กรุงเทพฯ',
         'ร้านเล็กอบอุ่น ยังไม่มีรีวิว',
         '/uploads/restaurants/9005-seed.jpg', 16, 45);

-- ---------------------------------------------------------------- opening hours (weekday 0 = Sunday)
INSERT INTO restaurant_opening_hours (restaurant_id, weekday, open_time, close_time)
SELECT 9001, day, '11:00', '22:00' FROM generate_series(0, 6) AS day;

INSERT INTO restaurant_opening_hours (restaurant_id, weekday, open_time, close_time)
SELECT 9002, day, '16:00', '23:00' FROM generate_series(0, 6) AS day;

-- closed on Mondays
INSERT INTO restaurant_opening_hours (restaurant_id, weekday, open_time, close_time)
SELECT 9003, day, '17:00', '22:30' FROM generate_series(0, 6) AS day WHERE day <> 1;

-- Wednesday to Sunday only
INSERT INTO restaurant_opening_hours (restaurant_id, weekday, open_time, close_time)
SELECT 9004, day, '17:00', '23:30' FROM generate_series(0, 6) AS day WHERE day IN (0, 3, 4, 5, 6);

INSERT INTO restaurant_opening_hours (restaurant_id, weekday, open_time, close_time)
SELECT 9005, day, '10:30', '21:00' FROM generate_series(0, 6) AS day;

-- ---------------------------------------------------------------- reviews (9005 has none)
INSERT INTO reviews (restaurant_id, user_id, rating, comment) VALUES
  (9001, '5eed0000-0000-4000-8000-000000000003', 5, 'น้ำซุปหอม เนื้อสด บริการดีมาก'),
  (9001, '5eed0000-0000-4000-8000-000000000004', 4, 'อร่อย แต่รอคิวนานนิดหน่อย'),
  (9001, '5eed0000-0000-4000-8000-000000000005', 5, 'ชอบมาก จะกลับมาอีกแน่นอน'),
  (9002, '5eed0000-0000-4000-8000-000000000003', 4, 'หมูนุ่ม เครื่องเคียงเยอะ'),
  (9002, '5eed0000-0000-4000-8000-000000000004', 3, 'ราคาโอเค แต่ร้านค่อนข้างร้อน'),
  (9003, '5eed0000-0000-4000-8000-000000000005', 5, 'เนื้อคุณภาพดีเหมือนร้านที่ญี่ปุ่น'),
  (9003, '5eed0000-0000-4000-8000-000000000001', 4, 'ทำเลดี บรรยากาศเงียบสงบ'),
  (9004, '5eed0000-0000-4000-8000-000000000003', 2, 'ควันเยอะ ที่นั่งแน่นไปหน่อย');

-- ---------------------------------------------------------------- reservations
-- Relative to today in Bangkok, always 18:00-20:00, which is inside the hours of 9001 and 9002
-- on every weekday: one yesterday (already over), two tomorrow, one cancelled, one the day after.
WITH today AS (
  SELECT date_trunc('day', now() AT TIME ZONE 'Asia/Bangkok') AS midnight
)
INSERT INTO reservations (restaurant_id, user_id, start_at, end_at, guests, status)
SELECT r.restaurant_id,
       r.user_id::uuid,
       (today.midnight + make_interval(days => r.day_offset) + interval '18 hours') AT TIME ZONE 'Asia/Bangkok',
       (today.midnight + make_interval(days => r.day_offset) + interval '20 hours') AT TIME ZONE 'Asia/Bangkok',
       r.guests,
       r.status
FROM today,
     (VALUES
       (9001, '5eed0000-0000-4000-8000-000000000003', -1,  2, 'confirmed'),
       (9001, '5eed0000-0000-4000-8000-000000000003',  1,  4, 'confirmed'),
       (9001, '5eed0000-0000-4000-8000-000000000004',  1,  6, 'confirmed'),
       (9001, '5eed0000-0000-4000-8000-000000000005',  1,  8, 'cancelled'),
       (9002, '5eed0000-0000-4000-8000-000000000005',  2,  2, 'confirmed')
     ) AS r(restaurant_id, user_id, day_offset, guests, status);

COMMIT;
