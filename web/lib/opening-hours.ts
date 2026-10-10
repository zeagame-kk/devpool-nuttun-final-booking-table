import { WEEKDAY_LABELS } from "@/lib/datetime";
import type { OpeningHour } from "@/lib/types";

/** One row of the weekly editor: a day that is either closed or open between two "HH:MM" times. */
export interface DayRow {
  weekday: number;
  enabled: boolean;
  open: string;
  close: string;
}

const DEFAULT_OPEN = "11:00";
const DEFAULT_CLOSE = "22:00";

/** Seven closed days, Sunday (0) to Saturday (6). */
export function emptyDayRows(): DayRow[] {
  return Array.from({ length: 7 }, (_, weekday) => ({
    weekday,
    enabled: false,
    open: DEFAULT_OPEN,
    close: DEFAULT_CLOSE,
  }));
}

/** Rows for the editor from the API's list; a weekday that is not listed stays closed. */
export function rowsFromHours(hours: OpeningHour[]): DayRow[] {
  const rows = emptyDayRows();
  for (const hour of hours) {
    // Look the row up by weekday, never with a truthiness check: Sunday is 0.
    const row = rows.find((r) => r.weekday === hour.weekday);
    if (row) {
      row.enabled = true;
      row.open = hour.open;
      row.close = hour.close;
    }
  }
  return rows;
}

/** The API's list: open days only, ordered by weekday. */
export function rowsToHours(rows: DayRow[]): OpeningHour[] {
  return rows
    .filter((r) => r.enabled)
    .sort((a, b) => a.weekday - b.weekday)
    .map((r) => ({ weekday: r.weekday, open: r.open, close: r.close }));
}

/** First problem in Thai, or null when the week can be sent. "HH:MM" strings compare correctly as text. */
export function validateRows(rows: DayRow[]): string | null {
  const openRows = rows.filter((r) => r.enabled);
  if (openRows.length === 0) return "ต้องเปิดอย่างน้อย 1 วัน";
  const blank = openRows.find((r) => r.open === "" || r.close === "");
  if (blank) return `กรอกเวลาเปิดและเวลาปิด (${WEEKDAY_LABELS[blank.weekday]})`;
  const bad = openRows.find((r) => r.close <= r.open);
  if (bad) return `เวลาปิดต้องหลังเวลาเปิด (${WEEKDAY_LABELS[bad.weekday]})`;
  return null;
}

/** "11–22" for the weekly strip: the minutes are dropped when they are :00, kept otherwise ("10:30–21"). */
export function shortHours(open: string, close: string): string {
  const part = (time: string) => (time.endsWith(":00") ? String(Number(time.slice(0, 2))) : time);

  return `${part(open)}–${part(close)}`;
}

/** Whether the restaurant is closed on a "YYYY-MM-DD" date: its weekday has no opening hours. */
export function closedWeekdayOf(hours: OpeningHour[], key: string): boolean {
  const [year, month, day] = key.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();

  return !hours.some((hour) => hour.weekday === weekday);
}

/** One line for the restaurant page: "เปิดทุกวัน 11:00–22:00" or "เปิด 11:00–22:00 · ปิดวันอาทิตย์". */
export function openingSummary(hours: OpeningHour[]): string {
  if (hours.length === 0) return "ยังไม่ได้ตั้งเวลาเปิด";

  const open = hours.map((hour) => hour.open).sort()[0];
  const close = hours.map((hour) => hour.close).sort().at(-1) as string;
  const differs = hours.some((hour) => hour.open !== open || hour.close !== close);
  const closedDays = WEEKDAY_LABELS.filter((_, weekday) => !hours.some((hour) => hour.weekday === weekday));

  const span = closedDays.length === 0 && !differs ? `เปิดทุกวัน ${open}–${close}` : `เปิด ${open}–${close}`;

  return [span + (differs ? " (เวลาแต่ละวันต่างกัน)" : ""), closedDays.length > 0 ? `ปิดวัน${closedDays.join(" ")}` : ""]
    .filter(Boolean)
    .join(" · ");
}
