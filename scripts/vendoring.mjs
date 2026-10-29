export const SOURCE_URL = "https://github.com/mattpocock/skills";
export const UPSTREAM_MANIFEST = ".claude-plugin/plugin.json";
export const REQUIRED_SKILLS = [
  "setup-matt-pocock-skills", "grill-with-docs", "to-spec", "to-tickets",
];
export const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function safePath(value) {
  return typeof value === "string" && /^[A-Za-z0-9_./-]+$/.test(value) &&
    !value.startsWith("/") && value.split("/").every((part) => part && part !== "." && part !== "..");
}

export function selectedSkills(manifest) {
  if (manifest?.name !== "mattpocock-skills" || manifest.license !== "MIT" ||
      !Array.isArray(manifest.skills) || !manifest.skills.length) {
    throw new Error("Upstream manifest must describe the MIT mattpocock-skills plugin with a skills array.");
  }
  const skills = new Map();
  for (const value of manifest.skills) {
    if (typeof value !== "string" || !value.startsWith("./skills/") || !safePath(value.slice(2))) {
      throw new Error(`Invalid upstream skill path: ${JSON.stringify(value)}`);
    }
    const source = value.slice(2);
    const name = source.split("/").at(-1);
    if (!KEBAB.test(name) || name.length > 64 || skills.has(name)) {
      throw new Error(`Invalid or duplicate upstream skill name: ${name}`);
    }
    if ([...skills.values()].some((other) => source.startsWith(`${other}/`) || other.startsWith(`${source}/`))) {
      throw new Error(`Overlapping upstream skill path: ${source}`);
    }
    skills.set(name, source);
  }
  for (const name of REQUIRED_SKILLS) {
    if (!skills.has(name)) throw new Error(`Required workshop skill is missing upstream: ${name}`);
  }
  return skills;
}

export function destinationFor(source, skills) {
  if (!safePath(source)) throw new Error(`Unsafe upstream file path: ${source}`);
  if (source === "LICENSE") return "LICENSE";
  if (source === UPSTREAM_MANIFEST) return "upstream/plugin.json";
  for (const [name, directory] of skills) {
    if (source.startsWith(`${directory}/`)) return `skills/${name}/${source.slice(directory.length + 1)}`;
  }
  throw new Error(`File is not selected by the upstream plugin: ${source}`);
}

export function provenance(commit, records) {
  return `# Matt Pocock skills provenance

- Source repository: ${SOURCE_URL}
- Upstream commit: \`${commit}\`
- License: MIT (see [LICENSE](LICENSE)).
- Selection: every directory listed in the pinned upstream
  \`${UPSTREAM_MANIFEST}\`, preserved at [upstream/plugin.json](upstream/plugin.json).
- Layout: upstream category directories are flattened to \`skills/<skill>/\`;
  every selected file, including supporting documents and scripts, is unchanged.
- Hashes below are SHA-256 of raw Git blob bytes, not a platform-normalized checkout.

## Update

From the repository root, with Node.js 22+ and Git:

1. Choose and review a full 40-character upstream commit SHA.
2. Run \`node scripts/vendor-matt-pocock-skills.mjs --commit <sha>\`.
   To use an existing upstream clone without network access, append \`--source <path>\`.
3. Review the upstream manifest, license, skill changes, and this generated inventory.
   The command replaces all vendored files; make local contributions in the
   maintenance plugin instead.
4. Bump the local plugin version in its \`.github/plugin/plugin.json\` and the
   matching catalog entry. Use a major bump for removed or renamed skills.
5. Run \`npm ci\`, \`npm test\`, and \`npm run validate\`; open a PR.

Do not edit vendored files or their hashes manually. Re-run the command instead.
The local plugin manifest and this generated document are not upstream files.

## Vendored files

| Vendored file | Upstream file | SHA-256 |
|---|---|---|
${records.map(({ destination, source, hash }) => `| \`${destination}\` | \`${source}\` | \`${hash}\` |`).join("\n")}
`;
}
