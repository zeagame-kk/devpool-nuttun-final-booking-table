"use client";

import { useState } from "react";
import { useSlotPicker } from "@/hooks/use-slot-picker";
import { apiFetch } from "@/lib/api";
import type { OpeningHour, SaveReservationInput } from "@/lib/types";

export type BookingResult = { ok: true } | { ok: false; error: unknown };

/**
 * Everything the restaurant page needs to book a table: the shared slot picker plus pressing "book" and
 * its result. A failed booking is shown as the server answered it, never guessed.
 */
export function useBooking(restaurant: { id: number; seatingCapacity: number; openingHours: OpeningHour[] }) {
  const picker = useSlotPicker({ restaurantId: restaurant.id, capacity: restaurant.seatingCapacity });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<BookingResult | null>(null);

  async function book() {
    if (!picker.selection || !picker.times) return;
    setSubmitting(true);
    setResult(null);
    const body: SaveReservationInput = { startAt: picker.times.startAt, endAt: picker.times.endAt, guests: picker.party };
    try {
      await apiFetch(`/restaurants/${restaurant.id}/reservations`, { method: "POST", body });
      setResult({ ok: true });
      picker.clearPick();
      picker.reload(); // the seats just taken show up in the grid
    } catch (err) {
      setResult({ ok: false, error: err });
    } finally {
      setSubmitting(false);
    }
  }

  return {
    ...picker,
    // Any change of day, hour, length or party clears the last result.
    selectDate: (key: string) => {
      setResult(null);
      picker.selectDate(key);
    },
    pickSlot: (index: number) => {
      setResult(null);
      picker.pickSlot(index);
    },
    chooseHours: (hours: number) => {
      setResult(null);
      picker.chooseHours(hours);
    },
    changeParty: (party: number) => {
      setResult(null);
      picker.changeParty(party);
    },
    submitting,
    result,
    book,
  };
}

export type Booking = ReturnType<typeof useBooking>;
