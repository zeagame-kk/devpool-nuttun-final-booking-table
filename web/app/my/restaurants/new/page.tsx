"use client";

import { useRouter } from "next/navigation";
import { AuthGuard } from "@/components/auth-guard";
import { RestaurantForm } from "@/components/restaurant-form";
import { apiFetch } from "@/lib/api";

export default function NewRestaurantPage() {
  const router = useRouter();
  return (
    <AuthGuard>
      <div className="flex max-w-2xl flex-col gap-4">
        <h1 className="text-xl font-semibold">สร้างร้านใหม่</h1>
        <p className="text-sm text-muted-foreground">หลังสร้างร้านแล้ว คุณจะอัปโหลดรูปได้ในหน้าถัดไป</p>
        <RestaurantForm
          onSubmit={async (input) => {
            const { id } = await apiFetch<{ id: number }>("/restaurants", { method: "POST", body: input });
            router.push(`/my/restaurants/${id}/edit`); // a picture needs the restaurant's id first
          }}
        />
      </div>
    </AuthGuard>
  );
}
