"use client";

import { CalendarOff } from "lucide-react";
import { DayStrip } from "@/components/day-strip";
import { EmptyState } from "@/components/empty-state";
import { ErrorAlert } from "@/components/error-alert";
import { SlotGrid, SlotLegend } from "@/components/slot-grid";
import { Skeleton } from "@/components/ui/skeleton";
import type { Booking } from "@/hooks/use-booking";
import { formatThaiMonthYear, thaiDateParts } from "@/lib/datetime";
import { closedWeekdayOf } from "@/lib/opening-hours";
import type { OpeningHour } from "@/lib/types";

/** "ช่วงว่าง": pick a day from the next seven, then a free hour. Picking only fills in the booking card. */
export function AvailabilityPicker({ booking, openingHours }: { booking: Booking; openingHours: OpeningHour[] }) {
  const { availability } = booking;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xl font-semibold md:text-[22px]">ช่วงว่าง</h2>
        <span className="text-sm text-muted-foreground">{formatThaiMonthYear(booking.dateKey)}</span>
      </div>

      <DayStrip
        days={booking.days}
        today={booking.today}
        selected={booking.dateKey}
        isClosed={(key) => closedWeekdayOf(openingHours, key)}
        onSelect={booking.selectDate}
      />

      <ErrorAlert error={booking.error} onRetry={booking.reload} />

      {booking.loading && !booking.error && (
        <div className="grid grid-cols-3 gap-1.5 md:grid-cols-4 md:gap-2" aria-label="กำลังโหลดช่วงว่าง">
          {Array.from({ length: 8 }, (_, index) => (
            <Skeleton key={index} className="h-14" />
          ))}
        </div>
      )}

      {availability?.closed && (
        <EmptyState
          icon={CalendarOff}
          title={`ร้านปิดวัน${thaiDateParts(booking.dateKey).weekdayFull}`}
          description="วันนี้โต๊ะหาไม่เจอจริง ๆ ลองเลือกวันอื่นดูนะ"
        />
      )}

      {availability && !availability.closed && (
        <>
          <SlotGrid
            slots={booking.slots}
            capacity={availability.capacity}
            now={booking.now}
            selection={booking.selection}
            onPick={booking.pickSlot}
          />
          <SlotLegend />
        </>
      )}
    </div>
  );
}
