import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { publicRead } from "../src/services/publicRead.js";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

test("lectures simultanées dédupliquées, sans cache après réponse", async () => {
  let calls = 0;
  globalThis.fetch = async () => ({ json: async () => [++calls] });
  const first = publicRead("/catalog", (res) => res.json());
  const second = publicRead("/catalog", (res) => res.json());
  assert.equal(first, second);
  assert.deepEqual(await first, [1]);
  assert.deepEqual(await publicRead("/catalog", (res) => res.json()), [2]);
});

test("délai maximal, abandon du transport puis réessai possible", async () => {
  let signal;
  globalThis.fetch = (_, options) => {
    signal = options.signal;
    return new Promise(() => {});
  };
  await assert.rejects(publicRead("/timeout", (res) => res.json(), 20), { code: "REQUEST_TIMEOUT" });
  assert.equal(signal.aborted, true);
  globalThis.fetch = async () => ({ json: async () => [] });
  assert.deepEqual(await publicRead("/timeout", (res) => res.json()), []);
});

test("la lecture du corps de réponse est également bornée", async () => {
  globalThis.fetch = async () => ({ json: () => new Promise(() => {}) });
  await assert.rejects(publicRead("/body", (res) => res.json(), 20), { code: "REQUEST_TIMEOUT" });
});

test("une erreur libère la requête et ne bloque pas les autres catalogues", async () => {
  globalThis.fetch = async (url) => {
    if (url === "/broken") throw new Error("offline");
    return { json: async () => ["ok"] };
  };
  const failed = assert.rejects(publicRead("/broken", (res) => res.json()), /offline/);
  assert.deepEqual(await publicRead("/healthy", (res) => res.json()), ["ok"]);
  await failed;
  globalThis.fetch = async () => ({ json: async () => ["recovered"] });
  assert.deepEqual(await publicRead("/broken", (res) => res.json()), ["recovered"]);
});
