"use client";

import { useState } from "react";
import Link from "next/link";
import { Store } from "lucide-react";
import { AuthGuard } from "@/components/auth-guard";
import { Button, buttonVariants } from "@/components/bases/button";
import { EmptyState } from "@/components/empty-state";
import { ErrorAlert } from "@/components/error-alert";
import { RestaurantCard } from "@/components/restaurant-card";
import { StatCard } from "@/components/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAsync } from "@/hooks/use-async";
import { apiFetch } from "@/lib/api";
import { summarizeRestaurants } from "@/lib/stats";
import type { ListResponse, RestaurantSummary } from "@/lib/types";

function MyRestaurants() {
  const { data, error, loading, reload } = useAsync(
    () => apiFetch<ListResponse<RestaurantSummary>>("/restaurants?mine=true&limit=100"),
    [],
  );
  const [deleteError, setDeleteError] = useState<unknown>(null);
  const summary = data ? summarizeRestaurants(data.results) : null;

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
      <ErrorAlert error={error} onRetry={reload} />
      <ErrorAlert error={deleteError} />
      {loading && !data && !error && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="กำลังโหลดร้านของฉัน">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-64" />
          ))}
        </div>
      )}
      {data && data.results.length === 0 && (
        <EmptyState
          icon={Store}
          title="คุณยังไม่มีร้าน"
          description="สร้างร้านแรกของคุณ ใส่เวลาเปิด จำนวนที่นั่ง และรูป แล้วลูกค้าจะจองได้ทันที"
          action={
            <Link href="/my/restaurants/new" className={buttonVariants()}>
              สร้างร้านใหม่
            </Link>
          }
        />
      )}
      {summary && summary.count > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="ร้านของฉัน" value={summary.count} />
          <StatCard label="รีวิวทั้งหมด" value={summary.reviews} />
          <StatCard label="คะแนนเฉลี่ย" value={summary.average?.toFixed(1) ?? "–"} hint={summary.average === null ? "ยังไม่มีรีวิว" : "ถ่วงตามจำนวนรีวิว"} />
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
