"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/bases/button";
import { UserAvatar } from "@/components/user-avatar";
import { useCredential } from "@/hooks/use-credential";
import { useMe } from "@/hooks/use-me";
import { logout, startLogin } from "@/lib/auth";
import { displayName } from "@/lib/user";

const LINKS = [
  { href: "/", label: "ร้านทั้งหมด" },
  { href: "/my/restaurants", label: "ร้านของฉัน" },
  { href: "/my/reservations", label: "การจองของฉัน" },
];

function isCurrent(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader() {
  const credential = useCredential();
  const { data: me } = useMe();
  const pathname = usePathname();
  const name = me ? displayName(me) : "";

  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 p-4">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold text-primary-strong">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" width={28} height={28} className="size-7" />
          Table Not Found
        </Link>
        {credential === null && (
          <Button size="small" className="ml-auto" onClick={startLogin}>
            เข้าสู่ระบบ
          </Button>
        )}
        {credential && (
          <>
            <nav aria-label="เมนูหลัก" className="flex flex-wrap gap-4 text-sm">
              {LINKS.map((link) => {
                const current = isCurrent(pathname, link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={current ? "page" : undefined}
                    className={current ? "font-medium text-primary-strong" : "text-muted-foreground hover:text-foreground"}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
            <div className="ml-auto flex items-center gap-3">
              <Link
                href="/my/profile"
                aria-label="โปรไฟล์ของฉัน"
                aria-current={isCurrent(pathname, "/my/profile") ? "page" : undefined}
                className="flex items-center gap-2 rounded-full pr-1 hover:bg-muted"
              >
                <UserAvatar name={name || "?"} imageUrl={me?.imageUrl} />
                <span className="hidden max-w-40 truncate text-sm sm:inline">{name}</span>
              </Link>
              <Button variant="outline" size="small" onClick={() => void logout()}>
                ออกจากระบบ
              </Button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
