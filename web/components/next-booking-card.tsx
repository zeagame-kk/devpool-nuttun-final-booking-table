import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { bangkokClock, bangkokDateKey, thaiDateParts } from "@/lib/datetime";
import type { MyReservation } from "@/lib/types";

/** The caller's soonest upcoming reservation on a dark card: a date tile, where, when and how many. The whole card opens "my reservations". */
export function NextBookingCard({ reservation }: { reservation: MyReservation }) {
  const parts = thaiDateParts(bangkokDateKey(new Date(reservation.startAt)));

  return (
    <Link
      href="/my/reservations"
      className="flex flex-col gap-3.5 rounded-[20px] bg-surface-inverse p-4 text-surface-inverse-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:p-5"
    >
      <span className="text-xs text-surface-inverse-muted md:text-sm">การจองถัดไปของคุณ</span>
      <div className="flex items-center gap-3.5">
        <div className="flex size-[52px] flex-none flex-col items-center justify-center rounded-xl bg-card leading-tight text-foreground md:size-16 md:rounded-[14px]">
          <span className="text-[11px] text-muted-foreground md:text-xs">{parts.weekdayShort}</span>
          <span className="text-xl font-bold md:text-2xl">{parts.day}</span>
          <span className="hidden text-xs text-muted-foreground md:block">{parts.monthShort}</span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-base font-semibold md:text-lg">{reservation.restaurant.name}</span>
          <span className="text-[13px] text-surface-inverse-muted md:text-[15px]">
            {bangkokClock(reservation.startAt)}–{bangkokClock(reservation.endAt)} · {reservation.guests} คน
          </span>
        </div>
        <span aria-hidden="true" className="text-xl text-surface-inverse-link md:hidden">
          ›
        </span>
      </div>
      <div className="hidden items-center justify-between border-t border-surface-inverse-border pt-3 md:flex">
        <StatusBadge status={reservation.status} />
        <span className="text-sm font-semibold text-surface-inverse-link">จัดการการจอง →</span>
      </div>
    </Link>
  );
}
