# Pi Stacked PRs

A Pi package with three prompts, three skills, and one phase worker agent.
Use it to plan, implement, and publish a stack of Gitea pull requests.
The package has no runtime npm dependencies and no executable Pi extension.

## Requirements

- Pi with support for package prompts and skills.
- Node.js 22.19 or later for the plan validator.
- Git and a repository with an existing base commit.
- A subagent integration for implementation, such as `pi-subagents`.
- Linear MCP read access when the task identifies a Linear issue.
- Gitea MCP read and write access for publication.
- Native Gitea dependencies that support PR issue numbers.

The package includes a worker definition for `pi-subagents`.
It does not install a subagent integration or configure MCP servers.
The workflow checks the current tool schemas before it uses them.
If a required capability is missing, the workflow stops.

## Install

From this directory, install the package for your user:

```sh
pi install "$PWD"
```

For one project only:

```sh
pi install --local "$PWD"
```

For a temporary session without a saved installation:

```sh
pi -e "$PWD"
```

Run `/reload` after you change package files in an active session.
Use `/mcp` to inspect the required service connections.
Review package content before you grant project trust.

## Commands

| Command | Input | Result |
| --- | --- | --- |
| `/stacked-pr-plan` | A task or a Linear issue ID | A Markdown plan in `$HOME/.pi/tasks/<uuid>.md` |
| `/stacked-pr-implement` | An optional plan UUID | Local phase branches, commits, and recorded check results |
| `/stacked-pr-publish` | An optional plan UUID | Reviewed Gitea PRs with a branch chain and native dependencies |

Examples:

```text
/stacked-pr-plan ENG-123
/stacked-pr-plan Add cursor pagination to the activity API
/stacked-pr-implement 00000000-0000-4000-8000-000000000001
/stacked-pr-publish 00000000-0000-4000-8000-000000000001
```

Without a UUID, implementation and publication use one clearly identified plan from the current context.
If the context is not clear, the agent asks you.
It does not select the newest saved plan.
A complete context-only plan must first be saved with the package plan contract.

## Plan and branch contract

Plans contain these sections:

- Goal
- Scope and exclusions
- Requirements with sources
- Architecture
- Risks and dependencies
- Assumptions and questions
- Validation strategy
- Implementation

Each plan records its repository, remote, base branch, and base commit in a JSON metadata block.
Each phase has a stable ID, a distinct feature branch, tasks, measurable acceptance criteria, and validation commands.
The details keep task evidence and unresolved blockers.
Only accepted work receives a checked checkbox.
The parent agent owns the plan updates.

See [the plan template](skills/stacked-pr-plan/references/plan-template.md) for the full format.
The template contains example values, not an executable task.
Replace them with verified repository values.
Existing free-form plans must be adapted to this contract before use.
Preserve their requirements and stable IDs.

Branch names use an issue ID or a short task name, the phase ID, and a short phase name.
For example, use `HXP-1545_p1-input-inventory`.
Do not include a UUID or a `stack-<uuid>` segment in a feature branch name.
The UUID identifies the plan file and its metadata, not its branches.

A two-phase stack has this shape:

```text
main <- feat/activity-p1-api <- feat/activity-p2-ui
        PR 1 targets main      PR 2 targets the P1 branch
                               PR 2 is blocked by PR 1 in Gitea
```

Implementation uses one separate subagent per phase, in sequence.
Each phase starts from the accepted previous phase tip.
The first phase starts from the recorded base commit.
A successful phase has committed changes and a clean working tree.
Partial task success stays recorded when a phase fails.
Dependent phases cannot start until the current phase passes.

## Publication and approval

Publication first checks that all phase and task checkboxes are complete.
It then checks evidence, Git history, repository identity, and service capabilities.
An open item stops the command before a fetch, push, or Gitea write.

The workflow can push existing commits before you approve PR text.
It cannot create or update a PR before you review the current proposal and explicitly approve it.
The review includes the full English titles and descriptions, branch targets, commit IDs, and native dependency actions.
You can approve one named phase or the exact full stack shown in the review.
A changed proposal or changed commit requires a new approval.

Each later PR targets the previous feature branch.
It also receives a native `blocked_by` dependency on the previous PR.
A link in the description is not sufficient.
If native dependencies are unavailable, publication stops before any remote write.
If a dependency write fails after a PR was created, the workflow reports partial publication and stops.
It does not claim success or remove successful PRs.
A later run reads the server state before it proposes remaining writes.

The publish command does not modify repository files, create commits, rewrite history, merge PRs, or delete branches.
It can update evidence in the external plan file.
Automatic retargeting after a merge and automatic stack rebasing are outside this package's scope.

These prompts define model instructions, not a sandbox or a tool-permission gate.
Use host permission controls when you need enforced approval boundaries.

## Skills

| Skill | Responsibility |
| --- | --- |
| `stacked-pr-plan` | Shared rules, plan lookup, plan creation, and local validation |
| `stacked-pr-implementation` | Phase handoffs, branch safety, acceptance, and continuation |
| `stacked-pr-publication` | Gitea capability checks, PR review, approval, dependencies, and retries |

Prompts explicitly request these skills.
The skills can also be used in another stacked PR workflow.
All prompt and skill instructions use English and ASD-STE100-style controlled language.
Technical names retain their exact spelling.
No certified ASD-STE100 dictionary validation is included.

## Phase worker

With `pi-subagents`, `/stacked-pr-implement` uses the bundled
[`pi-stacked-prs.worker`](agents/worker.md) agent.
The package manifest exposes `agents/` for discovery.
The worker uses `openai/gpt-6.1-sol` with `medium` thinking.
This model must be available and authenticated in your Pi installation.
The command keeps the agent's configured model and thinking level.
User or project `pi-subagents` overrides can change these defaults.

The worker implements exactly one assigned phase.
It inherits repository instructions and has local read, edit, shell, search, and codemode tools.
It runs the phase checks and creates local phase commits.
It does not edit the plan, change branches, publish, rewrite history, or delegate work.
The parent agent owns branch setup, plan updates, and final acceptance.
If this worker is missing from `pi-subagents`, implementation stops instead of selecting another `worker`.

Another subagent integration must supply a suitable implementation agent.
Run `/reload` after you change the bundled agent in an active session.

## Optional phase review triage

Phase review triage is off by default. To try it, tell the parent:

```text
Enable shadow triage with OpenRouter ~typesafe/jev-latest for this implementation.
You may send sanitized phase excerpts to OpenRouter and its model provider.
/stacked-pr-implement <plan UUID>
```

The parent uses codemode and the configured `OPENROUTER_API_KEY`.
No OpenAI API key or new runtime dependency is required.
The phase worker keeps its configured model and thinking level.
After a worker stops, the parent can classify sanitized phase scope, diff excerpts,
worker results, and observed check results for three advisory signals:

- Possible scope drift.
- Possible acceptance evidence gaps.
- Sensitive changes that need attention.

The parent checks each hint independently. Classifier answers do not accept work,
change plan checkboxes, skip tests, route workers, or approve publication.
Missing tools, credentials, API errors, and invalid answers skip triage without
blocking the normal workflow. No model substitution or automatic retry occurs.
Inputs are limited to 64000 JSON characters. Omitted content must be identified.
The parent reports probabilities and coverage limits separately from evidence.
Review useful findings, false alarms, and latency before making triage routine.

See [the triage procedure](skills/stacked-pr-implementation/references/phase-triage.md)
for the codemode script and data-sharing rules. Run `/reload` after installation changes.

## Validate a plan

Run this command from the package directory:

```sh
node skills/stacked-pr-plan/scripts/validate-plan.mjs "$HOME/.pi/tasks/<uuid>.md"
node skills/stacked-pr-plan/scripts/validate-plan.mjs "$HOME/.pi/tasks/<uuid>.md" --require-complete
```

The validator checks:

- Schema version, UUID, filename, repository path, and base commit form.
- Unique phase IDs and feature branches without UUIDs.
- The ordered branch chain and earlier phase dependencies.
- Required plan sections and phase detail fields.
- At least one correctly nested task per phase.
- Unique task IDs and phase/task completion consistency.
- Completion order, recorded blockers, and a non-default evidence field for a complete phase.
- All open phase and task IDs when `--require-complete` is set.

Exit codes:

- `0`: The structural checks passed.
- `1`: The file could not be read, or the plan failed validation.
- `2`: The command arguments are not valid.

Validation results use JSON on standard output.
Usage errors use standard error.
The validator only reads the plan.
It does not run plan commands or contact Git, Linear, or Gitea.
It does not prove test results, acceptance criteria, or branch ancestry.
The agent must verify those facts separately.

## Develop and package

No dependency installation is required.
Run:

```sh
npm test
npm run check
npm pack --dry-run
```

When Pi is available on your path, also run:

```sh
npm run test:pi
```

This check starts Pi with temporary user configuration and requests its command list through RPC.
It does not send a model prompt, install the package, or connect to MCP servers.

Tests cover resource declarations, worker configuration and authority, command routing, shared contracts, malformed plans, completion gates, and validator command behavior.
They do not execute live subagents or create remote PRs.
The npm archive includes the worker agent, prompts, skills, templates, validator, and this README.

The manifest uses `UNLICENSED` because no distribution license has been selected.
Select a license before public distribution.
