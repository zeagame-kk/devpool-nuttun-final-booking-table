import { Button } from "@/components/bases/button";
import { messageForError } from "@/lib/errors";

/**
 * Shows the Thai message for an error thrown by the API client. Renders nothing when there is no error.
 * Give `onRetry` (for example the `reload` of useAsync) to offer a retry button.
 */
export function ErrorAlert({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  if (error === undefined || error === null) return null;
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      <span>{messageForError(error)}</span>
      {onRetry && (
        <Button variant="outline" size="small" className="ml-auto" onClick={onRetry}>
          ลองอีกครั้ง
        </Button>
      )}
    </div>
  );
}
