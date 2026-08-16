import assert from "node:assert/strict";
import test from "node:test";

import { normalizePluginConfig } from "../src/config.js";

test("normalizes labels and defaults", () => {
  const config = normalizePluginConfig({
    profiles: [{ id: "openai:first@example.com" }, { id: "openai:second@example.com", label: "Backup" }],
  });
  assert.equal(config.provider, "openai");
  assert.equal(config.profiles[0].label, "Account 1");
  assert.equal(config.profiles[1].label, "Backup");
  assert.equal(config.commandTimeoutMs, 60000);
});

test("rejects duplicate profile ids", () => {
  assert.throws(() => normalizePluginConfig({
    profiles: [{ id: "same" }, { id: "same" }],
  }), /unique/);
});

test("requires at least two profiles", () => {
  assert.throws(() => normalizePluginConfig({ profiles: [{ id: "one" }] }), /at least two/);
});
