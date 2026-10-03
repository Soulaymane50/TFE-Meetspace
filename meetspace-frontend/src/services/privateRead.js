// One deadline covers both response headers and body. Authenticated reads are never shared.
export async function privateRead(url, options = {}, timeoutMs = 15000, fetcher = globalThis.fetch) {
  const controller = new AbortController();
  const timeoutError = Object.assign(new Error("REQUEST_TIMEOUT"), { code: "REQUEST_TIMEOUT" });
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
    const read = (method) => Promise.race([Promise.resolve().then(() => response[method]()), deadline]).finally(cleanup);
    return { ok: response.ok, status: response.status, headers: response.headers,
      json: () => read("json"), text: () => read("text") };
  } catch (error) {
    cleanup();
    throw error;
  }
}
