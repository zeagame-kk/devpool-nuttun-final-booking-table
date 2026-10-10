import type { HourLoad, LoadState } from "@/lib/owner-day";

const COLOR: Record<LoadState, string> = {
  idle: "bg-border",
  normal: "bg-primary",
  near: "bg-accent",
  full: "bg-destructive-strong",
};

const STATE_LABEL: Record<LoadState, string> = { idle: "ว่าง", normal: "มีการจอง", near: "ใกล้เต็ม", full: "เต็ม" };

/** One bar per open hour, as tall as the share of seats in use; amber when almost full, red when full. */
export function DayLoadBars({ bars }: { bars: HourLoad[] }) {
  return (
    <div role="img" aria-label="ที่นั่งที่ใช้ในแต่ละชั่วโมง" className="flex flex-col gap-1">
      <div className="grid h-9 items-end gap-1" style={{ gridTemplateColumns: `repeat(${bars.length}, minmax(0, 1fr))` }}>
        {bars.map((bar) => (
          <div
            key={bar.hour}
            title={`${bar.hour}:00 ${STATE_LABEL[bar.state]} ${bar.used} คน`}
            className={`rounded ${COLOR[bar.state]}`}
            style={{ height: `${bar.heightPercent}%` }}
          />
        ))}
      </div>
      <div className="grid gap-1 text-center text-[11px] text-muted-foreground" style={{ gridTemplateColumns: `repeat(${bars.length}, minmax(0, 1fr))` }}>
        {bars.map((bar) => (
          <span key={bar.hour}>{bar.hour}</span>
        ))}
      </div>
    </div>
  );
}

export function LoadLegend() {
  const items: { label: string; color: string }[] = [
    { label: "ที่นั่งที่จองแล้ว", color: COLOR.normal },
    { label: "ใกล้เต็ม", color: COLOR.near },
    { label: "เต็ม", color: COLOR.full },
  ];

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5">
          <span aria-hidden="true" className={`size-2.5 rounded-[3px] ${item.color}`} />
          {item.label}
        </span>
      ))}
      <span className="md:ml-auto">แถบคำนวณจากการจองที่ยืนยันแล้ว</span>
    </div>
  );
}
