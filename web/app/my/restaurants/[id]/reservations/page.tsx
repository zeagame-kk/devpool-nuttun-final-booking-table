"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AuthGuard } from "@/components/auth-guard";
import { ErrorAlert } from "@/components/error-alert";
import { Badge } from "@/components/ui/badge";
import { useAsync } from "@/hooks/use-async";
import { apiFetch } from "@/lib/api";
import { formatThaiDateTime } from "@/lib/datetime";
import type { ListResponse, OwnerReservation } from "@/lib/types";

const STATUS_FILTERS = [
  { value: "", label: "ทั้งหมด" },
  { value: "confirmed", label: "ยืนยันแล้ว" },
  { value: "cancelled", label: "ยกเลิกแล้ว" },
];

function RestaurantReservations() {
  const { id } = useParams<{ id: string }>();
  const [status, setStatus] = useState("");
  const { data, error, loading } = useAsync(
    () => apiFetch<ListResponse<OwnerReservation>>(`/restaurants/${id}/reservations${status ? `?status=${status}` : ""}`),
    [id, status],
  );

  return (
    <div className="flex flex-col gap-4">
      <Link href="/my/restaurants" className="text-sm text-primary underline">
        ← ร้านของฉัน
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">การจองของร้าน</h1>
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
      <ErrorAlert error={error} />
      {loading && !data && !error && <p className="text-muted-foreground">กำลังโหลด…</p>}
      {data && data.results.length === 0 && <p className="text-muted-foreground">ยังไม่มีการจอง</p>}
      {data && data.results.length > 0 && (
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
              {data.results.map((reservation) => (
                <tr key={reservation.id} className="border-b">
                  <td className="py-2 pr-4">{reservation.customer.name}</td>
                  <td className="py-2 pr-4">
                    {formatThaiDateTime(reservation.startAt)} – {formatThaiDateTime(reservation.endAt)}
                  </td>
                  <td className="py-2 pr-4">{reservation.guests}</td>
                  <td className="py-2">
                    <Badge variant={reservation.status === "confirmed" ? "default" : "secondary"}>
                      {reservation.status === "confirmed" ? "ยืนยันแล้ว" : "ยกเลิกแล้ว"}
                    </Badge>
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
