"use client";

import { AuthGuard } from "@/components/auth-guard";

export default function HomePage() {
  return (
    <AuthGuard>
      <h1 className="text-xl font-semibold">ร้านทั้งหมด</h1>
    </AuthGuard>
  );
}
