"use client";

import { useState } from "react";
import { useAsync } from "@/hooks/use-async";
import { apiFetch } from "@/lib/api";
import { creditSeats, durationOptions, selectionFor, selectionTimes, slotState, type Selection } from "@/lib/booking";
import { addDaysToKey, bangkokDateKey } from "@/lib/datetime";
import type { Availability } from "@/lib/types";

/** How many days, starting today, the day strip offers. */
export const BOOKABLE_DAYS = 7;

export interface SlotPickerOptions {
  restaurantId: number;
  capacity: number;
  /**
   * Set when changing a reservation: the picker opens on its day with its hours chosen, its guests are the
   * party size, and its own seats are counted as free (the server does not count them against it either).
   */
  existing?: { startAt: string; endAt: string; guests: number };
}

/**
 * The shared part of booking and changing a booking: the chosen day, that day's hourly availability, the
 * picked hour, how long, and for how many. The availability is a snapshot; the server decides.
 */
export function useSlotPicker({ restaurantId, capacity, existing }: SlotPickerOptions) {
  const [today] = useState(() => bangkokDateKey(new Date()));
  const [dateKey, setDateKey] = useState(() => (existing ? bangkokDateKey(new Date(existing.startAt)) : today));
  // undefined: nothing touched yet, so an existing reservation's own hour is the choice; null: nothing chosen.
  const [picked, setPicked] = useState<number | null | undefined>(undefined);
  const [chosenHours, setChosenHours] = useState<number | undefined>(undefined);
  const [party, setParty] = useState(existing ? existing.guests : Math.min(2, capacity));

  const { data: loaded, error, loading, reload } = useAsync(
    () => apiFetch<Availability>(`/restaurants/${restaurantId}/availability?date=${dateKey}`),
    [restaurantId, dateKey],
  );
  // useAsync keeps the last answer while a new one loads; never show another day's hours under this date.
  const availability = loaded?.date === dateKey ? loaded : undefined;
  const slots = creditSeats(availability?.slots ?? [], capacity, existing ?? null);
  const now = new Date();

  const fromExisting = existing && picked === undefined ? selectionFor(slots, existing.startAt, existing.endAt) : null;
  const startIndex = picked === undefined ? (fromExisting?.startIndex ?? null) : picked;
  const wantedHours = chosenHours ?? fromExisting?.hours ?? 1;

  const durations = durationOptions(slots, startIndex);
  // The chosen length is capped by what is left of the day after the picked slot.
  const hours = startIndex === null ? wantedHours : Math.max(1, ...durations.filter((d) => d.enabled && d.hours <= wantedHours).map((d) => d.hours));
  const selection: Selection | null = startIndex === null ? null : { startIndex, hours };
  const times = selection ? selectionTimes(slots, selection.startIndex, selection.hours) : null;

  function selectDate(key: string) {
    setDateKey(key);
    setPicked(null);
  }

  function pickSlot(index: number) {
    const state = slotState({ slot: slots[index], index, capacity: availability?.capacity ?? 0, now, selection: null });
    if (state === "past" || state === "full") return;
    setChosenHours(hours); // keep the length the person had in mind
    setPicked(index);
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
    hours,
    party,
    selectDate,
    pickSlot,
    chooseHours: setChosenHours,
    changeParty: (next: number) => setParty(Math.min(capacity, Math.max(1, next))),
    /** After a successful save: nothing is picked any more and the grid is read again. */
    clearPick: () => setPicked(null),
  };
}

export type SlotPicker = ReturnType<typeof useSlotPicker>;
