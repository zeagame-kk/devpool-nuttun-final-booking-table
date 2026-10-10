import { describe, expect, it } from "vitest";
import { creditSeats, durationOptions, minRemaining, selectionFor, selectionTimes, slotState } from "@/lib/booking";
import type { AvailabilitySlot } from "@/lib/types";

// Eleven one-hour slots 11:00-22:00 on 2026-10-12 (Bangkok), capacity 10, with the seats left given per slot.
function day(remaining: number[]): AvailabilitySlot[] {
  return remaining.map((left, index) => ({
    startAt: `2026-10-12T${String(11 + index).padStart(2, "0")}:00:00+07:00`,
    endAt: `2026-10-12T${String(12 + index).padStart(2, "0")}:00:00+07:00`,
    bookedGuests: 10 - left,
    remainingSeats: left,
  }));
}

const slots = day([10, 10, 10, 10, 10, 6, 4, 2, 0, 3, 8]);
const morning = new Date("2026-10-12T08:00:00+07:00"); // before opening: nothing is past
const at1330 = new Date("2026-10-12T13:30:00+07:00");

describe("slotState", () => {
  it("is avail with plenty of seats, near with 30% or fewer, full with none", () => {
    const states = slots.map((slot, index) => slotState({ slot, index, capacity: 10, now: morning, selection: null }));

    expect(states[0]).toBe("avail");
    expect(states[5]).toBe("avail"); // 6 of 10
    expect(states[6]).toBe("avail"); // 4 of 10 is still more than 30%
    expect(states[7]).toBe("near"); // 2 of 10
    expect(states[8]).toBe("full");
    expect(states[9]).toBe("near"); // exactly 3 of 10 = 30%
  });

  it("is past once the slot has started, even when it is full", () => {
    expect(slotState({ slot: slots[2], index: 2, capacity: 10, now: at1330, selection: null })).toBe("past"); // 13:00 started
    expect(slotState({ slot: slots[3], index: 3, capacity: 10, now: at1330, selection: null })).toBe("avail"); // 14:00 has not
    expect(slotState({ slot: slots[8], index: 8, capacity: 10, now: new Date("2026-10-12T20:30:00+07:00"), selection: null })).toBe("past");
  });

  it("marks the picked slot selected and the rest of the chosen hours in range", () => {
    const selection = { startIndex: 3, hours: 2 };

    expect(slotState({ slot: slots[3], index: 3, capacity: 10, now: morning, selection })).toBe("selected");
    expect(slotState({ slot: slots[4], index: 4, capacity: 10, now: morning, selection })).toBe("range");
    expect(slotState({ slot: slots[5], index: 5, capacity: 10, now: morning, selection })).toBe("avail");
  });

  it("marks a full slot inside the chosen hours as a conflict", () => {
    const selection = { startIndex: 7, hours: 3 }; // 18:00, 19:00 (full), 20:00

    expect(slotState({ slot: slots[8], index: 8, capacity: 10, now: morning, selection })).toBe("conflict");
    expect(slotState({ slot: slots[9], index: 9, capacity: 10, now: morning, selection })).toBe("range");
  });
});

describe("durationOptions", () => {
  it("offers 1 to 3 hours and disables what would run past closing", () => {
    expect(durationOptions(slots, 0)).toEqual([
      { hours: 1, enabled: true },
      { hours: 2, enabled: true },
      { hours: 3, enabled: true },
    ]);
    expect(durationOptions(slots, 9)).toEqual([
      { hours: 1, enabled: true },
      { hours: 2, enabled: true },
      { hours: 3, enabled: false },
    ]); // 20:00 + 3h = 23:00 but the restaurant closes at 22:00
    expect(durationOptions(slots, 10)).toEqual([
      { hours: 1, enabled: true },
      { hours: 2, enabled: false },
      { hours: 3, enabled: false },
    ]);
  });

  it("disables everything while no slot is picked", () => {
    expect(durationOptions(slots, null).every((option) => !option.enabled)).toBe(true);
  });
});

describe("selectionTimes", () => {
  it("runs from the start of the first picked slot to the end of the last", () => {
    expect(selectionTimes(slots, 6, 2)).toEqual({
      startAt: "2026-10-12T17:00:00+07:00",
      endAt: "2026-10-12T19:00:00+07:00",
    });
  });

  it("ends at closing time when the last slot is shorter than an hour", () => {
    const shortDay: AvailabilitySlot[] = [
      { startAt: "2026-10-12T21:00:00+07:00", endAt: "2026-10-12T22:00:00+07:00", bookedGuests: 0, remainingSeats: 10 },
      { startAt: "2026-10-12T22:00:00+07:00", endAt: "2026-10-12T22:30:00+07:00", bookedGuests: 0, remainingSeats: 10 },
    ];

    expect(selectionTimes(shortDay, 0, 2).endAt).toBe("2026-10-12T22:30:00+07:00");
  });
});

describe("minRemaining", () => {
  it("is the fewest seats left in any chosen hour", () => {
    expect(minRemaining(slots, 5, 3)).toBe(2); // 6, 4, 2
    expect(minRemaining(slots, 7, 3)).toBe(0); // 2, 0, 3
    expect(minRemaining(slots, 0, 1)).toBe(10);
  });
});

describe("selectionFor", () => {
  it("finds the slot a reservation starts in and how many hours it covers", () => {
    expect(selectionFor(slots, "2026-10-12T18:00:00+07:00", "2026-10-12T20:00:00+07:00")).toEqual({ startIndex: 7, hours: 2 });
    expect(selectionFor(slots, "2026-10-12T11:00:00+07:00", "2026-10-12T12:00:00+07:00")).toEqual({ startIndex: 0, hours: 1 });
  });

  it("starts in the hour that contains a half-hour start and covers every hour it touches", () => {
    expect(selectionFor(slots, "2026-10-12T12:30:00+07:00", "2026-10-12T13:30:00+07:00")).toEqual({ startIndex: 1, hours: 2 });
  });

  it("covers at most three hours", () => {
    expect(selectionFor(slots, "2026-10-12T11:00:00+07:00", "2026-10-12T15:00:00+07:00")).toEqual({ startIndex: 0, hours: 3 });
  });

  it("is null when the reservation is not on this day", () => {
    expect(selectionFor(slots, "2026-10-13T18:00:00+07:00", "2026-10-13T19:00:00+07:00")).toBeNull();
    expect(selectionFor([], "2026-10-12T18:00:00+07:00", "2026-10-12T19:00:00+07:00")).toBeNull();
  });
});

describe("creditSeats", () => {
  it("gives back the seats of the reservation being changed in the hours it overlaps, up to the capacity", () => {
    const credited = creditSeats(slots, 10, { startAt: "2026-10-12T16:00:00+07:00", endAt: "2026-10-12T18:00:00+07:00", guests: 3 });

    expect(credited.map((slot) => slot.remainingSeats)).toEqual([10, 10, 10, 10, 10, 9, 7, 2, 0, 3, 8]);
    expect(credited[5].bookedGuests).toBe(1);
    expect(credited[6].bookedGuests).toBe(3);
  });

  it("never offers more than the capacity or fewer than zero booked", () => {
    const credited = creditSeats(slots, 10, { startAt: "2026-10-12T11:00:00+07:00", endAt: "2026-10-12T12:00:00+07:00", guests: 4 });

    expect(credited[0].remainingSeats).toBe(10);
    expect(credited[0].bookedGuests).toBe(0);
  });

  it("leaves the slots alone when there is nothing to credit or it is another day", () => {
    expect(creditSeats(slots, 10, null)).toEqual(slots);
    expect(creditSeats(slots, 10, { startAt: "2026-10-13T18:00:00+07:00", endAt: "2026-10-13T19:00:00+07:00", guests: 5 })).toEqual(slots);
  });
});
