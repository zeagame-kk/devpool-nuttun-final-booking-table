import { describe, expect, it } from "vitest";
import { fromApiDateTime, toApiDateTime, WEEKDAY_LABELS } from "@/lib/datetime";

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
