import { constants as fsConstants } from "node:fs";
import { access, readFile, readdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

export const PATCH_MARKER = "openclaw-codex-profile-switcher: thread-rotation-v1";

const CLEAR_BINDING_ANCHOR = [
  "\t\tconst clearCurrentBinding = async (operation) => {",
  "\t\t\tconst current = binding;",
  "\t\t\tif (!current?.threadId) return;",
  "\t\t\tif (!await params.bindingStore.mutate(bindingIdentity, {",
  "\t\t\t\tkind: \"clear\",",
  "\t\t\t\tthreadId: current.threadId",
  "\t\t\t})) throw new CodexThreadBindingConflictError(current.threadId, operation);",
  "\t\t\tbinding = void 0;",
  "\t\t};",
  "",
].join("\n");

const ROTATION_BLOCK = [
  `\t\t// ${PATCH_MARKER}`,
  "\t\tconst requestedAuthProfileId = params.params.authProfileId?.trim();",
  "\t\tconst boundAuthProfileId = binding?.authProfileId?.trim();",
  "\t\tif (binding?.threadId && requestedAuthProfileId && boundAuthProfileId !== requestedAuthProfileId) {",
  "\t\t\tembeddedAgentLog.debug(\"codex auth profile changed; starting a new thread\", {",
  "\t\t\t\tthreadId: binding.threadId,",
  "\t\t\t\tpreviousAuthProfileId: boundAuthProfileId ?? null,",
  "\t\t\t\tnextAuthProfileId: requestedAuthProfileId",
  "\t\t\t});",
  "\t\t\tawait clearCurrentBinding(\"rotating a thread binding after auth profile change\");",
  "\t\t}",
  "",
].join("\n");

export function transformLifecycleSource(source) {
  if (source.includes(PATCH_MARKER)) return { source, changed: false };
  if (!source.includes("async function startOrResumeThread(params)")) {
    throw new Error("Codex lifecycle entry point was not found");
  }
  const anchorCount = source.split(CLEAR_BINDING_ANCHOR).length - 1;
  if (anchorCount !== 1) {
    throw new Error(`expected exactly one Codex binding anchor, found ${anchorCount}`);
  }
  return { source: source.replace(CLEAR_BINDING_ANCHOR, `${CLEAR_BINDING_ANCHOR}${ROTATION_BLOCK}`), changed: true };
}

async function readable(path) {
  try {
    await access(path, fsConstants.R_OK);
    return true;
  } catch {
    return false;
  }
}

export async function discoverLifecycleFiles(projectsRoot) {
  const projects = await readdir(projectsRoot, { withFileTypes: true });
  const found = [];
  for (const project of projects) {
    if (!project.isDirectory()) continue;
    const packageRoot = join(projectsRoot, project.name, "node_modules", "@openclaw", "codex");
    const packageJsonPath = join(packageRoot, "package.json");
    if (!(await readable(packageJsonPath))) continue;
    const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
    if (packageJson.name !== "@openclaw/codex") continue;
    const candidates = (await readdir(join(packageRoot, "dist")))
      .filter((name) => /^thread-lifecycle-[A-Za-z0-9_-]+\.js$/.test(name))
      .map((name) => join(packageRoot, "dist", name));
    const matching = [];
    for (const candidate of candidates) {
      if ((await readFile(candidate, "utf8")).includes("async function startOrResumeThread(params)")) {
        matching.push(candidate);
      }
    }
    if (matching.length !== 1) {
      throw new Error(`expected one Codex lifecycle bundle in ${project.name}, found ${matching.length}`);
    }
    found.push({ file: matching[0], project: project.name, version: String(packageJson.version || "unknown") });
  }
  if (found.length === 0) throw new Error(`no installed @openclaw/codex package found under ${projectsRoot}`);
  return found.sort((left, right) => left.file.localeCompare(right.file));
}

async function atomicReplace(path, content) {
  const details = await stat(path);
  const temporary = `${path}.profile-rotation-${process.pid}.tmp`;
  try {
    await writeFile(temporary, content, { mode: details.mode });
    await rename(temporary, path);
  } finally {
    await unlink(temporary).catch((error) => {
      if (error?.code !== "ENOENT") throw error;
    });
  }
}

export async function ensureLifecyclePatch({ mode, projectsRoot }) {
  if (mode !== "apply" && mode !== "check") throw new Error("mode must be apply or check");
  const installed = await discoverLifecycleFiles(projectsRoot);
  let changed = 0;
  for (const entry of installed) {
    const before = await readFile(entry.file, "utf8");
    const transformed = transformLifecycleSource(before);
    if (transformed.changed) {
      if (mode === "check") throw new Error(`Codex lifecycle patch is missing in ${entry.project}`);
      await atomicReplace(entry.file, transformed.source);
      changed += 1;
    }
    if (!(await readFile(entry.file, "utf8")).includes(PATCH_MARKER)) {
      throw new Error(`Codex lifecycle patch verification failed in ${entry.project}`);
    }
  }
  return { checked: installed.length, changed, versions: [...new Set(installed.map((entry) => entry.version))] };
}
