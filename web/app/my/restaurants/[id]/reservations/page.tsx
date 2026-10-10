"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { AuthGuard } from "@/components/auth-guard";
import { DayLoadBars, LoadLegend } from "@/components/day-load-bars";
import { EmptyState } from "@/components/empty-state";
import { ErrorAlert } from "@/components/error-alert";
import { RestaurantImage } from "@/components/restaurant-card";
import { SegmentedControl, type Segment } from "@/components/segmented-control";
import { StatCard } from "@/components/stat-card";
import { STATUS_LABELS, StatusBadge } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/user-avatar";
import { useAsync } from "@/hooks/use-async";
import { apiFetch } from "@/lib/api";
import { bangkokClock, bangkokDateKey, formatThaiDateWithWeekday, thaiDateParts } from "@/lib/datetime";
import { groupReservationsByDay, hourlyLoad } from "@/lib/owner-day";
import { summarizeReservations } from "@/lib/stats";
import type { ListResponse, OpeningHour, OwnerReservation, ReservationStatus, RestaurantDetail } from "@/lib/types";

/** The hours the bars cover for a weekday: that day's opening hours, or the span of the whole week for an odd day with bookings. */
function barsHours(openingHours: OpeningHour[], weekday: number): { open: string; close: string } {
  const day = openingHours.find((hour) => hour.weekday === weekday);
  if (day) return { open: day.open, close: day.close };
  if (openingHours.length === 0) return { open: "11:00", close: "22:00" };

  return { open: openingHours.map((h) => h.open).sort()[0], close: openingHours.map((h) => h.close).sort().at(-1) as string };
}

function RestaurantReservations() {
  const { id } = useParams<{ id: string }>();
  const [status, setStatus] = useState<"" | ReservationStatus>("");
  const [now] = useState(() => new Date());
  const restaurant = useAsync(() => apiFetch<RestaurantDetail>(`/restaurants/${id}`), [id]);
  // Everything is loaded once and filtered here, so the numbers above the list do not change with the filter.
  const reservations = useAsync(() => apiFetch<ListResponse<OwnerReservation>>(`/restaurants/${id}/reservations`), [id]);

  const detail = restaurant.data;
  const all = reservations.data?.results;
  const summary = all ? summarizeReservations(all, now) : null;
  const groups = all ? groupReservationsByDay(all, status, bangkokDateKey(now)) : [];
  const dash = "–";

  const segments: Segment<"" | ReservationStatus>[] = [
    { value: "", label: "ทั้งหมด", count: all?.length ?? 0 },
    { value: "confirmed", label: STATUS_LABELS.confirmed, count: all?.filter((r) => r.status === "confirmed").length ?? 0 },
    { value: "cancelled", label: STATUS_LABELS.cancelled, count: all?.filter((r) => r.status === "cancelled").length ?? 0 },
  ];

  return (
    <div className="flex flex-col gap-5 md:gap-6">
      <div className="flex flex-col gap-3.5">
        <p className="text-[15px] text-muted-foreground">
          <Link href="/my/restaurants" className="hover:text-foreground">
            ร้านของฉัน
          </Link>{" "}
          <span className="text-border">/</span> {detail?.name ?? ""}
        </p>
        <div className="flex items-center gap-4">
          {detail && <RestaurantImage imageUrl={detail.imageUrl} name={detail.name} className="size-14 shrink-0 rounded-[14px]" />}
          <div className="flex min-w-0 flex-col">
            <h1 className="text-2xl leading-tight font-bold md:text-[28px]">การจองของร้าน{detail ? ` ${detail.name}` : ""}</h1>
            <p className="text-sm text-muted-foreground">{detail ? `ที่นั่ง ${detail.seatingCapacity} · ดูได้อย่างเดียว` : "ดูได้อย่างเดียว"}</p>
          </div>
        </div>
      </div>

      <ErrorAlert error={reservations.error} onRetry={reservations.reload} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <StatCard tone="primary" label="วันนี้" value={summary?.today ?? dash} hint="การจองที่ยืนยันแล้วของวันนี้" />
        <StatCard label="กำลังจะถึง" value={summary?.upcoming ?? dash} />
        <StatCard label="แขกที่กำลังจะมา" value={summary?.upcomingGuests ?? dash} hint="รวมทุกการจองที่กำลังจะถึง" />
        <StatCard label="ยกเลิกแล้ว" value={summary?.cancelled ?? dash} muted />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 className="text-xl font-semibold">รายการจอง</h2>
        <SegmentedControl label="กรองตามสถานะ" segments={segments} value={status} onChange={setStatus} />
      </div>

      {!reservations.data && !reservations.error && <Skeleton className="h-40" />}
      {all && all.length === 0 && (
        <EmptyState icon={CalendarDays} title="ยังไม่มีการจอง" description="เมื่อลูกค้าจองโต๊ะที่ร้านนี้ รายการจะมาแสดงที่นี่" />
      )}
      {all && all.length > 0 && groups.length === 0 && <p className="text-muted-foreground">ไม่มีรายการที่ตรงกับตัวกรอง</p>}

      {groups.map((group) => {
        const weekday = thaiDateParts(group.dateKey).weekday;
        const hours = detail ? barsHours(detail.openingHours, weekday) : null;
        return (
          <section key={group.dateKey} className="overflow-hidden rounded-[18px] border border-border-subtle bg-card">
            <div className="grid gap-3 border-b border-border-subtle px-5 py-[18px] md:grid-cols-[minmax(0,1fr)_420px] md:items-center md:gap-6">
              <div className="flex flex-col gap-0.5">
                <h3 className="text-lg font-semibold">{formatThaiDateWithWeekday(group.dateKey)}</h3>
                <p className="text-sm text-muted-foreground">
                  {group.confirmed} การจอง · {group.guests} คน
                </p>
              </div>
              {detail && hours && (
                <DayLoadBars
                  bars={hourlyLoad({ bookings: group.confirmedRows, capacity: detail.seatingCapacity, open: hours.open, close: hours.close, dateKey: group.dateKey })}
                />
              )}
            </div>
            <ul>
              {group.rows.map((reservation) => (
                <li
                  key={reservation.id}
                  className={`grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-1.5 border-b border-background px-5 py-3.5 last:border-b-0 md:grid-cols-[130px_minmax(0,1fr)_100px_110px] ${
                    reservation.status === "cancelled" ? "opacity-60" : ""
                  }`}
                >
                  <span className="text-[17px] font-bold">
                    {bangkokClock(reservation.startAt)}–{bangkokClock(reservation.endAt)}
                  </span>
                  <span className="flex min-w-0 items-center gap-2.5 text-[15px]">
                    <UserAvatar name={reservation.customer.name} size="medium" />
                    <span className="truncate">{reservation.customer.name}</span>
                  </span>
                  <span className="text-[15px] md:col-auto">{reservation.guests} คน</span>
                  <span className="justify-self-start">
                    <StatusBadge status={reservation.status} />
                  </span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {groups.length > 0 && <LoadLegend />}
    </div>
  );
}

export default function RestaurantReservationsPage() {
  return (
    <AuthGuard>
      <RestaurantReservations />
    </AuthGuard>
  );
}
