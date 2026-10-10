import { describe, expect, it } from "vitest";
import { addDaysToKey, bangkokDateKey, formatThaiDate, fromApiDateTime, toApiDateTime, validateTimeRange, WEEKDAY_LABELS } from "@/lib/datetime";

// npm test runs with TZ=America/New_York, so any code that leans on the machine's zone fails here.

describe("toApiDateTime", () => {
  it("marks a datetime-local value as Bangkok time", () => {
    expect(toApiDateTime("2026-10-12T18:00")).toBe("2026-10-12T18:00:00+07:00");
  });
});

describe("fromApiDateTime", () => {
  it("shows a UTC instant as Bangkok time", () => {
    expect(fromApiDateTime("2026-10-12T11:00:00Z")).toBe("2026-10-12T18:00");
  });

  it("keeps a value that already carries +07:00", () => {
    expect(fromApiDateTime("2026-10-12T18:00:00+07:00")).toBe("2026-10-12T18:00");
  });

  it("rolls over to the next Bangkok day", () => {
    expect(fromApiDateTime("2026-10-12T17:30:00Z")).toBe("2026-10-13T00:30");
  });

  it.each(["2026-10-12T00:00", "2026-12-31T23:59"])("round-trips %s", (local) => {
    expect(fromApiDateTime(toApiDateTime(local))).toBe(local);
  });
});

describe("WEEKDAY_LABELS", () => {
  it("starts on Sunday and covers seven days", () => {
    expect(WEEKDAY_LABELS).toHaveLength(7);
    expect(WEEKDAY_LABELS[0]).toBe("อาทิตย์");
  });
});

describe("validateTimeRange", () => {
  it("accepts an end after the start, even across midnight", () => {
    expect(validateTimeRange("2026-10-12T18:00", "2026-10-12T20:00")).toBeNull();
    expect(validateTimeRange("2026-10-12T23:00", "2026-10-13T01:00")).toBeNull();
  });

  it.each([
    ["2026-10-12T20:00", "2026-10-12T18:00"],
    ["2026-10-12T18:00", "2026-10-12T18:00"],
  ])("rejects an end that is not after the start (%s -> %s)", (start, end) => {
    expect(validateTimeRange(start, end)).toBe("เวลาสิ้นสุดต้องหลังเวลาเริ่ม");
  });
});

describe("bangkokDateKey", () => {
  it("is the Bangkok calendar day of an instant", () => {
    expect(bangkokDateKey(new Date("2026-10-12T04:00:00Z"))).toBe("2026-10-12");
  });

  it("is already the next day in Bangkok while it is still evening in New York and UTC", () => {
    // 2026-10-12 17:30 UTC = 00:30 on the 13th in Bangkok = 13:30 on the 12th in New York.
    expect(bangkokDateKey(new Date("2026-10-12T17:30:00Z"))).toBe("2026-10-13");
  });

  it("is still the previous day just before Bangkok midnight", () => {
    expect(bangkokDateKey(new Date("2026-10-12T16:59:59Z"))).toBe("2026-10-12");
  });

  it("crosses a year end", () => {
    expect(bangkokDateKey(new Date("2026-12-31T20:00:00Z"))).toBe("2027-01-01");
  });
});

describe("addDaysToKey", () => {
  it("moves forward and backward", () => {
    expect(addDaysToKey("2026-10-12", 1)).toBe("2026-10-13");
    expect(addDaysToKey("2026-10-12", -1)).toBe("2026-10-11");
    expect(addDaysToKey("2026-10-12", 0)).toBe("2026-10-12");
  });

  it("crosses month and year boundaries and leap days", () => {
    expect(addDaysToKey("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDaysToKey("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysToKey("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDaysToKey("2027-03-01", -1)).toBe("2027-02-28");
  });
});

describe("formatThaiDate", () => {
  it("writes a date key as a Thai calendar date with its weekday, whatever the machine's zone", () => {
    const text = formatThaiDate("2026-10-12");

    expect(text).toContain("จันทร์"); // 12 October 2026 is a Monday
    expect(text).toContain("12");
    expect(text).toContain("ตุลาคม");
  });

  it("does not slip to the previous day west of Greenwich", () => {
    expect(formatThaiDate("2026-10-13")).toContain("อังคาร");
  });
});
