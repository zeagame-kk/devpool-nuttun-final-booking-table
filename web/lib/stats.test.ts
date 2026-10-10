import { describe, expect, it } from "vitest";
import { summarizeRestaurants, summarizeReservations, summarizeReviews } from "@/lib/stats";

// npm test runs with TZ=America/New_York, so "today" must come from Bangkok, not this machine.

const now = new Date("2026-10-12T09:00:00+07:00"); // Monday morning in Bangkok

function reservation(id: number, startAt: string, status: "confirmed" | "cancelled", guests: number) {
  return { id, startAt, status, guests };
}

describe("summarizeReservations", () => {
  const items = [
    reservation(1, "2026-10-12T08:00:00+07:00", "confirmed", 2), // today, already started
    reservation(2, "2026-10-12T18:00:00+07:00", "confirmed", 4), // today, upcoming
    reservation(3, "2026-10-13T12:00:00+07:00", "confirmed", 3), // tomorrow
    reservation(4, "2026-10-12T19:00:00+07:00", "cancelled", 5), // cancelled, counts nowhere else
    reservation(5, "2026-10-11T12:00:00+07:00", "confirmed", 1), // yesterday
  ];

  it("counts every reservation and the cancelled ones", () => {
    const summary = summarizeReservations(items, now);

    expect(summary.total).toBe(5);
    expect(summary.cancelled).toBe(1);
  });

  it("counts confirmed reservations that have not started as upcoming, with their guests", () => {
    const summary = summarizeReservations(items, now);

    expect(summary.upcoming).toBe(2);
    expect(summary.upcomingGuests).toBe(7);
  });

  it("counts confirmed reservations on today's Bangkok date, started or not", () => {
    expect(summarizeReservations(items, now).today).toBe(2);
  });

  it("picks the soonest upcoming reservation as next, whatever the list order", () => {
    const summary = summarizeReservations([...items].reverse(), now);

    expect(summary.next?.id).toBe(2);
  });

  it("has no next and zero everywhere for an empty list", () => {
    expect(summarizeReservations([], now)).toEqual({
      total: 0,
      upcoming: 0,
      today: 0,
      cancelled: 0,
      upcomingGuests: 0,
      next: null,
    });
  });

  it("takes today from Bangkok even when it is still the previous evening in New York", () => {
    // 17:30 UTC on the 12th is 00:30 on the 13th in Bangkok and 13:30 on the 12th in New York.
    const lateNow = new Date("2026-10-12T17:30:00Z");
    const summary = summarizeReservations([reservation(1, "2026-10-13T05:00:00+07:00", "confirmed", 2)], lateNow);

    expect(summary.today).toBe(1);
  });
});

describe("summarizeRestaurants", () => {
  it("adds up reviews and weights the average by how many reviews each restaurant has", () => {
    const summary = summarizeRestaurants([
      { rating: { average: 4, total: 2 } }, // 8 stars
      { rating: { average: 3, total: 1 } }, // 3 stars
      { rating: { average: 0, total: 0 } }, // no reviews: must not drag the average down
    ]);

    expect(summary).toEqual({ count: 3, reviews: 3, average: 3.7 }); // 11 / 3 = 3.67
  });

  it("has no average when nothing was reviewed", () => {
    expect(summarizeRestaurants([{ rating: { average: 0, total: 0 } }])).toEqual({ count: 1, reviews: 0, average: null });
    expect(summarizeRestaurants([])).toEqual({ count: 0, reviews: 0, average: null });
  });
});

describe("summarizeReviews", () => {
  it("averages the stars given, to one decimal", () => {
    expect(summarizeReviews([{ rating: 5 }, { rating: 4 }, { rating: 4 }])).toEqual({ count: 3, averageGiven: 4.3 });
  });

  it("has no average without reviews", () => {
    expect(summarizeReviews([])).toEqual({ count: 0, averageGiven: null });
  });
});
