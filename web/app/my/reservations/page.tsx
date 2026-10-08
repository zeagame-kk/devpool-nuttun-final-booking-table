"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { AuthGuard } from "@/components/auth-guard";
import { Button } from "@/components/bases/button";
import { ErrorAlert } from "@/components/error-alert";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAsync } from "@/hooks/use-async";
import { apiFetch } from "@/lib/api";
import { formatThaiDateTime, fromApiDateTime, toApiDateTime } from "@/lib/datetime";
import type { ListResponse, MyReservation, SaveReservationInput } from "@/lib/types";

function ReservationItem({ reservation, canChange, onChanged }: { reservation: MyReservation; canChange: boolean; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [start, setStart] = useState(fromApiDateTime(reservation.startAt));
  const [end, setEnd] = useState(fromApiDateTime(reservation.endAt));
  const [guests, setGuests] = useState(String(reservation.guests));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function run(action: () => Promise<unknown>, after?: () => void) {
    setBusy(true);
    setError(null);
    try {
      await action();
      after?.();
      onChanged();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  function save(e: FormEvent) {
    e.preventDefault();
    const body: SaveReservationInput = { startAt: toApiDateTime(start), endAt: toApiDateTime(end), guests: Number(guests) };
    void run(() => apiFetch(`/reservations/${reservation.id}`, { method: "PUT", body }), () => setEditing(false));
  }

  function cancel() {
    if (!window.confirm("ยืนยันการยกเลิกการจอง?")) return;
    void run(() => apiFetch(`/reservations/${reservation.id}/cancel`, { method: "POST" }));
  }

  const confirmed = reservation.status === "confirmed";
  return (
    <li className="flex flex-col gap-2 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/restaurants/${reservation.restaurant.id}`} className="font-semibold hover:text-primary">
          {reservation.restaurant.name}
        </Link>
        <Badge variant={confirmed ? "default" : "secondary"}>{confirmed ? "ยืนยันแล้ว" : "ยกเลิกแล้ว"}</Badge>
      </div>
      <p className="text-sm">
        {formatThaiDateTime(reservation.startAt)} – {formatThaiDateTime(reservation.endAt)} · {reservation.guests} คน
      </p>

      {editing ? (
        <form onSubmit={save} className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor={`start-${reservation.id}`}>เริ่ม</Label>
              <Input id={`start-${reservation.id}`} type="datetime-local" required value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor={`end-${reservation.id}`}>สิ้นสุด</Label>
              <Input id={`end-${reservation.id}`} type="datetime-local" required value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor={`guests-${reservation.id}`}>จำนวนคน</Label>
              <Input id={`guests-${reservation.id}`} type="number" min={1} step={1} required value={guests} onChange={(e) => setGuests(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="small" disabled={busy}>
              บันทึก
            </Button>
            <Button type="button" variant="outline" size="small" disabled={busy} onClick={() => setEditing(false)}>
              ปิด
            </Button>
          </div>
        </form>
      ) : (
        canChange && (
          <div className="flex gap-2">
            <Button variant="outline" size="small" disabled={busy} onClick={() => setEditing(true)}>
              แก้ไข
            </Button>
            <Button variant="destructive" size="small" disabled={busy} onClick={cancel}>
              ยกเลิก
            </Button>
          </div>
        )
      )}
      <ErrorAlert error={error} />
    </li>
  );
}

function MyReservations() {
  const { data, error, loading, reload } = useAsync(() => apiFetch<ListResponse<MyReservation>>("/reservations"), []);
  // Only decides whether the buttons show; the server makes the real call on lead time and start.
  const [now] = useState(() => Date.now());

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">การจองของฉัน</h1>
      <ErrorAlert error={error} />
      {loading && !data && <p className="text-muted-foreground">กำลังโหลด…</p>}
      {data && data.results.length === 0 && <p className="text-muted-foreground">ยังไม่มีการจอง</p>}
      {data && data.results.length > 0 && (
        <ul className="flex flex-col gap-3">
          {data.results.map((reservation) => (
            <ReservationItem
              key={reservation.id}
              reservation={reservation}
              canChange={reservation.status === "confirmed" && new Date(reservation.startAt).getTime() > now}
              onChanged={reload}
            />
          ))}
        </ul>
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
