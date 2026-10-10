"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, Store } from "lucide-react";
import { AuthGuard } from "@/components/auth-guard";
import { AvailabilityPicker } from "@/components/availability-picker";
import { buttonVariants } from "@/components/bases/button";
import { BookingBar, BookingCard } from "@/components/booking-card";
import { EmptyState } from "@/components/empty-state";
import { ErrorAlert } from "@/components/error-alert";
import { HoursStrip } from "@/components/hours-strip";
import { RatingText, RestaurantImage } from "@/components/restaurant-card";
import { ReviewSection } from "@/components/review-section";
import { Skeleton } from "@/components/ui/skeleton";
import { useAsync } from "@/hooks/use-async";
import { useBooking } from "@/hooks/use-booking";
import { apiFetch } from "@/lib/api";
import { thaiDateParts } from "@/lib/datetime";
import { isNotFound } from "@/lib/errors";
import { openingSummary } from "@/lib/opening-hours";
import type { ListResponse, RestaurantDetail, Review } from "@/lib/types";

const CHIP = "rounded-full border border-border bg-card px-3 py-1.5 text-sm";

/** The restaurant once it is loaded (a separate component so the booking hook can rely on it being there). */
function RestaurantView({ restaurant, reviews, onReviewChanged }: { restaurant: RestaurantDetail; reviews: Review[] | undefined; onReviewChanged: () => void }) {
  const router = useRouter();
  const booking = useBooking(restaurant);

  return (
    <div className="flex flex-col gap-6 pb-64 md:gap-7 md:pb-0">
      <div className="relative -mx-4 -mt-6 md:mx-0 md:mt-0">
        <RestaurantImage imageUrl={restaurant.imageUrl} name={restaurant.name} className="h-60 w-full md:h-80 md:rounded-[20px]" />
        <button
          type="button"
          aria-label="ย้อนกลับ"
          onClick={() => router.back()}
          className="absolute top-3.5 left-3.5 flex size-10 items-center justify-center rounded-full bg-card md:hidden"
        >
          <ChevronLeft aria-hidden="true" />
        </button>
      </div>

      <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_340px] md:items-start">
        <div className="flex min-w-0 flex-col gap-9">
          <div className="flex flex-col gap-2.5">
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-[26px] leading-tight font-bold md:text-[34px]">{restaurant.name}</h1>
              {restaurant.isOwner && (
                <Link href={`/my/restaurants/${restaurant.id}/edit`} className={`${buttonVariants({ variant: "outline", size: "small" })} shrink-0`}>
                  จัดการร้าน
                </Link>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[15px] text-muted-foreground">
              <span className="font-semibold text-foreground">
                <RatingText average={restaurant.rating.average} total={restaurant.rating.total} />
              </span>
              <span>{restaurant.address}</span>
            </div>
            {restaurant.description && <p className="text-base leading-7 whitespace-pre-wrap">{restaurant.description}</p>}
            <div className="flex flex-wrap gap-2 pt-1">
              <span className={CHIP}>ที่นั่ง {restaurant.seatingCapacity}</span>
              <span className={CHIP}>ยกเลิกได้ล่วงหน้า {restaurant.cancellationLeadMinutes} นาที</span>
              <span className={CHIP}>{openingSummary(restaurant.openingHours)}</span>
            </div>
          </div>

          <AvailabilityPicker booking={booking} openingHours={restaurant.openingHours} />

          <section className="flex flex-col gap-3.5">
            <h2 className="text-xl font-semibold md:text-[22px]">เวลาเปิด</h2>
            <HoursStrip hours={restaurant.openingHours} highlight={thaiDateParts(booking.dateKey).weekday} />
          </section>

          <ReviewSection
            restaurantId={restaurant.id}
            rating={restaurant.rating}
            isOwner={restaurant.isOwner}
            myReview={restaurant.myReview}
            reviews={reviews}
            onChanged={onReviewChanged}
          />
        </div>

        <div className="hidden md:block">
          <BookingCard booking={booking} capacity={restaurant.seatingCapacity} />
        </div>
      </div>

      <BookingBar booking={booking} capacity={restaurant.seatingCapacity} />
    </div>
  );
}

function RestaurantPage() {
  const { id } = useParams<{ id: string }>();
  const detail = useAsync(() => apiFetch<RestaurantDetail>(`/restaurants/${id}`), [id]);
  const reviews = useAsync(() => apiFetch<ListResponse<Review>>(`/restaurants/${id}/reviews`), [id]);

  const restaurant = detail.data;
  if (detail.error) {
    return isNotFound(detail.error) ? (
      <EmptyState
        icon={Store}
        title="ไม่พบร้านนี้"
        description="ร้านอาจถูกลบไปแล้ว"
        action={
          <Link href="/" className={buttonVariants({ size: "small" })}>
            ดูร้านทั้งหมด
          </Link>
        }
      />
    ) : (
      <ErrorAlert error={detail.error} onRetry={detail.reload} />
    );
  }
  if (!restaurant) {
    return (
      <div className="flex flex-col gap-4" aria-label="กำลังโหลดร้าน">
        <Skeleton className="h-60 md:h-80" />
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-24" />
      </div>
    );
  }

  return (
    <>
      <ErrorAlert error={reviews.error} onRetry={reviews.reload} />
      <RestaurantView
        // key: a different restaurant starts with a fresh day, slot and party size.
        key={restaurant.id}
        restaurant={restaurant}
        reviews={reviews.data?.results}
        onReviewChanged={() => {
          detail.reload();
          reviews.reload();
        }}
      />
    </>
  );
}

export default function RestaurantDetailPage() {
  return (
    <AuthGuard>
      <RestaurantPage />
    </AuthGuard>
  );
}
