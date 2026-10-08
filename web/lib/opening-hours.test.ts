import { describe, expect, it } from "vitest";
import { emptyDayRows, rowsFromHours, rowsToHours, validateRows } from "./opening-hours";

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

  it("accepts a valid week", () => {
    const rows = emptyDayRows().map((r) => ({ ...r, enabled: true }));
    expect(validateRows(rows)).toBeNull();
  });
});
