"use client";

import { useState } from "react";
import { CalendarOff } from "lucide-react";
import { Button } from "@/components/bases/button";
import { ChipGroup } from "@/components/chip-group";
import { DayStrip } from "@/components/day-strip";
import { EmptyState } from "@/components/empty-state";
import { ErrorAlert } from "@/components/error-alert";
import { SlotGrid } from "@/components/slot-grid";
import { Stepper } from "@/components/stepper";
import { Skeleton } from "@/components/ui/skeleton";
import { useAsync } from "@/hooks/use-async";
import { useSlotPicker } from "@/hooks/use-slot-picker";
import { apiFetch } from "@/lib/api";
import { bangkokClock, formatThaiDateShort, thaiDateParts } from "@/lib/datetime";
import { isApiCode } from "@/lib/errors";
import { closedWeekdayOf } from "@/lib/opening-hours";
import type { MyReservation, RestaurantDetail, SaveReservationInput } from "@/lib/types";

function EditorBody({
  reservation,
  restaurant,
  onClose,
  onSaved,
}: {
  reservation: MyReservation;
  restaurant: RestaurantDetail;
  onClose: () => void;
  onSaved: () => void;
}) {
  const picker = useSlotPicker({
    restaurantId: restaurant.id,
    capacity: restaurant.seatingCapacity,
    existing: { startAt: reservation.startAt, endAt: reservation.endAt, guests: reservation.guests },
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const { availability, times } = picker;

  async function save() {
    if (!times) return;
    setSaving(true);
    setError(null);
    const body: SaveReservationInput = { startAt: times.startAt, endAt: times.endAt, guests: picker.party };
    try {
      await apiFetch(`/reservations/${reservation.id}`, { method: "PUT", body });
      onSaved();
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 border-t border-border-subtle pt-4">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold">วัน</span>
        <DayStrip
          days={picker.days}
          today={picker.today}
          selected={picker.dateKey}
          isClosed={(key) => closedWeekdayOf(restaurant.openingHours, key)}
          onSelect={(key) => {
            setError(null);
            picker.selectDate(key);
          }}
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold">เวลาเริ่ม</span>
        <ErrorAlert error={picker.error} onRetry={picker.reload} />
        {picker.loading && !picker.error && <Skeleton className="h-28" />}
        {availability?.closed && (
          <EmptyState icon={CalendarOff} title={`ร้านปิดวัน${thaiDateParts(picker.dateKey).weekdayFull}`} description="ลองเลือกวันอื่นดูนะ" />
        )}
        {availability && !availability.closed && (
          <SlotGrid
            slots={picker.slots}
            capacity={availability.capacity}
            now={picker.now}
            selection={picker.selection}
            onPick={(index) => {
              setError(null);
              picker.pickSlot(index);
            }}
          />
        )}
      </div>

      <div className="flex flex-wrap items-end gap-x-7 gap-y-4">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold">ระยะเวลา</span>
          <div className="w-60">
            <ChipGroup
              label="ระยะเวลา"
              chips={picker.durations.map((d) => ({ value: d.hours, label: `${d.hours} ชม.`, enabled: d.enabled }))}
              value={picker.hours}
              onChange={picker.chooseHours}
            />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold">จำนวนคน</span>
          <Stepper label="จำนวนคน" unit="คน" value={picker.party} min={1} max={restaurant.seatingCapacity} onChange={picker.changeParty} />
        </div>
      </div>

      <ErrorAlert error={error} hint={isApiCode(error, "capacity_exceeded") ? "ลองลดจำนวนคน หรือเลือกช่วงเวลาอื่น" : undefined} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">
          {times ? `${formatThaiDateShort(picker.dateKey)} · ${bangkokClock(times.startAt)}–${bangkokClock(times.endAt)}` : "เลือกเวลาเริ่ม"}
        </span>
        <div className="flex gap-2">
          <Button type="button" variant="outline" disabled={saving} onClick={onClose}>
            ปิด
          </Button>
          <Button type="button" disabled={!times || saving} onClick={() => void save()}>
            {saving ? "กำลังบันทึก…" : "บันทึก"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Changing a reservation in place: the same day, hour, length and party pickers as when booking. */
export function ReservationEditor(props: { reservation: MyReservation; onClose: () => void; onSaved: () => void }) {
  const restaurant = useAsync(() => apiFetch<RestaurantDetail>(`/restaurants/${props.reservation.restaurant.id}`), [props.reservation.restaurant.id]);

  if (restaurant.error) {
    return (
      <div className="flex flex-col gap-3 border-t border-border-subtle pt-4">
        <ErrorAlert error={restaurant.error} onRetry={restaurant.reload} />
        <div>
          <Button variant="outline" onClick={props.onClose}>
            ปิด
          </Button>
        </div>
      </div>
    );
  }
  if (!restaurant.data) return <Skeleton aria-label="กำลังโหลด" className="h-40" />;

  return <EditorBody {...props} restaurant={restaurant.data} />;
}
