"use client";

import Link from "next/link";
import { RestaurantImage } from "@/components/restaurant-card";
import { useAsync } from "@/hooks/use-async";
import { apiFetch } from "@/lib/api";
import type { ListResponse, RestaurantSummary } from "@/lib/types";

const COUNT = 3;

/**
 * The best-rated restaurants as three big photos with their rank and rating on them. Wide screens only
 * (a phone goes straight to the list). Shows nothing when none has a review or the request fails: the list still tells the story.
 */
export function TopRated() {
  const { data } = useAsync(() => apiFetch<ListResponse<RestaurantSummary>>(`/restaurants?sort=rating&limit=${COUNT}`), []);
  const rated = data?.results.filter((restaurant) => restaurant.rating.total > 0) ?? [];
  if (rated.length === 0) return null;

  return (
    <section className="hidden flex-col gap-3.5 md:flex">
      <h2 className="text-xl font-semibold">ร้านคะแนนสูงสุด</h2>
      <ol className="grid grid-cols-3 gap-4">
        {rated.map((restaurant, index) => (
          <li key={restaurant.id}>
            <Link
              href={`/restaurants/${restaurant.id}`}
              className="relative flex h-[200px] overflow-hidden rounded-[18px] outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <RestaurantImage imageUrl={restaurant.imageUrl} name={restaurant.name} className="size-full" />
              <span aria-hidden="true" className="absolute inset-0 bg-linear-to-b from-transparent from-35% to-black/80" />
              <span className="absolute top-3 left-3 rounded-full bg-card px-2.5 py-1 text-[13px] font-bold text-foreground">อันดับ {index + 1}</span>
              <span className="absolute right-4 bottom-3.5 left-4 flex flex-col gap-0.5 text-white">
                <span className="truncate text-[19px] font-semibold">{restaurant.name}</span>
                <span className="text-sm">
                  ★ {restaurant.rating.average.toFixed(1)} ({restaurant.rating.total} รีวิว)
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
