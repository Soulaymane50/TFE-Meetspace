import assert from "node:assert/strict";
import { test } from "node:test";
import { fetchWithReadRecovery } from "../src/services/readTransport.js";
import { privateRead } from "../src/services/privateRead.js";

test("a transient read is recovered once and preserves authorization", async () => {
  for (const failure of ["network", 502, 503, 504]) {
    const requests = [];
    const options = { headers: { Authorization: "Bearer fixture-only" } };
    const response = await fetchWithReadRecovery("/private", options, async (_url, request) => {
      requests.push(request);
      if (requests.length === 1) {
        if (failure === "network") throw new TypeError("Failed to fetch");
        return new Response("Unavailable", { status: failure });
      }
      return new Response("recovered");
    });
    assert.equal(await response.text(), "recovered");
    assert.equal(requests.length, 2);
    assert.equal(requests[1].headers.Authorization, "Bearer fixture-only");
  }
});

test("writes, refusals and missing resources are never replayed", async () => {
  for (const method of ["POST", "PATCH", "PUT", "DELETE"]) {
    let calls = 0;
    await assert.rejects(fetchWithReadRecovery("/payment", { method }, async () => {
      calls++; throw new TypeError("Failed to fetch");
    }), TypeError);
    assert.equal(calls, 1);
    calls = 0;
    const result = await fetchWithReadRecovery("/payment", { method }, async () => { calls++; return new Response("error", {status:503}); });
    assert.equal(result.status, 503); assert.equal(calls, 1);
  }
  for (const status of [400, 401, 403, 404, 409, 429, 500]) {
    let calls = 0;
    const result = await fetchWithReadRecovery("/read", {}, async () => { calls++; return new Response("error", {status}); });
    assert.equal(result.status, status); assert.equal(calls, 1);
  }
});

test("a persistent outage makes at most two attempts", async () => {
  let calls = 0;
  await assert.rejects(fetchWithReadRecovery("/read", {}, async () => { calls++; throw new TypeError("offline"); }), TypeError);
  assert.equal(calls, 2);
});

test("the retry delay respects the overall deadline and cancellation", async () => {
  let calls = 0;
  await assert.rejects(privateRead("/read", {}, 25, async () => { calls++; throw new TypeError("offline"); }), {code:"REQUEST_TIMEOUT"});
  await new Promise(resolve => setTimeout(resolve, 350));
  assert.equal(calls, 1);
  const controller = new AbortController(); calls = 0;
  const pending = fetchWithReadRecovery("/read", {signal:controller.signal}, async () => { calls++; throw new TypeError("offline"); });
  setTimeout(() => controller.abort(), 20);
  await assert.rejects(pending, {name:"AbortError"});
  assert.equal(calls, 1);
});

test("a write deadline keeps the outcome unknown rather than replaying", async () => {
  let calls = 0;
  await assert.rejects(privateRead("/payment", {method:"POST"}, 20, async () => { calls++; return new Promise(() => {}); }), {code:"WRITE_OUTCOME_UNKNOWN"});
  assert.equal(calls, 1);
});
