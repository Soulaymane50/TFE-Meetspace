import test from "node:test";
import assert from "node:assert/strict";
import { probeHealth } from "../src/services/healthProbe.js";

test("health probe consumes the body and only accepts an UP response", async () => {
  let consumed = false;
  assert.equal(await probeHealth("local", undefined, 50, async () => ({ ok: true, json: async () => { consumed = true; return { status: "UP" }; } })), true);
  assert.equal(consumed, true);
  for (const state of [{ ok: false, status: "DOWN" }, { ok: true, status: "DOWN" }, { ok: true }]) {
    assert.equal(await probeHealth("local", undefined, 50, async () => ({ ok: state.ok, json: async () => ({ status: state.status }) })), false);
  }
});
test("health probe bounds stalled headers and bodies and aborts transport", async () => {
  for (const stallBody of [false, true]) {
    let signal;
    const result = await probeHealth("local", undefined, 15, async (_url, options) => {
      signal = options.signal;
      const stalled = new Promise(() => {});
      return stallBody ? { ok: true, json: () => stalled } : stalled;
    });
    assert.equal(result, false);
    assert.equal(signal.aborted, true);
  }
});
