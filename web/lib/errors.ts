// Business-rule codes the API sends in `{message, code}` (see api/docs/API.md, "Error codes").
const CODE_MESSAGES: Record<string, string> = {
  start_in_past: "ไม่สามารถจองย้อนหลังได้",
  outside_opening_hours: "เวลาที่เลือกอยู่นอกเวลาเปิดทำการของร้าน",
  capacity_exceeded: "ที่นั่งไม่พอสำหรับช่วงเวลานี้",
  too_late_to_cancel: "เลยกำหนดเวลาที่ยกเลิกได้แล้ว",
  too_late_to_modify: "เลยกำหนดเวลาที่แก้ไขได้แล้ว",
  reservation_not_active: "การจองนี้ถูกยกเลิกหรือเริ่มไปแล้ว",
  cannot_review_own_restaurant: "ไม่สามารถรีวิวร้านของตัวเองได้",
  already_reviewed: "คุณรีวิวร้านนี้ไปแล้ว",
  restaurant_has_active_reservations: "ลบร้านไม่ได้ เพราะยังมีการจองที่ค้างอยู่",
  invalid_image: "ไฟล์รูปไม่ถูกต้อง (รองรับ JPG, PNG, WebP ขนาดไม่เกิน 2 MB)",
};

// Used when the API sends no (or an unknown) code.
const STATUS_MESSAGES: Record<number, string> = {
  400: "ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง",
  401: "กรุณาเข้าสู่ระบบอีกครั้ง",
  403: "คุณไม่มีสิทธิ์ทำรายการนี้",
  404: "ไม่พบข้อมูลที่ต้องการ",
  409: "ทำรายการไม่ได้ในสถานะปัจจุบัน",
};

const GENERIC_MESSAGE = "เกิดข้อผิดพลาด กรุณาลองใหม่ภายหลัง";

// Shape of ApiError (lib/api.ts). Checked structurally so this file imports nothing from the project.
interface ErrorLike {
  status: number;
  code?: string;
}

function isErrorLike(err: unknown): err is ErrorLike {
  return typeof err === "object" && err !== null && typeof (err as ErrorLike).status === "number";
}

/** Thai message for anything thrown by the API client. */
export function messageForError(err: unknown): string {
  if (!isErrorLike(err)) return GENERIC_MESSAGE;
  if (err.code && Object.hasOwn(CODE_MESSAGES, err.code)) return CODE_MESSAGES[err.code];
  return STATUS_MESSAGES[err.status] ?? GENERIC_MESSAGE;
}

/** True when the API answered 404 (the thing asked for does not exist). */
export function isNotFound(err: unknown): boolean {
  return isErrorLike(err) && err.status === 404;
}
