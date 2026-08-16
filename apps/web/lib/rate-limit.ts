/**
 * Slowing down an automated sign-in attempt.
 *
 * The pilot write-up names this as an open risk in as many words: "nothing yet
 * slows an automated attempt." A password that takes a few tens of milliseconds
 * to check is a real cost per guess, but a machine making them in parallel for a
 * week does not care about that; it cares about being told to stop.
 *
 * WHAT THIS IS NOT. It is an in-process counter, so it protects one server
 * process and forgets everything on restart. That is honest for a single
 * container and would be the wrong shape behind several — a shared store is the
 * thing to build if this ever runs on more than one. Saying so here is the point:
 * the failure mode of a rate limiter you have quietly outgrown is that it looks
 * like it is working.
 *
 * TWO BUCKETS, ON PURPOSE. Counting only by address lets somebody spray one
 * password across many addresses; counting only by network address locks out an
 * entire office behind one connection when one person forgets their password.
 * Both are counted, and either can refuse.
 */

/** Attempts allowed in the window, per key. */
const MAX_ATTEMPTS = 8;
/** How long the window is, and how long a lockout lasts. */
const WINDOW_MS = 10 * 60 * 1000;

interface Bucket {
  count: number;
  /** When this bucket resets. */
  until: number;
}

const buckets = new Map<string, Bucket>();

/** Drop expired buckets so this cannot grow without bound on a long-lived process. */
function sweep(now: number): void {
  if (buckets.size < 512) return;
  for (const [k, b] of buckets) if (b.until <= now) buckets.delete(k);
}

/**
 * The caller's network address, as well as it can be known.
 *
 * Behind a proxy the socket address is the proxy's, so the forwarded header is
 * the only evidence — and it is a header, so somebody talking to the app
 * directly can put anything in it. That is acceptable HERE and would not be for
 * an authorisation decision: the worst a forged value achieves is dodging a
 * rate limit that also counts by email address.
 */
export function clientKey(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return fwd || req.headers.get("x-real-ip")?.trim() || "unknown";
}

export interface Verdict {
  allowed: boolean;
  /** Seconds until the caller may try again. Zero when allowed. */
  retryAfter: number;
}

/** Would this attempt be allowed? Does not count it. */
export function check(keys: string[], now = Date.now()): Verdict {
  let worst = 0;
  for (const k of keys) {
    const b = buckets.get(k);
    if (!b || b.until <= now) continue;
    if (b.count >= MAX_ATTEMPTS) worst = Math.max(worst, Math.ceil((b.until - now) / 1000));
  }
  return worst > 0 ? { allowed: false, retryAfter: worst } : { allowed: true, retryAfter: 0 };
}

/** Record a failed attempt against every key. */
export function recordFailure(keys: string[], now = Date.now()): void {
  sweep(now);
  for (const k of keys) {
    const b = buckets.get(k);
    if (!b || b.until <= now) buckets.set(k, { count: 1, until: now + WINDOW_MS });
    else b.count += 1;
  }
}

/**
 * Forget the failures for these keys.
 *
 * Called on a SUCCESSFUL sign-in. Without it, somebody who mistypes their
 * password seven times and then gets it right still carries seven strikes for
 * the next ten minutes, and the eighth honest mistake locks them out.
 */
export function recordSuccess(keys: string[]): void {
  for (const k of keys) buckets.delete(k);
}

/** Test seam. */
export function reset(): void {
  buckets.clear();
}

export const LIMITS = { MAX_ATTEMPTS, WINDOW_MS };
