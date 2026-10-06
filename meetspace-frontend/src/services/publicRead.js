import { fetchWithReadRecovery } from "./readTransport.js";

const pendingReads = new Map();

export const PUBLIC_READ_TIMEOUT_MS = 15000;

// Share only in-flight reads: availability must be fetched afresh afterwards.
export function publicRead(url, readResponse, timeoutMs = PUBLIC_READ_TIMEOUT_MS) {
  if (pendingReads.has(url)) return pendingReads.get(url);
  const controller = new AbortController();
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error("REQUEST_TIMEOUT");
      error.code = "REQUEST_TIMEOUT";
      reject(error);
      controller.abort();
    }, timeoutMs);
  });
  const request = Promise.race([
    Promise.resolve().then(() => fetchWithReadRecovery(url, { signal: controller.signal })).then(readResponse),
    deadline,
  ]).finally(() => {
    clearTimeout(timer);
    pendingReads.delete(url);
  });
  pendingReads.set(url, request);
  return request;
}
