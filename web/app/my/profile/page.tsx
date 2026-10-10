"use client";

import { useState } from "react";
import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { AuthGuard } from "@/components/auth-guard";
import { buttonVariants } from "@/components/bases/button";
import { EmptyState } from "@/components/empty-state";
import { ErrorAlert } from "@/components/error-alert";
import { NextBookingCard } from "@/components/next-booking-card";
import { ProfileHeader } from "@/components/profile-header";
import { RestaurantImage } from "@/components/restaurant-card";
import { StatCard, StatPill } from "@/components/stat-card";
import { Stars } from "@/components/stars";
import { Skeleton } from "@/components/ui/skeleton";
import { useAsync } from "@/hooks/use-async";
import { useMe } from "@/hooks/use-me";
import { apiFetch } from "@/lib/api";
import { bangkokDateKey, thaiDateParts } from "@/lib/datetime";
import { summarizeReservations, summarizeReviews } from "@/lib/stats";
import type { ListResponse, MyReservation, MyReview, RestaurantSummary } from "@/lib/types";

/** "10 ต.ค. 2569" */
function shortDate(iso: string): string {
  const parts = thaiDateParts(bangkokDateKey(new Date(iso)));

  return `${parts.day} ${parts.monthShort} ${parts.yearBE}`;
}

function Profile() {
  const me = useMe();
  const reservations = useAsync(() => apiFetch<ListResponse<MyReservation>>("/reservations"), []);
  // Only the total is wanted, so ask for one row.
  const owned = useAsync(() => apiFetch<ListResponse<RestaurantSummary>>("/restaurants?mine=true&limit=1"), []);
  const reviews = useAsync(() => apiFetch<ListResponse<MyReview>>("/reviews"), []);
  const [now] = useState(() => new Date());

  const failed = [me, reservations, owned, reviews].find((state) => state.error);
  const retryAll = () => {
    me.reload();
    reservations.reload();
    owned.reload();
    reviews.reload();
  };

  const bookings = reservations.data ? summarizeReservations(reservations.data.results, now) : null;
  const written = reviews.data ? summarizeReviews(reviews.data.results) : null;
  const dash = "–";

  return (
    <div className="flex flex-col gap-6">
      <ErrorAlert error={failed?.error} onRetry={retryAll} />

      <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)] lg:items-start">
        <div className="flex flex-col gap-4">
          {me.data ? <ProfileHeader me={me.data} onSaved={me.reload} /> : !me.error && <Skeleton className="h-72" />}
          {bookings?.next && <NextBookingCard reservation={bookings.next} />}
        </div>

        <div className="flex min-w-0 flex-col gap-7">
          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-semibold">สถิติการใช้งาน</h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-[1.3fr_1fr_1fr]">
              <div className="col-span-2 md:col-span-1">
                <StatCard tone="primary" label="กำลังจะถึง" value={bookings?.upcoming ?? dash} hint={bookings ? `รวม ${bookings.upcomingGuests} คน` : undefined} />
              </div>
              <StatCard label="การจองทั้งหมด" value={bookings?.total ?? dash} />
              <StatCard label="ยกเลิกแล้ว" value={bookings?.cancelled ?? dash} muted />
            </div>
            <div className="flex flex-wrap gap-2.5">
              <StatPill label="รีวิวที่เขียน" value={written?.count ?? dash} />
              <StatPill label="คะแนนเฉลี่ยที่ให้" value={written?.averageGiven?.toFixed(1) ?? dash} unit={written?.averageGiven != null ? "★" : undefined} />
              <StatPill label="ร้านที่เป็นเจ้าของ" value={owned.data?.total ?? dash} />
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-semibold">รีวิวของฉัน</h2>
            {!reviews.data && !reviews.error && <Skeleton className="h-20" />}
            {reviews.data && reviews.data.results.length === 0 && (
              <EmptyState
                icon={MessageSquare}
                title="ยังไม่ได้เขียนรีวิว"
                description="เลือกร้านที่เคยไปแล้วเล่าให้คนอื่นฟัง"
                action={
                  <Link href="/" className={buttonVariants({ size: "medium" })}>
                    ดูร้านทั้งหมด
                  </Link>
                }
              />
            )}
            {reviews.data && reviews.data.results.length > 0 && (
              <ul className="flex flex-col gap-3">
                {reviews.data.results.map((review) => (
                  <li key={review.id} className="grid grid-cols-[72px_minmax(0,1fr)] gap-3.5 rounded-2xl border border-border-subtle bg-card p-3.5">
                    <RestaurantImage imageUrl={review.restaurant.imageUrl} name={review.restaurant.name} className="size-[72px] rounded-xl" />
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <div className="flex items-baseline justify-between gap-2.5">
                        <Link href={`/restaurants/${review.restaurant.id}`} className="truncate text-base font-semibold hover:text-primary-strong">
                          {review.restaurant.name}
                        </Link>
                        <span className="shrink-0 text-[13px] text-muted-foreground">{shortDate(review.updatedAt)}</span>
                      </div>
                      <Stars value={review.rating} className="text-[15px]" />
                      <p className="text-[15px] whitespace-pre-wrap">{review.comment}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <AuthGuard>
      <Profile />
    </AuthGuard>
  );
}
