---
name: stacked-pr-publication
description: Publish or update a Gitea PR stack after plan checks and explicit review. Use for branch chains, native PR dependencies, coherent PR text, and safe publication retries.
---

# Stacked PR publication

Read the shared rules in the installed `stacked-pr-plan` skill first.
The parent retains all publication authority.
Do not delegate a Gitea write to an implementation subagent.

## Completion gate

The first operation after plan lookup is the full plan validation.
Run the local validator with `--require-complete`.
If any phase or task is open, report its ID and stop.
If the plan is malformed, report the error and stop.
Do not fetch, push, or change Gitea before this gate passes.

Then inspect all task evidence and phase checks.
Checkboxes alone do not prove successful implementation.
If evidence is missing, stale, failed, or blocked, report it and stop.
Do not run commands that modify repository files during publication.

## Repository and service checks

1. Inspect the current branch, Git root, remote URLs, and tracking branches.
2. Confirm that the root equals the plan repository.
3. Confirm that the index and working tree are clean, including untracked files.
4. Identify the Gitea host, owner, and repository from the chosen remote.
5. Check this identity with Gitea MCP.
6. Confirm the base branch and each source-to-target branch pair.
7. Discover Gitea tools for PR reads, PR writes, and native dependency reads and writes.
8. Read their current schemas. Do not invent tool names or parameters.
9. Check that native dependencies are supported for PR issue numbers on this server.
10. If this support is missing or unknown, stop before any push or Gitea write.
11. Fetch only the required remote refs. Do not change local branch history.
12. Check every phase branch, its accepted tip, and its recorded parent.
13. Check that the recorded base commit is an ancestor of the first phase.
14. Check that each parent phase tip is an ancestor of the next phase.
15. Compare local refs with remote refs and existing PR heads.
16. Stop on divergence, ambiguous identity, missing branches, or unexpected targets.
17. Review every phase's commits and diff against its intended PR target.
18. Require a nonempty phase diff and evidence for the current source tip.

Use read-only checks to confirm service capabilities.
Do not create a test PR or a test dependency.

Do not modify repository files or create additional commits.
Do not amend, rebase, merge, reset, delete branches, or force-push.
Do not retarget an unrelated PR or create a duplicate to bypass a conflict.

## Push and find existing PRs

Push committed phase branches in plan order.
Use explicit source and destination refs on the verified remote.
A normal push before approval is allowed.
Do not force-push.
Stop on a rejected push and report the affected phase.

For each phase, find an open PR with the exact source and target branches.
Use all result pages when the tool returns a paged list.
Also check for a source branch with a different target.
Stop if more than one PR matches or if the target conflicts with the plan.
Inspect merged or closed PRs before retrying creation.
Do not reopen a closed PR or duplicate a merged PR without a user decision.

Read each existing PR's full title, body, commits, and diff.
Read the existing native dependencies.
Preserve unrelated valid dependency edges.
Do not remove dependencies as part of this command.

## Prepare English PR text

Use `references/pr-template.md` as the description structure.
Resolve the path from this skill directory.
Describe only the phase diff, not the full cumulative stack.
State the previous PR as the target and native blocker for each later phase.
The first PR has no stack predecessor.

For a new PR, propose an accurate English title and a full English description.

For an existing PR:

- Keep the title when it remains accurate.
- Review both previous changes and newly pushed changes.
- Rewrite the affected description sections as one coherent description.
- Do not append a generic new-commits note.
- Preserve useful manual context, issue references, checks, risks, and checklists.
- Explain any removal of existing information.

Do not claim tests that were not run.
State relevant risks, limitations, and follow-up work.
Use `None.` only when the evidence supports it.

## Review and explicit approval

Before any Gitea write, present a review for the current proposal.

For each new PR, show:

- Gitea host, owner, and repository.
- Phase ID, source branch, target branch, and source and target commit IDs.
- The proposed English title.
- The full proposed English description.
- The native dependency action and its direction.
- All assumptions.

For each existing PR, also show:

- The PR number and URL.
- The full existing title and description.
- The proposed title, even when it is unchanged.
- The full proposed description.
- A short list of text changes.
- Existing dependencies and the exact proposed dependency action.

Wait for explicit approval after this review.
Approval can cover one named phase or the exact full stack shown in the review.
It must cover titles, full descriptions, targets, and native dependency actions.
The command request, general confirmation, and earlier approval do not count.
Do not change Gitea before this approval.

If a predecessor PR does not yet exist, use a clearly named phase placeholder in the review.
Show the exact text substitution that will insert its number and URL.
Approval may cover this substitution only.
Any other title, body, target, dependency, or commit change requires a new review.
If the substitution is not approved, show the resolved body and ask again.

Save the reviewed source and target commit IDs and existing PR text.
Before each write, re-read the plan and recheck completion and clean state.
Re-read local and remote refs, the PR text, and dependency state.
If new commits or concurrent edits changed the reviewed state, stop.
Prepare a new review and request approval again.
Do not overwrite a concurrent manual edit.
After an approved write succeeds, update the expected state for the next check.
Do not treat your own approved write as a concurrent edit.

## Create or update the approved stack

Work in phase order.

1. Create a missing PR or update the exact existing PR through Gitea MCP.
2. Skip a title or body write when no approved text change is needed.
3. For each later PR, add a native `blocked_by` edge to the previous PR.
4. Skip an edge that already exists.
5. Read the PR and dependency lists back from Gitea.
6. Verify the source, target, title, body, and dependency direction.
7. Record the PR number, URL, source tip, target tip, and dependency result in the plan evidence.
8. Continue only when this phase's publication checks pass.

Gitea exposes PRs through issue numbers for some dependency APIs.
When the discovered schema supports it, the intended relation is:

- `issue_number`: the current PR number.
- `related_issue_number`: the previous PR number.
- `dependency_type`: `blocked_by`.

Use only the fields and methods that the current server actually provides.
A body link, label, or comment is not a substitute for the native edge.

If a create call times out, search for the exact branch pair before you retry.
If a PR write succeeds but its dependency write fails, stop the stack.
Report the partial result and the missing edge.
Do not claim that publication succeeded.
Do not close or delete successful PRs as automatic rollback.
On a later run, read the actual server state and ask approval for remaining writes.
Do not recreate PRs that already exist.

## Completion

For each phase, return:

- Created, updated, unchanged, or partially published.
- PR number, title, and URL.
- Source branch and target branch.
- Previous PR and verified native dependency state.

Return the plan path and any unresolved publication blocker.
Do not merge PRs or delete branches.
