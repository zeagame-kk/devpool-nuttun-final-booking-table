"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { AuthGuard } from "@/components/auth-guard";
import { ErrorAlert } from "@/components/error-alert";
import { ImageUploader } from "@/components/image-uploader";
import { RestaurantForm } from "@/components/restaurant-form";
import { useAsync } from "@/hooks/use-async";
import { apiFetch } from "@/lib/api";
import { isNotFound } from "@/lib/errors";
import type { RestaurantDetail } from "@/lib/types";

function EditRestaurant() {
  const { id } = useParams<{ id: string }>();
  const { data, error, reload } = useAsync(() => apiFetch<RestaurantDetail>(`/restaurants/${id}`), [id]);

  if (error) {
    return isNotFound(error) ? <p className="text-muted-foreground">ไม่พบร้านนี้</p> : <ErrorAlert error={error} />;
  }
  if (!data) return <p className="text-muted-foreground">กำลังโหลด…</p>;
  if (!data.isOwner) return <p className="text-muted-foreground">คุณไม่มีสิทธิ์แก้ร้านนี้</p>;

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl font-semibold">แก้ไขร้าน</h1>
          <Link href={`/restaurants/${data.id}`} className="text-sm text-primary-strong underline">
            ดูหน้าร้าน
          </Link>
        </div>
        <RestaurantForm
          initial={data}
          onSubmit={async (input) => {
            await apiFetch(`/restaurants/${data.id}`, { method: "PUT", body: input });
            reload();
          }}
        />
      </div>
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">รูปร้าน</h2>
        <ImageUploader restaurantId={data.id} imageUrl={data.imageUrl} onChanged={reload} />
      </div>
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
