"use client";

import { Input } from "@/components/ui/input";
import { WEEKDAY_LABELS } from "@/lib/datetime";
import type { DayRow } from "@/lib/opening-hours";

interface OpeningHoursEditorProps {
  rows: DayRow[];
  onChange: (rows: DayRow[]) => void;
}

export function OpeningHoursEditor({ rows, onChange }: OpeningHoursEditorProps) {
  function update(weekday: number, patch: Partial<DayRow>) {
    onChange(rows.map((row) => (row.weekday === weekday ? { ...row, ...patch } : row)));
  }

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row) => (
        <div key={row.weekday} className="flex flex-wrap items-center gap-3">
          <label className="flex w-32 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={row.enabled}
              onChange={(e) => update(row.weekday, { enabled: e.target.checked })}
            />
            {WEEKDAY_LABELS[row.weekday]}
          </label>
          <Input
            type="time"
            aria-label={`${WEEKDAY_LABELS[row.weekday]} เวลาเปิด`}
            className="w-32"
            disabled={!row.enabled}
            required
            value={row.open}
            onChange={(e) => update(row.weekday, { open: e.target.value })}
          />
          <span className="text-muted-foreground">ถึง</span>
          <Input
            type="time"
            aria-label={`${WEEKDAY_LABELS[row.weekday]} เวลาปิด`}
            className="w-32"
            disabled={!row.enabled}
            required
            value={row.close}
            onChange={(e) => update(row.weekday, { close: e.target.value })}
          />
          {!row.enabled && <span className="text-sm text-muted-foreground">ปิด</span>}
        </div>
      ))}
    </div>
  );
}
