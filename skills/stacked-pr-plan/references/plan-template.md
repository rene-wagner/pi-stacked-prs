# Plan template

Copy the plan below without this introduction.
Replace example values before you save it.
Add phases, tasks, and details as needed.
Keep the JSON phase order equal to the checklist order.
The example has one phase and one task.

# Stacked PR plan: Example change

```stacked-pr-plan
{
  "schemaVersion": 1,
  "id": "00000000-0000-4000-8000-000000000001",
  "repository": "/absolute/path/to/repository",
  "remote": "origin",
  "baseBranch": "main",
  "baseCommit": "0000000000000000000000000000000000000000",
  "phases": [
    {
      "id": "P1",
      "branch": "feat/example-p1-change",
      "parent": "main",
      "dependsOn": []
    }
  ]
}
```

## Goal

- State the measurable result.

## Scope and exclusions

- In scope: State the included change.
- Out of scope: State the excluded change.

## Requirements with sources

- R1: State a requirement. Source: `path/to/file:10-20` or an issue URL.

## Architecture

- State the affected components and the intended data flow.

## Risks and dependencies

- State a risk, its effect, and its control.

## Assumptions and questions

- Assumption: State an unverified fact.
- Question: State a question, or state that no question remains.

## Validation strategy

- State the checks and expected results.
- State how each requirement maps to a task and a check.

## Implementation

- [ ] P1: Deliver the example change
  - [ ] P1.T1: Change `src/example.ts` and verify `test/example.test.ts`

### P1 – Details

- Files and interfaces: `src/example.ts`; `test/example.test.ts`; name the changed interface.
- Steps and dependencies: P1.T1 implements R1, then runs its checks. No earlier phase is required.
- Acceptance criteria: P1.T1 produces the required result. Its regression test passes. The phase check exits with code 0.
- Validation commands: Replace this text with exact commands and expected results from this repository.
- Evidence: Not run. Record task results, commands, outcomes, and the tested commit here.
- Blockers: None.
