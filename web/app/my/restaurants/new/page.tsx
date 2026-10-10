"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthGuard } from "@/components/auth-guard";
import { RestaurantForm } from "@/components/restaurant-form";
import { apiFetch } from "@/lib/api";

export default function NewRestaurantPage() {
  const router = useRouter();
  return (
    <AuthGuard>
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <p className="text-[15px] text-muted-foreground">
            <Link href="/my/restaurants" className="hover:text-foreground">
              ร้านของฉัน
            </Link>{" "}
            <span className="text-border">/</span> สร้างร้านใหม่
          </p>
          <h1 className="text-[26px] font-bold md:text-[30px]">สร้างร้านใหม่</h1>
          <p className="text-sm text-muted-foreground">หลังสร้างร้านแล้ว คุณจะอัปโหลดรูปได้ในหน้าถัดไป</p>
        </div>
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
