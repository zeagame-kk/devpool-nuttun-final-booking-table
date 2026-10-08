import { messageForError } from "@/lib/errors";

/** Shows the Thai message for an error thrown by the API client. Renders nothing when there is no error. */
export function ErrorAlert({ error }: { error: unknown }) {
  if (error === undefined || error === null) return null;
  return (
    <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {messageForError(error)}
    </div>
  );
}
