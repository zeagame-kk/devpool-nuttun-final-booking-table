"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/bases/button";
import { EmptyState } from "@/components/empty-state";
import { ErrorAlert } from "@/components/error-alert";
import { Landing } from "@/components/landing";
import { NextBookingCard } from "@/components/next-booking-card";
import { Pager } from "@/components/pager";
import { RestaurantCard } from "@/components/restaurant-card";
import { TopRated } from "@/components/top-rated";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAsync } from "@/hooks/use-async";
import { useCredential } from "@/hooks/use-credential";
import { useMe } from "@/hooks/use-me";
import { apiFetch } from "@/lib/api";
import { summarizeReservations } from "@/lib/stats";
import type { ListResponse, MyReservation, RestaurantSummary } from "@/lib/types";
import { displayName } from "@/lib/user";

const PAGE_SIZE = 12;
const MAX_PAGE = 1_000_000; // the API refuses anything higher
const SORTS = [
  { value: "", label: "ใหม่ล่าสุด" },
  { value: "rating", label: "คะแนนเฉลี่ย" },
  { value: "reviews", label: "จำนวนรีวิว" },
];

function NextBooking() {
  const { data } = useAsync(() => apiFetch<ListResponse<MyReservation>>("/reservations"), []);
  const next = data ? summarizeReservations(data.results, new Date()).next : null;
  if (!next) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">การจองถัดไปของคุณ</h2>
      <NextBookingCard reservation={next} />
    </section>
  );
}

function RestaurantList() {
  const router = useRouter();
  const params = useSearchParams();
  const { data: me } = useMe();

  // The URL is the state, so refresh, back and shared links all keep the same search.
  const name = params.get("name") ?? "";
  const sortParam = params.get("sort") ?? "";
  const sort = SORTS.some((s) => s.value === sortParam) ? sortParam : "";
  const page = Math.min(MAX_PAGE, Math.max(1, parseInt(params.get("page") ?? "1", 10) || 1));

  function go(next: { name?: string; sort?: string; page?: number }) {
    const q = new URLSearchParams();
    const n = next.name ?? name;
    const s = next.sort ?? sort;
    const p = next.page ?? page;
    if (n) q.set("name", n);
    if (s) q.set("sort", s);
    if (p > 1) q.set("page", String(p));
    router.push(q.size ? `/?${q}` : "/");
  }

  const { data, error, loading, reload } = useAsync(() => {
    const q = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (name) q.set("name", name);
    if (sort) q.set("sort", sort);
    return apiFetch<ListResponse<RestaurantSummary>>(`/restaurants?${q}`);
  }, [name, sort, page]);

  // The highlights are for someone just arriving; once they search, sort or page, only the list matters.
  const showHighlights = !name && !sort && page === 1;

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3 rounded-2xl bg-primary-subtle p-5 sm:p-6">
        <div>
          <h1 className="text-2xl font-semibold">{me ? `สวัสดี ${displayName(me)}` : "สวัสดี"}</h1>
          <p className="text-muted-foreground">วันนี้อยากทานร้านไหน? ค้นหาแล้วดูช่วงที่ว่างได้เลย</p>
        </div>
        {/* key: when the URL changes (back button) the box shows the URL's value again */}
        <form
          key={name}
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const value = new FormData(e.currentTarget).get("name");
            go({ name: String(value ?? "").trim(), page: 1 });
          }}
        >
          <Input
            name="name"
            defaultValue={name}
            placeholder="ค้นหาตามชื่อร้าน"
            aria-label="ค้นหาตามชื่อร้าน"
            className="bg-card"
          />
          <Button type="submit">ค้นหา</Button>
        </form>
      </section>

      {showHighlights && <NextBooking />}
      {showHighlights && <TopRated />}

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">ร้านทั้งหมด</h2>
          <select
            aria-label="เรียงลำดับ"
            value={sort}
            onChange={(e) => go({ sort: e.target.value, page: 1 })}
            className="h-[40px] rounded-lg border border-input bg-background px-3 text-sm"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <ErrorAlert error={error} onRetry={reload} />
        {loading && !data && !error && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="กำลังโหลดรายการร้าน">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="h-64" />
            ))}
          </div>
        )}
        {data && data.results.length === 0 && page === 1 && (
          <EmptyState
            icon={Search}
            title="ไม่พบร้านที่ค้นหา"
            description={name ? `ไม่มีร้านที่ชื่อตรงกับ "${name}" ลองใช้คำอื่นดู` : "ยังไม่มีร้านในระบบ"}
            action={
              name ? (
                <Button variant="outline" size="small" onClick={() => go({ name: "", page: 1 })}>
                  ล้างคำค้นหา
                </Button>
              ) : undefined
            }
          />
        )}
        {data && data.results.length === 0 && page > 1 && (
          <div className="flex flex-col items-start gap-2">
            <p className="text-muted-foreground">ไม่มีรายการในหน้านี้</p>
            <Button variant="outline" size="small" onClick={() => go({ page: 1 })}>
              กลับไปหน้าแรก
            </Button>
          </div>
        )}
        {data && data.results.length > 0 && (
          <div className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-3 ${loading ? "opacity-60" : ""}`}>
            {data.results.map((restaurant) => (
              <RestaurantCard key={restaurant.id} restaurant={restaurant} />
            ))}
          </div>
        )}
        {data && <Pager page={page} total={data.total} limit={PAGE_SIZE} onChange={(p) => go({ page: p })} />}
      </section>
    </div>
  );
}

export default function HomePage() {
  const credential = useCredential();
  if (credential === undefined) return null; // not mounted yet: do not flash the landing page at someone signed in
  if (credential === null) return <Landing />;

  return (
    <Suspense fallback={null}>
      <RestaurantList />
    </Suspense>
  );
}
