"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { AuthGuard } from "@/components/auth-guard";
import { ErrorAlert } from "@/components/error-alert";
import { ImageUploader } from "@/components/image-uploader";
import { RestaurantForm } from "@/components/restaurant-form";
import { Skeleton } from "@/components/ui/skeleton";
import { useAsync } from "@/hooks/use-async";
import { apiFetch } from "@/lib/api";
import { isNotFound } from "@/lib/errors";
import type { RestaurantDetail } from "@/lib/types";

function EditRestaurant() {
  const { id } = useParams<{ id: string }>();
  const { data, error, reload } = useAsync(() => apiFetch<RestaurantDetail>(`/restaurants/${id}`), [id]);

  if (error) {
    return isNotFound(error) ? <p className="text-muted-foreground">ไม่พบร้านนี้</p> : <ErrorAlert error={error} onRetry={reload} />;
  }
  if (!data) return <Skeleton aria-label="กำลังโหลด" className="h-96" />;
  if (!data.isOwner) return <p className="text-muted-foreground">คุณไม่มีสิทธิ์แก้ร้านนี้</p>;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-col gap-1">
          <p className="text-[15px] text-muted-foreground">
            <Link href="/my/restaurants" className="hover:text-foreground">
              ร้านของฉัน
            </Link>{" "}
            <span className="text-border">/</span> {data.name}
          </p>
          <h1 className="text-[26px] font-bold md:text-[30px]">แก้ไขร้าน</h1>
        </div>
        <Link href={`/restaurants/${data.id}`} className="text-[15px] font-semibold text-primary-strong hover:underline">
          ดูหน้าร้าน →
        </Link>
      </div>
      <RestaurantForm
        initial={data}
        imageSection={<ImageUploader restaurantId={data.id} imageUrl={data.imageUrl} onChanged={reload} />}
        onSubmit={async (input) => {
          await apiFetch(`/restaurants/${data.id}`, { method: "PUT", body: input });
          reload();
        }}
      />
    </div>
  );
}

export default function EditRestaurantPage() {
  return (
    <AuthGuard>
      <EditRestaurant />
    </AuthGuard>
  );
}
