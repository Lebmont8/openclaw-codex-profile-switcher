import assert from "node:assert/strict";
import test from "node:test";

import { clearPreferredProfile, preferredProfilePatch, setPreferredProfile } from "../src/session-preference.js";

test("uses source=auto so fallback candidates remain available", () => {
  assert.deepEqual(preferredProfilePatch({ compactionCount: 4 }, "openai:first@example.com"), {
    authProfileOverride: "openai:first@example.com",
    authProfileOverrideSource: "auto",
    authProfileOverrideCompactionCount: 4,
  });
});

test("persists a preference through the atomic session runtime", async () => {
  let options;
  const sessionRuntime = {
    async patchSessionEntry(value) {
      options = value;
      return { compactionCount: 2, ...value.update({ compactionCount: 2 }) };
    },
  };
  const result = await setPreferredProfile({
    sessionRuntime,
    agentId: "main",
    sessionKey: "agent:main:telegram:direct:1",
    profileId: "openai:first@example.com",
  });
  assert.equal(options.readConsistency, "latest");
  assert.equal(options.preserveActivity, true);
  assert.equal(result.authProfileOverrideSource, "auto");
});

test("clears all session preference fields", async () => {
  const sessionRuntime = {
    async patchSessionEntry(value) {
      return { compactionCount: 1, ...value.update({ compactionCount: 1 }) };
    },
  };
  const result = await clearPreferredProfile({
    sessionRuntime,
    agentId: "main",
    sessionKey: "agent:main:telegram:direct:1",
  });
  assert.equal(result.authProfileOverride, undefined);
  assert.equal(result.authProfileOverrideSource, undefined);
});
