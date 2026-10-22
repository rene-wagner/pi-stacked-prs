import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// Inspect resource discovery through RPC. Never send a model prompt.
const root = fileURLToPath(new URL("../", import.meta.url));
const temp = mkdtempSync(join(tmpdir(), "pi-stacked-prs-smoke-"));
const agentDir = join(temp, "agent");
mkdirSync(agentDir);
writeFileSync(join(agentDir, "settings.json"), JSON.stringify({
  enableAnalytics: false,
  enableInstallTelemetry: false,
}));
const child = spawn("pi", [
  "--mode", "rpc", "--no-session", "--no-mcp", "--no-tools",
  "--no-extensions", "--no-context-files", "--no-approve", "--offline",
  "-e", root,
], {
  cwd: temp,
  env: {
    ...process.env,
    HOME: temp,
    XDG_CONFIG_HOME: join(temp, "config"),
    PI_CODING_AGENT_DIR: agentDir,
    PI_OFFLINE: "1",
  },
  stdio: ["pipe", "pipe", "pipe"],
});

let stderr = "";
let buffer = "";
try {
  const response = await new Promise((accept, reject) => {
    const timer = setTimeout(() => reject(new Error("Pi resource discovery timed out.")), 20000);
    const finish = (error, value) => {
      clearTimeout(timer);
      if (error) reject(error);
      else accept(value);
    };
    child.once("error", (error) => finish(error));
    child.once("exit", (code) => finish(new Error(`Pi exited before the response (${code}). ${stderr}`)));
    child.stdin.on("error", (error) => finish(error));
    child.stderr.setEncoding("utf8").on("data", (chunk) => { stderr += chunk; });
    child.stdout.setEncoding("utf8").on("data", (chunk) => {
      buffer += chunk;
      let index;
      while ((index = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, index).replace(/\r$/, "");
        buffer = buffer.slice(index + 1);
        if (!line) continue;
        try {
          const record = JSON.parse(line);
          if (record.id === "resources") finish(null, record);
        } catch (error) {
          finish(error);
        }
      }
    });
    child.stdin.write(JSON.stringify({ id: "resources", type: "get_commands" }) + "\n");
  });
  assert.equal(response.success, true, JSON.stringify(response));
  const commands = response.data.commands;
  const expected = {
    "stacked-pr-plan": "prompt",
    "stacked-pr-implement": "prompt",
    "stacked-pr-publish": "prompt",
    "skill:stacked-pr-plan": "skill",
    "skill:stacked-pr-implementation": "skill",
    "skill:stacked-pr-publication": "skill",
  };
  for (const [name, source] of Object.entries(expected)) {
    const command = commands.find((entry) => entry.name === name);
    assert.ok(command, `Pi did not load ${name}. ${stderr}`);
    assert.equal(command.source, source);
    // Explicit local -e resources can use top-level origin in Pi.
    assert.ok(["package", "top-level"].includes(command.sourceInfo.origin));
    assert.ok(command.sourceInfo.path.startsWith(root));
  }
  assert.equal(stderr.trim(), "", `Pi startup diagnostics: ${stderr}`);
  console.log("Pi loaded all three prompts and all three skills without diagnostics.");
} finally {
  const exited = new Promise((accept) => child.once("close", accept));
  child.stdin.end();
  const timer = setTimeout(() => child.kill("SIGKILL"), 2000);
  await exited;
  clearTimeout(timer);
  rmSync(temp, { recursive: true, force: true });
}
