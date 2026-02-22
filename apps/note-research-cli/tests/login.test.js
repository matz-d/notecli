import test from "node:test";
import assert from "node:assert/strict";
import { chromiumInstallHintForError } from "../dist/auth/login.js";

test("chromiumInstallHintForError returns install hint for missing executable errors", () => {
  const message =
    "browserType.launch: Executable doesn't exist at C:\\Users\\user\\AppData\\Local\\ms-playwright\\chromium\\chrome.exe";
  const hint = chromiumInstallHintForError(message);
  assert.match(hint || "", /npx playwright install chromium/);
});

test("chromiumInstallHintForError returns null for unrelated errors", () => {
  const hint = chromiumInstallHintForError("network timeout");
  assert.equal(hint, null);
});
