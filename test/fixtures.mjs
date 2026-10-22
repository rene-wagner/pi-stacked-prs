import { readFileSync } from "node:fs";

export const ID = "00000000-0000-4000-8000-000000000001";
export const COMMIT = "a".repeat(40);
const template = readFileSync(new URL("../skills/stacked-pr-plan/references/plan-template.md", import.meta.url), "utf8");

export function metadata(source, change) {
  return source.replace(/(```stacked-pr-plan\n)([\s\S]*?)(\n```)/, (_, open, json, close) => {
    const data = JSON.parse(json);
    change(data);
    return open + JSON.stringify(data, null, 2) + close;
  });
}

export function plan({ count = 1, completed = false } = {}) {
  let source = template.slice(template.indexOf("# Stacked PR plan:"));
  const phases = Array.from({ length: count }, (_, i) => ({
    id: `P${i + 1}`,
    branch: `feat/example-p${i + 1}-change`,
    parent: i === 0 ? "main" : `feat/example-p${i}-change`,
    dependsOn: i === 0 ? [] : [`P${i}`],
  }));
  source = metadata(source, (data) => { data.baseCommit = COMMIT; data.phases = phases; });
  source = source.slice(0, source.indexOf("## Implementation"));
  const state = completed ? "x" : " ";
  const checklist = phases.map(({ id }) => `- [${state}] ${id}: Deliver the example change
  - [${state}] ${id}.T1: Change src/example.ts and test/example.test.ts`).join("\n");
  const details = phases.map(({ id }, i) => `### ${id} – Details

- Files and interfaces: src/example.ts; test/example.test.ts.
- Steps and dependencies: ${id}.T1 implements R1.${i ? ` Requires P${i}.` : ""}
- Acceptance criteria: ${id}.T1 passes its regression test. The phase command exits with code 0.
- Validation commands: \`node --test\`; expect exit code 0.
- Evidence: ${completed ? `Task and phase checks passed at ${COMMIT}. Command node --test exited with code 0.` : "Not run."}
- Blockers: None.
`).join("\n");
  return source + `## Implementation\n\n${checklist}\n\n${details}`;
}
