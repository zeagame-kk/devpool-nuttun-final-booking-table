import type { ReactNode } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { assetUrl } from "@/lib/api";
import type { RestaurantSummary } from "@/lib/types";

export function RestaurantImage({ imageUrl, name, className }: { imageUrl: string | null; name: string; className?: string }) {
  const src = assetUrl(imageUrl);
  if (!src) {
    return (
      <div className={`flex items-center justify-center bg-muted text-sm text-muted-foreground ${className ?? ""}`}>
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

export function RestaurantCard({ restaurant, actions }: { restaurant: RestaurantSummary; actions?: ReactNode }) {
  return (
    <Card className="overflow-hidden pt-0">
      <Link href={`/restaurants/${restaurant.id}`} className="block">
        <RestaurantImage imageUrl={restaurant.imageUrl} name={restaurant.name} className="h-40 w-full" />
      </Link>
      <CardContent className="flex flex-1 flex-col gap-1">
        <Link href={`/restaurants/${restaurant.id}`} className="text-lg font-semibold hover:text-primary">
          {restaurant.name}
        </Link>
        <p className="text-sm text-muted-foreground">{restaurant.address}</p>
        <p className="text-sm">
          <RatingText average={restaurant.rating.average} total={restaurant.rating.total} />
        </p>
        <p className="text-sm text-muted-foreground">ที่นั่ง {restaurant.seatingCapacity}</p>
        {actions && <div className="mt-2 flex flex-wrap gap-2">{actions}</div>}
      </CardContent>
    </Card>
  );
}
