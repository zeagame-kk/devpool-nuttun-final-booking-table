"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { AuthGuard } from "@/components/auth-guard";
import { EmptyState } from "@/components/empty-state";
import { ErrorAlert } from "@/components/error-alert";
import { StatCard } from "@/components/stat-card";
import { STATUS_LABELS, StatusBadge } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAsync } from "@/hooks/use-async";
import { apiFetch } from "@/lib/api";
import { formatThaiDateTime } from "@/lib/datetime";
import { summarizeReservations } from "@/lib/stats";
import type { ListResponse, OwnerReservation, RestaurantDetail } from "@/lib/types";

const STATUS_FILTERS = [
  { value: "", label: "ทั้งหมด" },
  { value: "confirmed", label: STATUS_LABELS.confirmed },
  { value: "cancelled", label: STATUS_LABELS.cancelled },
];

function RestaurantReservations() {
  const { id } = useParams<{ id: string }>();
  const [status, setStatus] = useState("");
  const [now] = useState(() => new Date());
  const restaurant = useAsync(() => apiFetch<RestaurantDetail>(`/restaurants/${id}`), [id]);
  // Everything is loaded once and filtered here, so the numbers above the table do not change with the filter.
  const reservations = useAsync(() => apiFetch<ListResponse<OwnerReservation>>(`/restaurants/${id}/reservations`), [id]);

  const all = reservations.data?.results;
  const shown = all?.filter((reservation) => !status || reservation.status === status);
  const summary = all ? summarizeReservations(all, now) : null;
  const dash = "–";

  return (
    <div className="flex flex-col gap-4">
      <Link href="/my/restaurants" className="text-sm text-primary-strong underline">
        ← ร้านของฉัน
      </Link>
      <h1 className="text-xl font-semibold">การจองของร้าน{restaurant.data ? ` ${restaurant.data.name}` : ""}</h1>

      <ErrorAlert error={reservations.error} onRetry={reservations.reload} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="วันนี้" value={summary?.today ?? dash} hint="การจองที่ยืนยันแล้วของวันนี้" />
        <StatCard label="กำลังจะถึง" value={summary?.upcoming ?? dash} />
        <StatCard label="แขกที่กำลังจะมา" value={summary?.upcomingGuests ?? dash} hint="รวมทุกการจองที่กำลังจะถึง" />
        <StatCard label="ยกเลิกแล้ว" value={summary?.cancelled ?? dash} />
      </div>

      <div className="flex justify-end">
        <select
          aria-label="กรองตามสถานะ"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-[40px] rounded-lg border border-input bg-background px-3 text-sm"
        >
          {STATUS_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      {!reservations.data && !reservations.error && <Skeleton className="h-40" />}
      {all && all.length === 0 && (
        <EmptyState icon={CalendarDays} title="ยังไม่มีการจอง" description="เมื่อลูกค้าจองโต๊ะที่ร้านนี้ รายการจะมาแสดงที่นี่" />
      )}
      {all && all.length > 0 && shown && shown.length === 0 && (
        <p className="text-muted-foreground">ไม่มีรายการที่ตรงกับตัวกรอง</p>
      )}
      {shown && shown.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b text-muted-foreground">
              <tr>
                <th className="py-2 pr-4 font-medium">ลูกค้า</th>
                <th className="py-2 pr-4 font-medium">ช่วงเวลา</th>
                <th className="py-2 pr-4 font-medium">จำนวนคน</th>
                <th className="py-2 font-medium">สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((reservation) => (
                <tr key={reservation.id} className="border-b">
                  <td className="py-2 pr-4">{reservation.customer.name}</td>
                  <td className="py-2 pr-4">
                    {formatThaiDateTime(reservation.startAt)} – {formatThaiDateTime(reservation.endAt)}
                  </td>
                  <td className="py-2 pr-4">{reservation.guests}</td>
                  <td className="py-2">
                    <StatusBadge status={reservation.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
