import { describe, expect, it } from "vitest";
import { fromApiDateTime, toApiDateTime, validateTimeRange, WEEKDAY_LABELS } from "@/lib/datetime";

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
