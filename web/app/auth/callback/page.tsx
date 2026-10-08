"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/bases/button";
import { ErrorAlert } from "@/components/error-alert";
import { exchangeTicket, startLogin } from "@/lib/auth";

function Callback() {
  const router = useRouter();
  const ticket = useSearchParams().get("ticket");
  // A ticket works once. React Strict Mode runs effects twice in development, and the ref (which survives
  // that simulated remount) makes sure only the first run spends the ticket.
  const exchanging = useRef(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!ticket || exchanging.current) return;
    exchanging.current = true;
    exchangeTicket(ticket)
      .then(() => router.replace("/"))
      .catch(setError);
  }, [ticket, router]);

  if (!ticket || error) {
    return (
      <div className="mx-auto mt-16 flex max-w-sm flex-col gap-4">
        {ticket ? <ErrorAlert error={error} /> : <p role="alert">ไม่พบข้อมูลสำหรับเข้าสู่ระบบ กรุณาลองใหม่</p>}
        <Button onClick={startLogin}>เข้าสู่ระบบอีกครั้ง</Button>
      </div>
    );
  }
  return <p className="mt-16 text-center text-muted-foreground">กำลังเข้าสู่ระบบ…</p>;
}

export default function CallbackPage() {
  return (
    <Suspense fallback={null}>
      <Callback />
    </Suspense>
  );
}
