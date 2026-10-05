// One deadline covers both response headers and body. Authenticated reads are never shared.
export async function privateRead(url, options = {}, timeoutMs = 15000, fetcher = globalThis.fetch) {
  const controller = new AbortController();
  const method = (options.method || "GET").toUpperCase();
  const timeoutCode = ["GET", "HEAD"].includes(method) ? "REQUEST_TIMEOUT" : "WRITE_OUTCOME_UNKNOWN";
  const timeoutError = Object.assign(new Error(timeoutCode), { code: timeoutCode });
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => { reject(timeoutError); controller.abort(); }, timeoutMs);
  });
  // Headers may arrive before the caller starts consuming the body.
  deadline.catch(() => {});
  const abort = () => controller.abort(options.signal?.reason);
  if (options.signal?.aborted) abort();
  else options.signal?.addEventListener("abort", abort, { once: true });
  const cleanup = () => {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", abort);
  };
  try {
    const response = await Promise.race([Promise.resolve().then(() => fetcher(url, { ...options, signal: controller.signal })), deadline]);
    if (response.status === 204 || response.status === 205 || options.method?.toUpperCase() === "HEAD") cleanup();
    const read = (method) => Promise.race([Promise.resolve().then(() => response[method]()), deadline]).finally(cleanup);
    return { ok: response.ok, status: response.status, headers: response.headers,
      json: () => read("json"), text: () => read("text") };
  } catch (error) {
    cleanup();
    throw error;
  }
}
