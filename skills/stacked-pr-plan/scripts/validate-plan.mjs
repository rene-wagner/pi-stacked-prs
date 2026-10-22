#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { basename, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const BRANCH_UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const PHASE = /^P[1-9]\d*$/;
const HEADINGS = [
  "Goal",
  "Scope and exclusions",
  "Requirements with sources",
  "Architecture",
  "Risks and dependencies",
  "Assumptions and questions",
  "Validation strategy",
  "Implementation",
];
const FIELDS = [
  "Files and interfaces",
  "Steps and dependencies",
  "Acceptance criteria",
  "Validation commands",
  "Evidence",
  "Blockers",
];

function need(condition, message) {
  if (!condition) throw new Error(message);
}

function text(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function keys(value, expected, label) {
  need(Object.keys(value).length === expected.length && expected.every((key) => Object.hasOwn(value, key)),
    `Use only the required ${label} fields: ${expected.join(", ")}.`);
}

function branch(value) {
  return text(value)
    && !/[\s\x00-\x1f\x7f~^:?*\[\\]/u.test(value)
    && !value.includes("..")
    && !value.includes("@{")
    && !value.startsWith("-")
    && !value.endsWith(".")
    && value !== "@"
    && value !== "HEAD"
    && value.split("/").every((part) => part && !part.startsWith(".") && !part.endsWith(".lock"));
}

// Preserve line positions. Do not interpret examples inside fenced code blocks.
function markdown(source) {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const visible = [];
  const blocks = [];
  let fence;
  let content = [];
  for (const line of lines) {
    if (fence) {
      const close = line.match(/^ {0,3}(`{3,}|~{3,})\s*$/);
      if (close && close[1][0] === fence.char && close[1].length >= fence.length) {
        if (fence.metadata) blocks.push(content.join("\n"));
        fence = undefined;
      } else if (fence.metadata) {
        content.push(line);
      }
      visible.push("");
      continue;
    }
    const open = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (open) {
      fence = {
        char: open[1][0],
        length: open[1].length,
        metadata: open[2].trim() === "stacked-pr-plan",
      };
      content = [];
      visible.push("");
    } else {
      visible.push(line);
    }
  }
  need(!fence, "Close all fenced code blocks.");
  need(blocks.length === 1, "Use exactly one stacked-pr-plan metadata block.");
  let metadata;
  try {
    metadata = JSON.parse(blocks[0]);
  } catch {
    throw new Error("The plan metadata must contain valid JSON.");
  }
  return { lines: visible, metadata };
}

function checkMetadata(data, filePath) {
  need(data && typeof data === "object" && !Array.isArray(data), "Use a metadata object.");
  keys(data, ["schemaVersion", "id", "repository", "remote", "baseBranch", "baseCommit", "phases"], "metadata");
  need(data.schemaVersion === 1, "Use plan schemaVersion 1.");
  need(typeof data.id === "string" && data.id.length === 36 && UUID.test(data.id), "Use a lowercase version 4 plan UUID.");
  if (filePath !== undefined) {
    need(basename(filePath) === `${data.id}.md`, "The filename must equal the plan UUID plus .md.");
  }
  need(text(data.repository) && isAbsolute(data.repository), "Record an absolute repository path.");
  need(typeof data.remote === "string" && /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(data.remote)
    && !/\s/.test(data.remote), "Record a simple remote name, not a URL.");
  need(branch(data.baseBranch), "Record a valid base branch name.");
  need(typeof data.baseCommit === "string" && [40, 64].includes(data.baseCommit.length)
    && /^[0-9a-f]+$/.test(data.baseCommit) && !/^0+$/.test(data.baseCommit), "Record a full, nonzero base commit ID.");
  need(Array.isArray(data.phases) && data.phases.length > 0, "Record at least one phase.");
  const ids = new Set();
  const branches = new Set([data.baseBranch]);
  let parent = data.baseBranch;
  let previous;
  for (const phase of data.phases) {
    need(phase && typeof phase === "object" && typeof phase.id === "string" && PHASE.test(phase.id), "Use phase IDs such as P1.");
    keys(phase, ["id", "branch", "parent", "dependsOn"], "phase metadata");
    need(!ids.has(phase.id), `Duplicate phase ID: ${phase.id}.`);
    need(branch(phase.branch), `Invalid feature branch for ${phase.id}.`);
    need(!BRANCH_UUID.test(phase.branch), `Do not include a UUID in the feature branch for ${phase.id}.`);
    need(!branches.has(phase.branch), `Duplicate or base feature branch: ${phase.branch}.`);
    need(phase.parent === parent, `The parent of ${phase.id} must be ${parent}.`);
    need(Array.isArray(phase.dependsOn), `Record dependsOn for ${phase.id}.`);
    need(new Set(phase.dependsOn).size === phase.dependsOn.length, `Duplicate dependencies in ${phase.id}.`);
    need(phase.dependsOn.every((id) => ids.has(id)), `Dependencies of ${phase.id} must name earlier phases.`);
    need(!previous || phase.dependsOn.includes(previous), `${phase.id} must depend on ${previous}.`);
    ids.add(phase.id);
    branches.add(phase.branch);
    parent = phase.branch;
    previous = phase.id;
  }
}

/** Validate the plan contract. This function never executes plan commands. */
export function validatePlan(source, { filePath, requireComplete = false } = {}) {
  const { lines, metadata } = markdown(source);
  checkMetadata(metadata, filePath);
  const headings = [];
  lines.forEach((line, index) => {
    const match = line.match(/^## (.+)$/);
    if (match) headings.push({ title: match[1], index });
  });
  need(headings.length === HEADINGS.length && headings.every((h, i) => h.title === HEADINGS[i]),
    `Use these headings in order: ${HEADINGS.join("; ")}.`);
  for (let i = 0; i < headings.length - 1; i++) {
    const body = lines.slice(headings[i].index + 1, headings[i + 1].index).join("\n");
    need(body.trim(), `Fill the ${headings[i].title} section.`);
  }

  const implementation = headings.at(-1).index;
  const phases = [];
  const taskIds = new Set();
  const details = new Map();
  let current;
  let detail;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const detailMatch = line.match(/^### (P[1-9]\d*) – Details$/);
    if (detailMatch) {
      need(i > implementation, "Keep phase details in Implementation.");
      need(!details.has(detailMatch[1]), `Duplicate details for ${detailMatch[1]}.`);
      detail = [];
      details.set(detailMatch[1], detail);
      current = undefined;
      continue;
    }
    if (i > implementation && /^### /.test(line)) {
      throw new Error("Use phase detail headings such as: ### P1 – Details");
    }
    const phaseMatch = line.match(/^- \[([ x])\] (P[1-9]\d*): (\S.*)$/);
    const taskMatch = line.match(/^ {2}- \[([ x])\] (P[1-9]\d*\.T[1-9]\d*): (\S.*)$/);
    if (phaseMatch) {
      need(i > implementation && !detail, "Keep phase checkboxes before phase details in Implementation.");
      current = { id: phaseMatch[2], title: phaseMatch[3], done: phaseMatch[1] === "x", tasks: [] };
      phases.push(current);
    } else if (taskMatch) {
      need(i > implementation && current && !detail, "Put each task directly under its phase.");
      need(taskMatch[2].startsWith(`${current.id}.T`), `Task ${taskMatch[2]} has the wrong phase.`);
      need(!taskIds.has(taskMatch[2]), `Duplicate task ID: ${taskMatch[2]}.`);
      taskIds.add(taskMatch[2]);
      current.tasks.push({ id: taskMatch[2], title: taskMatch[3], done: taskMatch[1] === "x" });
    } else {
      need(!/^\s*(?:[-*+]|\d+[.)])\s+\[[^\]]*\]/.test(line),
        `Invalid or misplaced checkbox at line ${i + 1}.`);
      if (detail) detail.push(line);
    }
  }
  need(phases.length === metadata.phases.length, "Match the metadata phases and the checklist phases.");
  need(details.size === phases.length, "Give every phase one details section.");
  let earlierComplete = true;
  for (let i = 0; i < phases.length; i++) {
    const phase = phases[i];
    need(phase.id === metadata.phases[i].id, "Match the metadata order and the checklist order.");
    need(phase.tasks.length > 0, `Give ${phase.id} at least one task.`);
    need(!phase.done || phase.tasks.every((task) => task.done), `${phase.id} has open tasks.`);
    need(earlierComplete || (!phase.done && phase.tasks.every((task) => !task.done)),
      `${phase.id} has completed work before an earlier phase passed.`);
    const body = details.get(phase.id);
    need(body, `Missing details for ${phase.id}.`);
    const values = {};
    for (const field of FIELDS) {
      const prefix = `- ${field}: `;
      const matches = body.filter((line) => line.startsWith(prefix));
      need(matches.length === 1 && text(matches[0].slice(prefix.length)), `Give ${phase.id} one nonempty ${field} field.`);
      values[field] = matches[0].slice(prefix.length).trim();
    }
    if (phase.done) {
      need(values.Blockers === "None.", `${phase.id} still has a blocker.`);
      need(!/^Not run\b/i.test(values.Evidence), `${phase.id} has no validation evidence.`);
    }
    Object.assign(phase, metadata.phases[i]);
    earlierComplete &&= phase.done;
  }
  const pending = phases.flatMap((phase) => [
    ...(!phase.done ? [phase.id] : []),
    ...phase.tasks.filter((task) => !task.done).map((task) => task.id),
  ]);
  need(!requireComplete || pending.length === 0, `Open items: ${pending.join(", ")}.`);
  return { valid: true, ...metadata, phases, complete: pending.length === 0, pending };
}

export function main(args) {
  const requireComplete = args.includes("--require-complete");
  const paths = args.filter((arg) => arg !== "--require-complete");
  if (paths.length !== 1 || paths[0].startsWith("-") || args.length !== (requireComplete ? 2 : 1)) {
    console.error("Usage: node validate-plan.mjs <plan.md> [--require-complete]");
    return 2;
  }
  try {
    const result = validatePlan(readFileSync(paths[0], "utf8"), { filePath: paths[0], requireComplete });
    console.log(JSON.stringify(result, null, 2));
    return 0;
  } catch (error) {
    console.log(JSON.stringify({ valid: false, error: error.message }, null, 2));
    return 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
