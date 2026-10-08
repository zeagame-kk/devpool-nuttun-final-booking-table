"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/bases/button";
import { ErrorAlert } from "@/components/error-alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api";
import { toApiDateTime } from "@/lib/datetime";
import type { SaveReservationInput } from "@/lib/types";

export function ReservationForm({ restaurantId, onCreated }: { restaurantId: number; onCreated: () => void }) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [guests, setGuests] = useState("2");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [done, setDone] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setDone(false);
    const body: SaveReservationInput = {
      // The inputs hold Bangkok wall-clock time; the API wants it with its offset.
      startAt: toApiDateTime(start),
      endAt: toApiDateTime(end),
      guests: Number(guests),
    };
    try {
      await apiFetch(`/restaurants/${restaurantId}/reservations`, { method: "POST", body });
      setDone(true);
      onCreated();
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">เวลาทั้งหมดเป็นเวลาประเทศไทย (UTC+7)</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="start">เริ่ม</Label>
          <Input id="start" type="datetime-local" required value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="end">สิ้นสุด</Label>
          <Input id="end" type="datetime-local" required value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="guests">จำนวนคน</Label>
          <Input id="guests" type="number" min={1} step={1} required value={guests} onChange={(e) => setGuests(e.target.value)} />
        </div>
      </div>
      <ErrorAlert error={error} />
      {done && (
        <p role="status" className="text-sm text-success">
          จองสำเร็จ{" "}
          <Link href="/my/reservations" className="underline">
            ดูการจองของฉัน
          </Link>
        </p>
      )}
      <div>
        <Button type="submit" disabled={submitting}>
          {submitting ? "กำลังจอง…" : "จองโต๊ะ"}
        </Button>
      </div>
    </form>
  );
}
