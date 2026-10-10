import { describe, expect, it } from "vitest";
import {
  addDaysToKey,
  bangkokClock,
  cancelDeadlineText,
  bangkokDateKey,
  formatThaiDateShort,
  formatThaiDateWithWeekday,
  formatThaiMonthYear,
  fromApiDateTime,
  thaiDateParts,
  WEEKDAY_LABELS,
} from "@/lib/datetime";

// npm test runs with TZ=America/New_York, so any code that leans on the machine's zone fails here.

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

});

describe("WEEKDAY_LABELS", () => {
  it("starts on Sunday and covers seven days", () => {
    expect(WEEKDAY_LABELS).toHaveLength(7);
    expect(WEEKDAY_LABELS[0]).toBe("อาทิตย์");
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

describe("thaiDateParts", () => {
  it("splits a date key into the pieces a date tile shows, in the Buddhist era", () => {
    expect(thaiDateParts("2026-10-12")).toEqual({
      weekday: 1,
      weekdayShort: "จ.",
      weekdayFull: "จันทร์",
      day: 12,
      monthShort: "ต.ค.",
      yearBE: 2569,
    });
  });

  it("knows Sunday is 0 and a January date in a new year", () => {
    expect(thaiDateParts("2026-10-11")).toMatchObject({ weekday: 0, weekdayShort: "อา.", weekdayFull: "อาทิตย์" });
    expect(thaiDateParts("2027-01-01")).toMatchObject({ weekdayShort: "ศ.", monthShort: "ม.ค.", yearBE: 2570 });
  });
});

describe("formatThaiDateShort and formatThaiDateWithWeekday", () => {
  it("writes the short form used on tiles and in the booking summary", () => {
    expect(formatThaiDateShort("2026-10-12")).toBe("จ. 12 ต.ค. 2569");
    expect(formatThaiDateWithWeekday("2026-10-12")).toBe("วันจันทร์ 12 ต.ค. 2569");
  });
});

describe("bangkokClock", () => {
  it("is HH:mm in Bangkok whatever the machine's zone", () => {
    expect(bangkokClock("2026-10-12T19:00:00+07:00")).toBe("19:00");
    expect(bangkokClock("2026-10-12T12:30:00Z")).toBe("19:30");
  });
});

describe("formatThaiMonthYear", () => {
  it("writes the month in full with the Buddhist-era year", () => {
    expect(formatThaiMonthYear("2026-10-12")).toBe("ตุลาคม พ.ศ. 2569");
    expect(formatThaiMonthYear("2027-01-01")).toBe("มกราคม พ.ศ. 2570");
  });
});

describe("cancelDeadlineText", () => {
  it("says until when a reservation can be cancelled, from its start and the restaurant's lead time", () => {
    expect(cancelDeadlineText("2026-10-12T12:00:00+07:00", 60)).toBe("ยกเลิกได้ถึง 11:00 วันที่ 12 ต.ค.");
  });

  it("moves to the previous day when the lead time reaches back past midnight", () => {
    expect(cancelDeadlineText("2026-10-12T00:30:00+07:00", 90)).toBe("ยกเลิกได้ถึง 23:00 วันที่ 11 ต.ค.");
  });

  it("uses Bangkok time whatever the machine's zone", () => {
    expect(cancelDeadlineText("2026-10-12T05:00:00Z", 30)).toBe("ยกเลิกได้ถึง 11:30 วันที่ 12 ต.ค.");
  });
});
