"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { Button } from "@/components/bases/button";
import { ErrorAlert } from "@/components/error-alert";
import { RestaurantImage } from "@/components/restaurant-card";
import { apiFetch } from "@/lib/api";

const MAX_BYTES = 2 * 1024 * 1024;

interface ImageUploaderProps {
  restaurantId: number;
  imageUrl: string | null;
  onChanged: () => void;
}

export function ImageUploader({ restaurantId, imageUrl, onChanged }: ImageUploaderProps) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      onChanged();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  function pick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // lets the same file be chosen again after a failure
    if (!file) return;
    if (file.size > MAX_BYTES) {
      // Same message as the server's invalid_image; the server still checks size and the real file type.
      setError({ status: 400, code: "invalid_image" });
      return;
    }
    const form = new FormData();
    form.append("file", file);
    void run(() => apiFetch(`/restaurants/${restaurantId}/image`, { method: "POST", body: form }));
  }

  return (
    <div className="flex flex-col gap-3">
      <RestaurantImage imageUrl={imageUrl} name="รูปร้าน" className="h-48 w-full max-w-md rounded-lg" />
      <div className="flex flex-wrap gap-2">
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={pick} />
        <Button variant="outline" size="small" disabled={busy} onClick={() => input.current?.click()}>
          {imageUrl ? "เปลี่ยนรูป" : "อัปโหลดรูป"}
        </Button>
        {imageUrl && (
          <Button
            variant="destructive"
            size="small"
            disabled={busy}
            onClick={() => void run(() => apiFetch(`/restaurants/${restaurantId}/image`, { method: "DELETE" }))}
          >
            ลบรูป
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">รองรับ JPG, PNG, WebP ขนาดไม่เกิน 2 MB</p>
      <ErrorAlert error={error} />
    </div>
  );
}
