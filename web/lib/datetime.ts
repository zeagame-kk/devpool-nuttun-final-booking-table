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

/** Index = weekday number used by the API (0 = Sunday), abbreviated as on a date tile. */
export const WEEKDAY_SHORT: string[] = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];

const MONTH_SHORT: string[] = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

export interface ThaiDateParts {
  /** 0 = Sunday. */
  weekday: number;
  weekdayShort: string;
  weekdayFull: string;
  day: number;
  monthShort: string;
  /** Buddhist era, as Thai dates are written. */
  yearBE: number;
}

/** The pieces of a "YYYY-MM-DD" key for a date tile: weekday, day, month and year (calendar arithmetic, no time zone involved). */
export function thaiDateParts(key: string): ThaiDateParts {
  const [year, month, day] = key.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();

  return {
    weekday,
    weekdayShort: WEEKDAY_SHORT[weekday],
    weekdayFull: WEEKDAY_LABELS[weekday],
    day,
    monthShort: MONTH_SHORT[month - 1],
    yearBE: year + 543,
  };
}

/** "จ. 12 ต.ค. 2569" */
export function formatThaiDateShort(key: string): string {
  const parts = thaiDateParts(key);

  return `${parts.weekdayShort} ${parts.day} ${parts.monthShort} ${parts.yearBE}`;
}

/** "วันจันทร์ 12 ต.ค. 2569" */
export function formatThaiDateWithWeekday(key: string): string {
  const parts = thaiDateParts(key);

  return `วัน${parts.weekdayFull} ${parts.day} ${parts.monthShort} ${parts.yearBE}`;
}

const thaiMonthName = new Intl.DateTimeFormat("th-TH", { timeZone: "UTC", month: "long" });

/** "ตุลาคม พ.ศ. 2569" */
export function formatThaiMonthYear(key: string): string {
  return `${thaiMonthName.format(new Date(`${key}T00:00:00Z`))} พ.ศ. ${thaiDateParts(key).yearBE}`;
}

/** "HH:mm" of an RFC 3339 instant in Bangkok time. */
export function bangkokClock(iso: string): string {
  return fromApiDateTime(iso).slice(11);
}

/** Index = weekday number used by the API (0 = Sunday). */
export const WEEKDAY_LABELS: string[] = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
