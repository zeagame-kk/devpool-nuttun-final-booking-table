"use client";

interface StarPickerProps {
  /** 0 means "not chosen yet". */
  value: number;
  onChange: (value: number) => void;
}

export function StarPicker({ value, onChange }: StarPickerProps) {
  return (
    <div role="group" aria-label="ให้คะแนน" className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          aria-label={`${n} ดาว`}
          aria-pressed={n <= value}
          onClick={() => onChange(n)}
          className={`text-2xl leading-none ${n <= value ? "text-accent-strong" : "text-muted-foreground/40"}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}
