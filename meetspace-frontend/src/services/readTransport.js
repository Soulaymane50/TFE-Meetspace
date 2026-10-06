const TRANSIENT_STATUSES = new Set([502, 503, 504]);

function pauseBeforeRetry(signal) {
  return new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      reject(signal?.reason || new DOMException("Aborted", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve();
    }, 300);
    if (signal?.aborted) abort();
    else signal?.addEventListener("abort", abort, { once: true });
  });
}

// Retry one transient read within the caller's existing deadline. Never replay a write.
export async function fetchWithReadRecovery(url, options = {}, fetcher = globalThis.fetch) {
  const safeRead = ["GET", "HEAD"].includes((options.method || "GET").toUpperCase());
  let response;
  try {
    response = await fetcher(url, options);
    if (!safeRead || !TRANSIENT_STATUSES.has(response.status) || options.signal?.aborted) return response;
  } catch (error) {
    if (!safeRead || !(error instanceof TypeError) || options.signal?.aborted) throw error;
  }
  await response?.body?.cancel().catch(() => {});
  await pauseBeforeRetry(options.signal);
  return fetcher(url, options);
}
