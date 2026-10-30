#!/usr/bin/env node
// Adapted from the maintainer's exported validator; see maintenance provenance.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { parseArgs } from "node:util";
import { parseDocument } from "yaml";
import { KEBAB, SOURCE_URL, REQUIRED_SKILLS, selectedSkills, destinationFor, safePath } from "./vendoring.mjs";

const root = process.cwd();
const errors = [];
const err = (file, message) => errors.push(`${relative(root, file) || file}: ${message}`);
const PLUGINS = ["marketplace-maintenance", "matt-pocock-skills"];
const MAINTENANCE_SKILLS = ["marketplace-install", "marketplace-create-skill", "marketplace-submit-update"];
const RESERVED = new Set(["assistant-setup", "assistant-learn", "assistant-skill", "assistant-share"]);
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

function version(value) {
  const match = typeof value === "string" && value.match(SEMVER);
  if (!match || match[4]?.split(".").some((id) => /^\d+$/.test(id) && /^0\d/.test(id))) return null;
  return { numbers: match.slice(1, 4).map(BigInt), prerelease: match[4]?.split(".") };
}

function isHigher(next, previous) {
  const a = version(next);
  const b = version(previous);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) {
    if (a.numbers[i] !== b.numbers[i]) return a.numbers[i] > b.numbers[i];
  }
  if (!a.prerelease || !b.prerelease) return Boolean(b.prerelease) && !a.prerelease;
  for (let i = 0; i < Math.max(a.prerelease.length, b.prerelease.length); i++) {
    const x = a.prerelease[i];
    const y = b.prerelease[i];
    if (x === y) continue;
    if (x === undefined || y === undefined) return y === undefined;
    const numericX = /^\d+$/.test(x);
    const numericY = /^\d+$/.test(y);
    if (numericX && numericY) return BigInt(x) > BigInt(y);
    if (numericX !== numericY) return numericY;
    return x > y;
  }
  return false;
}

function readJson(file) {
  if (!existsSync(file)) {
    err(file, "file is missing");
    return null;
  }
  try {
    const data = JSON.parse(readFileSync(file, "utf8"));
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("expected an object");
    return data;
  } catch (error) {
    err(file, `invalid JSON: ${error.message}`);
    return null;
  }
}

function checkName(file, field, value) {
  if (typeof value !== "string" || !KEBAB.test(value) || value.length > 64) {
    err(file, `${field} must be kebab-case, at most 64 characters`);
  }
}

function checkDescription(file, field, value) {
  if (typeof value !== "string" || !value.trim()) err(file, `${field} must be a non-empty string`);
  else if (value.length > 1024) err(file, `${field} exceeds 1024 characters`);
}

function parseFrontmatter(file) {
  const text = readFileSync(file, "utf8").replace(/^\uFEFF/, "");
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) {
    err(file, "missing YAML frontmatter delimited by ---");
    return null;
  }
  try {
    const document = parseDocument(match[1], { uniqueKeys: true });
    if (document.errors.length) throw new Error(document.errors.map((error) => error.message).join("; "));
    const data = document.toJS({ maxAliasCount: 50 });
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("expected a YAML mapping");
    if (!text.slice(match[0].length).trim()) err(file, "skill body is empty");
    return data;
  } catch (error) {
    err(file, `invalid YAML frontmatter: ${error.message}`);
    return null;
  }
}

const SENSITIVE = [
  ["GUID", /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i],
  ["JWT", /\beyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{10,}/],
  ["private key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["secret", /(password|passwd|secret|api[_-]?key|token)["']?\s*[:=]\s*["']?(?![A-Z0-9_]*(YOUR|REPLACE|CHANGE|EXAMPLE|PLACEHOLDER))[A-Za-z0-9+/_-]{16,}/i],
];

function listFiles(directory, ignored = new Set()) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory).flatMap((name) => {
    if (ignored.has(name)) return [];
    const file = join(directory, name);
    const stat = lstatSync(file);
    if (stat.isSymbolicLink()) {
      err(file, "symbolic links are not allowed in marketplace content");
      return [];
    }
    if (stat.isDirectory()) return listFiles(file, ignored);
    if (!stat.isFile()) {
      err(file, "expected a regular file");
      return [];
    }
    return [file];
  });
}

function checkSensitive(directory) {
  for (const file of listFiles(directory)) {
    readFileSync(file, "utf8").split(/\r?\n/).forEach((line, index) => {
      for (const [label, pattern] of SENSITIVE) {
        if (pattern.test(line)) err(file, `line ${index + 1} contains a possible sensitive value (${label})`);
      }
    });
  }
}

function checkRepositoryReferences() {
  const forbidden = [
    ["ai", "dev", "marketplace"].join("-"),
    `${["msu", "charda"].join("")}/${["copilot", "marketplace"].join("-")}`,
  ];
  for (const file of listFiles(root, new Set([".git", "node_modules"]))) {
    const text = readFileSync(file, "utf8").toLowerCase();
    for (const reference of forbidden) {
      if (text.includes(reference)) err(file, "contains a retired marketplace or development-copy reference");
    }
  }
}

function checkVendoring(plugin) {
  const provenanceFile = join(plugin, "PROVENANCE.md");
  if (!existsSync(provenanceFile)) {
    err(provenanceFile, "file is missing");
    return;
  }
  const text = readFileSync(provenanceFile, "utf8");
  if (!text.includes(`- Source repository: ${SOURCE_URL}\n`)) err(provenanceFile, "incorrect source repository");
  if (!/^- Upstream commit: `[0-9a-f]{40}`$/m.test(text)) err(provenanceFile, "missing full upstream commit SHA");
  if (!text.includes("- License: MIT")) err(provenanceFile, "missing MIT attribution");
  const manifest = readJson(join(plugin, "upstream", "plugin.json"));
  if (!manifest) return;
  let skills;
  try {
    skills = selectedSkills(manifest);
  } catch (error) {
    err(provenanceFile, error.message);
    return;
  }
  const table = text.split("| Vendored file | Upstream file | SHA-256 |\n|---|---|---|\n");
  if (table.length !== 2) {
    err(provenanceFile, "missing or ambiguous SHA-256 inventory table");
    return;
  }
  const inventory = new Map();
  for (const line of table[1].trim().split(/\r?\n/)) {
    const row = line.match(/^\| `([^`]+)` \| `([^`]+)` \| `([0-9a-f]{64})` \|$/);
    if (!row) {
      err(provenanceFile, `invalid inventory row: ${line}`);
      continue;
    }
    const [, destination, source, hash] = row;
    if (!safePath(destination)) {
      err(provenanceFile, `unsafe destination: ${destination}`);
      continue;
    }
    if (inventory.has(destination)) err(provenanceFile, `duplicate inventory file: ${destination}`);
    inventory.set(destination, hash);
    try {
      if (destinationFor(source, skills) !== destination) err(provenanceFile, `incorrect source mapping for ${destination}`);
    } catch (error) {
      err(provenanceFile, error.message);
    }
  }
  const actual = new Set(listFiles(plugin)
    .map((file) => relative(plugin, file).split(sep).join("/"))
    .filter((file) => ![".github/plugin/plugin.json", "PROVENANCE.md"].includes(file)));
  for (const required of ["LICENSE", "upstream/plugin.json", ...[...skills.keys()].map((name) => `skills/${name}/SKILL.md`)]) {
    if (!inventory.has(required)) err(provenanceFile, `required file is missing from inventory: ${required}`);
  }
  for (const [file, hash] of inventory) {
    if (!actual.has(file)) {
      err(provenanceFile, `vendored file is missing: ${file}`);
      continue;
    }
    const actualHash = createHash("sha256").update(readFileSync(join(plugin, ...file.split("/")))).digest("hex");
    if (actualHash !== hash) err(join(plugin, file), "SHA-256 mismatch against PROVENANCE.md");
  }
  for (const file of actual) {
    if (!inventory.has(file)) err(join(plugin, file), "extra vendored file is not in PROVENANCE.md");
  }
}

function checkVersionBumps(base, entries) {
  if (!base) return;
  if (!/^[0-9a-f]{40}$/.test(base)) throw new Error("--base must be a full 40-character commit SHA");
  const git = (...args) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  git("cat-file", "-e", `${base}^{commit}`);
  for (const entry of entries) {
    const directory = `plugins/${entry.name}`;
    const changed = git("diff", "--name-only", base, "--", directory).trim() ||
      git("ls-files", "--others", "--exclude-standard", "--", directory).trim();
    if (!changed) continue;
    const file = `${directory}/.github/plugin/plugin.json`;
    const previousFiles = git("ls-tree", "--name-only", base, "--", file).trim();
    if (!previousFiles) continue;
    const previous = JSON.parse(git("show", `${base}:${file}`));
    if (!isHigher(entry.version, previous.version)) {
      err(join(root, file), `plugin changed but version did not increase above ${previous.version}`);
    }
  }
}

try {
  const { values } = parseArgs({ options: { base: { type: "string" } }, strict: true, allowPositionals: false });
  checkRepositoryReferences();
  const marketplaceFile = join(root, ".github", "plugin", "marketplace.json");
  const marketplace = readJson(marketplaceFile);
  const skillNames = new Map();
  const listedSources = new Set();
  const pluginNames = new Set();
  const entries = Array.isArray(marketplace?.plugins) ? marketplace.plugins : [];
  if (marketplace) {
    checkName(marketplaceFile, "name", marketplace.name);
    if (marketplace.name !== "copilot-marketplace") err(marketplaceFile, "name must be copilot-marketplace");
    if (marketplace.owner?.name !== "agel-data-and-ai-temp-poc") err(marketplaceFile, "incorrect marketplace owner");
    if (!version(marketplace.metadata?.version)) err(marketplaceFile, "metadata.version must be SemVer");
    checkDescription(marketplaceFile, "metadata.description", marketplace.metadata?.description);
  }
  if (entries.length !== PLUGINS.length) err(marketplaceFile, "catalog must contain exactly the two workshop plugins");
  for (const [index, entry] of entries.entries()) {
    const where = `plugins[${index}]`;
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      err(marketplaceFile, `${where} must be an object`);
      continue;
    }
    checkName(marketplaceFile, `${where}.name`, entry.name);
    if (!PLUGINS.includes(entry.name)) err(marketplaceFile, `${where}.name is not a workshop plugin`);
    if (pluginNames.has(entry.name)) err(marketplaceFile, `${where}.name is duplicated`);
    pluginNames.add(entry.name);
    checkDescription(marketplaceFile, `${where}.description`, entry.description);
    if (!version(entry.version)) err(marketplaceFile, `${where}.version must be SemVer`);
    if (!PLUGINS.includes(entry.name) || entry.source !== `./plugins/${entry.name}`) {
      err(marketplaceFile, `${where}.source must equal ./plugins/<plugin-name>`);
      continue;
    }
    const plugin = resolve(root, entry.source);
    listedSources.add(plugin);
    if (!existsSync(plugin) || !lstatSync(plugin).isDirectory()) {
      err(marketplaceFile, `${where}.source does not exist as a directory`);
      continue;
    }
    const manifestFile = join(plugin, ".github", "plugin", "plugin.json");
    const manifest = readJson(manifestFile);
    if (manifest) {
      checkName(manifestFile, "name", manifest.name);
      checkDescription(manifestFile, "description", manifest.description);
      if (manifest.name !== entry.name) err(manifestFile, "name differs from the catalog");
      if (!version(manifest.version)) err(manifestFile, "version must be SemVer");
      if (manifest.version !== entry.version) err(manifestFile, "version differs from the catalog");
      if (manifest.repository !== "https://github.com/agel-data-and-ai-temp-poc/copilot-marketplace") {
        err(manifestFile, "incorrect plugin repository");
      }
    }
    const skillsDirectory = join(plugin, "skills");
    const directories = existsSync(skillsDirectory) ? readdirSync(skillsDirectory).filter((name) =>
      lstatSync(join(skillsDirectory, name)).isDirectory()) : [];
    if (!directories.length) err(plugin, "plugin has no skills/<skill>/SKILL.md");
    for (const directory of directories) {
      const file = join(skillsDirectory, directory, "SKILL.md");
      if (!existsSync(file)) {
        err(file, "SKILL.md is missing");
        continue;
      }
      const frontmatter = parseFrontmatter(file);
      if (!frontmatter) continue;
      checkName(file, "name", frontmatter.name);
      checkDescription(file, "description", frontmatter.description);
      if (frontmatter.name !== directory) err(file, "name must match its skill directory");
      if (RESERVED.has(frontmatter.name)) err(file, "skill name is reserved for the assistant template");
      if (skillNames.has(frontmatter.name)) err(file, `duplicate skill name also found in ${skillNames.get(frontmatter.name)}`);
      else skillNames.set(frontmatter.name, entry.name);
      checkSensitive(join(skillsDirectory, directory));
    }
    if (entry.name === "matt-pocock-skills") {
      for (const name of REQUIRED_SKILLS) {
        if (!directories.includes(name)) err(plugin, `required workshop skill is missing: ${name}`);
      }
      checkVendoring(plugin);
    } else {
      for (const name of MAINTENANCE_SKILLS) {
        if (!directories.includes(name)) err(plugin, `required maintenance skill is missing: ${name}`);
      }
    }
  }
  for (const name of PLUGINS) {
    if (!pluginNames.has(name)) err(marketplaceFile, `required plugin is missing: ${name}`);
  }
  const pluginsRoot = join(root, "plugins");
  if (existsSync(pluginsRoot)) {
    for (const name of readdirSync(pluginsRoot)) {
      const full = join(pluginsRoot, name);
      if (!listedSources.has(full)) err(full, "plugin is not listed in the catalog");
    }
  }
  checkVersionBumps(values.base, entries.filter((entry) => entry && PLUGINS.includes(entry.name)));
  if (errors.length) {
    console.error(`Validation failed (${errors.length}):`);
    for (const error of errors) console.error(`  - ${error}`);
    process.exitCode = 1;
  } else {
    console.log(`OK: ${entries.length} plugins, ${skillNames.size} skills. Vendored hashes verified offline.`);
  }
} catch (error) {
  console.error(`Validation failed: ${error.message}`);
  process.exitCode = 1;
}
