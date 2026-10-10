import { seatLevel } from "@/lib/availability";
import { bangkokDateKey } from "@/lib/datetime";
import type { ReservationStatus } from "@/lib/types";

/** What the owner's day view needs to know about a reservation. */
export interface OwnerRow {
  startAt: string;
  endAt: string;
  guests: number;
  status: ReservationStatus;
}

export interface DayGroup<T extends OwnerRow> {
  /** The Bangkok calendar day, "YYYY-MM-DD". */
  dateKey: string;
  /** The day's rows after the status filter, earliest first. */
  rows: T[];
  /** Confirmed reservations that day and their guests, whatever the filter says. */
  confirmed: number;
  guests: number;
  confirmedRows: T[];
}

/**
 * Groups reservations by their Bangkok start day. Days that are today or later come first, earliest
 * first, then the days that are over, latest first. A day whose rows are all filtered out is dropped.
 */
export function groupReservationsByDay<T extends OwnerRow>(rows: T[], filter: "" | ReservationStatus, todayKey: string): DayGroup<T>[] {
  const byDay = new Map<string, T[]>();
  for (const row of rows) {
    const key = bangkokDateKey(new Date(row.startAt));
    byDay.set(key, [...(byDay.get(key) ?? []), row]);
  }

  const groups = [...byDay].map(([dateKey, all]): DayGroup<T> => {
    const sorted = [...all].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
    const confirmedRows = sorted.filter((row) => row.status === "confirmed");

    return {
      dateKey,
      rows: sorted.filter((row) => !filter || row.status === filter),
      confirmed: confirmedRows.length,
      guests: confirmedRows.reduce((sum, row) => sum + row.guests, 0),
      confirmedRows,
    };
  });

  const shown = groups.filter((group) => group.rows.length > 0);
  const upcoming = shown.filter((group) => group.dateKey >= todayKey).sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  const past = shown.filter((group) => group.dateKey < todayKey).sort((a, b) => b.dateKey.localeCompare(a.dateKey));

  return [...upcoming, ...past];
}

export type LoadState = "idle" | "normal" | "near" | "full";

export interface HourLoad {
  hour: number;
  used: number;
  left: number;
  state: LoadState;
  /** Height of the bar in a box, 4 to 100. */
  heightPercent: number;
}

const HOUR_MS = 3_600_000;

/**
 * For each hour the restaurant is open that day, the most guests present at one moment in that hour
 * (the same "peak, not sum" rule the server uses to accept a booking). `bookings` are the confirmed ones.
 */
export function hourlyLoad(input: {
  bookings: { startAt: string; endAt: string; guests: number }[];
  capacity: number;
  open: string;
  close: string;
  dateKey: string;
}): HourLoad[] {
  const { bookings, capacity, open, close, dateKey } = input;
  const firstHour = Number(open.slice(0, 2));
  const [closeHour, closeMinute] = close.split(":").map(Number);
  const endHour = closeMinute > 0 ? closeHour + 1 : closeHour;
  const spans = bookings.map((b) => ({ start: new Date(b.startAt).getTime(), end: new Date(b.endAt).getTime(), guests: b.guests }));

  const bars: HourLoad[] = [];
  for (let hour = firstHour; hour < endHour; hour++) {
    const slotStart = new Date(`${dateKey}T${String(hour).padStart(2, "0")}:00:00+07:00`).getTime();
    const slotEnd = slotStart + HOUR_MS;
    const moments = [slotStart, ...spans.map((s) => s.start).filter((start) => start > slotStart && start < slotEnd)];
    const used = Math.max(...moments.map((at) => spans.filter((s) => s.start <= at && at < s.end).reduce((sum, s) => sum + s.guests, 0)));
    const left = capacity - used;
    const level = seatLevel(left, capacity);

    bars.push({
      hour,
      used,
      left,
      state: used === 0 ? "idle" : level === "full" ? "full" : level === "low" ? "near" : "normal",
      heightPercent: Math.min(100, Math.max(4, Math.round((used / capacity) * 100))),
    });
  }

  return bars;
}
