"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthGuard } from "@/components/auth-guard";
import { Button } from "@/components/bases/button";
import { ErrorAlert } from "@/components/error-alert";
import { Pager } from "@/components/pager";
import { RestaurantCard } from "@/components/restaurant-card";
import { Input } from "@/components/ui/input";
import { useAsync } from "@/hooks/use-async";
import { apiFetch } from "@/lib/api";
import type { ListResponse, RestaurantSummary } from "@/lib/types";

const PAGE_SIZE = 12;
const MAX_PAGE = 1_000_000; // the API refuses anything higher
const SORTS = [
  { value: "", label: "ใหม่ล่าสุด" },
  { value: "rating", label: "คะแนนเฉลี่ย" },
  { value: "reviews", label: "จำนวนรีวิว" },
];

function RestaurantList() {
  const router = useRouter();
  const params = useSearchParams();

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

  const { data, error, loading } = useAsync(() => {
    const q = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (name) q.set("name", name);
    if (sort) q.set("sort", sort);
    return apiFetch<ListResponse<RestaurantSummary>>(`/restaurants?${q}`);
  }, [name, sort, page]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">ร้านทั้งหมด</h1>
      <div className="flex flex-wrap items-center gap-2">
        {/* key: when the URL changes (back button) the box shows the URL's value again */}
        <form
          key={name}
          className="flex flex-1 gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const value = new FormData(e.currentTarget).get("name");
            go({ name: String(value ?? "").trim(), page: 1 });
          }}
        >
          <Input name="name" defaultValue={name} placeholder="ค้นหาตามชื่อร้าน" aria-label="ค้นหาตามชื่อร้าน" />
          <Button type="submit">ค้นหา</Button>
        </form>
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

      <ErrorAlert error={error} />
      {loading && !data && <p className="text-muted-foreground">กำลังโหลด…</p>}
      {data && data.results.length === 0 && page === 1 && <p className="text-muted-foreground">ไม่พบร้านที่ค้นหา</p>}
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
    </div>
  );
}

export default function HomePage() {
  return (
    <AuthGuard>
      <Suspense fallback={null}>
        <RestaurantList />
      </Suspense>
    </AuthGuard>
  );
}
