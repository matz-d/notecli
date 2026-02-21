import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cliPath = path.resolve(__dirname, "../dist/main.js");

function runCli(args) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    encoding: "utf-8",
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
