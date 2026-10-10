"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Store } from "lucide-react";
import { AuthGuard } from "@/components/auth-guard";
import { Button, buttonVariants } from "@/components/bases/button";
import { EmptyState } from "@/components/empty-state";
import { ErrorAlert } from "@/components/error-alert";
import { RatingText, RestaurantImage } from "@/components/restaurant-card";
import { StatCard } from "@/components/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAsync } from "@/hooks/use-async";
import { apiFetch } from "@/lib/api";
import { summarizeRestaurants } from "@/lib/stats";
import type { ListResponse, RestaurantSummary } from "@/lib/types";

const CHIP = "rounded-full bg-background px-2.5 py-1 text-[13px]";

function ManageRow({ restaurant, onDelete }: { restaurant: RestaurantSummary; onDelete: () => void }) {
  return (
    <article className="grid gap-4 rounded-[18px] border border-border-subtle bg-card p-3.5 md:grid-cols-[200px_minmax(0,1fr)_auto] md:items-center md:gap-5">
      <RestaurantImage imageUrl={restaurant.imageUrl} name={restaurant.name} className="h-40 w-full rounded-xl md:h-[130px]" />
      <div className="flex min-w-0 flex-col gap-1.5">
        <Link href={`/restaurants/${restaurant.id}`} className="truncate text-lg font-semibold hover:text-primary-strong md:text-xl">
          {restaurant.name}
        </Link>
        <p className="truncate text-sm text-muted-foreground">{restaurant.address}</p>
        <div className="flex flex-wrap gap-1.5 pt-1">
          <span className={CHIP}>
            <b>
              <RatingText average={restaurant.rating.average} total={restaurant.rating.total} />
            </b>
          </span>
          <span className={CHIP}>ที่นั่ง {restaurant.seatingCapacity}</span>
          <span className={CHIP}>ยกเลิกล่วงหน้า {restaurant.cancellationLeadMinutes} นาที</span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 md:pr-1.5">
        <Link href={`/my/restaurants/${restaurant.id}/reservations`} className={buttonVariants({ size: "medium" })}>
          ดูการจอง
        </Link>
        <Link href={`/my/restaurants/${restaurant.id}/edit`} className={buttonVariants({ variant: "outline", size: "medium" })}>
          แก้ไข
        </Link>
        <Button variant="destructive" size="medium" onClick={onDelete}>
          ลบ
        </Button>
      </div>
    </article>
  );
}

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
    <div className="flex flex-col gap-5 md:gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-[26px] font-bold md:text-[30px]">ร้านของฉัน</h1>
          <p className="text-base text-muted-foreground">จัดการข้อมูลร้านและดูการจองที่เข้ามา</p>
        </div>
        <Link href="/my/restaurants/new" className={`${buttonVariants({ size: "large" })} h-12`}>
          <Plus aria-hidden="true" className="size-5" />
          สร้างร้านใหม่
        </Link>
      </div>

      <ErrorAlert error={error} onRetry={reload} />
      <ErrorAlert error={deleteError} />
      {loading && !data && !error && (
        <div className="flex flex-col gap-3" aria-label="กำลังโหลดร้านของฉัน">
          {Array.from({ length: 2 }, (_, index) => (
            <Skeleton key={index} className="h-48 md:h-40" />
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
        <div className="grid grid-cols-2 gap-3 md:grid-cols-[1.4fr_1fr_1fr]">
          <div className="col-span-2 md:col-span-1">
            <StatCard
              tone="primary"
              label="คะแนนเฉลี่ย"
              value={summary.average?.toFixed(1) ?? "–"}
              unit={summary.average === null ? undefined : "★"}
              hint={summary.average === null ? "ยังไม่มีรีวิว" : "ถ่วงตามจำนวนรีวิว"}
            />
          </div>
          <StatCard label="ร้านของฉัน" value={summary.count} />
          <StatCard label="รีวิวทั้งหมด" value={summary.reviews} />
        </div>
      )}
      {data && data.results.length > 0 && (
        <div className="grid grid-cols-1 gap-3">
          {data.results.map((restaurant) => (
            <ManageRow key={restaurant.id} restaurant={restaurant} onDelete={() => void remove(restaurant)} />
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
