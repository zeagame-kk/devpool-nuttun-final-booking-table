import { Minus, Plus } from "lucide-react";

/**
 * A number field with − and + buttons beside it. It is still a real `<input type="number">` (so typing,
 * the browser's min check and `id` for a label all work); `value` is the text of the field.
 */
export function NumberStepper({
  id,
  label,
  value,
  min,
  onChange,
}: {
  id: string;
  /** What is counted, for the buttons' labels ("จำนวนที่นั่ง"). */
  label: string;
  value: string;
  min: number;
  onChange: (value: string) => void;
}) {
  const current = Number(value) || min;
  const button =
    "flex size-10 items-center justify-center rounded-[9px] outline-none hover:bg-background focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-40";

  return (
    <div className="flex w-max items-center gap-1 rounded-xl border-[1.5px] border-input bg-card p-0.5 focus-within:border-primary focus-within:ring-3 focus-within:ring-primary-subtle">
      <button type="button" aria-label={`ลด${label}`} disabled={current <= min} onClick={() => onChange(String(Math.max(min, current - 1)))} className={button}>
        <Minus aria-hidden="true" className="size-4" />
      </button>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        step={1}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-16 bg-transparent text-center text-[17px] font-semibold outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <button type="button" aria-label={`เพิ่ม${label}`} onClick={() => onChange(String(current + 1))} className={button}>
        <Plus aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}
