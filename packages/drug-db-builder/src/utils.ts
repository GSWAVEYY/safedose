/**
 * Shared utilities for the drug-db-builder pipeline.
 * - Rate limiter (token bucket, 20 req/sec for NLM)
 * - Retry with exponential backoff
 * - Simple progress tracker
 */

// ---------------------------------------------------------------------------
// Rate limiter — token bucket
// ---------------------------------------------------------------------------

export interface RateLimiterOptions {
  /** Maximum requests per second. */
  requestsPerSecond: number;
}

export class RateLimiter {
  private readonly intervalMs: number;
  private lastCallTime = 0;

  constructor(options: RateLimiterOptions) {
    this.intervalMs = 1000 / options.requestsPerSecond;
  }

  /**
   * Wait until the next request slot is available.
   * Resolves immediately if a slot is currently available.
   */
  async wait(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastCallTime;
    const delay = this.intervalMs - elapsed;

    if (delay > 0) {
      await sleep(delay);
    }

    this.lastCallTime = Date.now();
  }
}

// ---------------------------------------------------------------------------
// Retry with exponential backoff
// ---------------------------------------------------------------------------

export interface RetryOptions {
  /** Maximum number of attempts (including the first try). Default: 3 */
  maxAttempts?: number;
  /** Base delay in ms for backoff calculation. Default: 1000 */
  baseDelayMs?: number;
  /** Maximum delay cap in ms. Default: 30000 */
  maxDelayMs?: number;
  /** Jitter factor 0–1 applied to each delay to prevent thundering herd. Default: 0.2 */
  jitter?: number;
  /** Called on each failed attempt before retrying. */
  onRetry?: (attempt: number, error: unknown, delayMs: number) => void;
}

/**
 * Retry an async operation with exponential backoff.
 * Throws the last error if all attempts are exhausted.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelayMs = 1000,
    maxDelayMs = 30_000,
    jitter = 0.2,
    onRetry,
  } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      if (attempt === maxAttempts) {
        break;
      }

      // Exponential: baseDelay * 2^(attempt-1), capped, with jitter
      const exponential = baseDelayMs * Math.pow(2, attempt - 1);
      const capped = Math.min(exponential, maxDelayMs);
      const jitterAmount = capped * jitter * Math.random();
      const delayMs = Math.round(capped + jitterAmount);

      onRetry?.(attempt, err, delayMs);
      await sleep(delayMs);
    }
  }

  throw lastError;
}

// ---------------------------------------------------------------------------
// Fetch wrapper with retry + rate limiter
// ---------------------------------------------------------------------------

export interface FetchJsonOptions extends RetryOptions {
  rateLimiter?: RateLimiter;
}

/**
 * Fetch a URL as JSON with automatic retry and optional rate limiting.
 * Returns the parsed body typed as T (caller is responsible for validation).
 */
export async function fetchJson<T>(
  url: string,
  options: FetchJsonOptions = {}
): Promise<T> {
  const { rateLimiter, ...retryOpts } = options;

  return withRetry(async () => {
    await rateLimiter?.wait();

    const response = await fetch(url);

    if (!response.ok) {
      throw new FetchError(
        `HTTP ${response.status} ${response.statusText} — ${url}`,
        response.status
      );
    }

    return (await response.json()) as T;
  }, retryOpts);
}

// ---------------------------------------------------------------------------
// Custom error types
// ---------------------------------------------------------------------------

export class FetchError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = "FetchError";
  }
}

// ---------------------------------------------------------------------------
// Progress tracker (console-based, no external deps for core logic)
// ---------------------------------------------------------------------------

export class ProgressTracker {
  private completed = 0;
  private failed = 0;
  private readonly startTime: number;

  constructor(private readonly total: number, private readonly label: string) {
    this.startTime = Date.now();
  }

  tick(success = true): void {
    if (success) {
      this.completed++;
    } else {
      this.failed++;
    }
  }

  get done(): number {
    return this.completed + this.failed;
  }

  get percent(): number {
    return this.total === 0 ? 100 : Math.round((this.done / this.total) * 100);
  }

  get elapsedSeconds(): number {
    return (Date.now() - this.startTime) / 1000;
  }

  get estimatedRemainingSeconds(): number {
    const done = this.done;
    if (done === 0) return 0;
    const rate = done / this.elapsedSeconds;
    return (this.total - done) / rate;
  }

  summary(): string {
    return (
      `[${this.label}] ${this.done}/${this.total} (${this.percent}%) ` +
      `— ${this.completed} ok, ${this.failed} failed ` +
      `— elapsed: ${this.elapsedSeconds.toFixed(1)}s ` +
      `— eta: ${this.estimatedRemainingSeconds.toFixed(0)}s`
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Chunk an array into groups of at most `size` items.
 */
export function chunk<T>(arr: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size) as T[]);
  }
  return result;
}

/**
 * Deduplicate an array of strings (case-insensitive).
 */
export function dedupeStrings(arr: string[]): string[] {
  const seen = new Set<string>();
  return arr.filter((s) => {
    const key = s.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Safely parse JSON, returning null on failure instead of throwing.
 */
export function safeJsonParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Format a file size in bytes to a human-readable string.
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
