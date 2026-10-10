// Bangkok is UTC+7 with no daylight saving, so a fixed offset is exact.
const BANGKOK_OFFSET = "+07:00";

const BANGKOK_OFFSET_MS = 7 * 3600 * 1000;

/** "2026-10-12T18:00" (datetime-local value, read as Bangkok time) -> RFC 3339 with +07:00. */
export function toApiDateTime(local: string): string {
  return `${local}:00${BANGKOK_OFFSET}`;
}

/** The Bangkok calendar day of an instant as "YYYY-MM-DD" (the value a date input takes and the API's `date` query). */
export function bangkokDateKey(instant: Date): string {
  return new Date(instant.getTime() + BANGKOK_OFFSET_MS).toISOString().slice(0, 10);
}

/** "YYYY-MM-DD" plus (or minus) whole days, as calendar arithmetic that no time zone can disturb. */
export function addDaysToKey(key: string, days: number): string {
  const [year, month, day] = key.split("-").map(Number);

  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
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

const thaiDate = new Intl.DateTimeFormat("th-TH", { timeZone: "UTC", dateStyle: "full" });

/** "YYYY-MM-DD" -> a Thai calendar date with its weekday. The key is read as plain calendar arithmetic (UTC), so no zone shifts the day. */
export function formatThaiDate(key: string): string {
  return thaiDate.format(new Date(`${key}T00:00:00Z`));
}

/** Index = weekday number used by the API (0 = Sunday). */
export const WEEKDAY_LABELS: string[] = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
