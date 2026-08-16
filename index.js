import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";

import { normalizePluginConfig, pluginConfigSchema } from "./src/config.js";
import { getProfileOrder, probeProvider, setProfileOrder } from "./src/openclaw-cli.js";
import { profileIndexFromArgument, rotateProfiles } from "./src/profile-order.js";
import { clearPreferredProfile, setPreferredProfile } from "./src/session-preference.js";

const PLUGIN_ID = "codex-profiles";

function resolveAgentId(sessionKey) {
  return /^agent:([^:]+):/.exec(sessionKey || "")?.[1] || "main";
}

function compact(output, maxLength = 3000) {
  const clean = String(output || "").trim();
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength)}\n…output truncated`;
}

function menuText(config) {
  const profileLines = config.profiles.map((profile, index) =>
    `${index + 1}. ${profile.label} (${profile.id})`
  );
  return [
    "Codex profiles",
    "",
    ...profileLines,
    "",
    "Commands:",
    "/profiles status — current order and session preference",
    "/profiles limits — provider probe and usage",
    "/profiles <number> — prefer a profile",
    "/profiles auto — clear the session preference",
  ].join("\n");
}

function buttons(config) {
  const rows = [];
  for (let index = 0; index < config.profiles.length; index += 2) {
    rows.push(config.profiles.slice(index, index + 2).map((profile, offset) => ({
      text: profile.label,
      callback_data: `/profiles ${index + offset + 1}`,
    })));
  }
  rows.push([
    { text: "Status", callback_data: "/profiles status" },
    { text: "Limits", callback_data: "/profiles limits" },
  ]);
  rows.push([{ text: "Auto", callback_data: "/profiles auto" }]);
  return rows;
}

function response(text, config) {
  return {
    text,
    channelData: { telegram: { buttons: buttons(config) } },
    presentation: {
      title: "Codex Profiles",
      tone: "info",
      blocks: [{ type: "text", text }],
    },
  };
}

function currentPreference(sessionRuntime, agentId, sessionKey) {
  if (!sessionRuntime?.getSessionEntry || !sessionKey) return null;
  return sessionRuntime.getSessionEntry({ agentId, sessionKey });
}

async function handleCommand(ctx, api, config) {
  const args = String(ctx.args || "").trim();
  const lower = args.toLowerCase();
  const agentId = resolveAgentId(ctx.sessionKey);
  const cli = {
    cliPath: config.cliPath,
    timeout: config.commandTimeoutMs,
    agentId,
    provider: config.provider,
  };

  if (!args || lower === "help") {
    const order = await getProfileOrder(cli);
    return response(`${menuText(config)}\n\nCurrent order:\n${compact(order)}`, config);
  }

  if (lower === "status") {
    const order = await getProfileOrder(cli);
    const entry = await currentPreference(api.runtime?.agent?.session, agentId, ctx.sessionKey);
    const preference = entry?.authProfileOverride
      ? `${entry.authProfileOverride} (source: ${entry.authProfileOverrideSource || "unknown"})`
      : "automatic";
    return response([
      `Agent: ${agentId}`,
      `Session preference: ${preference}`,
      "",
      "Profile order:",
      compact(order),
    ].join("\n"), config);
  }

  if (lower === "limits" || lower === "probe") {
    return response(compact(await probeProvider(cli)), config);
  }

  if (lower === "auto") {
    const patched = await clearPreferredProfile({
      sessionRuntime: api.runtime?.agent?.session,
      agentId,
      sessionKey: ctx.sessionKey,
    });
    return response(patched
      ? "Session preference cleared. OpenClaw will choose from the configured profile order."
      : "No persisted session entry was available; the global profile order was left unchanged.", config);
  }

  const selectedIndex = profileIndexFromArgument(args, config.profiles);
  if (selectedIndex < 0) return response(`Unknown profile: ${args}\n\n${menuText(config)}`, config);

  const ordered = rotateProfiles(config.profiles, selectedIndex);
  await setProfileOrder({ ...cli, order: ordered.map((profile) => profile.id) });
  const patched = await setPreferredProfile({
    sessionRuntime: api.runtime?.agent?.session,
    agentId,
    sessionKey: ctx.sessionKey,
    profileId: ordered[0].id,
  });
  return response([
    `Preferred profile: ${ordered[0].label}`,
    `Agent: ${agentId}`,
    patched
      ? "The session preference uses source=auto, so the next configured profile remains available for failover."
      : "The order was updated; the preference will apply to new sessions.",
  ].join("\n"), config);
}

export default definePluginEntry({
  id: PLUGIN_ID,
  name: "Codex Profiles",
  description: "Switch Codex OAuth profiles while preserving automatic failover.",
  configSchema: pluginConfigSchema,
  register(api) {
    const command = {
      name: "profiles",
      description: "Check and switch Codex OAuth profiles.",
      acceptsArgs: true,
      requireAuth: true,
      async handler(ctx) {
        try {
          const config = normalizePluginConfig(api.pluginConfig);
          return await handleCommand(ctx, api, config);
        } catch (error) {
          return { text: `Codex profile switcher failed: ${error?.message || String(error)}` };
        }
      },
    };
    api.registerCommand(command);
  },
});
