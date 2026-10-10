"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/bases/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLinkItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/user-avatar";
import { useCredential } from "@/hooks/use-credential";
import { useMe } from "@/hooks/use-me";
import { logout, startLogin } from "@/lib/auth";
import { displayName } from "@/lib/user";

const LINKS = [
  { href: "/", label: "ร้านทั้งหมด" },
  { href: "/my/reservations", label: "การจองของฉัน" },
  { href: "/my/restaurants", label: "ร้านของฉัน" },
];

function isCurrent(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/** The signed-in person's avatar (with their name on wide screens); opens a menu with the profile and sign-out. */
function UserMenu({ name, email, imageUrl }: { name: string; email?: string; imageUrl?: string | null }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="เมนูผู้ใช้"
        className="flex items-center gap-2 rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:border md:border-border md:p-1 md:pr-2.5 data-popup-open:border-primary"
      >
        <UserAvatar name={name || "?"} imageUrl={imageUrl} />
        <span className="hidden max-w-40 truncate text-[15px] md:inline">{name}</span>
        <ChevronDown aria-hidden="true" className="hidden size-3.5 text-muted-foreground md:block" />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <div className="px-3 py-2">
          <p className="truncate text-[15px] font-semibold">{name}</p>
          {email && <p className="truncate text-[13px] text-muted-foreground">{email}</p>}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuLinkItem render={<Link href="/my/profile" />}>โปรไฟล์ของฉัน</DropdownMenuLinkItem>
        <DropdownMenuItem onClick={() => void logout()}>ออกจากระบบ</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SiteHeader() {
  const credential = useCredential();
  const { data: me } = useMe();
  const pathname = usePathname();
  const name = me ? displayName(me) : "";

  return (
    <>
      <header className="sticky top-0 z-30 border-b bg-card">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4 md:h-16">
          <div className="flex min-w-0 items-center gap-7">
            <Link href="/" className="flex shrink-0 items-center gap-2.5 text-[17px] font-bold text-primary-strong md:text-[19px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="" width={32} height={32} className="size-7 rounded-lg md:size-8" />
              Table Not Found
            </Link>
            {credential && (
              <nav aria-label="เมนูหลัก" className="hidden gap-1 text-[15px] md:flex">
                {LINKS.map((link) => {
                  const current = isCurrent(pathname, link.href);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      aria-current={current ? "page" : undefined}
                      className={`rounded-full px-3.5 py-2 ${
                        current ? "bg-primary-subtle font-semibold text-primary-ink" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </nav>
            )}
          </div>
          {credential === null && <Button onClick={startLogin}>เข้าสู่ระบบ</Button>}
          {credential && <UserMenu name={name} email={me?.email} imageUrl={me?.imageUrl} />}
        </div>
      </header>

      {credential && (
        <nav
          aria-label="เมนูหลักบนมือถือ"
          className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
        >
          {LINKS.map((link) => {
            const current = isCurrent(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={current ? "page" : undefined}
                className={`flex h-[72px] flex-col items-center justify-center gap-1 text-xs ${
                  current ? "font-semibold text-primary" : "text-muted-foreground"
                }`}
              >
                <span aria-hidden="true" className={`h-1 w-[22px] rounded-sm ${current ? "bg-primary" : ""}`} />
                {link.label}
              </Link>
            );
          })}
        </nav>
      )}
    </>
  );
}
