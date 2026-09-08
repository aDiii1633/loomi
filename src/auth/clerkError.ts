/**
 * Clerk's signals API resolves to `{ error }` rather than throwing. That
 * error can be a Clerk API error (with a nested `errors` array), a Clerk
 * runtime error, or a plain Error. This normalises any of them to one
 * human-readable line for the UI.
 */
export function clerkErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (!error) return fallback;
  if (typeof error === 'string') return error;

  const e = error as {
    errors?: { longMessage?: string; message?: string }[];
    longMessage?: string;
    message?: string;
  };

  const first = Array.isArray(e.errors) ? e.errors[0] : undefined;
  return (
    first?.longMessage ||
    first?.message ||
    e.longMessage ||
    e.message ||
    fallback
  );
}
