---
name: marketplace-create-skill
description: "Create or import a shared skill into copilot-marketplace, including a handoff from assistant-share. Use when the user wants to write, scaffold, add or share a skill, choose its name, or prepare SKILL.md and supporting files."
---

# Create a shared skill

## Scope and input

1. Read the user's request or the `assistant-share` handoff. Establish the task
   the skill solves, when it should trigger, and the source files, if any.
   Ask for missing behavioral requirements rather than inventing them.
2. By default, work in a checkout of
   `agel-data-and-ai-temp-poc/copilot-marketplace` on a contribution branch.
   If starting in the personal assistant repository, preserve it and open or
   clone a separate marketplace checkout. Resolve any explicitly requested
   destination using the exception rule below. Run **Verify all destination
   URLs** before editing, for the default target too. Confirm branch/PR access.
3. This workshop catalog contains exactly two plugins. Put participant-authored
   skills in `marketplace-maintenance`. Keep `matt-pocock-skills` byte-identical
   to upstream. A third plugin requires a separately agreed catalog change.

### Pin both checkouts before editing

The assistant repository is the **source**; the marketplace checkout is the
**destination**. Their working directories and commit SHAs are not interchangeable.

1. Establish the absolute `assistantRoot` (if importing) and `marketplaceRoot`.
   Check the destination's catalog, `package.json`, and `package-lock.json`
   using paths under `marketplaceRoot`. Stop if it is not the marketplace root.
2. Address every destination Git command as `git -C "<marketplace-root>" ...`.
   Inspect status, origin, and branch there, not in the assistant checkout.
   Finish any approved fast-forward/branch preparation before recording the base.
3. **Before the first marketplace edit**, run
   `git -C "<marketplace-root>" rev-parse HEAD`, check its exit code, and record
   the full output as `marketplaceBase`. Keep this SHA through the handoff.
   An assistant/source-skill commit is not the marketplace base.
4. Use absolute destination paths for file reads and edits. Each tool call may
   start back in the assistant directory: repeat the absolute marketplace path
   in every command rather than relying on a previous `cd` or shell variable.

### Explicit destination exception

Use a different destination only when all three conditions hold:

1. The user explicitly names the destination as `owner/repo` in their request.
2. Every fetch and effective push URL of the marketplace checkout's `origin`
   identifies that exact GitHub repository. Run the destination guard below;
   an origin alone is not authorization.
3. `<marketplace-root>/.github/plugin/marketplace.json` has
   `"name": "copilot-marketplace"`.

If any condition fails, stop and report the mismatch before editing or writing
remotely. Keep the AGEL identity in the catalog, plugin manifests, and
participant-facing documentation. State the explicit destination exception in
the output and carry the approved target and three checks into the
`marketplace-submit-update` handoff; its PR must disclose the exception too.

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

## Write or import

1. Choose a unique English kebab-case name, at most 64 characters. Check every
   skill directory in both plugins. Reserve `assistant-setup`, `assistant-learn`,
   `assistant-skill`, and `assistant-share` for the assistant template.
2. Create `<marketplace-root>/plugins/marketplace-maintenance/skills/<skill>/SKILL.md`.
   If importing, copy the required supporting files with their relative paths.
   Inspect them for credentials, personal identifiers, organization-specific
   data, absolute machine paths, and permission to redistribute. Preserve any
   required attribution/license. Ask the author to resolve unclear ownership.
3. Write the name, description, body, and new supporting documents in English.
   Use valid YAML frontmatter; quote descriptions that contain punctuation:

   ```markdown
   ---
   name: example-skill
   description: "Perform the named task. Use when the user asks for the specific trigger."
   ---

   # Example skill

   1. Read the required input.
   2. Perform the task using the repository's existing conventions.
   3. Report the result and any unresolved blocker.

   Done when the required output exists and its check passes.
   ```

4. Give each step a checkable completion condition. Describe concrete triggers
   in `description`; do not promise unavailable integrations. Keep the main
   body concise (normally under 500 lines). Put branch-specific reference
   material in `references/`, executable helpers in `scripts/`, and input assets
   in `assets/`; link each required supporting file from the skill.
5. Match frontmatter `name` to the directory name. `name` and `description` are
   required; an optional `license` must reflect actual redistribution rights.
   Skills are discovered from `skills/<skill>/SKILL.md`; no per-skill catalog
   registration is necessary.

## Prepare the contribution

1. Bump `marketplace-maintenance`'s minor version for the new capability in
   `plugins/marketplace-maintenance/.github/plugin/plugin.json` and the matching
   catalog entry, both under `marketplaceRoot`. Use the same value in both.
   If the handoff already includes the correct bump, keep it.
2. Run this PowerShell block with the absolute destination and the pre-edit
   marketplace SHA substituted. `npm --prefix` runs each script with the
   marketplace as its working directory, even from the assistant checkout:

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

   Wait for each command to finish and inspect its exit code. On failure,
   report the exact command, marketplace path, exit code and error; preserve
   the changes and stop. Do not continue to later checks or publication, run
   `npm install` as a substitute, or create a lockfile in the assistant clone.
3. With the user's permission, optionally test the candidate plugin in an
   isolated CLI session with
   `copilot --plugin-dir "<marketplace-root>/plugins/marketplace-maintenance"`, inspect `/skills`,
   and invoke it with a representative prompt. Record skipped live checks.
4. Hand off to `marketplace-submit-update` with the absolute assistant/source
   and marketplace paths, approved target and verified fetch/push destinations,
   marketplace branch and pre-edit `marketplaceBase`, source attribution,
   changed skill, version bump, and the
   exact validation commands with exit codes. Keep any source commit separately
   named; do not label it as the marketplace base. The receiving skill must
   repeat the destination guard immediately before each push.

Done when the skill and all required supporting files pass validation and the
contribution handoff is complete. A local skill is not yet a published update.
