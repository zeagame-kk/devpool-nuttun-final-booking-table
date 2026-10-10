import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/** The "nothing here yet" panel: an icon, what is missing, and (optionally) what to do about it. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-card px-4 py-10 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-primary-subtle text-primary-strong">
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <p className="font-medium">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
