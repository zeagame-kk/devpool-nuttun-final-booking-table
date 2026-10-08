"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/bases/button";
import { ErrorAlert } from "@/components/error-alert";
import { StarPicker } from "@/components/star-picker";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api";
import { formatThaiDateTime } from "@/lib/datetime";
import type { RestaurantDetail, Review } from "@/lib/types";

interface ReviewSectionProps {
  restaurantId: number;
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
    <form onSubmit={submit} className="flex flex-col gap-3">
      <h3 className="font-medium">{myReview ? "แก้ไขรีวิวของคุณ" : "เขียนรีวิว"}</h3>
      <StarPicker value={rating} onChange={setRating} />
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
      <div>
        <Button type="submit" disabled={submitting || rating === 0 || comment.trim() === ""}>
          {myReview ? "บันทึกการแก้ไข" : "ส่งรีวิว"}
        </Button>
      </div>
    </form>
  );
}

export function ReviewSection({ restaurantId, isOwner, myReview, reviews, onChanged }: ReviewSectionProps) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">รีวิว</h2>
      {isOwner ? (
        <p className="text-muted-foreground">ร้านของคุณ ไม่สามารถรีวิวได้</p>
      ) : (
        // key: after the first review is saved the same form turns into the edit form with the saved values.
        <ReviewForm key={myReview?.id ?? "new"} restaurantId={restaurantId} myReview={myReview} onChanged={onChanged} />
      )}
      {reviews === undefined ? null : reviews.length === 0 ? (
        <p className="text-muted-foreground">ยังไม่มีรีวิว</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {reviews.map((review) => (
            <li key={review.id} className="rounded-lg border bg-card p-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium">{review.user.name}</span>
                <span className="text-accent-strong" role="img" aria-label={`${review.rating} ดาว`}>
                  {"★".repeat(review.rating)}
                  <span className="text-muted-foreground/40">{"★".repeat(5 - review.rating)}</span>
                </span>
                <span className="text-muted-foreground">{formatThaiDateTime(review.createdAt)}</span>
              </div>
              <p className="mt-1 whitespace-pre-wrap">{review.comment}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
