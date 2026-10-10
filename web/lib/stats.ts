import { bangkokDateKey } from "@/lib/datetime";
import type { ReservationStatus } from "@/lib/types";

/** What the statistics need to know about a reservation, whether it is the caller's or one at their restaurant. */
export interface ReservationLike {
  startAt: string;
  status: ReservationStatus;
  guests: number;
}

export interface ReservationSummary<T> {
  total: number;
  /** Confirmed and not started yet. */
  upcoming: number;
  /** Confirmed and on today's date in Bangkok, whether or not it has started. */
  today: number;
  cancelled: number;
  upcomingGuests: number;
  /** The soonest upcoming reservation. */
  next: T | null;
}

export function summarizeReservations<T extends ReservationLike>(items: T[], now: Date): ReservationSummary<T> {
  const todayKey = bangkokDateKey(now);
  const upcoming = items
    .filter((item) => item.status === "confirmed" && new Date(item.startAt) > now)
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

  return {
    total: items.length,
    upcoming: upcoming.length,
    today: items.filter((item) => item.status === "confirmed" && bangkokDateKey(new Date(item.startAt)) === todayKey).length,
    cancelled: items.filter((item) => item.status === "cancelled").length,
    upcomingGuests: upcoming.reduce((sum, item) => sum + item.guests, 0),
    next: upcoming[0] ?? null,
  };
}

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

export interface RestaurantsSummary {
  count: number;
  reviews: number;
  /** Mean star rating over all reviews of all the restaurants; null when there are none. */
  average: number | null;
}

export function summarizeRestaurants(restaurants: { rating: { average: number; total: number } }[]): RestaurantsSummary {
  const reviews = restaurants.reduce((sum, restaurant) => sum + restaurant.rating.total, 0);
  const stars = restaurants.reduce((sum, restaurant) => sum + restaurant.rating.average * restaurant.rating.total, 0);

  return {
    count: restaurants.length,
    reviews,
    average: reviews === 0 ? null : roundToOneDecimal(stars / reviews),
  };
}

export interface ReviewsSummary {
  count: number;
  /** Mean stars the person gave; null when they have written none. */
  averageGiven: number | null;
}

export function summarizeReviews(reviews: { rating: number }[]): ReviewsSummary {
  const stars = reviews.reduce((sum, review) => sum + review.rating, 0);

  return {
    count: reviews.length,
    averageGiven: reviews.length === 0 ? null : roundToOneDecimal(stars / reviews.length),
  };
}
