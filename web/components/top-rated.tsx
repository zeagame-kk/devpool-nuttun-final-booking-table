"use client";

import { RestaurantCard } from "@/components/restaurant-card";
import { useAsync } from "@/hooks/use-async";
import { apiFetch } from "@/lib/api";
import type { ListResponse, RestaurantSummary } from "@/lib/types";

const COUNT = 3;

/** The best-rated restaurants as a short highlight. Shows nothing when none has a review or the request fails: the full list below still tells the story. */
export function TopRated() {
  const { data } = useAsync(() => apiFetch<ListResponse<RestaurantSummary>>(`/restaurants?sort=rating&limit=${COUNT}`), []);
  const rated = data?.results.filter((restaurant) => restaurant.rating.total > 0) ?? [];
  if (rated.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">ร้านคะแนนสูงสุด</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rated.map((restaurant) => (
          <RestaurantCard key={restaurant.id} restaurant={restaurant} />
        ))}
      </div>
    </section>
  );
}
