"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { AuthGuard } from "@/components/auth-guard";
import { buttonVariants } from "@/components/bases/button";
import { ErrorAlert } from "@/components/error-alert";
import { RatingText, RestaurantImage } from "@/components/restaurant-card";
import { ReservationForm } from "@/components/reservation-form";
import { ReviewSection } from "@/components/review-section";
import { useAsync } from "@/hooks/use-async";
import { apiFetch } from "@/lib/api";
import { WEEKDAY_LABELS } from "@/lib/datetime";
import { isNotFound } from "@/lib/errors";
import type { ListResponse, RestaurantDetail, Review } from "@/lib/types";

function RestaurantPage() {
  const { id } = useParams<{ id: string }>();
  const detail = useAsync(() => apiFetch<RestaurantDetail>(`/restaurants/${id}`), [id]);
  const reviews = useAsync(() => apiFetch<ListResponse<Review>>(`/restaurants/${id}/reviews`), [id]);

  const restaurant = detail.data;
  if (detail.error) {
    return isNotFound(detail.error) ? <p className="text-muted-foreground">ไม่พบร้านนี้</p> : <ErrorAlert error={detail.error} />;
  }
  if (!restaurant) return <p className="text-muted-foreground">กำลังโหลด…</p>;

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4 sm:flex-row">
        <RestaurantImage imageUrl={restaurant.imageUrl} name={restaurant.name} className="h-56 w-full rounded-lg sm:w-80" />
        <div className="flex flex-1 flex-col gap-2">
          <h1 className="text-2xl font-semibold">{restaurant.name}</h1>
          <p>{restaurant.address}</p>
          {restaurant.description && <p className="whitespace-pre-wrap text-muted-foreground">{restaurant.description}</p>}
          <p className="text-sm">
            <RatingText average={restaurant.rating.average} total={restaurant.rating.total} />
          </p>
          <p className="text-sm">ที่นั่ง {restaurant.seatingCapacity}</p>
          <p className="text-sm text-muted-foreground">
            ยกเลิกได้ล่วงหน้าอย่างน้อย {restaurant.cancellationLeadMinutes} นาที
          </p>
          {restaurant.isOwner && (
            <div>
              <Link href={`/my/restaurants/${restaurant.id}/edit`} className={buttonVariants({ variant: "outline", size: "small" })}>
                จัดการร้าน
              </Link>
            </div>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">เวลาเปิด</h2>
        <table className="w-full max-w-sm text-sm">
          <tbody>
            {WEEKDAY_LABELS.map((label, weekday) => {
              const hours = restaurant.openingHours.find((h) => h.weekday === weekday);
              return (
                <tr key={weekday} className="border-b">
                  <td className="py-1 pr-4">{label}</td>
                  <td className={hours ? "" : "text-muted-foreground"}>{hours ? `${hours.open} – ${hours.close}` : "ปิด"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">จองโต๊ะ</h2>
        <ReservationForm restaurantId={restaurant.id} onCreated={() => undefined} />
      </section>

      <ErrorAlert error={reviews.error} />
      <ReviewSection
        restaurantId={restaurant.id}
        isOwner={restaurant.isOwner}
        myReview={restaurant.myReview}
        reviews={reviews.data?.results}
        onChanged={() => {
          detail.reload();
          reviews.reload();
        }}
      />
    </div>
  );
}

export default function RestaurantDetailPage() {
  return (
    <AuthGuard>
      <RestaurantPage />
    </AuthGuard>
  );
}
