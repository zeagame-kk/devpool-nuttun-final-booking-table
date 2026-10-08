import { Badge } from "@/components/ui/badge";
import type { ReservationStatus } from "@/lib/types";

export const STATUS_LABELS: Record<ReservationStatus, string> = {
  confirmed: "ยืนยันแล้ว",
  cancelled: "ยกเลิกแล้ว",
};

export function StatusBadge({ status }: { status: ReservationStatus }) {
  return <Badge variant={status === "confirmed" ? "default" : "secondary"}>{STATUS_LABELS[status]}</Badge>;
}
