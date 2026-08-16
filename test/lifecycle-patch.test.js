import assert from "node:assert/strict";
import test from "node:test";

import { PATCH_MARKER, transformLifecycleSource } from "../compat/lifecycle-patch.js";

const fixture = [
  "async function startOrResumeThread(params) {",
  "\treturn await params.bindingStore.withLease(bindingIdentity, async () => {",
  "\t\tlet binding = await params.bindingStore.read(bindingIdentity);",
  "\t\tconst clearCurrentBinding = async (operation) => {",
  "\t\t\tconst current = binding;",
  "\t\t\tif (!current?.threadId) return;",
  "\t\t\tif (!await params.bindingStore.mutate(bindingIdentity, {",
  "\t\t\t\tkind: \"clear\",",
  "\t\t\t\tthreadId: current.threadId",
  "\t\t\t})) throw new CodexThreadBindingConflictError(current.threadId, operation);",
  "\t\t\tbinding = void 0;",
  "\t\t};",
  "\t\tif (binding?.threadId) return binding;",
  "\t});",
  "}",
  "",
].join("\n");

test("starts a new thread when the auth profile changes", () => {
  const result = transformLifecycleSource(fixture);
  assert.equal(result.changed, true);
  assert.match(result.source, new RegExp(PATCH_MARKER));
  assert.match(result.source, /boundAuthProfileId !== requestedAuthProfileId/);
});

test("is idempotent and fails closed on unknown bundle shapes", () => {
  const once = transformLifecycleSource(fixture);
  assert.equal(transformLifecycleSource(once.source).changed, false);
  assert.throws(
    () => transformLifecycleSource("async function startOrResumeThread(params) {}"),
    /expected exactly one/,
  );
});
