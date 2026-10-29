#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import {
  SOURCE_URL, UPSTREAM_MANIFEST, selectedSkills, destinationFor, provenance,
} from "./vendoring.mjs";

const temporary = [];

try {
  const { values } = parseArgs({
    options: { commit: { type: "string" }, source: { type: "string" } },
    strict: true, allowPositionals: false,
  });
  if (!/^[0-9a-f]{40}$/.test(values.commit ?? "")) {
    throw new Error("Usage: node scripts/vendor-matt-pocock-skills.mjs --commit <40-character-sha> [--source <clone>]");
  }
  const root = process.cwd();
  const plugin = join(root, "plugins", "matt-pocock-skills");
  const metadataPath = join(plugin, ".github", "plugin", "plugin.json");
  if (!existsSync(metadataPath)) throw new Error("Run from the marketplace root with the local plugin manifest present.");
  if (lstatSync(plugin).isSymbolicLink()) throw new Error("The target plugin must not be a symbolic link.");
  const metadata = readFileSync(metadataPath);
  if (JSON.parse(metadata).name !== "matt-pocock-skills") throw new Error("Unexpected local plugin identity.");

  let source = values.source && resolve(values.source);
  if (!source) {
    const clone = mkdtempSync(join(tmpdir(), "copilot-marketplace-upstream-"));
    temporary.push(clone);
    source = join(clone, "source");
    execFileSync("git", ["clone", "--quiet", "--no-checkout", `${SOURCE_URL}.git`, source],
      { stdio: ["ignore", "ignore", "pipe"] });
  }
  const git = (...args) => execFileSync("git", ["-C", source, ...args], { maxBuffer: 32 * 1024 * 1024 });
  const commit = values.commit;
  git("cat-file", "-e", `${commit}^{commit}`);
  const manifestBytes = git("show", `${commit}:${UPSTREAM_MANIFEST}`);
  const skills = selectedSkills(JSON.parse(manifestBytes.toString("utf8")));
  const files = git("ls-tree", "-r", "-z", commit, "--", "LICENSE", UPSTREAM_MANIFEST, ...skills.values())
    .toString("utf8").split("\0").filter(Boolean);
  const records = files.map((line) => {
    const match = line.match(/^(100644|100755) blob ([0-9a-f]+)\t(.+)$/);
    if (!match) throw new Error(`Only regular upstream files can be vendored: ${line}`);
    const [, mode, , sourcePath] = match;
    const destination = destinationFor(sourcePath, skills);
    const bytes = git("show", `${commit}:${sourcePath}`);
    return { source: sourcePath, destination, bytes, mode, hash: createHash("sha256").update(bytes).digest("hex") };
  }).sort((a, b) => a.destination < b.destination ? -1 : a.destination > b.destination ? 1 : 0);
  const destinations = new Set(records.map((record) => record.destination));
  if (destinations.size !== records.length) throw new Error("Upstream files map to duplicate destinations.");
  for (const required of ["LICENSE", "upstream/plugin.json", ...[...skills.keys()].map((name) => `skills/${name}/SKILL.md`)]) {
    if (!destinations.has(required)) throw new Error(`Required upstream file is missing: ${required}`);
  }
  const license = records.find((record) => record.destination === "LICENSE").bytes.toString("utf8");
  if (!license.startsWith("MIT License") || !license.includes("Permission is hereby granted")) {
    throw new Error("Upstream LICENSE is not the expected MIT license; review before adapting the importer.");
  }

  const staging = mkdtempSync(join(dirname(plugin), ".matt-pocock-stage-"));
  temporary.push(staging);
  for (const { destination, bytes, mode } of records) {
    const file = join(staging, ...destination.split("/"));
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, bytes, { mode: mode === "100755" ? 0o755 : 0o644 });
  }
  mkdirSync(join(staging, ".github", "plugin"), { recursive: true });
  writeFileSync(join(staging, ".github", "plugin", "plugin.json"), metadata);
  writeFileSync(join(staging, "PROVENANCE.md"), provenance(commit, records));
  const backupDirectory = mkdtempSync(join(dirname(plugin), ".matt-pocock-backup-"));
  temporary.push(backupDirectory);
  const backup = join(backupDirectory, "plugin");
  renameSync(plugin, backup);
  try {
    renameSync(staging, plugin);
  } catch (error) {
    try {
      renameSync(backup, plugin);
    } catch (restoreError) {
      temporary.splice(temporary.indexOf(backupDirectory), 1);
      throw new Error(`Replacement and rollback failed. Recover the original plugin from ${backup}. ${restoreError.message}`, { cause: error });
    }
    throw error;
  }
  console.log(`Vendored ${skills.size} skills, ${records.length} upstream files at ${commit}.`);
} catch (error) {
  console.error(`Vendoring failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  for (const directory of temporary.reverse()) rmSync(directory, { recursive: true, force: true });
}
