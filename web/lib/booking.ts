import { isSlotBookable, seatLevel } from "@/lib/availability";
import type { AvailabilitySlot } from "@/lib/types";

/** The longest stay the booking card offers. */
export const MAX_HOURS = 3;

export type SlotState = "avail" | "near" | "full" | "past" | "selected" | "range" | "conflict";

/** What the person picked: the slot they tapped and for how many hours (of consecutive slots). */
export interface Selection {
  startIndex: number;
  hours: number;
}

/**
 * How one slot of the day is drawn. Slots that have started are past, then full, almost full (30% or
 * fewer seats left) or free; inside the chosen hours a slot is the selected start, part of the range, or
 * (when it is full) a conflict, because the booking could not be made.
 */
export function slotState(input: {
  slot: AvailabilitySlot;
  index: number;
  capacity: number;
  now: Date;
  selection: Selection | null;
}): SlotState {
  const { slot, index, capacity, now, selection } = input;
  const past = !isSlotBookable(slot, now);
  const level = seatLevel(slot.remainingSeats, capacity);
  const base: SlotState = past ? "past" : level === "full" ? "full" : level === "low" ? "near" : "avail";

  const inRange = selection !== null && !past && index >= selection.startIndex && index < selection.startIndex + selection.hours;
  if (!inRange) return base;
  if (base === "full") return "conflict";

  return index === selection.startIndex ? "selected" : "range";
}

/** 1 to 3 hours; an option is off while nothing is picked and when it would run past the last slot of the day. */
export function durationOptions(slots: AvailabilitySlot[], startIndex: number | null): { hours: number; enabled: boolean }[] {
  return Array.from({ length: MAX_HOURS }, (_, offset) => {
    const hours = offset + 1;

    return { hours, enabled: startIndex !== null && startIndex + hours <= slots.length };
  });
}

/** From the start of the first chosen slot to the end of the last one (closing time when that slot is short). */
export function selectionTimes(slots: AvailabilitySlot[], startIndex: number, hours: number): { startAt: string; endAt: string } {
  return { startAt: slots[startIndex].startAt, endAt: slots[startIndex + hours - 1].endAt };
}

/** The fewest seats left in any of the chosen hours. */
export function minRemaining(slots: AvailabilitySlot[], startIndex: number, hours: number): number {
  return Math.min(...slots.slice(startIndex, startIndex + hours).map((slot) => slot.remainingSeats));
}

/**
 * The slot a reservation starts in and how many of the day's hours it touches (at most three), so a change
 * can open with the current choice selected. Null when the reservation is not on this day.
 */
export function selectionFor(slots: AvailabilitySlot[], startAt: string, endAt: string): { startIndex: number; hours: number } | null {
  const start = new Date(startAt).getTime();
  const end = new Date(endAt).getTime();
  const startIndex = slots.findIndex((slot) => new Date(slot.startAt).getTime() <= start && start < new Date(slot.endAt).getTime());
  if (startIndex === -1) return null;

  let hours = 0;
  while (hours < MAX_HOURS && startIndex + hours < slots.length && new Date(slots[startIndex + hours].startAt).getTime() < end) hours++;

  return { startIndex, hours: Math.max(1, hours) };
}

/**
 * Changing a reservation must not count its own seats against it (the server does not). In the hours the
 * reservation overlaps, give its guests back, never beyond the capacity.
 */
export function creditSeats(
  slots: AvailabilitySlot[],
  capacity: number,
  credit: { startAt: string; endAt: string; guests: number } | null,
): AvailabilitySlot[] {
  if (!credit) return slots;
  const creditStart = new Date(credit.startAt).getTime();
  const creditEnd = new Date(credit.endAt).getTime();

  return slots.map((slot) => {
    const overlaps = new Date(slot.startAt).getTime() < creditEnd && new Date(slot.endAt).getTime() > creditStart;
    if (!overlaps) return slot;

    const given = Math.min(credit.guests, slot.bookedGuests, capacity - slot.remainingSeats);

    return { ...slot, bookedGuests: slot.bookedGuests - given, remainingSeats: slot.remainingSeats + given };
  });
}
