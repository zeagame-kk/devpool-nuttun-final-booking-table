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
import { SegmentedControl, type Segment } from "@/components/segmented-control";
import { RestaurantCard } from "@/components/restaurant-card";
import { TopRated } from "@/components/top-rated";
import { Skeleton } from "@/components/ui/skeleton";
import { useAsync } from "@/hooks/use-async";
import { useCredential } from "@/hooks/use-credential";
import { useMe } from "@/hooks/use-me";
import { apiFetch } from "@/lib/api";
import { summarizeReservations } from "@/lib/stats";
import type { ListResponse, MyReservation, RestaurantSummary } from "@/lib/types";
import { displayName, firstName } from "@/lib/user";

const PAGE_SIZE = 12;
const MAX_PAGE = 1_000_000; // the API refuses anything higher
const SORTS: Segment<string>[] = [
  { value: "", label: "ใหม่ล่าสุด" },
  { value: "rating", label: "คะแนนสูงสุด" },
  { value: "reviews", label: "รีวิวมากที่สุด" },
];

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

  const reservations = useAsync(() => apiFetch<ListResponse<MyReservation>>("/reservations"), []);
  const next = reservations.data ? summarizeReservations(reservations.data.results, new Date()).next : null;

  // The best-rated row is for someone just arriving; once they search, sort or page, only the list matters.
  const showHighlights = !name && !sort && page === 1;

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <div className={`grid gap-4 md:gap-5 ${next ? "md:grid-cols-[minmax(0,1fr)_380px]" : ""}`}>
        <section className="flex flex-col gap-3.5 rounded-[20px] border border-border-subtle bg-card p-5 md:gap-[18px] md:p-7">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold md:text-[28px]">{me ? `สวัสดี ${firstName(displayName(me))}` : "สวัสดี"}</h1>
            <p className="hidden text-base text-muted-foreground md:block">วันนี้อยากทานร้านไหน? ค้นหาแล้วดูช่วงที่ว่างได้เลย</p>
          </div>
          {/* key: when the URL changes (back button) the box shows the URL's value again */}
          <form
            key={name}
            className="flex gap-2.5"
            onSubmit={(e) => {
              e.preventDefault();
              const value = new FormData(e.currentTarget).get("name");
              go({ name: String(value ?? "").trim(), page: 1 });
            }}
          >
            <label className="flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-xl border-[1.5px] border-input bg-card px-3.5 focus-within:border-primary focus-within:ring-3 focus-within:ring-primary-subtle">
              <Search aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
              <input
                name="name"
                defaultValue={name}
                placeholder="ค้นหาตามชื่อร้าน"
                aria-label="ค้นหาตามชื่อร้าน"
                className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
              />
            </label>
            <Button type="submit" className="h-12 px-5 text-base md:px-6">
              ค้นหา
            </Button>
          </form>
        </section>
        {next && <NextBookingCard reservation={next} />}
      </div>

      {showHighlights && <TopRated />}

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <h2 className="text-xl font-semibold">ร้านทั้งหมด</h2>
          <SegmentedControl label="เรียงลำดับ" segments={SORTS} value={sort} onChange={(value) => go({ sort: value, page: 1 })} />
        </div>

        <ErrorAlert error={error} onRetry={reload} />
        {loading && !data && !error && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3" aria-label="กำลังโหลดรายการร้าน">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="h-28 sm:h-72" />
            ))}
          </div>
        )}
        {data && data.results.length === 0 && page === 1 && (
          <EmptyState
            icon={Search}
            title="ไม่พบร้านที่ค้นหา"
            description={name ? "ลองพิมพ์ชื่อร้านให้สั้นลง หรือดูร้านทั้งหมด" : "ยังไม่มีร้านในระบบ"}
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
          <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 ${loading ? "opacity-60" : ""}`}>
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
