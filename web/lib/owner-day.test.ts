import { describe, expect, it } from "vitest";
import { groupReservationsByDay, hourlyLoad } from "@/lib/owner-day";

// npm test runs with TZ=America/New_York, so day and hour boundaries must come from Bangkok, not this machine.

function booking(start: string, end: string, guests: number, status: "confirmed" | "cancelled" = "confirmed") {
  return { startAt: `${start}:00+07:00`, endAt: `${end}:00+07:00`, guests, status };
}

describe("hourlyLoad", () => {
  const day = "2026-10-12";
  const bookings = [
    booking(`${day}T18:00`, `${day}T20:00`, 6),
    booking(`${day}T19:00`, `${day}T20:00`, 4),
    booking(`${day}T20:00`, `${day}T21:00`, 7),
  ];

  it("gives one bar per hour the restaurant is open, with the most guests present in that hour", () => {
    const bars = hourlyLoad({ bookings, capacity: 10, open: "11:00", close: "22:00", dateKey: day });

    expect(bars.map((bar) => bar.hour)).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]);
    expect(bars.find((bar) => bar.hour === 18)?.used).toBe(6);
    expect(bars.find((bar) => bar.hour === 19)?.used).toBe(10); // 6 + 4 are there together
    expect(bars.find((bar) => bar.hour === 20)?.used).toBe(7);
    expect(bars.find((bar) => bar.hour === 11)?.used).toBe(0);
  });

  it("calls an hour idle with nobody, full with no seat left, near with 30% or fewer left, otherwise normal", () => {
    const states = Object.fromEntries(
      hourlyLoad({ bookings, capacity: 10, open: "11:00", close: "22:00", dateKey: day }).map((bar) => [bar.hour, bar.state]),
    );

    expect(states[11]).toBe("idle");
    expect(states[18]).toBe("normal"); // 4 of 10 left
    expect(states[19]).toBe("full");
    expect(states[20]).toBe("near"); // 3 of 10 left
  });

  it("counts the peak in an hour, not the sum of everybody who touches it", () => {
    const half = [booking(`${day}T12:30`, `${day}T13:00`, 5), booking(`${day}T13:00`, `${day}T13:30`, 4)];

    const bars = hourlyLoad({ bookings: half, capacity: 10, open: "11:00", close: "15:00", dateKey: day });

    expect(bars.find((bar) => bar.hour === 12)?.used).toBe(5);
    expect(bars.find((bar) => bar.hour === 13)?.used).toBe(4); // the 12:30-13:00 booking has left by 13:00
  });

  it("starts at the hour of opening and ends after the hour of closing, half hours included", () => {
    const bars = hourlyLoad({ bookings: [], capacity: 10, open: "10:30", close: "21:30", dateKey: day });

    expect(bars[0].hour).toBe(10);
    expect(bars.at(-1)?.hour).toBe(21);
  });

  it("draws a bar at least a little tall even when empty, and never taller than the box", () => {
    const bars = hourlyLoad({ bookings, capacity: 10, open: "18:00", close: "21:00", dateKey: day });

    expect(Math.min(...bars.map((bar) => bar.heightPercent))).toBeGreaterThanOrEqual(4);
    expect(Math.max(...bars.map((bar) => bar.heightPercent))).toBeLessThanOrEqual(100);
    expect(hourlyLoad({ bookings: [booking(`${day}T11:00`, `${day}T12:00`, 30)], capacity: 10, open: "11:00", close: "12:00", dateKey: day })[0].heightPercent).toBe(100);
  });
});

describe("groupReservationsByDay", () => {
  const rows = [
    { id: 1, ...booking("2026-10-13T12:00", "2026-10-13T13:00", 2, "cancelled") },
    { id: 2, ...booking("2026-10-12T20:00", "2026-10-12T21:00", 7) },
    { id: 3, ...booking("2026-10-12T18:00", "2026-10-12T20:00", 6) },
    { id: 4, ...booking("2026-10-09T18:00", "2026-10-09T19:00", 3) },
    { id: 5, ...booking("2026-10-12T00:30", "2026-10-12T01:30", 1, "cancelled") }, // 12 Oct in Bangkok, 11 Oct in New York
  ];

  it("groups by Bangkok date, upcoming days first (earliest first), then past days (latest first)", () => {
    const groups = groupReservationsByDay(rows, "", "2026-10-12");

    expect(groups.map((group) => group.dateKey)).toEqual(["2026-10-12", "2026-10-13", "2026-10-09"]);
  });

  it("lists a day's rows earliest first", () => {
    const today = groupReservationsByDay(rows, "", "2026-10-12")[0];

    expect(today.rows.map((row) => row.id)).toEqual([5, 3, 2]);
  });

  it("counts only the confirmed reservations and their guests for the day", () => {
    const today = groupReservationsByDay(rows, "", "2026-10-12")[0];

    expect(today.confirmed).toBe(2);
    expect(today.guests).toBe(13);
    expect(today.confirmedRows.map((row) => row.id)).toEqual([3, 2]);
  });

  it("filters the rows but keeps the day's totals and drops days left empty", () => {
    const groups = groupReservationsByDay(rows, "cancelled", "2026-10-12");

    expect(groups.map((group) => group.dateKey)).toEqual(["2026-10-12", "2026-10-13"]);
    expect(groups[0].rows.map((row) => row.id)).toEqual([5]);
    expect(groups[0].confirmed).toBe(2); // the totals still describe the whole day
  });

  it("has no groups for no reservations", () => {
    expect(groupReservationsByDay([], "", "2026-10-12")).toEqual([]);
  });
});
