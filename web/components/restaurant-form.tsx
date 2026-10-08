"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/bases/button";
import { ErrorAlert } from "@/components/error-alert";
import { OpeningHoursEditor } from "@/components/opening-hours-editor";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { emptyDayRows, rowsFromHours, rowsToHours, validateRows } from "@/lib/opening-hours";
import type { RestaurantDetail, SaveRestaurantInput } from "@/lib/types";

interface RestaurantFormProps {
  initial?: RestaurantDetail;
  onSubmit: (input: SaveRestaurantInput) => Promise<void>;
}

export function RestaurantForm({ initial, onSubmit }: RestaurantFormProps) {
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

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Label htmlFor="name">ชื่อร้าน *</Label>
        <Input id="name" required maxLength={255} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="address">ที่อยู่ *</Label>
        <Input id="address" required value={address} onChange={(e) => setAddress(e.target.value)} />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="description">คำอธิบาย</Label>
        <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="capacity">จำนวนที่นั่ง *</Label>
          <Input id="capacity" type="number" min={1} step={1} required value={capacity} onChange={(e) => setCapacity(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="lead">ยกเลิกได้ล่วงหน้า (นาที) *</Label>
          <Input id="lead" type="number" min={30} step={1} required value={leadMinutes} onChange={(e) => setLeadMinutes(e.target.value)} />
          <p className="text-xs text-muted-foreground">อย่างน้อย 30 นาที</p>
        </div>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">เวลาเปิด (เวลาประเทศไทย)</legend>
        <OpeningHoursEditor rows={rows} onChange={setRows} />
      </fieldset>
      {problem && (
        <p role="alert" className="text-sm text-destructive">
          {problem}
        </p>
      )}
      <ErrorAlert error={error} />
      {saved && (
        <p role="status" className="text-sm text-success">
          บันทึกแล้ว
        </p>
      )}
      <div>
        <Button type="submit" disabled={submitting}>
          {submitting ? "กำลังบันทึก…" : initial ? "บันทึก" : "สร้างร้าน"}
        </Button>
      </div>
    </form>
  );
}
