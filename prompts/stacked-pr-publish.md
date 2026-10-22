---
description: Publish or update an approved stack of Gitea pull requests.
argument-hint: "[plan UUID]"
---

Publish the stacked PR plan.

<plan-input>
$ARGUMENTS
</plan-input>

Read the installed `stacked-pr-plan` skill for its shared rules.
Then read the installed `stacked-pr-publication` skill.
Use the UUID above, or resolve one plan from the current context.

First, validate the full plan with `--require-complete`.
If any item is open, report its ID and stop.
Do not push branches or change Gitea in this case.

Use a branch chain and native Gitea dependencies.
Present all proposed English PR titles and full descriptions.
Wait for explicit approval of the current proposals before each Gitea write.
The command itself is not publication approval.
