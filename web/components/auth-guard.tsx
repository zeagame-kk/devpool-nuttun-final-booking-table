"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/bases/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCredential } from "@/hooks/use-credential";
import { startLogin } from "@/lib/auth";

/** Shows its children only to a signed-in user; everyone else gets a sign-in card. */
export function AuthGuard({ children }: { children: ReactNode }) {
  const credential = useCredential();
  if (credential === undefined) return null; // not mounted yet: do not flash the sign-in card
  if (credential === null) {
    return (
      <Card className="mx-auto mt-16 max-w-sm">
        <CardHeader>
          <CardTitle>กรุณาเข้าสู่ระบบ</CardTitle>
          <CardDescription>เข้าสู่ระบบด้วยอีเมลเพื่อค้นหาร้าน จองโต๊ะ และรีวิว</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={startLogin}>เข้าสู่ระบบ</Button>
        </CardContent>
      </Card>
    );
  }
  return <>{children}</>;
}
