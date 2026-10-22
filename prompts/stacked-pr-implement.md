---
description: Implement each plan phase with a separate subagent.
argument-hint: "[plan UUID]"
---

Implement the stacked PR plan.

<plan-input>
$ARGUMENTS
</plan-input>

Read the installed `stacked-pr-plan` skill for its shared rules.
Then read the installed `stacked-pr-implementation` skill.
Use the UUID above, or resolve one plan from the current context.
Do not select the newest plan when the context is not clear.

Use a separate subagent for each phase.
With `pi-subagents`, use the packaged `pi-stacked-prs.worker` agent.
Verify that this agent is available before you launch it.
Keep its configured model and thinking level.
Keep the phase order and the branch chain from the plan.
Do not replace a failed subagent with direct implementation without user approval.

Keep task results in the plan.
Mark a phase complete only after all tasks and phase checks pass.
Do not push branches or publish pull requests.
Return completed IDs, branch names, check results, and open blockers.
