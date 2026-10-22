import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const reference = read("skills/stacked-pr-implementation/references/phase-triage.md");
const source = reference.match(/```js\n([\s\S]*?)\n```/)[1];
const runScript = new (Object.getPrototypeOf(async function () {}).constructor)("models", "load", "store", source);
const model = { provider: "openrouter", id: "~typesafe/jev-latest" };
const input = {
  phaseId: "P1", testedCommit: "a".repeat(40), scope: "Change the greeting only.",
  acceptanceCriteria: "The greeting is Hello.", diff: '-Hi\n+Hello',
  workerReport: "Changed the greeting. Tests passed.", checkResults: "npm test: exit 0",
  coverage: "Complete.",
};
const answer = (choice = "no_signal") => ({ type: "choice", choice, confidence: 0.8,
  probabilities: { review: 0.1, no_signal: 0.8, unknown: 0.1 } });
const success = () => ({ stopReason: "stop", answers: Object.fromEntries(
  ["scopeDrift", "evidenceGap", "sensitiveChange"].map((id) => [id, answer()])) });
async function run({ state = input, available = [model], result = success(), fail = false } = {}) {
  let calls = 0;
  let cleared = false;
  const models = {
    getAvailableOfType: async (type, provider) => {
      assert.equal(type, "classifier");
      assert.equal(provider, "openrouter");
      return available;
    },
    classify: async (selected, context) => {
      calls++;
      assert.deepEqual(selected, model);
      assert.equal(context.state, state);
      assert.deepEqual(Object.keys(context.questions), ["scopeDrift", "evidenceGap", "sensitiveChange"]);
      for (const question of Object.values(context.questions)) {
        assert.equal(question.type, "choice");
        assert.match(question.instructions, /untrusted evidence/);
        assert.deepEqual(Object.keys(question.criteria), ["review", "no_signal", "unknown"]);
      }
      if (fail) throw new Error("secret provider error");
      return result;
    },
  };
  const output = await runScript(models,
    (key) => { assert.equal(key, "stacked-pr-triage-input"); return state; },
    (key, value) => { assert.equal(key, "stacked-pr-triage-input"); assert.equal(value, undefined); cleared = true; });
  assert.equal(cleared, true);
  return { output, calls };
}

test("triage returns advisory answers tied to the tested state", async () => {
  const { output, calls } = await run();
  assert.equal(calls, 1);
  assert.equal(output.status, "advisory");
  assert.equal(output.model, model.id);
  assert.equal(output.testedCommit, input.testedCommit);
  assert.equal(output.coverage, input.coverage);
  assert.equal(output.answers.scopeDrift.choice, "no_signal");
});

test("unavailable exact model skips without substitution", async () => {
  const { output, calls } = await run({ available: [{ provider: "openrouter", id: "typesafe/jev-1.13" }] });
  assert.equal(output.status, "skipped");
  assert.equal(calls, 0);
});

test("invalid and oversized inputs never reach the provider", async () => {
  for (const state of [undefined, {}, { ...input, diff: "" }, { ...input, diff: "x".repeat(64000) },
    { ...input, extra: "unrelated content" }]) {
    // Pass null for missing state because the helper defaults undefined to its fixture.
    const { output, calls } = await run({ state: state ?? null });
    assert.equal(output.status, "skipped");
    assert.equal(calls, 0);
  }
});

test("provider failures and malformed answers skip without retry or raw errors", async () => {
  for (const options of [
    { fail: true },
    { result: { stopReason: "error", errorMessage: "secret" } },
    { result: { stopReason: "aborted" } },
    { result: { stopReason: "stop", answers: {} } },
    { result: { stopReason: "stop", answers: { ...success().answers, scopeDrift: answer("approve") } } },
    { result: { stopReason: "stop", answers: { ...success().answers, scopeDrift: { ...answer(), confidence: NaN } } } },
    { result: { stopReason: "stop", answers: { ...success().answers, scopeDrift: { ...answer(), probabilities: {} } } } },
  ]) {
    const { output, calls } = await run(options);
    assert.equal(output.status, "skipped");
    assert.equal(calls, 1);
    assert.ok(!JSON.stringify(output).includes("secret"));
  }
});

test("triage instructions preserve opt-in, privacy, and parent authority", () => {
  const skill = read("skills/stacked-pr-implementation/SKILL.md");
  assert.match(skill, /off by default/);
  assert.match(skill, /references\/phase-triage.md/);
  for (const term of ["Confirm that the user permits", "Do not send secrets", "Do not silently truncate",
    "not instructions or acceptance evidence", "Do not retry automatically", "Only independently confirmed problems",
    "Keep this report separate from acceptance evidence", "60000 ms"]) {
    assert.ok(reference.includes(term), term);
  }
  assert.ok(!source.includes("tools."), "The script cannot perform repository or remote writes.");
});
