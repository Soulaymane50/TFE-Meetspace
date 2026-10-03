import { privateRead } from "./privateRead.js";

export async function probeHealth(url, signal, timeoutMs = 15000, fetcher = globalThis.fetch) {
  try {
    const response = await privateRead(url, {
      headers: { Accept: "application/json" }, cache: "no-store", signal,
    }, timeoutMs, fetcher);
    // Consume the body before reporting recovery; a stalled response also has a deadline.
    const body = await response.json();
    return response.ok && body?.status === "UP";
  } catch {
    return false;
  }
}
