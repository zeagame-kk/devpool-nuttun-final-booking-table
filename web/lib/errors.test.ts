import { describe, expect, it } from "vitest";
import { messageForError } from "./errors";

describe("messageForError", () => {
  it.each([
    ["start_in_past", "ไม่สามารถจองย้อนหลังได้"],
    ["outside_opening_hours", "เวลาที่เลือกอยู่นอกเวลาเปิดทำการของร้าน"],
    ["capacity_exceeded", "ที่นั่งไม่พอสำหรับช่วงเวลานี้"],
    ["too_late_to_cancel", "เลยกำหนดเวลาที่ยกเลิกได้แล้ว"],
    ["too_late_to_modify", "เลยกำหนดเวลาที่แก้ไขได้แล้ว"],
    ["reservation_not_active", "การจองนี้ถูกยกเลิกหรือเริ่มไปแล้ว"],
    ["cannot_review_own_restaurant", "ไม่สามารถรีวิวร้านของตัวเองได้"],
    ["already_reviewed", "คุณรีวิวร้านนี้ไปแล้ว"],
    ["restaurant_has_active_reservations", "ลบร้านไม่ได้ เพราะยังมีการจองที่ค้างอยู่"],
    ["invalid_image", "ไฟล์รูปไม่ถูกต้อง (รองรับ JPG, PNG, WebP ขนาดไม่เกิน 2 MB)"],
  ])("explains the %s code in Thai", (code, message) => {
    expect(messageForError({ status: 400, code })).toBe(message);
  });

  it.each([
    [400, "ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง"],
    [401, "กรุณาเข้าสู่ระบบอีกครั้ง"],
    [403, "คุณไม่มีสิทธิ์ทำรายการนี้"],
    [404, "ไม่พบข้อมูลที่ต้องการ"],
    [409, "ทำรายการไม่ได้ในสถานะปัจจุบัน"],
  ])("falls back to the status when there is no code (%i)", (status, message) => {
    expect(messageForError({ status })).toBe(message);
  });

  it("ignores a code it does not know and uses the status", () => {
    expect(messageForError({ status: 404, code: "unknown_code" })).toBe("ไม่พบข้อมูลที่ต้องการ");
  });

  it.each(["constructor", "toString", "__proto__"])("does not treat %s as a known code", (code) => {
    expect(messageForError({ status: 409, code })).toBe("ทำรายการไม่ได้ในสถานะปัจจุบัน");
  });

  it.each([[500], [503]])("gives the generic message for status %i", (status) => {
    expect(messageForError({ status })).toBe("เกิดข้อผิดพลาด กรุณาลองใหม่ภายหลัง");
  });

  it("gives the generic message for things that are not API errors", () => {
    expect(messageForError(new Error("x"))).toBe("เกิดข้อผิดพลาด กรุณาลองใหม่ภายหลัง");
    expect(messageForError(undefined)).toBe("เกิดข้อผิดพลาด กรุณาลองใหม่ภายหลัง");
  });
});
