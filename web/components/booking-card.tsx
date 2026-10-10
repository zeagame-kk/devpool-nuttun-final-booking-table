"use client";

import Link from "next/link";
import { Button } from "@/components/bases/button";
import { ChipGroup } from "@/components/chip-group";
import { ErrorAlert } from "@/components/error-alert";
import { Stepper } from "@/components/stepper";
import type { Booking } from "@/hooks/use-booking";
import { bangkokClock, formatThaiDateShort, formatThaiDateWithWeekday } from "@/lib/datetime";
import { isApiCode } from "@/lib/errors";

function Outcome({ booking }: { booking: Booking }) {
  const { result } = booking;
  if (!result) return null;
  if (!result.ok) {
    return (
      <ErrorAlert
        error={result.error}
        hint={isApiCode(result.error, "capacity_exceeded") ? "ลองลดจำนวนคน หรือเลือกช่วงเวลาอื่น" : undefined}
      />
    );
  }
  return (
    <div role="status" className="flex flex-col rounded-xl bg-success-subtle px-4 py-3 text-success-ink">
      <span className="text-[15px] font-semibold">จองสำเร็จ</span>
      <span className="text-[13px]">
        ดูหรือแก้ได้ที่{" "}
        <Link href="/my/reservations" className="font-semibold underline">
          การจองของฉัน
        </Link>
      </span>
    </div>
  );
}

function BookButton({ booking, className }: { booking: Booking; className?: string }) {
  return (
    <Button size="large" className={className} disabled={!booking.selection || booking.submitting} onClick={() => void booking.book()}>
      {booking.submitting ? "กำลังจอง…" : "จองโต๊ะ"}
    </Button>
  );
}

/** The booking box beside the restaurant on a wide screen: what was picked, how long, how many, and the button. */
export function BookingCard({ booking, capacity }: { booking: Booking; capacity: number }) {
  const { times } = booking;

  return (
    <aside
      aria-label="จองโต๊ะ"
      className="sticky top-24 flex flex-col gap-4 rounded-[20px] border border-border-subtle bg-card p-[22px] shadow-[0_10px_30px_rgba(26,28,32,0.08)]"
    >
      <h2 className="text-xl font-bold">จองโต๊ะ</h2>
      <div className="flex flex-col gap-1.5 rounded-[14px] bg-background p-3.5">
        <span className="text-[13px] text-muted-foreground">วันและเวลา</span>
        {times ? (
          <>
            <span className="text-base font-semibold">{formatThaiDateWithWeekday(booking.dateKey)}</span>
            <span className="text-[22px] font-bold text-primary">
              {bangkokClock(times.startAt)}–{bangkokClock(times.endAt)}
            </span>
          </>
        ) : (
          <span className="text-[15px] text-muted-foreground">แตะช่วงเวลาที่ว่างทางซ้าย</span>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold">ระยะเวลา</span>
        <ChipGroup
          label="ระยะเวลา"
          chips={booking.durations.map((d) => ({ value: d.hours, label: `${d.hours} ชม.`, enabled: d.enabled }))}
          value={booking.hours}
          onChange={booking.chooseHours}
        />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">จำนวนคน</span>
        <Stepper label="จำนวนคน" unit="คน" value={booking.party} min={1} max={capacity} onChange={booking.changeParty} />
      </div>
      <Outcome booking={booking} />
      <BookButton booking={booking} className="w-full" />
      <p className="text-center text-[13px] text-muted-foreground">เวลาทั้งหมดเป็นเวลาประเทศไทย (UTC+7)</p>
    </aside>
  );
}

/** The same on a phone: a bar fixed to the bottom of the screen, so the button is never scrolled away. */
export function BookingBar({ booking, capacity }: { booking: Booking; capacity: number }) {
  const { times } = booking;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex flex-col gap-2.5 border-t bg-card px-4 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(26,28,32,0.08)] md:hidden">
      <Outcome booking={booking} />
      {times && (
        <ChipGroup
          label="ระยะเวลา"
          chips={booking.durations.map((d) => ({ value: d.hours, label: `${d.hours} ชม.`, enabled: d.enabled }))}
          value={booking.hours}
          onChange={booking.chooseHours}
        />
      )}
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex min-w-0 flex-col">
          {times ? (
            <>
              <span className="text-[13px] text-muted-foreground">{formatThaiDateShort(booking.dateKey)}</span>
              <span className="text-[17px] font-bold">
                {bangkokClock(times.startAt)}–{bangkokClock(times.endAt)}
              </span>
            </>
          ) : (
            <span className="text-sm text-muted-foreground">เลือกช่วงเวลาด้านบน</span>
          )}
        </div>
        <Stepper label="จำนวนคน" unit="คน" value={booking.party} min={1} max={capacity} onChange={booking.changeParty} />
      </div>
      <BookButton booking={booking} />
    </div>
  );
}
