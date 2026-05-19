/**
 * Thin wrapper around fetch for Databricks API calls.
 * Adds an AbortSignal timeout so a dead/slow connection doesn't block
 * the Next.js server for the full OS-level connect timeout (10 s+).
 */
export function databricksFetch(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<Response> {
  const { timeoutMs = 8_000, signal: userSignal, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  // Merge with any caller-supplied signal
  const signal = userSignal
    ? anySignal([userSignal as AbortSignal, controller.signal])
    : controller.signal;

  return fetch(url, { ...rest, signal }).finally(() => clearTimeout(timer));
}

/** Returns an AbortSignal that fires when any of the given signals fires. */
function anySignal(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  for (const s of signals) {
    if (s.aborted) { controller.abort(); break; }
    s.addEventListener("abort", () => controller.abort(), { once: true });
  }
  return controller.signal;
}
