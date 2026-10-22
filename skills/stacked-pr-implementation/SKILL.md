---
name: stacked-pr-implementation
description: Implement a stacked PR plan with one subagent per phase. Use for phase branches, task evidence, commits, and safe continuation after partial work.
---

# Stacked PR implementation

Read the shared rules in the installed `stacked-pr-plan` skill first.
Resolve one plan and run its local validator.

This command permits local phase changes and phase commits.
It does not permit a push, a PR write, or a dependency write.
Do not amend commits, rebase, merge, reset, delete branches, or force-push.
Do not stash or discard user changes.
Ask before an action outside this boundary.

## Before the first phase

1. Check the Git root against the plan.
2. Check the remote, base branch, and recorded base commit.
3. Check that the base commit exists and belongs to the intended base history.
4. Run `git status --porcelain=v1 --untracked-files=all`.
5. If the index or working tree is not clean, stop and report the paths.
6. Save the starting branch or detached commit.
7. Check that the subagent tools are available.
8. Enable subagent tools when the host requires it.
9. List available agents and read the tool guide.
10. With `pi-subagents`, select the packaged `pi-stacked-prs.worker` agent.
11. Verify that the selected agent has the required edit and test tools.
12. Keep the agent's configured model and thinking level.

Use the installed subagent package instructions when they are available.
With another integration, discover a suitable implementation agent.
Do not invent an agent name, model ID, or launch schema.
If `pi-subagents` cannot find `pi-stacked-prs.worker`, report the blocker and stop.
Do not substitute an unqualified `worker` agent.
Do not send model-only subagent tools through codemode.
If no subagent can run, report the blocker and stop.
Do not silently implement the phase in the parent.

## Implement phases in order

Use one separate subagent for each phase.
Run phases in sequence, not in parallel.
Keep one writer in the repository at a time.
The parent must not edit repository files while a phase subagent runs.
The parent owns the plan file, final acceptance, and publication authority.

For each phase:

1. Re-read the plan and check the accepted earlier phases.
2. Inspect evidence and commits before you skip a checked phase.
3. Confirm that each earlier phase tip remains an ancestor of the next phase branch.
4. Check the feature branch name with `git check-ref-format --branch`.
5. For a new first branch, start at the recorded base commit.
6. For a new later branch, start at the accepted previous phase tip.
7. If the branch exists, inspect its history and its relation to the plan.
8. Resume it only when its identity, parent, and prior work are clear.
9. Do not reset or replace an existing branch.
10. If earlier changes invalidate later branches, stop and ask for a recovery action.
11. Switch to the phase branch only with a clean index and working tree.
12. Record the branch and starting commit before you launch the subagent.

A handoff must contain:

- The plan UUID and the one phase ID.
- The repository path, branch, starting commit, and parent branch.
- The phase tasks, required files, interfaces, and dependency facts.
- The allowed edit scope and repository instructions.
- Each task's acceptance criteria and the phase checks.
- Permission to make local commits for this phase only.
- A ban on plan edits, remote writes, history rewrites, and further delegation.
- A request for changed paths, task outcomes, check results, and commit IDs.
- A request to stop on unclear requirements or work outside the phase.

Require the child to stage only the intended phase files.
Do not use `git add .` when unrelated files can be present.
Require at least one phase commit for a successful nonempty phase.

## Optional shadow triage

Shadow triage is off by default.
Enable it only when the user requests it in the current context.
Read `references/phase-triage.md` before use.
Use the parent to run the optional OpenRouter Jev classifier after the worker stops.
Run it after the parent inspects the diff and runs checks, but before final acceptance.
Classifier hints never replace the acceptance procedure below.
If triage is skipped or fails, continue the normal acceptance procedure.
Do not change the worker model, approval rules, or required checks.

## Accept a phase

1. Wait for the subagent result through the host's completion mechanism.
2. Inspect the actual branch, commits, and diff against the phase start.
3. Check that only the permitted phase changes are present.
4. Check the reported task results against their acceptance criteria.
5. Run all phase validation commands on the final phase state.
6. Record the tested commit and the command results.
7. Check that the phase branch has new commits and a nonempty phase diff.
8. Check that the index and working tree are clean.
9. Re-read the plan before each edit to avoid replacing unrelated updates.
10. Mark each proven task complete with a targeted `- [ ]` to `- [x]` edit.
11. Mark the phase complete only when every task and phase check passed.
12. Run the plan validator after the update.
13. Start the next phase only after final phase acceptance.

A child report alone is not acceptance evidence.
Do not infer success from an exit message or from a commit's existence.

If a task passes but the phase fails, keep that task's proven result.
Leave the phase and failed tasks open.
Record failed commands, changed paths, branch state, and remaining blockers.
Do not start a dependent phase while the current phase is open.
If a subagent fails to launch or loses its tools, record that infrastructure blocker.
Do not switch to direct implementation without explicit user approval.

## Finish or continue

- On success, return the plan path, accepted IDs, phase branches, and check results.
- State that the branches have not been pushed.
- Leave the checkout on the last accepted phase branch and report its name.
- On failure, preserve the partial work and report the current checkout.
- Do not restore the starting branch if that could disturb partial work.
- On a later run, inspect existing branches and evidence before resuming.
- Do not recreate accepted commits or skip unresolved checks.
