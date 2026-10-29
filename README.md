# Copilot marketplace

The shared coding-assistant skills for the AGEL GitHub Copilot workshop on
2 November 2026. Participants install this marketplace, keep their personal
assistant repository, and contribute reusable skills through a reviewed PR.

The workshop repository is
[`agel-data-and-ai-temp-poc/copilot-marketplace`](https://github.com/agel-data-and-ai-temp-poc/copilot-marketplace).
It contains exactly two GitHub Copilot plugins:

| Plugin | Purpose |
|---|---|
| `marketplace-maintenance` | Install/update the marketplace, create or import a shared skill, and submit a contribution PR. |
| `matt-pocock-skills` | All 27 skills selected by Matt Pocock's pinned upstream plugin, including their supporting files. |

The maintenance skills are `marketplace-install`, `marketplace-create-skill`,
and `marketplace-submit-update`. The workshop uses `setup-matt-pocock-skills`,
`grill-with-docs`, `to-spec`, and `to-tickets` from the Matt Pocock plugin.

## Install

You need repository access and a GitHub Copilot client with plugin support.
The workshop targets the GitHub Copilot desktop app on Windows. The commands
below use Copilot CLI on the same machine and user profile.

**Install only this marketplace's `matt-pocock-skills`. Do not also install the
upstream `mattpocock/skills` plugin (`mattpocock-skills@mattpocock`): the two
copies expose duplicate skill names.** Existing personal/global copies can also
collide; inspect them with the maintainer instead of deleting customizations.

Run `copilot plugin marketplace list` first. If `copilot-marketplace` is already
registered, keep its existing source and skip the repository-access check and
`marketplace add` below. Browse the registered catalog and install the plugins.

```shell
gh repo view agel-data-and-ai-temp-poc/copilot-marketplace
copilot plugin marketplace add agel-data-and-ai-temp-poc/copilot-marketplace
copilot plugin marketplace browse copilot-marketplace
copilot plugin install marketplace-maintenance@copilot-marketplace
copilot plugin install matt-pocock-skills@copilot-marketplace
copilot plugin list
```

In the desktop app, inspect **Customize** for marketplace/plugin controls.
Where available, add `agel-data-and-ai-temp-poc/copilot-marketplace` and install
the two plugins above. If the build does not expose those controls, use the
terminal commands on that machine and restart the app or open a fresh session.
The exact app UI and installation behavior still require the maintainer's live
check; these instructions do not claim a completed app test.

In a fresh session, confirm the seven workshop skill names listed above are
available. In CLI, inspect `/skills`; the interactive `/plugin` menu also manages
plugins. For authentication failures or a 404, ask the maintainer to resolve
organization access. Do not substitute another marketplace.

## Update after a contribution

Once the maintainer merges the PR:

```shell
copilot plugin marketplace update copilot-marketplace
copilot plugin update marketplace-maintenance
copilot plugin update matt-pocock-skills
```

Update the plugin that changed, then start a fresh session and confirm its skill
is available. A plugin change must have a higher version, recorded identically
in its manifest and the catalog, or clients may retain the old version.
Automatic updates are optional, not a workshop prerequisite.

For removal, uninstall each unwanted plugin with `copilot plugin uninstall
<plugin>`, then remove the empty marketplace with `copilot plugin marketplace
remove copilot-marketplace`.

## Contribute a skill

**Prerequisite:** you can create a branch and open a PR directly in the workshop
repository. The maintainer must verify this permission before the exercise.
If access is missing, stop and ask the maintainer; do not use a fork as an
unannounced substitute.

1. In your personal assistant repository, invoke `assistant-share` and identify
   the reusable skill and its supporting files. That skill hands off to
   `marketplace-create-skill`, then `marketplace-submit-update`.
2. Use a separate marketplace checkout and a task branch. Preserve changes in
   your assistant repository. Add the shared skill under
   `plugins/marketplace-maintenance/skills/<skill>/SKILL.md`; keep its required
   supporting files and redistribution notices. The workshop keeps exactly
   two plugins; participant contributions do not modify vendored upstream files.
3. Use an English kebab-case name and valid YAML frontmatter with `name` and
   `description`; match the skill's directory name. Check all existing names.
   The names `assistant-setup`, `assistant-learn`, `assistant-skill`, and
   `assistant-share` are reserved for the assistant template.
4. Bump the changed plugin's version in
   `plugins/<plugin>/.github/plugin/plugin.json` and the matching entry in
   `.github/plugin/marketplace.json`. Use patch for corrections, minor for new
   capabilities, and major for removals/renames or incompatible behavior.
5. From the repository root, with Node.js 22+ and Git:

   ```shell
   npm ci
   npm test
   npm run validate
   node scripts/validate.mjs --base <base-commit-sha>
   ```

6. Review for secrets, personal identifiers, organization-specific data, and
   unclear redistribution rights. Commit and push your branch. Open a PR
   against `main` and fill the [PR template](.github/pull_request_template.md).
   Wait for green CI and another maintainer's review. The contribution skills
   stop at a PR; the maintainer decides whether to merge.
7. After merge, the other participants update `marketplace-maintenance` and
   verify the shared skill in a fresh session.

Optional CLI testing uses `copilot --plugin-dir ./plugins/<plugin>` in a separate
session with the user's permission, then `/skills` and a representative prompt.
This does not replace the live desktop-app check.

## Validation and layout

The catalog is `.github/plugin/marketplace.json`. Each plugin contains
`.github/plugin/plugin.json` and `skills/<skill>/SKILL.md`. This is a
GitHub Copilot marketplace, not a second upstream marketplace installation.

`npm run validate` runs without network access after `npm ci`. It checks the
two-plugin identity, matching SemVer versions, skill frontmatter and names,
reserved names, sensitive-value patterns, retired repository references,
required workshop skills, and every vendored file's SHA-256 inventory.
Missing, extra, or changed vendored files fail validation. `npm test` exercises
those CLI failure paths and pinned-blob vendoring with temporary repositories.
CI runs both commands on Windows and Linux for PRs and pushes to `main`.
With `--base <40-character-sha>`, validation also requires a version increase
for every changed existing plugin; CI supplies the PR base or previous main SHA.

## Update the vendored skills

The local plugin name is deliberately `matt-pocock-skills`, not upstream
`mattpocock-skills`. Its local version is independent of the upstream version.

```shell
node scripts/vendor-matt-pocock-skills.mjs --commit <full-upstream-commit-sha>
```

The script clones upstream into a temporary directory, reads raw Git blobs at
that commit, selects every directory in the upstream plugin manifest, flattens
category directories, and replaces the vendored tree. Supporting documents,
scripts, and assets retain their bytes. It regenerates
[PROVENANCE.md](plugins/matt-pocock-skills/PROVENANCE.md) with the source commit
and every upstream/destination path and SHA-256. It preserves the local plugin
manifest. For an existing clone, append `--source <path>`; this mode requires no
network and ignores uncommitted source edits.

Review the diff, bump the local plugin version in both manifests, run the checks,
and open a PR. Do not manually patch vendor files or their hashes.
`.gitattributes` disables line-ending conversion for this plugin so Windows
checkouts preserve upstream bytes.

## Attribution

Matt Pocock's [skills](https://github.com/mattpocock/skills) are vendored under
the MIT license. The pinned source manifest, commit, file hashes, and update
instructions are in [provenance](plugins/matt-pocock-skills/PROVENANCE.md);
the upstream [LICENSE](plugins/matt-pocock-skills/LICENSE) is included unchanged.
The maintenance skills and validation workflow adapt the maintainer-provided
snapshot; see [maintenance provenance](plugins/marketplace-maintenance/PROVENANCE.md).

## Maintainer live checklist

These are open acceptance checks, not results from automated validation:

- Add the AGEL repository and install both plugins in the actual workshop app
  and participant profile; confirm skill discovery and a representative prompt.
- Verify participants can create a branch and PR directly in this repository.
- Complete one real contribution PR, confirm green CI, merge with approval,
  and verify a second participant receives the changed plugin after updating.

The development process does not install plugins into the maintainer's profile.
