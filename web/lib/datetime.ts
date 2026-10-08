// Bangkok is UTC+7 with no daylight saving, so a fixed offset is exact.
const BANGKOK_OFFSET = "+07:00";

const BANGKOK_OFFSET_MS = 7 * 3600 * 1000;

/** "2026-10-12T18:00" (datetime-local value, read as Bangkok time) -> RFC 3339 with +07:00. */
export function toApiDateTime(local: string): string {
  return `${local}:00${BANGKOK_OFFSET}`;
}

/** Any RFC 3339 instant -> "YYYY-MM-DDTHH:mm" in Bangkok time (the value a datetime-local input takes). */
export function fromApiDateTime(iso: string): string {
  return new Date(new Date(iso).getTime() + BANGKOK_OFFSET_MS).toISOString().slice(0, 16);
}

/** Thai message when `end` is not after `start`; null when fine. Both are datetime-local values, which sort as text. */
export function validateTimeRange(start: string, end: string): string | null {
  return end > start ? null : "เวลาสิ้นสุดต้องหลังเวลาเริ่ม";
}

const thaiDateTime = new Intl.DateTimeFormat("th-TH", {
  timeZone: "Asia/Bangkok",
  dateStyle: "medium",
  timeStyle: "short",
});

/** RFC 3339 instant -> a readable Thai date and time, always in Bangkok time. */
export function formatThaiDateTime(iso: string): string {
  return thaiDateTime.format(new Date(iso));
}

/** Index = weekday number used by the API (0 = Sunday). */
export const WEEKDAY_LABELS: string[] = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
