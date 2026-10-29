---
name: marketplace-submit-update
description: "Submit a copilot-marketplace contribution through a branch, version bump, validation and reviewable PR. Use after assistant-share or marketplace-create-skill, or when the user asks to publish a skill, submit an update, open a marketplace PR or bump a plugin version."
---

# Submit a marketplace update

## Establish the checkout and branch

1. Default to `agel-data-and-ai-temp-poc/copilot-marketplace`. Resolve an
   explicitly requested destination using the exception rule below, then
   confirm the user can create a branch and PR at that resolved target.
   If access is missing, stop and ask the maintainer to grant it; do not write
   to a substitute repository or fork by default.
2. Inspect the working tree and any `assistant-share` or `marketplace-create-skill`
   handoff. Preserve uncommitted changes. Reuse an existing task branch rather
   than switching to `main` and losing or mixing work.
3. For a new contribution in a clean checkout, update `main` with a fast-forward
   pull and create `skill/marketplace-maintenance/<skill>`,
   `plugin/<plugin>`, or `chore/<description>` as appropriate.
   In an app-managed worktree, use its existing branch and app branch tools.
4. Use `marketplace-create-skill` for a new skill. Participant-authored skills go
   in `marketplace-maintenance`. Use the vendoring script for changes to
   `matt-pocock-skills`; never patch its upstream files manually.

### Explicit destination exception

Use a different destination only when all three conditions hold:

1. The user explicitly names it as `owner/repo` in their request.
2. The checkout's `origin` points to that exact repository. Inspect the host
   and owner/repository in HTTPS or SSH remotes, ignoring only an optional
   `.git` suffix. An origin alone or an inferred handoff is not authorization.
3. `.github/plugin/marketplace.json` in this checkout has
   `"name": "copilot-marketplace"`.

Recheck these conditions before pushing or opening the PR. Stop on any mismatch.
Disclose the explicit destination exception in the output and PR description.
Preserve the AGEL catalog, plugin metadata, and participant documentation; the
exception authorizes only this contribution's resolved remote destination.

## Version and validate

1. Compare the changed plugin against the PR base. Every plugin change requires
   a higher version in its `.github/plugin/plugin.json` and matching catalog
   entry. Patch: corrections without a new capability. Minor: added skills or
   capabilities. Major: removed/renamed skills or incompatible behavior.
   Reuse a correct version bump already prepared by the preceding skill.
2. From the repository root, run:

   ```shell
   npm ci
   npm test
   npm run validate
   node scripts/validate.mjs --base <base-commit-sha>
   ```

3. With the user's permission, test the affected plugin in an isolated CLI
   session using `copilot --plugin-dir ./plugins/<plugin>`, inspect `/skills`,
   and use a representative prompt. Mark unperformed live checks explicitly.
4. Review the diff for redistribution rights, English text, concrete triggers,
   actionable instructions, secrets, and unrelated changes. Confirm catalog
   and plugin versions agree. Keep the workshop's two-plugin catalog.

## Open the PR

1. Commit the intended changes with an imperative message and push the task
   branch. Open a PR targeting `main` in the same marketplace repository.
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
