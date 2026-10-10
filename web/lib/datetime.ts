// Bangkok is UTC+7 with no daylight saving, so a fixed offset is exact.
const BANGKOK_OFFSET_MS = 7 * 3600 * 1000;

/** The Bangkok calendar day of an instant as "YYYY-MM-DD" (the API's `date` query and the key of a day tile). */
export function bangkokDateKey(instant: Date): string {
  return new Date(instant.getTime() + BANGKOK_OFFSET_MS).toISOString().slice(0, 10);
}

/** "YYYY-MM-DD" plus (or minus) whole days, as calendar arithmetic that no time zone can disturb. */
export function addDaysToKey(key: string, days: number): string {
  const [year, month, day] = key.split("-").map(Number);

  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** Any RFC 3339 instant -> "YYYY-MM-DDTHH:mm" in Bangkok time. */
export function fromApiDateTime(iso: string): string {
  return new Date(new Date(iso).getTime() + BANGKOK_OFFSET_MS).toISOString().slice(0, 16);
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

/** "ยกเลิกได้ถึง 11:00 วันที่ 12 ต.ค." : the last moment a reservation can be cancelled, from its start and the restaurant's lead time. */
export function cancelDeadlineText(startAt: string, leadMinutes: number): string {
  const deadline = new Date(new Date(startAt).getTime() - leadMinutes * 60_000);
  const parts = thaiDateParts(bangkokDateKey(deadline));

  return `ยกเลิกได้ถึง ${bangkokClock(deadline.toISOString())} วันที่ ${parts.day} ${parts.monthShort}`;
}

/** "HH:mm" of an RFC 3339 instant in Bangkok time. */
export function bangkokClock(iso: string): string {
  return fromApiDateTime(iso).slice(11);
}

/** Index = weekday number used by the API (0 = Sunday). */
export const WEEKDAY_LABELS: string[] = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
