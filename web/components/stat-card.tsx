/**
 * One number with a label. The first card of a row is `primary` (filled with the brand blue) so the eye
 * knows where to start; the others are plain. The label names the group so the value can be found by it.
 */
export function StatCard({
  label,
  value,
  hint,
  unit,
  tone = "plain",
  muted = false,
}: {
  label: string;
  value: string | number;
  hint?: string;
  /** Something that goes after the number but is not part of it, for example a star. */
  unit?: string;
  tone?: "primary" | "plain";
  /** The number is drawn in grey (for example cancelled reservations). */
  muted?: boolean;
}) {
  const primary = tone === "primary";

  return (
    <div
      role="group"
      aria-label={label}
      className={`flex flex-col gap-1 rounded-2xl p-[18px] md:p-5 ${primary ? "bg-primary text-primary-foreground" : "border border-border-subtle bg-card"}`}
    >
      <span className={`text-sm ${primary ? "" : "text-muted-foreground"}`}>{label}</span>
      <span className={`leading-tight font-bold ${primary ? "text-4xl" : "text-[28px]"} ${muted ? "text-muted-foreground" : ""}`}>
        <strong className="font-bold">{value}</strong>
        {unit && <span className="ml-1 text-xl">{unit}</span>}
      </span>
      {hint && <span className={`text-[13px] ${primary ? "text-primary-foreground/95" : "text-muted-foreground"}`}>{hint}</span>}
    </div>
  );
}

/** A smaller figure on a rounded pill, for the statistics that do not need a card. */
export function StatPill({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return (
    <span role="group" aria-label={label} className="rounded-full border border-border-subtle bg-card px-3.5 py-2 text-sm">
      {label}{" "}
      <b>
        <strong className="font-bold">{value}</strong>
        {unit && <span className="ml-0.5">{unit}</span>}
      </b>
    </span>
  );
}
