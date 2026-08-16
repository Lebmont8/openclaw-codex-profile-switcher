export function preferredProfilePatch(entry, profileId) {
  const normalized = profileId?.trim();
  if (!normalized) throw new Error("profileId is required");
  return {
    authProfileOverride: normalized,
    authProfileOverrideSource: "auto",
    authProfileOverrideCompactionCount: entry.compactionCount ?? 0,
  };
}

export function clearedProfilePatch() {
  return {
    authProfileOverride: undefined,
    authProfileOverrideSource: undefined,
    authProfileOverrideCompactionCount: undefined,
  };
}

export async function setPreferredProfile({ sessionRuntime, agentId, sessionKey, profileId }) {
  if (!sessionRuntime?.patchSessionEntry || !sessionKey) return null;
  const patched = await sessionRuntime.patchSessionEntry({
    agentId,
    sessionKey,
    readConsistency: "latest",
    preserveActivity: true,
    update(entry) {
      return preferredProfilePatch(entry, profileId);
    },
  });
  if (!patched) return null;
  if (
    patched.authProfileOverride !== profileId ||
    patched.authProfileOverrideSource !== "auto" ||
    patched.authProfileOverrideCompactionCount !== (patched.compactionCount ?? 0)
  ) {
    throw new Error("profile preference was not persisted atomically");
  }
  return patched;
}

export async function clearPreferredProfile({ sessionRuntime, agentId, sessionKey }) {
  if (!sessionRuntime?.patchSessionEntry || !sessionKey) return null;
  const patched = await sessionRuntime.patchSessionEntry({
    agentId,
    sessionKey,
    readConsistency: "latest",
    preserveActivity: true,
    update() {
      return clearedProfilePatch();
    },
  });
  if (!patched) return null;
  if (
    patched.authProfileOverride !== undefined ||
    patched.authProfileOverrideSource !== undefined ||
    patched.authProfileOverrideCompactionCount !== undefined
  ) {
    throw new Error("profile preference was not cleared atomically");
  }
  return patched;
}
