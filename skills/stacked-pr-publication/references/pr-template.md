# PR description template

Use this structure for each phase.
Replace all example text.
Keep correct manual sections from an existing PR when they add useful context.

```markdown
## Summary

- State the phase result.

## Motivation

- State the reason for the change.
- Link the task or issue when one exists.

## Main changes

- State the main file, interface, or behavior changes.

## Verification

- `exact command` — state the actual result.
- Tested commit: `full commit ID`.
- State any required check that was not run.

## Risks and follow-up work

- State risks, limitations, and follow-up work, or state that none are known.

## Stack

- Plan: `<uuid>`
- Phase: `P1`
- Source branch: `<feature branch>`
- Target branch: `<base branch or previous feature branch>`
- Previous PR: None for the first phase; otherwise use its number and URL.
- Native dependency: None for the first phase; otherwise state that this PR is blocked by the previous PR.
```

The native dependency line describes the approved relation.
After publication, verify that Gitea stores that relation.
If the edge fails, report the failure instead of treating the description as proof.
