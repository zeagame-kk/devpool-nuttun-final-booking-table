"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthGuard } from "@/components/auth-guard";
import { Button, buttonVariants } from "@/components/bases/button";
import { ErrorAlert } from "@/components/error-alert";
import { RestaurantCard } from "@/components/restaurant-card";
import { useAsync } from "@/hooks/use-async";
import { apiFetch } from "@/lib/api";
import type { ListResponse, RestaurantSummary } from "@/lib/types";

function MyRestaurants() {
  const { data, error, loading, reload } = useAsync(
    () => apiFetch<ListResponse<RestaurantSummary>>("/restaurants?mine=true&limit=100"),
    [],
  );
  const [deleteError, setDeleteError] = useState<unknown>(null);

  async function remove(restaurant: RestaurantSummary) {
    if (!window.confirm(`ลบร้าน "${restaurant.name}" ?`)) return;
    setDeleteError(null);
    try {
      await apiFetch(`/restaurants/${restaurant.id}`, { method: "DELETE" });
      reload();
    } catch (err) {
      setDeleteError(err); // e.g. restaurant_has_active_reservations
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">ร้านของฉัน</h1>
        <Link href="/my/restaurants/new" className={buttonVariants({ size: "small" })}>
          สร้างร้านใหม่
        </Link>
      </div>
      <ErrorAlert error={error} />
      <ErrorAlert error={deleteError} />
      {loading && !data && <p className="text-muted-foreground">กำลังโหลด…</p>}
      {data && data.results.length === 0 && (
        <div className="flex flex-col items-start gap-3">
          <p className="text-muted-foreground">คุณยังไม่มีร้าน</p>
          <Link href="/my/restaurants/new" className={buttonVariants()}>
            สร้างร้านใหม่
          </Link>
        </div>
      )}
      {data && data.results.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.results.map((restaurant) => (
            <RestaurantCard
              key={restaurant.id}
              restaurant={restaurant}
              actions={
                <>
                  <Link href={`/my/restaurants/${restaurant.id}/edit`} className={buttonVariants({ variant: "outline", size: "small" })}>
                    แก้ไข
                  </Link>
                  <Link href={`/my/restaurants/${restaurant.id}/reservations`} className={buttonVariants({ variant: "outline", size: "small" })}>
                    ดูการจอง
                  </Link>
                  <Button variant="destructive" size="small" onClick={() => void remove(restaurant)}>
                    ลบ
                  </Button>
                </>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function MyRestaurantsPage() {
  return (
    <AuthGuard>
      <MyRestaurants />
    </AuthGuard>
  );
}
