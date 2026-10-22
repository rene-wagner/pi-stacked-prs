import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { validatePlan } from "../skills/stacked-pr-plan/scripts/validate-plan.mjs";
import { ID, metadata, plan } from "./fixtures.mjs";

test("a one-task phase is a valid small plan", () => {
  const result = validatePlan(plan(), { filePath: `/tmp/${ID}.md` });
  assert.equal(result.valid, true);
  assert.equal(result.complete, false);
  assert.deepEqual(result.pending, ["P1", "P1.T1"]);
  assert.equal(result.phases[0].parent, "main");
});

test("a complete branch chain passes the publication gate", () => {
  const result = validatePlan(plan({ count: 3, completed: true }), { requireComplete: true });
  assert.equal(result.complete, true);
  assert.deepEqual(result.pending, []);
  assert.deepEqual(result.phases[2].dependsOn, ["P2"]);
  assert.equal(result.phases[2].parent, result.phases[1].branch);
});

test("issue-based branch names keep the UUID only in plan metadata", () => {
  const source = metadata(plan({ count: 2 }), (data) => {
    data.phases[0].branch = "HXP-1545_p1-input-inventory";
    data.phases[1].branch = "HXP-1545_p2-input-validation";
    data.phases[1].parent = data.phases[0].branch;
  });
  const result = validatePlan(source);
  assert.equal(result.id, ID);
  assert.equal(result.phases[0].branch, "HXP-1545_p1-input-inventory");
  assert.equal(result.phases[1].parent, result.phases[0].branch);
});

test("task success can precede phase acceptance", () => {
  const source = plan().replace("- [ ] P1.T1:", "- [x] P1.T1:");
  assert.deepEqual(validatePlan(source).pending, ["P1"]);
  assert.throws(() => validatePlan(source, { requireComplete: true }), /Open items: P1/);
});

test("all open IDs are reported by the publication gate", () => {
  assert.throws(() => validatePlan(plan({ count: 2 }), { requireComplete: true }),
    /Open items: P1, P1.T1, P2, P2.T1/);
});

test("stable IDs can have gaps after a plan revision", () => {
  const source = plan({ count: 2 }).replaceAll("P2", "P4");
  assert.equal(validatePlan(source).phases[1].id, "P4");
});

test("CRLF and SHA-256 commit IDs are accepted", () => {
  const source = metadata(plan(), (data) => { data.baseCommit = "a".repeat(64); }).replaceAll("\n", "\r\n");
  assert.equal(validatePlan(source).baseCommit.length, 64);
});

const metadataCases = [
  ["schema version", (data) => { data.schemaVersion = 2; }, /schemaVersion/],
  ["missing metadata field", (data) => { delete data.remote; }, /required metadata fields/],
  ["unknown metadata field", (data) => { data.complete = true; }, /required metadata fields/],
  ["unknown phase completion field", (data) => { data.phases[0].done = true; }, /required phase metadata fields/],
  ["unknown phase task field", (data) => { data.phases[0].tasks = []; }, /required phase metadata fields/],
  ["non-v4 UUID", (data) => { data.id = ID.replace("-4000-", "-1000-"); }, /UUID/],
  ["non-string UUID", (data) => { data.id = [ID]; }, /UUID/],
  ["UUID line break", (data) => { data.id += "\n"; }, /UUID/],
  ["remote line break", (data) => { data.remote += "\n"; }, /remote name/],
  ["commit line break", (data) => { data.baseCommit += "\n"; }, /base commit/],
  ["relative repository", (data) => { data.repository = "../repo"; }, /absolute repository/],
  ["remote URL", (data) => { data.remote = "ssh://host/repo"; }, /remote name/],
  ["short commit", (data) => { data.baseCommit = "abc123"; }, /base commit/],
  ["zero commit", (data) => { data.baseCommit = "0".repeat(40); }, /base commit/],
  ["missing phases", (data) => { data.phases = []; }, /at least one phase/],
  ["duplicate phase ID", (data) => { data.phases.push({ ...data.phases[0] }); }, /Duplicate phase ID/],
  ["duplicate branch", (data) => { data.phases[1].branch = data.phases[0].branch; }, /Duplicate or base/],
  ["base as feature branch", (data) => { data.phases[0].branch = data.baseBranch; }, /Duplicate or base/],
  ["invalid branch", (data) => { data.phases[0].branch = "feat/bad..name"; }, /Invalid feature branch/],
  ["reported stack UUID branch", (data) => {
    data.phases[0].branch = "HXP-1545_stack-aa6eeea6-c1d7-4e44-86f9-e1a37be89d56-p1-input-inventory";
  }, /Do not include a UUID/],
  ["plan UUID without stack prefix", (data) => { data.phases[0].branch = `feat/${data.id}-p1-example`; }, /Do not include a UUID/],
  ["uppercase UUID", (data) => {
    data.phases[0].branch = "feat/stack-AA6EEEA6-C1D7-4E44-86F9-E1A37BE89D56-p1-example";
  }, /Do not include a UUID/],
  ["UUID in a later phase", (data) => { data.phases[1].branch = `feat/stack-${data.id}-p2-example`; }, /Do not include a UUID/],
  ["branch injection", (data) => { data.phases[0].branch = "feat/a\nother"; }, /Invalid feature branch/],
  ["wrong parent", (data) => { data.phases[1].parent = "main"; }, /parent of P2/],
  ["forward dependency", (data) => { data.phases[0].dependsOn = ["P2"]; }, /earlier phases/],
  ["self dependency", (data) => { data.phases[0].dependsOn = ["P1"]; }, /earlier phases/],
  ["missing predecessor", (data) => { data.phases[1].dependsOn = []; }, /must depend on P1/],
  ["duplicate dependency", (data) => { data.phases[1].dependsOn = ["P1", "P1"]; }, /Duplicate dependencies/],
];
for (const [name, change, error] of metadataCases) {
  test(`reject metadata: ${name}`, () => {
    assert.throws(() => validatePlan(metadata(plan({ count: 2 }), change)), error);
  });
}

const contentCases = [
  ["missing metadata", (s) => s.replace(/```stacked-pr-plan[\s\S]*?\n```/, ""), /exactly one/],
  ["duplicate metadata", (s) => s + s.match(/```stacked-pr-plan[\s\S]*?\n```/)[0], /exactly one/],
  ["invalid JSON", (s) => s.replace('"schemaVersion": 1,', '"schemaVersion": 1,,') , /valid JSON/],
  ["unclosed fence", (s) => s + "\n```sh\nnode --test", /Close all/],
  ["missing section", (s) => s.replace("## Architecture", "Architecture"), /headings in order/],
  ["empty section", (s) => s.replace(/## Goal\n[\s\S]*?\n## Scope/, "## Goal\n\n## Scope"), /Fill the Goal/],
  ["empty phase", (s) => s.replace(/^  - \[ \] P1.T1:.*\n/m, ""), /at least one task/],
  ["duplicate task", (s) => s.replace("### P1", "  - [ ] P1.T1: Duplicate task\n\n### P1"), /Duplicate task ID/],
  ["wrong task owner", (s) => s.replace("  - [ ] P1.T1:", "  - [ ] P2.T1:"), /wrong phase/],
  ["wrong indentation", (s) => s.replace("  - [ ] P1.T1:", "    - [ ] P1.T1:"), /Invalid or misplaced/],
  ["nonstandard checkbox", (s) => s.replace("- [ ] P1:", "- [X] P1:"), /Invalid or misplaced/],
  ["extra open checkbox", (s) => s.replace("## Goal\n", "## Goal\n\n- [ ] Hidden work\n"), /Invalid or misplaced/],
  ["numbered checkbox", (s) => s.replace("## Goal\n", "## Goal\n\n1. [ ] Hidden work\n"), /Invalid or misplaced/],
  ["checked phase with open task", (s) => s.replace("- [ ] P1:", "- [x] P1:"), /P1 has open tasks/],
  ["missing details", (s) => s.replace("### P1 – Details", "### P2 – Details"), /Missing details for P1/],
  ["duplicate details", (s) => s + "\n### P1 – Details\n", /Duplicate details/],
  ["missing acceptance", (s) => s.replace(/^- Acceptance criteria:.*$/m, ""), /Acceptance criteria field/],
  ["empty command", (s) => s.replace(/^- Validation commands:.*$/m, "- Validation commands: "), /Validation commands field/],
  ["duplicate blocker field", (s) => s + "\n- Blockers: Another blocker.\n", /Blockers field/],
];
for (const [name, change, error] of contentCases) {
  test(`reject content: ${name}`, () => {
    assert.throws(() => validatePlan(change(plan())), error);
  });
}

test("a completed phase cannot keep a blocker", () => {
  const source = plan({ completed: true }).replace("- Blockers: None.", "- Blockers: Build is broken.");
  assert.throws(() => validatePlan(source), /still has a blocker/);
});

test("a completed phase cannot retain default evidence", () => {
  const source = plan({ completed: true }).replace(/^- Evidence:.*$/m, "- Evidence: Not run.");
  assert.throws(() => validatePlan(source), /no validation evidence/);
});

test("later work cannot pass an incomplete predecessor", () => {
  const source = plan({ count: 2, completed: true }).replace("- [x] P1:", "- [ ] P1:");
  assert.throws(() => validatePlan(source), /before an earlier phase passed/);
});

test("the filename must match the metadata UUID", () => {
  assert.throws(() => validatePlan(plan(), { filePath: "/tmp/another.md" }), /filename/);
});

test("fenced examples do not add tasks", () => {
  const source = plan().replace("## Goal", "````markdown\n- [ ] Example only\n```\n````\n\n## Goal");
  assert.equal(validatePlan(source).phases[0].tasks.length, 1);
});

test("validation commands are never executed", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "stacked-plan-noexec-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const sentinel = join(dir, "sentinel");
  const source = plan().replace("node --test", `touch "${sentinel}"`);
  validatePlan(source);
  assert.throws(() => readFileSync(sentinel), { code: "ENOENT" });
});

test("CLI validates files, reports failures, and rejects bad arguments", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "stacked-plan-cli-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, `${ID}.md`);
  const script = fileURLToPath(new URL("../skills/stacked-pr-plan/scripts/validate-plan.mjs", import.meta.url));
  const run = (...args) => spawnSync(process.execPath, [script, ...args], { encoding: "utf8" });
  writeFileSync(path, plan());
  let result = run(path);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).complete, false);
  result = run(path, "--require-complete");
  assert.equal(result.status, 1);
  assert.match(JSON.parse(result.stdout).error, /P1.T1/);
  writeFileSync(path, plan({ completed: true }));
  result = run("--require-complete", path);
  assert.equal(result.status, 0, result.stdout);
  assert.equal(JSON.parse(result.stdout).complete, true);
  result = run(join(dir, "missing.md"));
  assert.equal(result.status, 1);
  assert.equal(JSON.parse(result.stdout).valid, false);
  for (const args of [[], ["--bad"], [path, "extra"], [path, "--require-complete", "--require-complete"]]) {
    result = run(...args);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /Usage:/);
  }
  assert.equal(readFileSync(path, "utf8"), plan({ completed: true }));
});
