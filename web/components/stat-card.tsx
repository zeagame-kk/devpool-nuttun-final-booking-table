import { Card } from "@/components/ui/card";

/** One number with a label, for the profile and owner summaries. */
export function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card size="sm" className="gap-1">
      <div className="px-(--card-spacing)">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold text-primary-strong">{value}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
    </Card>
  );
}
