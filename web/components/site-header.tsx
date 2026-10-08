"use client";

import Link from "next/link";
import { Button } from "@/components/bases/button";
import { useCredential } from "@/hooks/use-credential";
import { logout } from "@/lib/auth";

const LINKS = [
  { href: "/", label: "ร้านทั้งหมด" },
  { href: "/my/restaurants", label: "ร้านของฉัน" },
  { href: "/my/reservations", label: "การจองของฉัน" },
];

export function SiteHeader() {
  const credential = useCredential();
  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 p-4">
        <Link href="/" className="text-lg font-semibold text-primary">
          Booking Table
        </Link>
        {credential && (
          <>
            <nav aria-label="เมนูหลัก" className="flex flex-wrap gap-4 text-sm">
              {LINKS.map((link) => (
                <Link key={link.href} href={link.href} className="text-muted-foreground hover:text-foreground">
                  {link.label}
                </Link>
              ))}
            </nav>
            <Button variant="outline" size="small" className="ml-auto" onClick={() => void logout()}>
              ออกจากระบบ
            </Button>
          </>
        )}
      </div>
    </header>
  );
}
