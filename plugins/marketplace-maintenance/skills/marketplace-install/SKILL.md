---
name: marketplace-install
description: "Install, update or remove copilot-marketplace plugins in GitHub Copilot. Use when the user asks to add the marketplace, install workshop skills, update a plugin, uninstall, or troubleshoot missing skills."
---

# Install the workshop marketplace

## Identify the client and access

1. Establish whether the user uses the GitHub Copilot desktop app, Copilot CLI,
   or VS Code. The workshop targets the desktop app on Windows.
2. Verify repository access with
   `gh repo view agel-data-and-ai-temp-poc/copilot-marketplace`.
   A 404 may mean missing organization access. Have the maintainer resolve it
   before installation; never substitute a different marketplace.
3. Check `copilot plugin list` for an existing upstream `mattpocock-skills`
   installation. Use only this marketplace's `matt-pocock-skills` plugin.
   Installing the upstream `mattpocock/skills` plugin alongside it duplicates
   skill names. Explain the conflict and obtain permission before removing an
   existing installation; preserve unrelated customizations.

## Install

Obtain permission before commands that change the user's Copilot configuration.
From a terminal, use:

```shell
copilot plugin marketplace add agel-data-and-ai-temp-poc/copilot-marketplace
copilot plugin marketplace browse copilot-marketplace
copilot plugin install marketplace-maintenance@copilot-marketplace
copilot plugin install matt-pocock-skills@copilot-marketplace
```

In the desktop app, inspect **Customize** for marketplace/plugin controls.
If the current build exposes them, add the same repository and install the two
named plugins. Exact control names and the app installation path remain subject
to the maintainer's live workshop check; do not claim they have been verified.
If those controls are unavailable, use the terminal commands above on the same
machine and with the same user profile, then restart the app or open a new session.

For Copilot CLI, the interactive `/plugin` menu is an alternative to terminal
commands. For VS Code, configure these user-level settings, then inspect
**Extensions** with the `@agentPlugins` filter and install the two plugins:

```json
{
  "chat.plugins.enabled": true,
  "chat.plugins.marketplaces": ["agel-data-and-ai-temp-poc/copilot-marketplace"]
}
```

Confirm trust only after the user has reviewed the marketplace. Workspace-level
settings are not a substitute for user-level plugin installation.

## Update or remove

After a contribution is merged, refresh the catalog and update the changed plugin:

```shell
copilot plugin marketplace update copilot-marketplace
copilot plugin update marketplace-maintenance
copilot plugin update matt-pocock-skills
```

Only run the update for plugins the user has installed. Removal is a separate,
explicit user decision:

```shell
copilot plugin uninstall <plugin>
copilot plugin marketplace remove copilot-marketplace
```

Uninstall the marketplace's plugins before removing the marketplace; do not use
force removal as a shortcut. Automatic updates are optional and require a
separate user decision, not a workshop prerequisite.

## Verify and troubleshoot

1. Run `copilot plugin list` and inspect `/skills` in a fresh CLI session, or
   inspect the app's available skills in a fresh session.
2. Confirm both plugin identities and these skill names:
   `marketplace-install`, `marketplace-create-skill`, `marketplace-submit-update`,
   `setup-matt-pocock-skills`, `grill-with-docs`, `to-spec`, and `to-tickets`.
3. If the catalog is stale, refresh it. If skills are missing, restart the client
   and confirm the same user profile was used. If a changed plugin does not
   update, check that its version was bumped in both manifests.
4. Report authentication failures and unsupported UI paths explicitly. Report
   duplicate skill names rather than resolving them by deleting local skills.

Done when the two plugins appear installed and the required skills are visible.
If live verification was not performed, state that it remains open.
