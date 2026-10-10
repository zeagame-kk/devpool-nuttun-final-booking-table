"use client";

import { useState } from "react";
import { CalendarOff, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/bases/button";
import { EmptyState } from "@/components/empty-state";
import { ErrorAlert } from "@/components/error-alert";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAsync } from "@/hooks/use-async";
import { apiFetch } from "@/lib/api";
import { isSlotBookable, seatLevel, slotToFormValues, type SeatLevel } from "@/lib/availability";
import { addDaysToKey, bangkokDateKey, formatThaiDate, fromApiDateTime } from "@/lib/datetime";
import type { Availability, AvailabilitySlot } from "@/lib/types";

const LEVEL_STYLE: Record<SeatLevel, string> = {
  open: "border-primary-border bg-primary-subtle text-primary-strong hover:border-primary",
  low: "border-accent bg-accent-subtle text-accent-strong hover:border-accent-strong",
  full: "border-destructive/30 bg-destructive/10 text-destructive",
};

/** "19:00" of a slot's start or end, in Bangkok time. */
function clock(iso: string): string {
  return fromApiDateTime(iso).slice(11);
}

function SlotButton({
  slot,
  capacity,
  now,
  onPick,
}: {
  slot: AvailabilitySlot;
  capacity: number;
  now: Date;
  onPick: (slot: AvailabilitySlot) => void;
}) {
  const level = seatLevel(slot.remainingSeats, capacity);
  const started = !isSlotBookable(slot, now);
  const disabled = started || level === "full";
  const note = level === "full" ? "เต็ม" : started ? "ผ่านไปแล้ว" : `เหลือ ${slot.remainingSeats} ที่`;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onPick(slot)}
      className={`flex flex-col items-start rounded-lg border px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed ${
        started && level !== "full" ? "border-border bg-muted text-muted-foreground opacity-60" : LEVEL_STYLE[level]
      }`}
    >
      <span className="font-medium">
        {clock(slot.startAt)}–{clock(slot.endAt)}
      </span>
      <span className="text-xs">{note}</span>
    </button>
  );
}

/**
 * How full the restaurant is, hour by hour, for one day. Picking a free hour hands its times to the
 * booking form. It is only a snapshot: the server decides when the booking is actually made.
 * Change `refreshKey` to load it again, for example after a booking.
 */
export function AvailabilityPanel({
  restaurantId,
  refreshKey,
  onPick,
}: {
  restaurantId: number;
  refreshKey: number;
  onPick: (values: { start: string; end: string }) => void;
}) {
  const today = bangkokDateKey(new Date());
  const [date, setDate] = useState(today);
  const { data: loaded, error, loading, reload } = useAsync(
    () => apiFetch<Availability>(`/restaurants/${restaurantId}/availability?date=${date}`),
    [restaurantId, date, refreshKey],
  );
  // useAsync keeps the last answer while a new one loads; never show another day's hours under this date.
  const data = loaded?.date === date ? loaded : undefined;
  const now = new Date();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="small"
          aria-label="วันก่อนหน้า"
          disabled={date <= today}
          onClick={() => setDate(addDaysToKey(date, -1))}
        >
          <ChevronLeft aria-hidden="true" />
        </Button>
        <Input
          type="date"
          aria-label="วันที่"
          className="w-auto"
          min={today}
          value={date}
          onChange={(e) => e.target.value >= today && setDate(e.target.value)}
        />
        <Button variant="outline" size="small" aria-label="วันถัดไป" onClick={() => setDate(addDaysToKey(date, 1))}>
          <ChevronRight aria-hidden="true" />
        </Button>
        <span className="text-sm text-muted-foreground">{formatThaiDate(date)}</span>
      </div>

      <ErrorAlert error={error} onRetry={reload} />

      {!data && loading && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="กำลังโหลดช่วงว่าง">
          {Array.from({ length: 8 }, (_, index) => (
            <Skeleton key={index} className="h-14" />
          ))}
        </div>
      )}

      {data?.closed && <EmptyState icon={CalendarOff} title="ร้านปิดในวันนี้" description="ลองเลือกวันอื่น" />}

      {data && !data.closed && (
        <div className={`grid grid-cols-2 gap-2 sm:grid-cols-4 ${loading ? "opacity-60" : ""}`}>
          {data.slots.map((slot) => (
            <SlotButton
              key={slot.startAt}
              slot={slot}
              capacity={data.capacity}
              now={now}
              onPick={(picked) => onPick(slotToFormValues(picked))}
            />
          ))}
        </div>
      )}

      {data && !data.closed && (
        <p className="text-xs text-muted-foreground">
          จำนวนที่เหลือเป็นข้อมูลล่าสุดที่โหลดมา ระบบจะตรวจอีกครั้งตอนกดจอง
        </p>
      )}
    </div>
  );
}
