"use client";

import { useState } from "react";
import { useAsync } from "@/hooks/use-async";
import { apiFetch } from "@/lib/api";
import { durationOptions, minRemaining, selectionTimes, slotState, type Selection } from "@/lib/booking";
import { addDaysToKey, bangkokDateKey } from "@/lib/datetime";
import type { Availability, OpeningHour, SaveReservationInput } from "@/lib/types";

/** How many days, starting today, the day strip offers. */
export const BOOKABLE_DAYS = 7;

export type BookingResult = { ok: true } | { ok: false; error: unknown };

/**
 * Everything the restaurant page needs to book a table: the chosen day, the hourly availability of that
 * day, the picked slot, how long and for how many people, and the result of pressing "book".
 * The availability is a snapshot; the server decides, so a failed booking is shown, never guessed.
 */
export function useBooking(restaurant: { id: number; seatingCapacity: number; openingHours: OpeningHour[] }) {
  const [today] = useState(() => bangkokDateKey(new Date()));
  const [dateKey, setDateKey] = useState(today);
  const [startIndex, setStartIndex] = useState<number | null>(null);
  const [hours, setHours] = useState(1);
  const [party, setParty] = useState(Math.min(2, restaurant.seatingCapacity));
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<BookingResult | null>(null);

  const { data: loaded, error, loading, reload } = useAsync(
    () => apiFetch<Availability>(`/restaurants/${restaurant.id}/availability?date=${dateKey}`),
    [restaurant.id, dateKey],
  );
  // useAsync keeps the last answer while a new one loads; never show another day's hours under this date.
  const availability = loaded?.date === dateKey ? loaded : undefined;
  const slots = availability?.slots ?? [];
  const now = new Date();

  const durations = durationOptions(slots, startIndex);
  // The chosen length is capped by what is left of the day after the picked slot.
  const effectiveHours = startIndex === null ? hours : Math.max(1, ...durations.filter((d) => d.enabled && d.hours <= hours).map((d) => d.hours));
  const selection: Selection | null = startIndex === null ? null : { startIndex, hours: effectiveHours };
  const times = selection ? selectionTimes(slots, selection.startIndex, selection.hours) : null;

  function selectDate(key: string) {
    setDateKey(key);
    setStartIndex(null);
    setResult(null);
  }

  function pickSlot(index: number) {
    const state = slotState({ slot: slots[index], index, capacity: availability?.capacity ?? 0, now, selection: null });
    if (state === "past" || state === "full") return;
    setStartIndex(index);
    setResult(null);
  }

  function chooseHours(next: number) {
    setHours(next);
    setResult(null);
  }

  function changeParty(next: number) {
    setParty(Math.min(restaurant.seatingCapacity, Math.max(1, next)));
    setResult(null);
  }

  async function book() {
    if (!selection || !times) return;
    setSubmitting(true);
    setResult(null);
    const body: SaveReservationInput = { startAt: times.startAt, endAt: times.endAt, guests: party };
    try {
      await apiFetch(`/restaurants/${restaurant.id}/reservations`, { method: "POST", body });
      setResult({ ok: true });
      setStartIndex(null);
      reload(); // the seats just taken show up in the grid
    } catch (err) {
      setResult({ ok: false, error: err });
    } finally {
      setSubmitting(false);
    }
  }

  return {
    today,
    dateKey,
    days: Array.from({ length: BOOKABLE_DAYS }, (_, offset) => addDaysToKey(today, offset)),
    availability,
    slots,
    now,
    loading: loading && !availability,
    error,
    reload,
    selection,
    times,
    durations,
    hours: effectiveHours,
    party,
    submitting,
    result,
    selectDate,
    pickSlot,
    chooseHours,
    changeParty,
    book,
    minLeft: selection ? minRemaining(slots, selection.startIndex, selection.hours) : null,
  };
}

export type Booking = ReturnType<typeof useBooking>;
