"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/bases/button";
import { ErrorAlert } from "@/components/error-alert";
import { NumberStepper } from "@/components/number-stepper";
import { OpeningHoursEditor } from "@/components/opening-hours-editor";
import { RestaurantImage } from "@/components/restaurant-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { emptyDayRows, openingSummary, rowsFromHours, rowsToHours, validateRows } from "@/lib/opening-hours";
import type { RestaurantDetail, SaveRestaurantInput } from "@/lib/types";

interface RestaurantFormProps {
  initial?: RestaurantDetail;
  onSubmit: (input: SaveRestaurantInput) => Promise<void>;
  /** The picture card, shown above the fields when the restaurant already exists (a picture needs its id). */
  imageSection?: ReactNode;
}

const SECTION = "flex flex-col gap-4 rounded-[18px] border border-border-subtle bg-card p-[22px]";

export function RestaurantForm({ initial, onSubmit, imageSection }: RestaurantFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [capacity, setCapacity] = useState(String(initial?.seatingCapacity ?? 10));
  const [leadMinutes, setLeadMinutes] = useState(String(initial?.cancellationLeadMinutes ?? 60));
  const [rows, setRows] = useState(() => (initial ? rowsFromHours(initial.openingHours) : emptyDayRows()));
  const [problem, setProblem] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaved(false);
    setError(null);
    const rowsProblem = name.trim() === "" || address.trim() === "" ? "กรุณากรอกชื่อร้านและที่อยู่" : validateRows(rows);
    setProblem(rowsProblem);
    if (rowsProblem) return;

    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        address: address.trim(),
        // Left out when blank so the API stores "no description" rather than an empty string.
        description: description.trim() === "" ? undefined : description.trim(),
        seatingCapacity: Number(capacity),
        cancellationLeadMinutes: Number(leadMinutes),
        openingHours: rowsToHours(rows),
      });
      setSaved(true);
      // Creating navigates away; stay locked meanwhile so a second click cannot create a duplicate.
      if (initial) setSubmitting(false);
    } catch (err) {
      setError(err);
      setSubmitting(false);
    }
  }

  const openDays = rowsToHours(rows.filter((row) => row.open !== "" && row.close !== ""));

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="flex min-w-0 flex-col gap-4">
          {imageSection}
          <div className={SECTION}>
            <h2 className="text-lg font-semibold">ข้อมูลร้าน</h2>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name" className="text-sm font-semibold">
                ชื่อร้าน <span className="text-destructive-strong">*</span>
              </Label>
              <Input id="name" required maxLength={255} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="address" className="text-sm font-semibold">
                ที่อยู่ <span className="text-destructive-strong">*</span>
              </Label>
              <Input id="address" required value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="description" className="text-sm font-semibold">
                คำอธิบาย <span className="font-normal text-muted-foreground">(ไม่บังคับ)</span>
              </Label>
              <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>
          <div className={`${SECTION} sm:grid sm:grid-cols-2 sm:gap-5`}>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="capacity" className="text-sm font-semibold">
                จำนวนที่นั่ง <span className="text-destructive-strong">*</span>
              </Label>
              <NumberStepper id="capacity" label="จำนวนที่นั่ง" min={1} value={capacity} onChange={setCapacity} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lead" className="text-sm font-semibold">
                ยกเลิกได้ล่วงหน้า <span className="text-destructive-strong">*</span>
              </Label>
              <div className="flex items-center gap-2">
                <Input id="lead" type="number" min={30} step={1} required className="w-28" value={leadMinutes} onChange={(e) => setLeadMinutes(e.target.value)} />
                <span className="text-[15px] text-muted-foreground">นาที</span>
              </div>
              <span className="text-[13px] text-muted-foreground">อย่างน้อย 30 นาที</span>
            </div>
          </div>
          <OpeningHoursEditor rows={rows} onChange={setRows} />
        </div>

        <aside aria-label="ตัวอย่างการ์ดร้าน" className="hidden flex-col gap-2.5 lg:sticky lg:top-24 lg:flex">
          <span className="text-sm font-semibold text-muted-foreground">ตัวอย่างการ์ดร้าน</span>
          <div className="overflow-hidden rounded-[18px] border border-border-subtle bg-card">
            <div className="relative h-[180px]">
              <RestaurantImage imageUrl={initial?.imageUrl ?? null} name={name || "ร้าน"} className="size-full" />
              {initial && initial.rating.total > 0 && (
                <span className="absolute bottom-3 left-3 rounded-full bg-card px-2.5 py-1 text-[13px] font-semibold">
                  ★ {initial.rating.average.toFixed(1)} ({initial.rating.total} รีวิว)
                </span>
              )}
            </div>
            <div className="flex flex-col gap-1 px-4 pt-3.5 pb-4">
              <span className="truncate text-lg font-semibold">{name.trim() || "ชื่อร้าน"}</span>
              <span className="truncate text-sm text-muted-foreground">{address.trim() || "ที่อยู่ร้าน"}</span>
              <span className="text-sm text-muted-foreground">ที่นั่ง {Number(capacity) || 0}</span>
            </div>
          </div>
          <div className="flex flex-col gap-0.5 rounded-[14px] border border-border-subtle bg-card px-3.5 py-3 text-sm">
            <span className="text-muted-foreground">เวลาเปิดที่ลูกค้าเห็น</span>
            <span className="font-semibold">{openingSummary(openDays)}</span>
          </div>
        </aside>
      </div>

      {problem && (
        <p role="alert" className="text-sm text-destructive-strong">
          {problem}
        </p>
      )}
      <ErrorAlert error={error} />
      {saved && (
        <p role="status" className="text-sm text-success">
          บันทึกแล้ว
        </p>
      )}

      <div className="sticky bottom-[72px] z-20 flex justify-end gap-2.5 rounded-xl border border-border-subtle bg-card px-4 py-3 shadow-[0_-4px_16px_rgba(26,28,32,0.06)] md:bottom-3">
        <Link href="/my/restaurants" className={buttonVariants({ variant: "outline", size: "large" })}>
          ยกเลิก
        </Link>
        <Button type="submit" size="large" className="px-7" disabled={submitting}>
          {submitting ? "กำลังบันทึก…" : initial ? "บันทึก" : "สร้างร้าน"}
        </Button>
      </div>
    </form>
  );
}
