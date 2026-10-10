/** Read-only stars: the whole-number rating filled in amber, the rest in grey. */
export function Stars({ value, className }: { value: number; className?: string }) {
  const filled = Math.max(0, Math.min(5, Math.round(value)));

  return (
    <span role="img" aria-label={`${filled} ดาว`} className={className}>
      <span className="text-accent-strong">{"★".repeat(filled)}</span>
      <span className="text-input">{"★".repeat(5 - filled)}</span>
    </span>
  );
}
