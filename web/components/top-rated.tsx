"use client";

import Link from "next/link";
import { RatingText, RestaurantImage } from "@/components/restaurant-card";
import { useAsync } from "@/hooks/use-async";
import { apiFetch } from "@/lib/api";
import type { ListResponse, RestaurantSummary } from "@/lib/types";

const COUNT = 3;

/**
 * The best-rated restaurants as a short, compact highlight (the full cards are in the list below).
 * Shows nothing when none has a review or the request fails: the list still tells the story.
 */
export function TopRated() {
  const { data } = useAsync(() => apiFetch<ListResponse<RestaurantSummary>>(`/restaurants?sort=rating&limit=${COUNT}`), []);
  const rated = data?.results.filter((restaurant) => restaurant.rating.total > 0) ?? [];
  if (rated.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">ร้านคะแนนสูงสุด</h2>
      <ol className="grid gap-3 sm:grid-cols-3">
        {rated.map((restaurant, index) => (
          <li key={restaurant.id}>
            <Link
              href={`/restaurants/${restaurant.id}`}
              className="flex items-center gap-3 rounded-xl bg-card p-3 ring-1 ring-foreground/10 transition-colors hover:ring-primary"
            >
              <RestaurantImage imageUrl={restaurant.imageUrl} name={restaurant.name} className="size-16 shrink-0 rounded-lg" />
              <span className="flex min-w-0 flex-col">
                <span className="text-xs font-medium text-accent-strong">อันดับ {index + 1}</span>
                <span className="truncate font-semibold">{restaurant.name}</span>
                <span className="text-sm">
                  <RatingText average={restaurant.rating.average} total={restaurant.rating.total} />
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
