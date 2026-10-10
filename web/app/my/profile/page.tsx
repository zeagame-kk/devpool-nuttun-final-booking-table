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
import { StatCard } from "@/components/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAsync } from "@/hooks/use-async";
import { useMe } from "@/hooks/use-me";
import { apiFetch } from "@/lib/api";
import { formatThaiDateTime } from "@/lib/datetime";
import { summarizeReservations, summarizeReviews } from "@/lib/stats";
import type { ListResponse, MyReservation, MyReview, RestaurantSummary } from "@/lib/types";

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

      {me.data ? <ProfileHeader me={me.data} onSaved={me.reload} /> : !me.error && <Skeleton className="h-32" />}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">สถิติการใช้งาน</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard label="การจองทั้งหมด" value={bookings?.total ?? dash} />
          <StatCard label="กำลังจะถึง" value={bookings?.upcoming ?? dash} hint={bookings ? `${bookings.upcomingGuests} คน` : undefined} />
          <StatCard label="ยกเลิกแล้ว" value={bookings?.cancelled ?? dash} />
          <StatCard label="ร้านที่เป็นเจ้าของ" value={owned.data?.total ?? dash} />
          <StatCard label="รีวิวที่เขียน" value={written?.count ?? dash} />
          <StatCard label="คะแนนเฉลี่ยที่ให้" value={written?.averageGiven?.toFixed(1) ?? dash} />
        </div>
      </section>

      {bookings?.next && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">การจองถัดไป</h2>
          <NextBookingCard reservation={bookings.next} />
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">รีวิวของฉัน</h2>
        {!reviews.data && !reviews.error && <Skeleton className="h-20" />}
        {reviews.data && reviews.data.results.length === 0 && (
          <EmptyState
            icon={MessageSquare}
            title="ยังไม่ได้เขียนรีวิว"
            description="เลือกร้านที่เคยไปแล้วเล่าให้คนอื่นฟัง"
            action={
              <Link href="/" className={buttonVariants({ size: "small" })}>
                ดูร้านทั้งหมด
              </Link>
            }
          />
        )}
        {reviews.data && reviews.data.results.length > 0 && (
          <ul className="flex flex-col gap-3">
            {reviews.data.results.map((review) => (
              <li key={review.id} className="flex flex-col gap-1 rounded-lg border bg-card p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/restaurants/${review.restaurant.id}`} className="font-semibold hover:text-primary-strong">
                    {review.restaurant.name}
                  </Link>
                  <span aria-label={`${review.rating} ดาว`} className="text-sm text-accent-strong">
                    {"★".repeat(review.rating)}
                    <span className="text-muted-foreground">{"★".repeat(5 - review.rating)}</span>
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-sm">{review.comment}</p>
                <p className="text-xs text-muted-foreground">{formatThaiDateTime(review.updatedAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
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
