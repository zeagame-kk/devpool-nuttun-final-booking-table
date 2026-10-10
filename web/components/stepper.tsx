import { Minus, Plus } from "lucide-react";

/** A − value + control for a small whole number (people). The buttons stop at `min` and `max`. */
export function Stepper({
  value,
  min,
  max,
  onChange,
  label,
  unit,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  /** What is being counted, for screen readers ("จำนวนคน"). */
  label: string;
  unit?: string;
}) {
  const button =
    "flex size-[38px] items-center justify-center rounded-lg outline-none hover:bg-background focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-40 disabled:hover:bg-transparent";

  return (
    <div role="group" aria-label={label} className="flex items-center gap-1 rounded-xl border-[1.5px] border-input bg-card p-[3px]">
      <button type="button" aria-label={`ลด${label}`} disabled={value <= min} onClick={() => onChange(value - 1)} className={button}>
        <Minus aria-hidden="true" className="size-4" />
      </button>
      <span aria-live="polite" className="min-w-14 text-center text-[17px] font-semibold">
        {value}
        {unit ? ` ${unit}` : ""}
      </span>
      <button type="button" aria-label={`เพิ่ม${label}`} disabled={value >= max} onClick={() => onChange(value + 1)} className={button}>
        <Plus aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}
