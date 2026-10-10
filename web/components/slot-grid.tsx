import { slotState, type Selection, type SlotState } from "@/lib/booking";
import { bangkokClock } from "@/lib/datetime";
import type { AvailabilitySlot } from "@/lib/types";

const STYLE: Record<SlotState, { box: string; time: string; sub: string }> = {
  avail: { box: "border-border bg-card hover:border-primary", time: "text-foreground", sub: "text-success" },
  near: { box: "border-accent-border bg-accent-subtle hover:border-accent-strong", time: "text-foreground", sub: "text-accent-strong" },
  full: { box: "border-muted bg-muted", time: "text-muted-foreground", sub: "text-muted-foreground" },
  past: { box: "border-dashed border-border opacity-55", time: "text-muted-foreground", sub: "text-muted-foreground" },
  selected: { box: "border-primary bg-primary", time: "text-primary-foreground", sub: "text-primary-foreground" },
  range: { box: "border-primary bg-primary-subtle", time: "text-primary-ink", sub: "text-primary-ink" },
  conflict: { box: "border-destructive bg-destructive-subtle", time: "text-destructive-strong", sub: "text-destructive-strong" },
};

function note(state: SlotState, remainingSeats: number): string {
  if (state === "past") return "ผ่านไปแล้ว";
  if (state === "full" || (state === "conflict" && remainingSeats === 0)) return "เต็ม";
  return `เหลือ ${remainingSeats} ที่`;
}

/**
 * One tile per hour of the day. Free and almost-full tiles can be picked; full and past ones cannot.
 * The chosen hours are drawn as one block (a full hour inside it shows as a conflict).
 */
export function SlotGrid({
  slots,
  capacity,
  now,
  selection,
  onPick,
}: {
  slots: AvailabilitySlot[];
  capacity: number;
  now: Date;
  selection: Selection | null;
  onPick: (index: number) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-1.5 md:grid-cols-4 md:gap-2">
      {slots.map((slot, index) => {
        const state = slotState({ slot, index, capacity, now, selection });
        const style = STYLE[state];
        const start = bangkokClock(slot.startAt);
        return (
          <button
            key={slot.startAt}
            type="button"
            disabled={state === "past" || state === "full"}
            aria-pressed={state === "selected" || state === "range" || state === "conflict"}
            onClick={() => onPick(index)}
            className={`flex min-h-11 flex-col items-start rounded-[10px] border-[1.5px] px-2.5 py-2 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 enabled:cursor-pointer disabled:cursor-not-allowed md:rounded-xl md:px-3 md:py-2.5 ${style.box}`}
          >
            <span className={`text-[15px] font-semibold md:text-base ${style.time}`}>
              <span className="md:hidden">{start}</span>
              <span className="hidden md:inline">
                {start}–{bangkokClock(slot.endAt)}
              </span>
            </span>
            <span className={`text-xs md:text-[13px] ${style.sub}`}>{note(state, slot.remainingSeats)}</span>
          </button>
        );
      })}
    </div>
  );
}

const LEGEND: { label: string; swatch: string }[] = [
  { label: "ว่าง", swatch: "border-[1.5px] border-border bg-card" },
  { label: "ใกล้เต็ม", swatch: "bg-accent-border" },
  { label: "เต็ม", swatch: "bg-muted" },
  { label: "ผ่านไปแล้ว", swatch: "border-[1.5px] border-dashed border-border" },
];

export function SlotLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
      {LEGEND.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5">
          <span aria-hidden="true" className={`size-2.5 rounded-[3px] ${item.swatch}`} />
          {item.label}
        </span>
      ))}
      <span className="md:ml-auto md:text-right">จำนวนที่เหลือเป็นข้อมูลล่าสุดที่โหลดมา ระบบจะตรวจอีกครั้งตอนกดจอง</span>
    </div>
  );
}
