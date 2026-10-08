# Testing Guide

แนวทางนี้ช่วยให้ test ของ BookingTable API อ่านง่าย ดูแลต่อได้ และทดสอบพฤติกรรมจริงในจุดที่สำคัญ

- เขียน test ด้วย [`testify`](https://github.com/stretchr/testify) เป็นหลัก (`assert`/`require` และ suite เมื่อเหมาะสม)
- เขียน test แบบ red → green ทีละเคส (ถ้าใช้ skill `tdd` ของ mattpocock/skills ซึ่งติดตั้งแยกและไม่ได้อยู่ใน repo นี้ ก็ใช้แนวทางเดียวกัน)
- ทดสอบ repository ที่เชื่อมต่อ Database หรือ Redis ด้วย [Testcontainers](https://testcontainers.com/) เพื่อใช้ service จริงแบบแยกอิสระ
- ส่วนอื่นให้ stub dependency เท่าที่ทำได้ เพื่อให้ test เร็วและเจาะจง
- สร้าง mock ด้วย `mockery` เท่านั้น และหลีกเลี่ยงการเขียน mock struct เอง เว้นแต่จำเป็นจริง ๆ

ดูข้อกำหนดเพิ่มเติมของโปรเจกต์ได้ที่ [AGENTS.md](../AGENTS.md)
