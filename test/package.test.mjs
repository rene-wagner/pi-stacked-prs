import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const manifest = JSON.parse(read("package.json"));

function frontmatter(source) {
  const match = source.match(/^---\n([\s\S]+?)\n---\n/);
  assert.ok(match, "Frontmatter is required.");
  return Object.fromEntries(match[1].split("\n").map((line) => {
    const colon = line.indexOf(":");
    assert.ok(colon > 0, "Use a frontmatter key and value.");
    return [line.slice(0, colon), line.slice(colon + 1).trim()];
  }));
}

test("the manifest declares a dependency-free Pi package", () => {
  assert.ok(manifest.keywords.includes("pi-package"));
  assert.deepEqual(manifest.pi, {
    prompts: ["./prompts"],
    skills: ["./skills"],
    subagents: { agents: ["./agents"] },
  });
  assert.equal(manifest.dependencies, undefined);
  assert.ok(manifest.files.includes("agents/"));
  for (const path of [...manifest.pi.prompts, ...manifest.pi.skills, ...manifest.pi.subagents.agents, ...manifest.files]) {
    assert.ok(existsSync(new URL(path, root)), `Missing resource: ${path}`);
  }
});

test("three prompts expose the expected commands and arguments", () => {
  const files = readdirSync(new URL("prompts", root)).sort();
  assert.deepEqual(files, ["stacked-pr-implement.md", "stacked-pr-plan.md", "stacked-pr-publish.md"]);
  for (const file of files) {
    const source = read(`prompts/${file}`);
    const meta = frontmatter(source);
    assert.ok(meta.description);
    assert.equal(meta["argument-hint"], file === "stacked-pr-plan.md"
      ? '"<task or Linear issue ID>"' : '"[plan UUID]"');
    assert.equal(source.match(/\$ARGUMENTS/g)?.length, 1);
    assert.match(source, /stacked-pr-plan/);
    for (const name of source.matchAll(/`(stacked-pr-[a-z-]+)` skill/g)) {
      assert.ok(existsSync(new URL(`skills/${name[1]}/SKILL.md`, root)), `Missing skill: ${name[1]}`);
    }
  }
});

test("skills have portable metadata and their reference files exist", () => {
  const names = readdirSync(new URL("skills", root)).sort();
  assert.deepEqual(names, ["stacked-pr-implementation", "stacked-pr-plan", "stacked-pr-publication"]);
  for (const name of names) {
    const source = read(`skills/${name}/SKILL.md`);
    const meta = frontmatter(source);
    assert.equal(meta.name, name);
    assert.match(meta.name, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(meta.name.length <= 64);
    assert.ok(meta.description.length > 0 && meta.description.length <= 1024);
    for (const ref of source.matchAll(/`((?:references|scripts)\/[a-z0-9.-]+)`/g)) {
      assert.ok(existsSync(new URL(`skills/${name}/${ref[1]}`, root)), `Missing reference: ${ref[1]}`);
    }
  }
});

test("the plan contract keeps location, sources, IDs, and acceptance rules", () => {
  const skill = read("skills/stacked-pr-plan/SKILL.md");
  for (const term of ["ASD-STE100", "$HOME/.pi/tasks/<uuid>.md", "Requirements with sources",
    "P1.T1", "stable", "measurable acceptance", "Validation commands", "--require-complete"]) {
    assert.ok((skill + read("skills/stacked-pr-plan/references/plan-template.md")).includes(term), `Missing plan term: ${term}`);
  }
  assert.match(skill, /Do not search for the most recent plan/);
});

test("branch instructions and the template exclude UUID-based names", () => {
  const rule = "Do not include a UUID or a `stack-<uuid>` segment in a feature branch name.";
  assert.ok(read("prompts/stacked-pr-plan.md").includes(rule));
  assert.ok(read("skills/stacked-pr-plan/SKILL.md").includes(rule));
  const template = read("skills/stacked-pr-plan/references/plan-template.md");
  const data = JSON.parse(template.match(/```stacked-pr-plan\n([\s\S]*?)\n```/)[1]);
  assert.equal(data.phases[0].branch, "feat/example-p1-change");
  assert.ok(!data.phases[0].branch.includes(data.id));
});

test("implementation requires one phase subagent and keeps remote authority", () => {
  const skill = read("skills/stacked-pr-implementation/SKILL.md");
  assert.match(skill, /one separate subagent for each phase/);
  assert.match(skill, /in sequence, not in parallel/);
  assert.match(skill, /parent owns the plan file/);
  assert.match(skill, /does not permit a push/);
  assert.match(skill, /Do not switch to direct implementation without explicit user approval/);
  assert.match(skill, /all its tasks and all phase checks passed|every task and phase check passed/);
});

test("the packaged phase worker pins its model and thinking level", () => {
  assert.deepEqual(readdirSync(new URL("agents", root)), ["worker.md"]);
  const meta = frontmatter(read("agents/worker.md"));
  assert.equal(meta.name, "worker");
  assert.equal(meta.package, "pi-stacked-prs");
  assert.ok(meta.description);
  assert.equal(meta.model, "openai/gpt-6.1-sol");
  assert.equal(meta.thinking, "medium");
  assert.equal(meta.systemPromptMode, "replace");
  assert.equal(meta.inheritProjectContext, "true");
  assert.equal(meta.inheritGlobalContext, "false");
  assert.equal(meta.inheritSkills, "false");
  assert.equal(meta.defaultContext, "fresh");
  assert.equal(meta.acceptanceRole, "writer");
  assert.deepEqual(meta.tools.split(/,\s*/), ["read", "bash", "edit", "write", "grep", "find", "ls", "codemode"]);
});

test("the phase worker keeps plan, branch, and remote authority with the parent", () => {
  const worker = read("agents/worker.md");
  for (const rule of [
    "Implement exactly one phase",
    "Do not edit the plan file",
    "Do not push",
    "Do not amend commits, rebase, merge, reset, delete branches, or force-push.",
    "Do not stash or discard user changes.",
    "Do not create or switch branches.",
    "Do not delegate work or launch further subagents.",
    "Stage only the intended phase files with explicit paths.",
    "Make at least one local phase commit",
    "Run the required checks on the final committed state.",
    "Preserve partial work",
    "The parent must inspect the implementation and evidence",
  ]) assert.ok(worker.includes(rule), `Missing worker rule: ${rule}`);
});

test("implementation selects the qualified package worker without a model override", () => {
  const meta = frontmatter(read("agents/worker.md"));
  const name = `${meta.package}.${meta.name}`;
  for (const path of ["prompts/stacked-pr-implement.md", "skills/stacked-pr-implementation/SKILL.md"]) {
    const source = read(path);
    assert.ok(source.includes(`\`${name}\``), `Missing worker selection: ${path}`);
    assert.match(source, /configured model and thinking level/);
  }
  assert.match(read("skills/stacked-pr-implementation/SKILL.md"), /Do not substitute an unqualified `worker` agent/);
});

test("publication gates all writes and requires a native blocked_by edge", () => {
  const skill = read("skills/stacked-pr-publication/SKILL.md");
  assert.ok(skill.indexOf("## Completion gate") < skill.indexOf("## Repository and service checks"));
  for (const term of ["--require-complete", "Do not fetch, push, or change Gitea before this gate passes.",
    "Wait for explicit approval after this review.", "full proposed English description",
    "dependency_type", "blocked_by", "search for the exact branch pair before you retry",
    "Do not overwrite a concurrent manual edit.", "Do not claim that publication succeeded."]) {
    assert.ok(skill.includes(term), `Missing publication rule: ${term}`);
  }
  assert.match(skill, /A body link, label, or comment is not a substitute/);
  assert.match(skill, /Preserve useful manual context/);
  assert.match(skill, /Do not append a generic new-commits note/);
});

test("all local README links resolve", () => {
  for (const match of read("README.md").matchAll(/\]\(([^)]+)\)/g)) {
    if (!match[1].includes("://")) assert.ok(existsSync(new URL(match[1], root)), match[1]);
  }
});
