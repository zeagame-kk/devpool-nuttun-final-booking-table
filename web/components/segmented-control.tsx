"use client";

export interface Segment<T> {
  value: T;
  label: string;
  /** A small count shown after the label ("ทั้งหมด 4"). */
  count?: number;
}

/**
 * One choice out of a few (sort order, status filter). A track of buttons on a wide screen; on a phone
 * the same choices are pills in a row that scrolls sideways.
 */
export function SegmentedControl<T extends string>({
  label,
  segments,
  value,
  onChange,
}: {
  label: string;
  segments: Segment<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="-mx-4 flex gap-1.5 overflow-x-auto px-4 py-1 md:mx-0 md:rounded-xl md:bg-secondary md:p-1"
    >
      {segments.map((segment) => {
        const selected = segment.value === value;
        return (
          <button
            key={segment.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(segment.value)}
            className={`flex h-9 flex-none items-center rounded-full border px-3.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:rounded-[9px] md:border-0 ${
              selected
                ? "border-transparent bg-surface-inverse font-semibold text-surface-inverse-foreground md:bg-card md:text-foreground md:shadow-sm"
                : "border-border bg-card text-muted-foreground md:bg-transparent"
            }`}
          >
            {segment.label}
            {segment.count !== undefined && <span className="ml-1">{segment.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
