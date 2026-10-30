import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));
const script = path.join(root, "scripts", "validate.mjs");

function fixture(t) {
  const directory = mkdtempSync(path.join(tmpdir(), "copilot-marketplace-validation-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  cpSync(root, directory, {
    recursive: true,
    filter: (source) => ![".git", "node_modules"].includes(path.relative(root, source).split(path.sep)[0]),
  });
  return directory;
}

function validate(directory, ...args) {
  return spawnSync(process.execPath, [script, ...args], { cwd: directory, encoding: "utf8" });
}

function put(directory, file, content) {
  const target = path.join(directory, file);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, content);
}

function editJson(directory, file, edit) {
  const value = JSON.parse(readFileSync(path.join(directory, file), "utf8"));
  edit(value);
  put(directory, file, JSON.stringify(value));
}

const catalog = ".github/plugin/marketplace.json";
const vendor = "plugins/matt-pocock-skills";
const maintenance = "plugins/marketplace-maintenance";
const skill = `${maintenance}/skills/marketplace-install/SKILL.md`;

function setMaintenanceVersion(directory, version) {
  editJson(directory, catalog, (value) => {
    value.plugins.find((entry) => entry.name === "marketplace-maintenance").version = version;
  });
  editJson(directory, `${maintenance}/.github/plugin/plugin.json`, (value) => { value.version = version; });
}

test("the complete marketplace validates offline", (t) => {
  const result = validate(fixture(t));
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /OK: 2 plugins, \d+ skills/);
});

test("the test suite accepts a valid participant contribution and version bump", (t) => {
  const directory = fixture(t);
  let name = "participant-example";
  while (existsSync(path.join(directory, maintenance, "skills", name))) name += "-new";
  put(directory, `${maintenance}/skills/${name}/SKILL.md`,
    `---\nname: ${name}\ndescription: "A contributed skill."\n---\nPerform the task.\n`);
  setMaintenanceVersion(directory, "4.5.6");
  symlinkSync(path.join(root, "node_modules"), path.join(directory, "node_modules"),
    process.platform === "win32" ? "junction" : "dir");
  const environment = { ...process.env };
  // Start an independent CLI suite rather than inherit the parent test runner.
  delete environment.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, [
    "--test", "--test-reporter=spec", "--test-name-pattern", "the complete marketplace|plugin changes require",
    path.join(directory, "tests", "validate.test.mjs"),
  ], { cwd: directory, encoding: "utf8", env: environment });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /the complete marketplace validates offline/);
  assert.match(result.stdout, /plugin changes require a strictly higher SemVer than the base/);
});

test("the maintenance handoff skills cannot be removed", (t) => {
  const directory = fixture(t);
  rmSync(path.join(directory, "plugins/marketplace-maintenance/skills/marketplace-create-skill"), { recursive: true });
  const result = validate(directory);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /required maintenance skill is missing/);
});

const invalidChanges = [
  ["an incorrect marketplace name", (directory) => editJson(directory, catalog, (value) => {
    value.name = "unexpected-marketplace";
  }), /name must be copilot-marketplace/],
  ["an incorrect marketplace owner", (directory) => editJson(directory, catalog, (value) => {
    value.owner.name = "another-owner";
  }), /incorrect marketplace owner/],
  ["an extra catalog plugin", (directory) => editJson(directory, catalog, (value) => {
    value.plugins.push({ name: "unexpected", source: "./plugins/unexpected", version: "1.0.0", description: "Extra." });
  }), /exactly the two workshop plugins/],
  ["a missing catalog plugin", (directory) => editJson(directory, catalog, (value) => {
    value.plugins.pop();
  }), /required plugin is missing/],
  ["a plugin source outside its directory", (directory) => editJson(directory, catalog, (value) => {
    value.plugins[0].source = "../outside";
  }), /source must equal/],
  ["a non-array catalog", (directory) => editJson(directory, catalog, (value) => {
    value.plugins = {};
  }), /exactly the two workshop plugins/],
  ["a null plugin entry", (directory) => editJson(directory, catalog, (value) => {
    value.plugins[0] = null;
  }), /must be an object/],
  ["mismatched versions", (directory) => editJson(directory, catalog, (value) => {
    value.plugins[0].version = "9.0.0";
  }), /version differs/],
  ["invalid SemVer", (directory) => editJson(directory, catalog, (value) => {
    value.plugins[0].version = "01.2.3";
  }), /version must be SemVer/],
  ["a retired marketplace reference in a supporting file", (directory) =>
    put(directory, "notes.txt", ["ai", "dev", "marketplace"].join("-")), /retired marketplace/],
  ["a development-copy reference in a hidden file", (directory) =>
    put(directory, ".hidden", `${["msu", "charda"].join("")}/${["copilot", "marketplace"].join("-")}`), /development-copy reference/],
  ["changed vendor bytes", (directory) => put(directory, `${vendor}/skills/to-spec/SKILL.md`, "Changed.\n"), /SHA-256 mismatch/],
  ["changed license bytes", (directory) => put(directory, `${vendor}/LICENSE`, "Changed.\n"), /SHA-256 mismatch/],
  ["a missing support file", (directory) =>
    rmSync(path.join(directory, vendor, "skills/tdd/tests.md")), /vendored file is missing/],
  ["an extra support file", (directory) =>
    put(directory, `${vendor}/skills/tdd/extra.md`, "Unexpected.\n"), /extra vendored file/],
  ["an extra plugin file", (directory) =>
    put(directory, `${vendor}/extra.md`, "Unexpected.\n"), /extra vendored file/],
  ["a missing required workshop skill", (directory) =>
    rmSync(path.join(directory, vendor, "skills/to-tickets"), { recursive: true }), /required workshop skill is missing/],
  ["a skill omitted from the upstream manifest", (directory) =>
    editJson(directory, `${vendor}/upstream/plugin.json`, (value) => {
      value.skills = value.skills.filter((name) => !name.endsWith("/to-spec"));
    }), /Required workshop skill is missing upstream/],
  ["malformed frontmatter", (directory) => put(directory, skill, '---\nname: "unclosed\ndescription: test\n---\nBody.\n'), /invalid YAML/],
  ["duplicate YAML keys", (directory) => put(directory, skill,
    "---\nname: marketplace-install\nname: duplicate\ndescription: Test.\n---\nBody.\n"), /invalid YAML/],
  ["a description with the wrong YAML type", (directory) => put(directory, skill,
    "---\nname: marketplace-install\ndescription: [one, two]\n---\nBody.\n"), /description must be a non-empty string/],
  ["a mismatched skill name", (directory) => put(directory, skill,
    "---\nname: another-name\ndescription: Test.\n---\nBody.\n"), /name must match its skill directory/],
  ["a reserved assistant name", (directory) => put(directory,
    `${maintenance}/skills/assistant-share/SKILL.md`,
    "---\nname: assistant-share\ndescription: Test.\n---\nBody.\n"), /reserved for the assistant template/],
  ["a duplicate skill across plugins", (directory) => put(directory,
    `${maintenance}/skills/to-spec/SKILL.md`,
    "---\nname: to-spec\ndescription: Test.\n---\nBody.\n"), /duplicate skill name/],
  ["an empty skill body", (directory) => put(directory, skill,
    "---\nname: marketplace-install\ndescription: Test.\n---\n"), /skill body is empty/],
  ["a missing skill entry point", (directory) =>
    put(directory, `${maintenance}/skills/incomplete/reference.md`, "Only a reference.\n"), /SKILL.md is missing/],
  ["a sensitive supporting file", (directory) =>
    put(directory, `${maintenance}/skills/marketplace-install/example.txt`, `api_key = "${"a".repeat(24)}"\n`),
  /possible sensitive value/],
  ["a duplicated provenance row", (directory) => {
    const file = `${vendor}/PROVENANCE.md`;
    const text = readFileSync(path.join(directory, file), "utf8");
    const row = text.split("\n").find((line) => line.startsWith("| `LICENSE`"));
    put(directory, file, `${text}${row}\n`);
  }, /duplicate inventory file/],
  ["an incorrect provenance source mapping", (directory) => {
    const file = `${vendor}/PROVENANCE.md`;
    const text = readFileSync(path.join(directory, file), "utf8");
    put(directory, file, text.replace("| `LICENSE` | `LICENSE`", "| `LICENSE` | `.claude-plugin/plugin.json`"));
  }, /incorrect source mapping/],
];

for (const [name, change, error] of invalidChanges) {
  test(`offline validation rejects ${name}`, (t) => {
    const directory = fixture(t);
    change(directory);
    const result = validate(directory);
    assert.notEqual(result.status, 0, result.stdout);
    assert.match(result.stderr, error);
  });
}

test("valid folded YAML descriptions are accepted", (t) => {
  const directory = fixture(t);
  put(directory, skill, "---\nname: marketplace-install\ndescription: >-\n  Install the marketplace\n  for the workshop.\n---\nDo the work.\n");
  const result = validate(directory);
  assert.equal(result.status, 0, result.stderr);
});

test("plugin changes require a strictly higher SemVer than the base", (t) => {
  const directory = fixture(t);
  setMaintenanceVersion(directory, "1.2.3");
  const git = (...args) => execFileSync("git", ["-C", directory, ...args], { encoding: "utf8" }).trim();
  git("init", "--quiet");
  git("config", "user.name", "Fixture");
  git("config", "user.email", "fixture@example.invalid");
  git("config", "commit.gpgsign", "false");
  git("add", ".");
  git("commit", "--quiet", "-m", "Create marketplace fixture");
  const base = git("rev-parse", "HEAD");
  put(directory, `${maintenance}/skills/marketplace-install/example.md`, "A new supporting file.\n");
  const unchanged = validate(directory, "--base", base);
  assert.notEqual(unchanged.status, 0);
  assert.match(unchanged.stderr, /version did not increase/);
  setMaintenanceVersion(directory, "1.3.0-beta.1");
  const increased = validate(directory, "--base", base);
  assert.equal(increased.status, 0, increased.stderr);
  setMaintenanceVersion(directory, "1.2.3+build");
  const buildOnly = validate(directory, "--base", base);
  assert.notEqual(buildOnly.status, 0);
  assert.match(buildOnly.stderr, /version did not increase/);
});
