export interface Chip<T> {
  value: T;
  label: string;
  enabled?: boolean;
}

/** A row of mutually exclusive chips (for example 1 / 2 / 3 hours). A disabled chip is dimmed and cannot be chosen. */
export function ChipGroup<T extends string | number>({
  label,
  chips,
  value,
  onChange,
}: {
  label: string;
  chips: Chip<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${chips.length}, minmax(0, 1fr))` }}>
      {chips.map((chip) => {
        const selected = chip.value === value;
        return (
          <button
            key={chip.value}
            type="button"
            aria-pressed={selected}
            disabled={chip.enabled === false}
            onClick={() => onChange(chip.value)}
            className={`h-11 rounded-[10px] border-[1.5px] text-[15px] font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-40 ${
              selected ? "border-primary bg-primary-subtle text-primary-ink" : "border-input bg-card"
            }`}
          >
            {chip.label}
          </button>
        );
      })}
    </div>
  );
}
