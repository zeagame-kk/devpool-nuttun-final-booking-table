import { Button } from "@/components/bases/button";
import { messageForError } from "@/lib/errors";

/**
 * Shows the Thai message for an error thrown by the API client. Renders nothing when there is no error.
 * Give `onRetry` (for example the `reload` of useAsync) to offer a retry button, and `hint` for a second,
 * quieter line that says what to try.
 */
export function ErrorAlert({ error, onRetry, hint }: { error: unknown; onRetry?: () => void; hint?: string }) {
  if (error === undefined || error === null) return null;
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-3 rounded-xl bg-destructive-subtle px-4 py-3.5 text-destructive-strong"
    >
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-[15px] font-semibold">{messageForError(error)}</span>
        {hint && <span className="text-[13px]">{hint}</span>}
      </div>
      {onRetry && (
        <Button
          variant="outline"
          size="small"
          className="border-destructive-border bg-card text-destructive-strong hover:bg-card hover:text-destructive-strong"
          onClick={onRetry}
        >
          ลองอีกครั้ง
        </Button>
      )}
    </div>
  );
}
