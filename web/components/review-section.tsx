"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/bases/button";
import { ErrorAlert } from "@/components/error-alert";
import { StarPicker } from "@/components/star-picker";
import { Stars } from "@/components/stars";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/user-avatar";
import { apiFetch } from "@/lib/api";
import { formatThaiDateTime } from "@/lib/datetime";
import type { Rating, RestaurantDetail, Review } from "@/lib/types";

interface ReviewSectionProps {
  restaurantId: number;
  rating: Rating;
  isOwner: boolean;
  myReview: RestaurantDetail["myReview"];
  /** `undefined` while loading or when loading failed: nothing is claimed about the reviews then. */
  reviews: Review[] | undefined;
  onChanged: () => void;
}

function ReviewForm({ restaurantId, myReview, onChanged }: Pick<ReviewSectionProps, "restaurantId" | "myReview" | "onChanged">) {
  const [rating, setRating] = useState(myReview?.rating ?? 0);
  const [comment, setComment] = useState(myReview?.comment ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSaved(false);
    try {
      if (myReview) {
        await apiFetch(`/restaurants/${restaurantId}/reviews/me`, { method: "PUT", body: { rating, comment } });
      } else {
        await apiFetch(`/restaurants/${restaurantId}/reviews`, { method: "POST", body: { rating, comment } });
      }
      setSaved(true);
      onChanged();
      // A first review turns this form into the edit form (see the key below); until then a second
      // click would only be refused with already_reviewed, so stay locked.
      if (myReview) setSubmitting(false);
    } catch (err) {
      setError(err);
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2.5 rounded-2xl border border-border-subtle bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[15px] font-semibold">{myReview ? "แก้ไขรีวิวของคุณ" : "เขียนรีวิว"}</h3>
        <StarPicker value={rating} onChange={setRating} />
      </div>
      <Textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="เล่าประสบการณ์ของคุณ"
        aria-label="ข้อความรีวิว"
        required
      />
      <ErrorAlert error={error} />
      {saved && (
        <p role="status" className="text-sm text-success">
          บันทึกรีวิวแล้ว
        </p>
      )}
      <div className="flex justify-end">
        <Button type="submit" size="small" disabled={submitting || rating === 0 || comment.trim() === ""}>
          {myReview ? "บันทึกการแก้ไข" : "ส่งรีวิว"}
        </Button>
      </div>
    </form>
  );
}

export function ReviewSection({ restaurantId, rating, isOwner, myReview, reviews, onChanged }: ReviewSectionProps) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold md:text-[22px]">รีวิว</h2>
      <div className="grid gap-4 md:grid-cols-[200px_minmax(0,1fr)]">
        <div className="flex flex-col items-start gap-1 rounded-2xl border border-border-subtle bg-card p-5">
          <span className="text-[40px] leading-none font-bold">{rating.total > 0 ? rating.average.toFixed(1) : "–"}</span>
          {rating.total > 0 && <Stars value={rating.average} className="text-lg tracking-[2px]" />}
          <span className="text-sm text-muted-foreground">{rating.total > 0 ? `จาก ${rating.total} รีวิว` : "ยังไม่มีรีวิว"}</span>
        </div>
        {isOwner ? (
          <p className="flex items-center rounded-2xl border border-border-subtle bg-card p-4 text-muted-foreground">
            ร้านของคุณ ไม่สามารถรีวิวได้
          </p>
        ) : (
          // key: after the first review is saved the same form turns into the edit form with the saved values.
          <ReviewForm key={myReview?.id ?? "new"} restaurantId={restaurantId} myReview={myReview} onChanged={onChanged} />
        )}
      </div>
      {reviews === undefined ? null : reviews.length === 0 ? (
        <p className="text-muted-foreground">ยังไม่มีรีวิว</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {reviews.map((review) => (
            <li key={review.id} className="flex gap-3 rounded-2xl border border-border-subtle bg-card px-4 py-3.5">
              <UserAvatar name={review.user.name} size="medium" />
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-sm">
                  <span className="text-[15px] font-semibold">{review.user.name}</span>
                  <Stars value={review.rating} />
                  <span className="text-muted-foreground">{formatThaiDateTime(review.createdAt)}</span>
                </div>
                <p className="whitespace-pre-wrap text-base">{review.comment}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
