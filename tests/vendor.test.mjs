import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const script = fileURLToPath(new URL("../scripts/vendor-matt-pocock-skills.mjs", import.meta.url));
const workshopSkills = ["setup-matt-pocock-skills", "grill-with-docs", "to-spec", "to-tickets"];

function fixture(t) {
  const directory = mkdtempSync(path.join(tmpdir(), "copilot-marketplace-vendor-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const source = path.join(directory, "source");
  const target = path.join(directory, "target");
  const put = (root, file, content) => {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), content);
  };
  const git = (...args) => execFileSync("git", ["-C", source, ...args], { encoding: "utf8" }).trim();
  mkdirSync(source);
  git("init", "--quiet");
  git("config", "core.autocrlf", "false");
  git("config", "user.name", "Fixture");
  git("config", "user.email", "fixture@example.invalid");
  git("config", "commit.gpgsign", "false");
  const manifest = {
    name: "mattpocock-skills", license: "MIT",
    skills: workshopSkills.map((name) => `./skills/engineering/${name}`),
  };
  put(source, ".claude-plugin/plugin.json", JSON.stringify(manifest));
  put(source, "LICENSE", "MIT License\nCopyright (c) Fixture\nPermission is hereby granted, free of charge.\n");
  for (const name of workshopSkills) {
    put(source, `skills/engineering/${name}/SKILL.md`,
      `---\nname: ${name}\ndescription: "Use for ${name}."\n---\n\nDo the work.\n`);
  }
  const bytes = Buffer.from([0, 13, 10, 255, 42]);
  put(source, "skills/engineering/to-spec/assets/example.bin", bytes);
  git("add", ".");
  git("commit", "--quiet", "-m", "Create upstream fixture");
  const commit = git("rev-parse", "HEAD");
  put(target, "plugins/matt-pocock-skills/.github/plugin/plugin.json",
    '{"name":"matt-pocock-skills","version":"1.0.0"}\n');
  return { source, target, put, git, commit, bytes };
}

test("vendoring uses the pinned Git blobs, includes support files, and is repeatable", (t) => {
  const { source, target, put, commit, bytes } = fixture(t);
  put(source, "skills/engineering/to-spec/SKILL.md", "An uncommitted local edit.\r\n");
  const run = () => spawnSync(process.execPath, [script, "--commit", commit, "--source", source],
    { cwd: target, encoding: "utf8" });
  const first = run();
  assert.equal(first.status, 0, first.stderr);
  const plugin = path.join(target, "plugins/matt-pocock-skills");
  assert.deepEqual(readFileSync(path.join(plugin, "skills/to-spec/assets/example.bin")), bytes);
  assert.match(readFileSync(path.join(plugin, "skills/to-spec/SKILL.md"), "utf8"), /name: to-spec/);
  assert.equal(readFileSync(path.join(plugin, "upstream/plugin.json"), "utf8"),
    JSON.stringify({
      name: "mattpocock-skills", license: "MIT",
      skills: workshopSkills.map((name) => `./skills/engineering/${name}`),
    }));
  const provenance = readFileSync(path.join(plugin, "PROVENANCE.md"), "utf8");
  assert.ok(provenance.includes(commit));
  assert.match(provenance, /skills\/to-spec\/assets\/example\.bin/);
  const second = run();
  assert.equal(second.status, 0, second.stderr);
  assert.equal(readFileSync(path.join(plugin, "PROVENANCE.md"), "utf8"), provenance);
});

test("invalid pins fail without changing the existing plugin", (t) => {
  const { source, target } = fixture(t);
  const manifest = path.join(target, "plugins/matt-pocock-skills/.github/plugin/plugin.json");
  const before = readFileSync(manifest);
  const result = spawnSync(process.execPath, [script, "--commit", "main", "--source", source],
    { cwd: target, encoding: "utf8" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /40-character-sha/);
  assert.deepEqual(readFileSync(manifest), before);
});

test("an upstream manifest missing a workshop skill fails before replacing files", (t) => {
  const { source, target, put, git } = fixture(t);
  put(source, ".claude-plugin/plugin.json", JSON.stringify({
    name: "mattpocock-skills", license: "MIT", skills: ["./skills/engineering/to-spec"],
  }));
  git("add", ".");
  git("commit", "--quiet", "-m", "Omit required workshop skills");
  put(target, "plugins/matt-pocock-skills/sentinel.txt", "Keep this existing file.\n");
  const result = spawnSync(process.execPath, [script, "--commit", git("rev-parse", "HEAD"), "--source", source],
    { cwd: target, encoding: "utf8" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Required workshop skill is missing upstream/);
  assert.equal(readFileSync(path.join(target, "plugins/matt-pocock-skills/sentinel.txt"), "utf8"), "Keep this existing file.\n");
});
