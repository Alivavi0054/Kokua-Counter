/**
 * Short, log-safe description of an unknown thrown value (name/code/message only;
 * never the whole object, which could carry request data or secrets).
 */
export function describeError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`.slice(0, 300);
  }
  if (error && typeof error === "object") {
    const { code, message } = error as { code?: unknown; message?: unknown };
    const parts = [code, message].filter((part): part is string => typeof part === "string");
    if (parts.length) return parts.join(": ").slice(0, 300);
  }
  return "unknown error";
}
