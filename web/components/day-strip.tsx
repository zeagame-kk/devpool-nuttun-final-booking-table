import { thaiDateParts } from "@/lib/datetime";

/** The next days as tiles: weekday ("วันนี้" for today), day number, and the month or "ปิด" when the restaurant is closed. */
export function DayStrip({
  days,
  today,
  selected,
  isClosed,
  onSelect,
}: {
  days: string[];
  today: string;
  selected: string;
  isClosed: (key: string) => boolean;
  onSelect: (key: string) => void;
}) {
  return (
    <div role="group" aria-label="เลือกวัน" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 md:mx-0 md:grid md:grid-cols-7 md:overflow-visible md:px-0">
      {days.map((key) => {
        const parts = thaiDateParts(key);
        const isSelected = key === selected;
        const closed = isClosed(key);
        return (
          <button
            key={key}
            type="button"
            aria-pressed={isSelected}
            aria-label={`${key === today ? "วันนี้ " : ""}${parts.weekdayFull} ${parts.day} ${parts.monthShort}${closed ? " ร้านปิด" : ""}`}
            onClick={() => onSelect(key)}
            className={`flex h-[68px] w-14 flex-none flex-col items-center justify-center rounded-[14px] border-[1.5px] outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:h-[72px] md:w-auto ${
              isSelected ? "border-primary bg-primary text-primary-foreground" : closed ? "border-border bg-muted text-muted-foreground" : "border-border bg-card"
            }`}
          >
            <span className={`text-xs md:text-[13px] ${isSelected ? "text-primary-foreground/95" : "text-muted-foreground"}`}>
              {key === today ? "วันนี้" : parts.weekdayShort}
            </span>
            <span className="text-xl leading-tight font-bold md:text-[22px]">{parts.day}</span>
            <span className={`text-[11px] md:text-xs ${isSelected ? "text-primary-foreground/95" : "text-muted-foreground"}`}>
              {closed ? "ปิด" : parts.monthShort}
            </span>
          </button>
        );
      })}
    </div>
  );
}

