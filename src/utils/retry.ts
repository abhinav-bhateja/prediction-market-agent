const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface RetryOptions {
  attempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  shouldRetry?: (err: unknown) => boolean;
}

export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const { attempts = 3, baseDelayMs = 500, maxDelayMs = 10_000, shouldRetry = () => true } = opts;

  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i === attempts - 1 || !shouldRetry(err)) break;
      const delay = Math.min(baseDelayMs * 2 ** i + Math.random() * 100, maxDelayMs);
      await sleep(delay);
    }
  }
  throw lastErr;
}

/** Wraps fetch with retry + timeout. */
export async function fetchWithRetry(url: string, init?: RequestInit, opts?: RetryOptions): Promise<Response> {
  return withRetry(async () => {
    const res = await fetch(url, init);
    if (res.status >= 500) throw new Error(`HTTP ${res.status} from ${url}`);
    return res;
  }, opts);
}
