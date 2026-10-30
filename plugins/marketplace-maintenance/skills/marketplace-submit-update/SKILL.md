---
name: marketplace-submit-update
description: "Submit a copilot-marketplace contribution through a branch, version bump, validation and reviewable PR. Use after assistant-share or marketplace-create-skill, or when the user asks to publish a skill, submit an update, open a marketplace PR or bump a plugin version."
---

# Submit a marketplace update

## Establish the checkout and branch

1. Resolve the absolute `marketplaceRoot` from the handoff or the user's
   approved checkout. The assistant clone is a source, not the command working
   directory. Read the catalog, `package.json` and `package-lock.json` under
   `marketplaceRoot`; stop if they do not identify the marketplace checkout.
   Use `git -C "<marketplace-root>" ...` for every destination Git command and
   absolute destination paths for edits. Repeat paths in each tool call;
   a previous `cd` or shell variable may not persist.
2. Default to `agel-data-and-ai-temp-poc/copilot-marketplace`. Resolve an
   explicitly requested destination using the exception rule below. Run
   **Verify all destination URLs** before editing, for the default target too, then
   confirm the user can create a branch and PR at that resolved target.
   If access is missing, stop and ask the maintainer to grant it; do not write
   to a substitute repository or fork by default.
3. Inspect the marketplace working tree and any `assistant-share` or
   `marketplace-create-skill` handoff. Preserve uncommitted changes. Reuse its
   task branch rather than switching to `main` and losing or mixing work.
4. For a new contribution in a clean checkout, update `main` with a fast-forward
   pull and create `skill/marketplace-maintenance/<skill>`,
   `plugin/<plugin>`, or `chore/<description>` as appropriate.
   In an app-managed worktree, use its existing branch and app branch tools.
5. Before the first marketplace edit, capture
   `git -C "<marketplace-root>" rev-parse HEAD` and check its exit code. Record
   the full SHA as `marketplaceBase`. If the preceding skill already edited the
   marketplace, retain its explicitly recorded marketplace pre-edit base.
   Never use the assistant/source-skill commit or replace the base with the
   post-edit HEAD. If provenance of the base is missing or ambiguous, stop
   and ask for it rather than guessing.
6. Use `marketplace-create-skill` for a new skill. Participant-authored skills go
   in `marketplace-maintenance`. Use the vendoring script for changes to
   `matt-pocock-skills`; never patch its upstream files manually.

### Explicit destination exception

Use a different destination only when all three conditions hold:

1. The user explicitly names it as `owner/repo` in their request.
2. Every fetch and effective push URL of the marketplace checkout's `origin`
   identifies that exact GitHub repository. Run the destination guard below;
   an origin alone or an inferred handoff is not authorization.
3. `<marketplace-root>/.github/plugin/marketplace.json` has
   `"name": "copilot-marketplace"`.

Recheck these conditions before pushing or opening the PR. Stop on any mismatch.
Disclose the explicit destination exception in the output and PR description.
Preserve the AGEL catalog, plugin metadata, and participant documentation; the
exception authorizes only this contribution's resolved remote destination.

### Verify all destination URLs

For every destination (the AGEL default and any explicit exception), check all
fetch URLs with `git -C "<marketplace-root>" remote get-url --all origin` and all
effective push URLs with
`git -C "<marketplace-root>" remote get-url --push --all origin`.
Git must expand `insteadOf` and `pushInsteadOf`; every URL must identify the
approved GitHub host and exact owner/repository, ignoring only an optional
`.git` suffix. Reject a command error, empty output, or any unsupported or
mismatched URL. Repeat immediately before each push in the same Git configuration
context; stop on failure.

Run this block with the absolute checkout path and resolved target substituted.
Use `agel-data-and-ai-temp-poc/copilot-marketplace` unless all three exception
conditions above hold. Keep the same environment and any Git `-c`/`--config-env`
options for the check and push; after any configuration change, repeat the check.
Evaluate every returned URL, not only the first or the matching subset:

```powershell
$ErrorActionPreference = 'Stop'
$marketplaceRoot = '<absolute-marketplace-root>'
$approvedRepository = '<resolved-owner/repo>'
$fetchUrls = @(git -C $marketplaceRoot remote get-url --all origin)
if ($LASTEXITCODE -ne 0 -or $fetchUrls.Count -eq 0) {
    throw 'Cannot determine all origin fetch destinations; stop.'
}
$pushUrls = @(git -C $marketplaceRoot remote get-url --push --all origin)
if ($LASTEXITCODE -ne 0 -or $pushUrls.Count -eq 0) {
    throw 'Cannot determine all origin push destinations; stop.'
}
$pattern = '^(?:https://github\.com/|ssh://git@github\.com/|git@github\.com:)(?<repository>[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+?)(?:\.git)?\z'
foreach ($url in ($fetchUrls + $pushUrls)) {
    $destination = [regex]::Match($url, $pattern)
    if ([string]::IsNullOrWhiteSpace($url) -or -not $destination.Success -or
        $destination.Groups['repository'].Value -cne $approvedRepository) {
        throw 'Origin fetch/push destination is not the approved repository; stop.'
    }
}
'Origin fetch and push destinations verified.'
```

This is a destination check, not authorization inferred from Git configuration.
It does not replace the explicit user request or marketplace-name check.

## Version and validate

1. Compare the changed plugin against the PR base. Every plugin change requires
   a higher version in its `.github/plugin/plugin.json` and matching catalog
   entry. Patch: corrections without a new capability. Minor: added skills or
   capabilities. Major: removed/renamed skills or incompatible behavior.
   Reuse a correct version bump already prepared by the preceding skill.
2. Use this PowerShell block with the absolute marketplace root and its
   recorded pre-edit base. `npm --prefix` makes the scripts run with that
   checkout as their working directory even when the session is in the
   assistant clone:

   ```powershell
   $marketplaceRoot = '<absolute-marketplace-root>'
   $marketplaceBase = '<recorded-marketplace-base-sha>'
   git -C $marketplaceRoot cat-file -e "$marketplaceBase^{commit}"
   if ($LASTEXITCODE -ne 0) { throw 'Base is not a marketplace commit; stop.' }
   git -C $marketplaceRoot merge-base --is-ancestor $marketplaceBase HEAD
   if ($LASTEXITCODE -ne 0) { throw 'Base is not in this marketplace history; stop.' }
   npm --prefix $marketplaceRoot ci
   if ($LASTEXITCODE -ne 0) { throw 'Marketplace npm ci failed; stop.' }
   npm --prefix $marketplaceRoot test
   if ($LASTEXITCODE -ne 0) { throw 'Marketplace tests failed; stop.' }
   npm --prefix $marketplaceRoot run validate
   if ($LASTEXITCODE -ne 0) { throw 'Marketplace validation failed; stop.' }
   npm --prefix $marketplaceRoot run validate -- --base $marketplaceBase
   if ($LASTEXITCODE -ne 0) { throw 'Marketplace base validation failed; stop.' }
   ```

   Wait for completion and inspect every exit code. A failure ends this
   workflow: report the exact command, path, exit code and error, preserve the
   changes, and stop before later checks, commit, push or PR. Do not bypass
   `npm ci` with `npm install`, create an assistant lockfile, or claim a pending
   command passed.
3. With the user's permission, test the affected plugin in an isolated CLI
   session using `copilot --plugin-dir "<marketplace-root>/plugins/<plugin>"`, inspect `/skills`,
   and use a representative prompt. Mark unperformed live checks explicitly.
4. Review the diff for redistribution rights, English text, concrete triggers,
   actionable instructions, secrets, and unrelated changes. Confirm catalog
   and plugin versions agree. Keep the workshop's two-plugin catalog.

## Open the PR

1. Commit the intended changes with an imperative message, only after all checks
   pass. Immediately before each push, rerun **Verify all destination URLs**
   in the same Git configuration context. Stop on any failure; a handoff or
   earlier successful check is not sufficient. Then push only the task branch
   using `git -C "<marketplace-root>" push origin <task-branch>`.
   Repeat the target and exception checks before opening the PR too.
   Address GitHub CLI calls explicitly with `--repo <resolved-owner/repo>` and
   the approved marketplace head/base branches; do not infer them from the
   assistant working directory. Open a PR targeting `main` in that repository.
   Fill the repository PR template; include the reason, affected skills,
   version change, exact checks, and any unverified live behavior. Disclose an
   explicit destination exception if one was used.
2. Wait for green CI and ask another maintainer to review. Fix findings on the
   same branch. Report CI failures or missing permissions; do not claim a local
   check proves installation in the app.
3. Stop at a reviewable PR. Leave merge approval to the maintainer; never merge
   merely because this skill was invoked.

After the maintainer merges, participants refresh the catalog and update the
affected plugin:

```shell
copilot plugin marketplace update copilot-marketplace
copilot plugin update marketplace-maintenance
```

For a vendoring update, use `copilot plugin update matt-pocock-skills` instead.
Have participants open a fresh session and confirm the changed skill is visible.

Done when the PR URL, version bump, CI status, and outstanding live checks are
reported. Distribution is complete only after the maintainer merges and a
participant verifies the updated plugin.
