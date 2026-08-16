export function rotateProfiles(profiles, selectedIndex) {
  if (!Array.isArray(profiles) || profiles.length < 2) {
    throw new Error("at least two profiles are required");
  }
  if (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex >= profiles.length) {
    throw new Error("selected profile index is out of range");
  }
  return [profiles[selectedIndex], ...profiles.filter((_, index) => index !== selectedIndex)];
}

export function profileIndexFromArgument(value, profiles) {
  const normalized = String(value || "").trim().toLowerCase();
  if (/^[1-9]\d*$/.test(normalized)) {
    const index = Number(normalized) - 1;
    return index >= 0 && index < profiles.length ? index : -1;
  }
  return profiles.findIndex((profile) =>
    profile.id.toLowerCase() === normalized || profile.label.toLowerCase() === normalized
  );
}
