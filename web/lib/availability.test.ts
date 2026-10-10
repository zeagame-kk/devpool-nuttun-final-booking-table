import { describe, expect, it } from "vitest";
import { isSlotBookable, seatLevel, slotToFormValues } from "@/lib/availability";

describe("seatLevel", () => {
  it("is full when no seat is left", () => {
    expect(seatLevel(0, 10)).toBe("full");
  });

  it("is low when 30% or fewer of the seats are left, 30% included", () => {
    expect(seatLevel(1, 10)).toBe("low");
    expect(seatLevel(3, 10)).toBe("low");
  });

  it("is open when more than 30% are left", () => {
    expect(seatLevel(4, 10)).toBe("open");
    expect(seatLevel(10, 10)).toBe("open");
  });

  it("treats a restaurant without seats as full instead of dividing by zero", () => {
    expect(seatLevel(0, 0)).toBe("full");
  });
});

describe("slotToFormValues", () => {
  it("gives the datetime-local values of the slot in Bangkok time, whatever the machine's zone", () => {
    // npm test runs with TZ=America/New_York.
    expect(slotToFormValues({ startAt: "2026-10-12T19:00:00+07:00", endAt: "2026-10-12T20:00:00+07:00" })).toEqual({
      start: "2026-10-12T19:00",
      end: "2026-10-12T20:00",
    });
  });

  it("keeps a short last slot as it is", () => {
    expect(slotToFormValues({ startAt: "2026-10-12T21:00:00+07:00", endAt: "2026-10-12T21:30:00+07:00" }).end).toBe("2026-10-12T21:30");
  });
});

describe("isSlotBookable", () => {
  const slot = { startAt: "2026-10-12T19:00:00+07:00", endAt: "2026-10-12T20:00:00+07:00" };

  it("is bookable while it has not started", () => {
    expect(isSlotBookable(slot, new Date("2026-10-12T18:59:00+07:00"))).toBe(true);
  });

  it("is not once it has started, because a booking cannot begin in the past", () => {
    expect(isSlotBookable(slot, new Date("2026-10-12T19:00:00+07:00"))).toBe(false);
    expect(isSlotBookable(slot, new Date("2026-10-12T19:30:00+07:00"))).toBe(false);
  });
});
