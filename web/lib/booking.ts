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
