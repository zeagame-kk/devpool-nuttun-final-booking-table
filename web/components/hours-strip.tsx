import { WEEKDAY_SHORT } from "@/lib/datetime";
import { shortHours } from "@/lib/opening-hours";
import type { OpeningHour } from "@/lib/types";

/** The week at a glance: seven cells, Sunday first, with "11–22" or "ปิด"; `highlight` is the weekday of the day being looked at. */
export function HoursStrip({ hours, highlight }: { hours: OpeningHour[]; highlight: number }) {
  return (
    <div className="grid grid-cols-7 overflow-hidden rounded-[14px] border border-border-subtle bg-card">
      {WEEKDAY_SHORT.map((label, weekday) => {
        const open = hours.find((hour) => hour.weekday === weekday);
        return (
          <div
            key={weekday}
            className={`flex flex-col items-center gap-0.5 px-1 py-3 text-center ${weekday === highlight ? "bg-primary-subtle" : ""}`}
          >
            <span className="text-sm font-semibold">{label}</span>
            <span className={`text-[13px] ${open ? "text-muted-foreground" : "text-destructive-strong"}`}>
              {open ? shortHours(open.open, open.close) : "ปิด"}
            </span>
          </div>
        );
      })}
    </div>
  );
}
