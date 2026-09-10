import { useEffect, useState } from "react";

/**
 * Trails `value` by `delayMs`, so a search box can drive a server query without
 * firing one per keystroke.
 *
 * Used by the client picker, whose options come from `GET /api/clients?search=`
 * rather than from a truncated first page.
 */
export function useDebouncedValue<T>(value: T, delayMs = 250): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
