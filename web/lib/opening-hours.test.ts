import { describe, expect, it } from "vitest";
import { closedWeekdayOf, emptyDayRows, openingSummary, rowsFromHours, rowsToHours, shortHours, validateRows } from "@/lib/opening-hours";

describe("emptyDayRows", () => {
  it("gives seven closed days, Sunday (0) to Saturday (6), with default hours", () => {
    const rows = emptyDayRows();
    expect(rows.map((r) => r.weekday)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(rows.every((r) => !r.enabled && r.open === "11:00" && r.close === "22:00")).toBe(true);
  });
});

describe("rowsFromHours / rowsToHours", () => {
  it("keeps Sunday (weekday 0 is falsy in JS)", () => {
    const hours = [{ weekday: 0, open: "11:00", close: "22:00" }];
    expect(rowsToHours(rowsFromHours(hours))).toEqual(hours);
  });

  it("enables only the listed weekdays and keeps their times", () => {
    const rows = rowsFromHours([{ weekday: 3, open: "09:30", close: "18:00" }]);
    expect(rows.filter((r) => r.enabled).map((r) => r.weekday)).toEqual([3]);
    expect(rows[3]).toEqual({ weekday: 3, enabled: true, open: "09:30", close: "18:00" });
  });

  it("leaves out disabled days and sorts by weekday", () => {
    const rows = emptyDayRows();
    rows[6] = { weekday: 6, enabled: true, open: "10:00", close: "20:00" };
    rows[1] = { weekday: 1, enabled: true, open: "11:00", close: "22:00" };
    rows[2] = { weekday: 2, enabled: false, open: "08:00", close: "09:00" };
    expect(rowsToHours(rows.reverse())).toEqual([
      { weekday: 1, open: "11:00", close: "22:00" },
      { weekday: 6, open: "10:00", close: "20:00" },
    ]);
  });
});

describe("validateRows", () => {
  it("asks for at least one open day", () => {
    expect(validateRows(emptyDayRows())).toBe("ต้องเปิดอย่างน้อย 1 วัน");
  });

  it("names the day whose closing time is not after opening", () => {
    const rows = emptyDayRows();
    rows[1] = { weekday: 1, enabled: true, open: "22:00", close: "11:00" };
    expect(validateRows(rows)).toContain("จันทร์");
  });

  it("rejects closing exactly at opening time", () => {
    const rows = emptyDayRows();
    rows[5] = { weekday: 5, enabled: true, open: "11:00", close: "11:00" };
    expect(validateRows(rows)).not.toBeNull();
  });

  it("ignores wrong times on a closed day", () => {
    const rows = emptyDayRows();
    rows[1] = { weekday: 1, enabled: true, open: "11:00", close: "22:00" };
    rows[2] = { weekday: 2, enabled: false, open: "22:00", close: "11:00" };
    expect(validateRows(rows)).toBeNull();
  });

  it("asks for both times when an open day has an empty one", () => {
    for (const blank of [{ open: "" }, { close: "" }]) {
      const rows = emptyDayRows();
      rows[2] = { weekday: 2, enabled: true, open: "11:00", close: "22:00", ...blank };
      expect(validateRows(rows)).toBe("กรอกเวลาเปิดและเวลาปิด (อังคาร)");
    }
  });

  it("ignores empty times on a closed day", () => {
    const rows = emptyDayRows();
    rows[1] = { weekday: 1, enabled: true, open: "11:00", close: "22:00" };
    rows[3] = { weekday: 3, enabled: false, open: "", close: "" };
    expect(validateRows(rows)).toBeNull();
  });

  it("accepts a valid week", () => {
    const rows = emptyDayRows().map((r) => ({ ...r, enabled: true }));
    expect(validateRows(rows)).toBeNull();
  });
});

const everyDay = (open: string, close: string, except: number[] = []) =>
  [0, 1, 2, 3, 4, 5, 6].filter((weekday) => !except.includes(weekday)).map((weekday) => ({ weekday, open, close }));

describe("shortHours", () => {
  it("drops the minutes when they are all :00", () => {
    expect(shortHours("11:00", "22:00")).toBe("11–22");
  });

  it("keeps the minutes of whichever side has them", () => {
    expect(shortHours("10:30", "21:00")).toBe("10:30–21");
    expect(shortHours("11:00", "22:30")).toBe("11–22:30");
  });
});

describe("closedWeekdayOf", () => {
  it("says a date is closed when its weekday is not listed, Sunday included", () => {
    const hours = everyDay("11:00", "22:00", [0]);

    expect(closedWeekdayOf(hours, "2026-10-11")).toBe(true); // a Sunday
    expect(closedWeekdayOf(hours, "2026-10-12")).toBe(false); // a Monday
  });
});

describe("openingSummary", () => {
  it("says every day when no day is closed", () => {
    expect(openingSummary(everyDay("11:00", "22:00"))).toBe("เปิดทุกวัน 11:00–22:00");
  });

  it("names the closed days", () => {
    expect(openingSummary(everyDay("11:00", "22:00", [0]))).toBe("เปิด 11:00–22:00 · ปิดวันอาทิตย์");
    expect(openingSummary(everyDay("11:00", "22:00", [0, 1]))).toBe("เปิด 11:00–22:00 · ปิดวันอาทิตย์ จันทร์");
  });

  it("gives the widest span when the days differ", () => {
    const hours = [
      { weekday: 1, open: "11:00", close: "22:00" },
      { weekday: 2, open: "10:30", close: "21:00" },
    ];

    expect(openingSummary(hours)).toBe("เปิด 10:30–22:00 (เวลาแต่ละวันต่างกัน) · ปิดวันอาทิตย์ พุธ พฤหัสบดี ศุกร์ เสาร์");
  });

  it("has nothing to say for a restaurant with no opening hours", () => {
    expect(openingSummary([])).toBe("ยังไม่ได้ตั้งเวลาเปิด");
  });
});
