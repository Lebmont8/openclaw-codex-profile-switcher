import assert from "node:assert/strict";
import test from "node:test";

import { profileIndexFromArgument, rotateProfiles } from "../src/profile-order.js";

const profiles = [
  { id: "openai:first@example.com", label: "Primary" },
  { id: "openai:second@example.com", label: "Backup" },
  { id: "openai:third@example.com", label: "Third" },
];

test("moves the selected profile to the front and keeps fallback order", () => {
  assert.deepEqual(rotateProfiles(profiles, 1).map((entry) => entry.label), ["Backup", "Primary", "Third"]);
});

test("resolves one-based number, id, and label", () => {
  assert.equal(profileIndexFromArgument("2", profiles), 1);
  assert.equal(profileIndexFromArgument("openai:third@example.com", profiles), 2);
  assert.equal(profileIndexFromArgument("backup", profiles), 1);
});

test("rejects an unknown selection", () => {
  assert.equal(profileIndexFromArgument("9", profiles), -1);
  assert.throws(() => rotateProfiles(profiles, 9), /out of range/);
});
