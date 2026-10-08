import { WEEKDAY_LABELS } from "./datetime";
import type { OpeningHour } from "./types";

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
  const open = rows.filter((r) => r.enabled);
  if (open.length === 0) return "ต้องเปิดอย่างน้อย 1 วัน";
  const bad = open.find((r) => r.close <= r.open);
  if (bad) return `เวลาปิดต้องหลังเวลาเปิด (${WEEKDAY_LABELS[bad.weekday]})`;
  return null;
}
