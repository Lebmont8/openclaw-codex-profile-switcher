export const pluginConfigSchema = {
  type: "object",
  additionalProperties: false,
  required: ["profiles"],
  properties: {
    provider: { type: "string", default: "openai" },
    profiles: {
      type: "array",
      minItems: 2,
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id"],
        properties: {
          id: { type: "string", minLength: 1 },
          label: { type: "string", minLength: 1, maxLength: 40 },
        },
      },
    },
    cliPath: { type: "string" },
    commandTimeoutMs: {
      type: "integer",
      minimum: 1000,
      maximum: 300000,
      default: 60000,
    },
  },
};

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizePluginConfig(raw = {}) {
  const provider = clean(raw.provider) || "openai";
  const profiles = (Array.isArray(raw.profiles) ? raw.profiles : []).map((entry, index) => {
    const id = clean(entry?.id);
    if (!id) throw new Error(`profiles[${index}].id is required`);
    return {
      id,
      label: clean(entry?.label) || `Account ${index + 1}`,
    };
  });

  if (profiles.length < 2) throw new Error("configure at least two Codex profiles");
  if (profiles.length > 8) throw new Error("a maximum of eight profiles is supported");
  if (new Set(profiles.map((entry) => entry.id)).size !== profiles.length) {
    throw new Error("profile ids must be unique");
  }

  const timeout = Number(raw.commandTimeoutMs ?? 60000);
  if (!Number.isInteger(timeout) || timeout < 1000 || timeout > 300000) {
    throw new Error("commandTimeoutMs must be an integer between 1000 and 300000");
  }

  return {
    provider,
    profiles,
    cliPath: clean(raw.cliPath) || process.env.OPENCLAW_CLI || "openclaw",
    commandTimeoutMs: timeout,
  };
}
