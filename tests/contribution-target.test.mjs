import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));
const skills = ["marketplace-create-skill", "marketplace-submit-update"];
const defaultRepository = "agel-data-and-ai-temp-poc/copilot-marketplace";
const powershell = process.platform === "win32"
  ? path.join(process.env.SystemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe")
  : "pwsh";

function fixture(t, repository = defaultRepository) {
  const directory = mkdtempSync(path.join(tmpdir(), "copilot-marketplace-target-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (/^GIT_CONFIG_/i.test(key)) delete env[key];
  }
  env.GIT_CONFIG_GLOBAL = path.join(directory, "empty-global-config");
  env.GIT_CONFIG_NOSYSTEM = "1";
  writeFileSync(env.GIT_CONFIG_GLOBAL, "");
  const git = (...args) => {
    const result = spawnSync("git", ["-C", directory, ...args], { env, encoding: "utf8" });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    return result.stdout.trim();
  };
  git("init", "--quiet");
  git("remote", "add", "origin", `https://github.com/${repository}.git`);
  return { directory, env, git, repository };
}

function checkDestination(skill, checkout) {
  const text = readFileSync(path.join(root,
    "plugins", "marketplace-maintenance", "skills", skill, "SKILL.md"), "utf8");
  const block = text.match(/```powershell\r?\n([\s\S]*?)```/);
  assert.ok(block, `${skill} must supply an executable destination check`);
  const quote = (value) => `'${value.replaceAll("'", "''")}'`;
  const command = block[1]
    .replace("'<absolute-marketplace-root>'", quote(checkout.directory))
    .replace("'<resolved-owner/repo>'", quote(checkout.repository));
  const result = spawnSync(powershell, ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", command], {
    cwd: checkout.directory,
    env: checkout.env,
    encoding: "utf8",
    timeout: 30_000,
  });
  assert.ifError(result.error);
  return result;
}

const cases = [
  ["accepts the approved HTTPS origin without a pushurl", () => {}, true],
  ["accepts all approved HTTPS and SSH push destinations", ({ git, repository }) => {
    git("config", "remote.origin.pushurl", `https://github.com/${repository}`);
    git("config", "--add", "remote.origin.pushurl", `git@github.com:${repository}.git`);
    git("config", "--add", "remote.origin.pushurl", `ssh://git@github.com/${repository}`);
  }, true],
  ["accepts insteadOf expansion to the approved repository", ({ git, repository }) => {
    git("remote", "set-url", "origin", `workshop:${repository}.git`);
    git("config", "url.https://github.com/.insteadOf", "workshop:");
  }, true],
  ["accepts pushInsteadOf expansion to the approved SSH destination", ({ git }) => {
    git("config", "url.git@github.com:.pushInsteadOf", "https://github.com/");
  }, true],
  ["rejects a different push destination despite an approved fetch URL", ({ git, repository }) => {
    git("config", "remote.origin.pushurl", "https://github.com/example/wrong.git");
    assert.equal(git("remote", "get-url", "origin"), `https://github.com/${repository}.git`);
  }, false],
  ["rejects an inherited per-command pushurl override", ({ env }) => {
    env.GIT_CONFIG_COUNT = "1";
    env.GIT_CONFIG_KEY_0 = "remote.origin.pushurl";
    env.GIT_CONFIG_VALUE_0 = "https://github.com/example/wrong.git";
  }, false],
  ["rejects an unapproved second push destination", ({ git, repository }) => {
    git("config", "remote.origin.pushurl", `https://github.com/${repository}.git`);
    git("config", "--add", "remote.origin.pushurl", "https://github.com/example/wrong.git");
  }, false],
  ["rejects an unapproved first push destination", ({ git, repository }) => {
    git("config", "remote.origin.pushurl", "https://github.com/example/wrong.git");
    git("config", "--add", "remote.origin.pushurl", `https://github.com/${repository}.git`);
  }, false],
  ["rejects a different fetch URL despite an approved push destination", ({ git, repository }) => {
    git("remote", "set-url", "origin", "https://github.com/example/wrong.git");
    git("config", "remote.origin.pushurl", `https://github.com/${repository}.git`);
  }, false],
  ["rejects an unapproved additional fetch URL", ({ git }) => {
    git("config", "--add", "remote.origin.url", "https://github.com/example/wrong.git");
  }, false],
  ["rejects pushInsteadOf redirection to another host", ({ git, repository }) => {
    git("config", "url.https://unapproved.invalid/.pushInsteadOf", "https://github.com/");
    assert.equal(git("remote", "get-url", "origin"), `https://github.com/${repository}.git`);
    assert.equal(git("remote", "get-url", "--push", "--all", "origin"),
      `https://unapproved.invalid/${repository}.git`);
  }, false],
  ["rejects insteadOf redirection of an explicit pushurl", ({ git }) => {
    git("config", "remote.origin.pushurl", "redirect:wrong");
    git("config", "url.https://github.com/example/wrong.git.insteadOf", "redirect:wrong");
    assert.equal(git("remote", "get-url", "--push", "--all", "origin"),
      "https://github.com/example/wrong.git");
  }, false],
  ["rejects an empty fetch destination", ({ git, repository }) => {
    git("config", "remote.origin.url", "");
    git("config", "remote.origin.pushurl", `https://github.com/${repository}.git`);
  }, false],
  ["rejects empty effective push output", ({ git }) => {
    git("config", "remote.origin.pushurl", "\n");
    assert.equal(git("remote", "get-url", "--push", "--all", "origin"), "");
  }, false],
  ["rejects a whitespace-only push destination", ({ git }) => {
    git("config", "remote.origin.pushurl", " ");
  }, false],
  ["rejects unsupported push URL syntax", ({ git, repository }) => {
    git("config", "remote.origin.pushurl", `https://github.com.evil.invalid/${repository}.git`);
  }, false],
  ["rejects a failed origin lookup", ({ git }) => {
    git("remote", "remove", "origin");
  }, false],
];

for (const skill of skills) {
  for (const repository of [defaultRepository, "example/approved"]) {
    const target = repository === defaultRepository ? "default" : "explicit exception";
    for (const [name, configure, allowed] of cases) {
      test(`${skill} ${target}: ${name}`, (t) => {
        const checkout = fixture(t, repository);
        configure(checkout);
        const result = checkDestination(skill, checkout);
        if (allowed) {
          assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
          assert.match(result.stdout, /Origin fetch and push destinations verified/);
        } else {
          assert.notEqual(result.status, 0, result.stdout);
          assert.match(result.stderr,
            /Cannot determine all origin (?:fetch|push) destinations|Origin fetch\/push destination/);
          assert.doesNotMatch(result.stdout, /destinations verified/);
        }
      });
    }

    test(`${skill} ${target}: a fresh check rejects configuration drift before push`, (t) => {
      const checkout = fixture(t, repository);
      const before = checkDestination(skill, checkout);
      assert.equal(before.status, 0, `${before.stdout}\n${before.stderr}`);
      checkout.git("config", "remote.origin.pushurl", "https://github.com/example/wrong.git");
      const after = checkDestination(skill, checkout);
      assert.notEqual(after.status, 0, after.stdout);
      assert.match(after.stderr, /Origin fetch\/push destination/);
    });
  }
}
