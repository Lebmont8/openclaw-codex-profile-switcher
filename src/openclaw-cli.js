import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function runOpenClaw(cliPath, args, timeout) {
  const { stdout, stderr } = await execFileAsync(cliPath, args, {
    timeout,
    maxBuffer: 1024 * 1024,
  });
  return `${stdout || ""}${stderr ? `\n${stderr}` : ""}`.trim();
}

export async function getProfileOrder({ cliPath, timeout, agentId, provider }) {
  return runOpenClaw(cliPath, [
    "models", "auth", "--agent", agentId, "order", "get", "--provider", provider,
  ], timeout);
}

export async function setProfileOrder({ cliPath, timeout, agentId, provider, order }) {
  return runOpenClaw(cliPath, [
    "models", "auth", "--agent", agentId, "order", "set", "--provider", provider, ...order,
  ], timeout);
}

export async function probeProvider({ cliPath, timeout, agentId, provider }) {
  return runOpenClaw(cliPath, [
    "models", "status", "--agent", agentId, "--probe-provider", provider,
  ], Math.max(timeout, 120000));
}
