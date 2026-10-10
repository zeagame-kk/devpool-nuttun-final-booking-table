import type { ReactNode } from "react";
import Link from "next/link";
import { assetUrl } from "@/lib/api";
import type { RestaurantSummary } from "@/lib/types";

export function RestaurantImage({ imageUrl, name, className }: { imageUrl: string | null; name: string; className?: string }) {
  const src = assetUrl(imageUrl);
  if (!src) {
    return (
      <div className={`flex items-center justify-center bg-primary-subtle text-sm text-primary-strong ${className ?? ""}`}>
        ไม่มีรูป
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={name} className={`object-cover ${className ?? ""}`} />;
}

export function RatingText({ average, total }: { average: number; total: number }) {
  if (total === 0) return <span className="text-muted-foreground">ยังไม่มีรีวิว</span>;
  return (
    <span>
      ★ {average.toFixed(1)} <span className="text-muted-foreground">({total} รีวิว)</span>
    </span>
  );
}

/**
 * A restaurant in a list. On a wide screen it is a card with the photo on top and the rating on the photo;
 * on a phone it is a row with a small photo, so several fit on one screen. The whole card is the link.
 */
export function RestaurantCard({ restaurant, actions }: { restaurant: RestaurantSummary; actions?: ReactNode }) {
  const { rating } = restaurant;

  return (
    <article className="group relative flex gap-3 rounded-2xl border border-border-subtle bg-card p-2.5 transition-shadow hover:shadow-[0_8px_24px_rgba(26,28,32,0.10)] sm:flex-col sm:gap-0 sm:overflow-hidden sm:p-0">
      <div className="relative size-24 shrink-0 sm:size-auto sm:h-[190px]">
        <RestaurantImage imageUrl={restaurant.imageUrl} name={restaurant.name} className="size-full rounded-xl sm:rounded-none" />
        <span className="absolute bottom-3 left-3 hidden rounded-full bg-card px-2.5 py-1 text-[13px] font-semibold sm:block">
          {rating.total > 0 ? `★ ${rating.average.toFixed(1)} (${rating.total} รีวิว)` : "ยังไม่มีรีวิว"}
        </span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 sm:justify-start sm:px-4 sm:pt-3.5 sm:pb-4">
        <Link
          href={`/restaurants/${restaurant.id}`}
          className="truncate text-base font-semibold after:absolute after:inset-0 after:content-[''] hover:text-primary-strong sm:text-lg"
        >
          {restaurant.name}
        </Link>
        <p className="truncate text-[13px] text-muted-foreground sm:text-sm">{restaurant.address}</p>
        <p className="text-[13px] sm:hidden">
          <span className="font-semibold">{rating.total > 0 ? `★ ${rating.average.toFixed(1)}` : "ยังไม่มีรีวิว"}</span>
          <span className="text-muted-foreground"> · ที่นั่ง {restaurant.seatingCapacity}</span>
        </p>
        <p className="hidden text-sm text-muted-foreground sm:block">ที่นั่ง {restaurant.seatingCapacity}</p>
        {actions && <div className="relative z-10 mt-2 flex flex-wrap gap-2">{actions}</div>}
      </div>
    </article>
  );
}
