import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { normalizeSessionCookie, hasAuth, saveAuthState } from "@note-research/note-core";

test("normalizeSessionCookie keeps full cookie header", () => {
  const cookie = "_note_session_v5=abc123";
  assert.equal(normalizeSessionCookie(cookie), cookie);
});

test("normalizeSessionCookie wraps raw session token", () => {
  assert.equal(normalizeSessionCookie("abc123"), "_note_session_v5=abc123");
});

test("hasAuth evaluates normalized cookie and xsrf", () => {
  assert.equal(hasAuth({ cookie: "abc123", xsrfToken: "token" }), true);
  assert.equal(hasAuth({ cookie: "abc123", xsrfToken: "" }), true);
  assert.equal(hasAuth({ cookie: "", xsrfToken: "token" }), false);
});

test("saveAuthState creates session file with mode 0o600", () => {
  const origHome = process.env.HOME;
  const origUserProfile = process.env.USERPROFILE;
  const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "note-research-auth-test-"));
  try {
    process.env.HOME = tmpHome;
    process.env.USERPROFILE = tmpHome;
    saveAuthState({ cookie: "test_cookie", xsrfToken: "test_xsrf" });
    const sessionFile = path.join(tmpHome, ".note-research", "session.json");
    const stat = fs.statSync(sessionFile);
    const dirStat = fs.statSync(path.join(tmpHome, ".note-research"));
    if (process.platform === "win32") {
      assert.ok(stat.isFile());
      assert.ok(dirStat.isDirectory());
    } else {
      const mode = stat.mode & 0o777;
      assert.equal(mode, 0o600, `session.json should be 0o600 but got ${mode.toString(8)}`);
      const dirMode = dirStat.mode & 0o777;
      assert.equal(dirMode, 0o700, `.note-research dir should be 0o700 but got ${dirMode.toString(8)}`);
    }
  } finally {
    process.env.HOME = origHome;
    process.env.USERPROFILE = origUserProfile;
    fs.rmSync(tmpHome, { recursive: true, force: true });
  }
});
