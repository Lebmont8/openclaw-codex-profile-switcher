#!/usr/bin/env node

import { homedir } from "node:os";
import { join } from "node:path";
import { ensureLifecyclePatch } from "./lifecycle-patch.js";

const args = process.argv.slice(2);
const mode = args[0] === "--apply" ? "apply" : args[0] === "--check" ? "check" : null;
const rootFlag = args.indexOf("--projects-root");
const stateRoot = process.env.OPENCLAW_STATE_DIR || join(homedir(), ".openclaw");
const projectsRoot = rootFlag >= 0 ? args[rootFlag + 1] : join(stateRoot, "npm", "projects");

if (!mode || (rootFlag >= 0 && !args[rootFlag + 1])) {
  process.stderr.write(`Usage: ${process.argv[1]} {--apply|--check} [--projects-root PATH]\n`);
  process.exit(2);
}

try {
  const result = await ensureLifecyclePatch({ mode, projectsRoot });
  process.stdout.write(
    `codex_lifecycle_patch=ok mode=${mode} files=${result.checked} changed=${result.changed} versions=${result.versions.join(",")}\n`,
  );
} catch (error) {
  process.stderr.write(`codex_lifecycle_patch=failed reason=${error?.message || String(error)}\n`);
  process.exit(1);
}
