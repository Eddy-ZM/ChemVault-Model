type FetchOptions = RequestInit & {
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 12000;

export async function fetchWithTimeout(input: string | URL | Request, options: FetchOptions = {}) {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, signal, ...init } = options;
  const controller = new AbortController();
  const timeout = windowSafeSetTimeout(() => controller.abort(), timeoutMs);

  if (signal) {
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener('abort', () => controller.abort(), { once: true });
    }
  }

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function windowSafeSetTimeout(callback: () => void, timeoutMs: number) {
  return setTimeout(callback, timeoutMs);
}
