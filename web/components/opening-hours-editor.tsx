"use client";

import { Input } from "@/components/ui/input";
import { WEEKDAY_LABELS } from "@/lib/datetime";
import type { DayRow } from "@/lib/opening-hours";

interface OpeningHoursEditorProps {
  rows: DayRow[];
  onChange: (rows: DayRow[]) => void;
}

/** A switch per day (a real checkbox drawn as a switch) and, for an open day, its opening and closing time. */
export function OpeningHoursEditor({ rows, onChange }: OpeningHoursEditorProps) {
  function update(weekday: number, patch: Partial<DayRow>) {
    onChange(rows.map((row) => (row.weekday === weekday ? { ...row, ...patch } : row)));
  }

  return (
    <fieldset className="flex flex-col gap-1.5 rounded-[18px] border border-border-subtle bg-card p-[22px]">
      <legend className="sr-only">เวลาเปิด (เวลาประเทศไทย)</legend>
      <div className="flex items-center justify-between pb-2">
        <div className="flex flex-col">
          <span className="text-lg font-semibold">เวลาเปิด</span>
          <span className="text-[13px] text-muted-foreground">เวลาประเทศไทย</span>
        </div>
        <button
          type="button"
          onClick={() => onChange(rows.map((row) => ({ ...row, enabled: true })))}
          className="text-sm font-semibold text-primary-strong hover:underline"
        >
          เปิดทุกวัน
        </button>
      </div>
      {rows.map((row) => (
        <div key={row.weekday} className="grid min-h-[52px] grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1 border-t border-background py-1.5 sm:grid-cols-[52px_110px_minmax(0,1fr)]">
          <input
            type="checkbox"
            role="switch"
            aria-label={`เปิด${WEEKDAY_LABELS[row.weekday]}`}
            checked={row.enabled}
            onChange={(e) => update(row.weekday, { enabled: e.target.checked })}
            className="relative h-6 w-10 shrink-0 cursor-pointer appearance-none rounded-full bg-input outline-none transition-colors before:absolute before:top-0.5 before:left-0.5 before:size-5 before:rounded-full before:bg-card before:shadow-sm before:transition-transform before:content-[''] checked:bg-primary checked:before:translate-x-4 focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <span className="text-[15px] font-semibold">{WEEKDAY_LABELS[row.weekday]}</span>
          {row.enabled ? (
            <div className="col-span-2 flex items-center gap-2.5 sm:col-span-1">
              <Input
                type="time"
                aria-label={`${WEEKDAY_LABELS[row.weekday]} เวลาเปิด`}
                className="h-10 w-28 rounded-[10px]"
                required
                value={row.open}
                onChange={(e) => update(row.weekday, { open: e.target.value })}
              />
              <span className="text-sm text-muted-foreground">ถึง</span>
              <Input
                type="time"
                aria-label={`${WEEKDAY_LABELS[row.weekday]} เวลาปิด`}
                className="h-10 w-28 rounded-[10px]"
                required
                value={row.close}
                onChange={(e) => update(row.weekday, { close: e.target.value })}
              />
            </div>
          ) : (
            <span className="col-span-2 text-[15px] text-muted-foreground sm:col-span-1">ปิดทั้งวัน</span>
          )}
        </div>
      ))}
    </fieldset>
  );
}
