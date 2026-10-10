import { Badge } from "@/components/ui/badge";
import type { ReservationStatus } from "@/lib/types";

export const STATUS_LABELS: Record<ReservationStatus, string> = {
  confirmed: "ยืนยันแล้ว",
  cancelled: "ยกเลิกแล้ว",
};

export function StatusBadge({ status }: { status: ReservationStatus }) {
  // "confirmed" is a soft blue chip: small white text on the bright brand blue is harder to read.
  return status === "confirmed" ? (
    <Badge className="bg-primary-subtle text-primary-ink">{STATUS_LABELS[status]}</Badge>
  ) : (
    <Badge className="bg-muted text-muted-foreground">{STATUS_LABELS[status]}</Badge>
  );
}
