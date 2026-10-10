import type { AvailabilitySlot } from "@/lib/types";

export type SeatLevel = "full" | "low" | "open";

const LOW_SEAT_RATIO = 0.3;

/** How a slot should look: no seat left, 30% of the seats or fewer left, or plenty. */
export function seatLevel(remainingSeats: number, capacity: number): SeatLevel {
  if (remainingSeats <= 0 || capacity <= 0) {
    return "full";
  }

  return remainingSeats / capacity <= LOW_SEAT_RATIO ? "low" : "open";
}

/** A booking cannot begin in the past, so a slot that has started cannot be chosen from its beginning. */
export function isSlotBookable(slot: Pick<AvailabilitySlot, "startAt">, now: Date): boolean {
  return new Date(slot.startAt) > now;
}
