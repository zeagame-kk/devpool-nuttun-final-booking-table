import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { formatThaiDateTime } from "@/lib/datetime";
import type { MyReservation } from "@/lib/types";

/** The caller's soonest upcoming reservation, with a way to manage it. */
export function NextBookingCard({ reservation }: { reservation: MyReservation }) {
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <Link href={`/restaurants/${reservation.restaurant.id}`} className="font-semibold hover:text-primary-strong">
          {reservation.restaurant.name}
        </Link>
        <span className="text-sm">
          {formatThaiDateTime(reservation.startAt)} · {reservation.guests} คน
        </span>
        <Link href="/my/reservations" className="ml-auto text-sm text-primary-strong underline-offset-4 hover:underline">
          จัดการการจอง
        </Link>
      </CardContent>
    </Card>
  );
}
