"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { AuthGuard } from "@/components/auth-guard";
import { Button, buttonVariants } from "@/components/bases/button";
import { EmptyState } from "@/components/empty-state";
import { ErrorAlert } from "@/components/error-alert";
import { ReservationEditor } from "@/components/reservation-editor";
import { RestaurantImage } from "@/components/restaurant-card";
import { StatusBadge } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAsync } from "@/hooks/use-async";
import { apiFetch } from "@/lib/api";
import { bangkokClock, bangkokDateKey, cancelDeadlineText, thaiDateParts } from "@/lib/datetime";
import type { ListResponse, MyReservation } from "@/lib/types";

const TILE = "flex flex-none flex-col items-center justify-center leading-tight";

function DateTile({ startAt, small = false }: { startAt: string; small?: boolean }) {
  const parts = thaiDateParts(bangkokDateKey(new Date(startAt)));

  return (
    <div className={`${TILE} ${small ? "size-[52px] rounded-xl bg-secondary text-muted-foreground" : "size-14 rounded-[14px] bg-background sm:size-[72px]"}`}>
      <span className={small ? "text-[11px]" : "text-xs text-muted-foreground sm:text-[13px]"}>{parts.weekdayShort}</span>
      <span className={`font-bold ${small ? "text-lg" : "text-2xl text-foreground sm:text-[26px]"}`}>{parts.day}</span>
      {!small && <span className="text-[11px] text-muted-foreground sm:text-xs">{parts.monthShort}</span>}
    </div>
  );
}

/** An upcoming booking: date, photo, where, when, until when it can be cancelled, and change / cancel. */
function UpcomingItem({ reservation, onChanged }: { reservation: MyReservation; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function cancel() {
    if (!window.confirm("ยืนยันการยกเลิกการจอง?")) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/reservations/${reservation.id}/cancel`, { method: "POST" });
      onChanged();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="flex flex-col gap-4 rounded-[18px] border border-border-subtle bg-card p-4">
      <div className="grid grid-cols-[56px_minmax(0,1fr)] items-center gap-4 sm:grid-cols-[72px_72px_minmax(0,1fr)_auto]">
        <DateTile startAt={reservation.startAt} />
        <RestaurantImage
          imageUrl={reservation.restaurant.imageUrl}
          name={reservation.restaurant.name}
          className="hidden size-[72px] rounded-[14px] sm:block"
        />
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <Link href={`/restaurants/${reservation.restaurant.id}`} className="truncate text-lg font-semibold hover:text-primary-strong">
              {reservation.restaurant.name}
            </Link>
            <StatusBadge status={reservation.status} />
          </div>
          <p className="text-base">
            <b>
              {bangkokClock(reservation.startAt)}–{bangkokClock(reservation.endAt)}
            </b>{" "}
            · {reservation.guests} คน
          </p>
          <p className="text-[13px] text-muted-foreground">{cancelDeadlineText(reservation.startAt, reservation.restaurant.cancellationLeadMinutes)}</p>
        </div>
        {!editing && (
          <div className="col-span-2 flex gap-2 sm:col-span-1">
            <Button variant="outline" size="medium" disabled={busy} onClick={() => setEditing(true)}>
              แก้ไข
            </Button>
            <Button variant="destructive" size="medium" disabled={busy} onClick={() => void cancel()}>
              ยกเลิก
            </Button>
          </div>
        )}
      </div>
      {editing && (
        <ReservationEditor
          reservation={reservation}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            onChanged();
          }}
        />
      )}
      <ErrorAlert error={error} />
    </li>
  );
}

/** A booking that is over or was cancelled: one quiet line, nothing to press. */
function QuietItem({ reservation }: { reservation: MyReservation }) {
  return (
    <li className="grid grid-cols-[52px_minmax(0,1fr)] items-center gap-3.5 rounded-2xl border border-border px-4 py-3 text-muted-foreground">
      <DateTile startAt={reservation.startAt} small />
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <Link href={`/restaurants/${reservation.restaurant.id}`} className="text-base font-semibold text-foreground/80 hover:text-primary-strong">
          {reservation.restaurant.name}
        </Link>
        <span className="text-sm">
          {bangkokClock(reservation.startAt)}–{bangkokClock(reservation.endAt)} · {reservation.guests} คน
        </span>
        <StatusBadge status={reservation.status} />
      </div>
    </li>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="pt-2 text-[15px] font-semibold text-muted-foreground">{title}</h2>
      <ul className="flex flex-col gap-3">{children}</ul>
    </section>
  );
}

function MyReservations() {
  const { data, error, loading, reload } = useAsync(() => apiFetch<ListResponse<MyReservation>>("/reservations"), []);
  // Only decides which group a booking is in; the server makes the real call on lead time and start.
  const [now] = useState(() => Date.now());

  const all = data?.results ?? [];
  const byStart = (a: MyReservation, b: MyReservation) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime();
  const upcoming = all.filter((r) => r.status === "confirmed" && new Date(r.startAt).getTime() > now).sort(byStart);
  const past = all.filter((r) => r.status === "confirmed" && new Date(r.startAt).getTime() <= now).sort((a, b) => byStart(b, a));
  const cancelled = all.filter((r) => r.status === "cancelled").sort((a, b) => byStart(b, a));

  return (
    <div className="mx-auto flex w-full max-w-[820px] flex-col gap-4">
      <h1 className="text-[26px] font-bold md:text-[30px]">การจองของฉัน</h1>
      <ErrorAlert error={error} onRetry={reload} />
      {loading && !data && !error && (
        <div className="flex flex-col gap-3" aria-label="กำลังโหลดการจอง">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-28" />
          ))}
        </div>
      )}
      {data && data.results.length === 0 && (
        <EmptyState
          icon={CalendarDays}
          title="ยังไม่มีการจอง"
          description="โต๊ะยังว่างรอคุณอยู่ เลือกร้านแล้วจองได้เลย"
          action={
            <Link href="/" className={buttonVariants({ size: "medium" })}>
              ดูร้านทั้งหมด
            </Link>
          }
        />
      )}
      {upcoming.length > 0 && (
        <Group title="กำลังจะถึง">
          {upcoming.map((reservation) => (
            <UpcomingItem key={reservation.id} reservation={reservation} onChanged={reload} />
          ))}
        </Group>
      )}
      {past.length > 0 && (
        <Group title="ผ่านมาแล้ว">
          {past.map((reservation) => (
            <QuietItem key={reservation.id} reservation={reservation} />
          ))}
        </Group>
      )}
      {cancelled.length > 0 && (
        <Group title="ยกเลิกแล้ว">
          {cancelled.map((reservation) => (
            <QuietItem key={reservation.id} reservation={reservation} />
          ))}
        </Group>
      )}
    </div>
  );
}

export default function MyReservationsPage() {
  return (
    <AuthGuard>
      <MyReservations />
    </AuthGuard>
  );
}
