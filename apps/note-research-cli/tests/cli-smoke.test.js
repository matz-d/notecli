import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cliPath = path.resolve(__dirname, "../dist/main.js");

function runCli(args, envOverrides = {}) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    encoding: "utf-8",
    env: {
      ...process.env,
      NOTE_SESSION_V5: "",
      NOTE_XSRF_TOKEN: "",
      NOTE_USER_ID: "",
      ...envOverrides,
    },
  });
}

test("CLI help contains primary command groups", () => {
  const result = runCli(["--help"]);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /search-notes/);
  assert.match(result.stdout, /competitor/);
  assert.match(result.stdout, /report/);
  assert.match(result.stdout, /draft/);
  assert.match(result.stdout, /user/);
  assert.doesNotMatch(result.stdout, /\bpublish\b/);
});

test("CLI version command works", () => {
  const result = runCli(["--version"]);
  assert.equal(result.status, 0);
  assert.match(result.stdout.trim(), /^0\.2\.0$/);
});

test("user analyze requires --user option", () => {
  const result = runCli(["user", "analyze"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr + result.stdout, /--user/);
});

test("publish command is blocked", () => {
  const result = runCli(["publish"]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unsupported command/);
  assert.match(result.stderr, /publish\/public\/post は提供していません/);
});

test("draft update requires numeric id", () => {
  const result = runCli(["draft", "update", "--id", "abc", "--body", "x"]);
  assert.equal(result.status, 3);
  assert.match(result.stderr, /E_INPUT/);
});

test("auth login without credentials fails on non-interactive stdin", () => {
  const result = runCli(["auth", "login"]);
  assert.equal(result.status, 3);
  assert.match(result.stderr, /E_INPUT/);
  assert.match(result.stderr, /認証情報が不足/);
});

test("auth login supports env mode", () => {
  const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "note-research-cli-auth-"));
  try {
    const login = runCli(["auth", "login", "--mode", "env"], {
      HOME: tmpHome,
      USERPROFILE: tmpHome,
      NOTE_SESSION_V5: "session_from_env",
      NOTE_XSRF_TOKEN: "xsrf_from_env",
      NOTE_USER_ID: "user_from_env",
    });
    assert.equal(login.status, 0);

    const status = runCli(["auth", "status"], { HOME: tmpHome, USERPROFILE: tmpHome });
    assert.equal(status.status, 0);
    assert.match(status.stdout, /"authenticated": true/);
    assert.match(status.stdout, /"userId": "user_from_env"/);
  } finally {
    fs.rmSync(tmpHome, { recursive: true, force: true });
  }
});
