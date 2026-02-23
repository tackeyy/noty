export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
};

function isRetryable(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const status = (error as Record<string, unknown>).status;
  if (status === 429) return true;
  if (typeof status === "number" && status >= 500) return true;
  return false;
}

function getRetryAfterMs(error: unknown): number | null {
  if (typeof error !== "object" || error === null) return null;
  const headers = (error as Record<string, unknown>).headers;
  if (typeof headers !== "object" || headers === null) return null;
  const retryAfter = (headers as Record<string, unknown>)["retry-after"];
  if (typeof retryAfter === "string") {
    const seconds = parseFloat(retryAfter);
    if (!isNaN(seconds)) return seconds * 1000;
  }
  return null;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts?: RetryOptions,
): Promise<T> {
  const { maxRetries, baseDelayMs, maxDelayMs } = {
    ...DEFAULT_OPTIONS,
    ...opts,
  };

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt >= maxRetries || !isRetryable(error)) {
        throw error;
      }

      const retryAfterMs = getRetryAfterMs(error);
      const exponentialDelay = baseDelayMs * Math.pow(2, attempt);
      const delay = Math.min(
        retryAfterMs ?? exponentialDelay,
        maxDelayMs,
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
