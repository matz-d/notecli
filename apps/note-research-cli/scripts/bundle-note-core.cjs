#!/usr/bin/env node
/**
 * bundle-note-core.cjs
 *
 * note-core をビルド → pack → CLI の node_modules にインストールし、
 * 推移的依存（node-fetch 等）も含めてバンドル可能な状態にする。
 *
 * Bug fixes:
 *  1. execFileSync('npm.cmd') → execSync('npm ...') でシェル経由実行
 *     (Windows Git Bash での EINVAL 回避)
 *  2. note-core install 後に推移的依存を解決
 *     (node-fetch 等が tgz に含まれるようにする)
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const CLI_DIR = path.resolve(__dirname, "..");
const VENDOR_DIR = path.join(CLI_DIR, ".vendor");
const NOTE_CORE_DIR = path.resolve(CLI_DIR, "../../packages/note-core");

// ---------- 1. .vendor/ 準備 ----------
fs.mkdirSync(VENDOR_DIR, { recursive: true });
for (const f of fs.readdirSync(VENDOR_DIR)) {
  if (/^note-research-note-core-.*\.tgz$/.test(f)) {
    fs.rmSync(path.join(VENDOR_DIR, f));
  }
}

// ---------- 2. note-core ビルド ----------
console.log("[bundle] Building note-core...");
execSync("npm run build", { cwd: NOTE_CORE_DIR, stdio: "inherit" });

// ---------- 3. npm pack ----------
console.log("[bundle] Packing note-core...");
execSync(`npm pack --pack-destination "${VENDOR_DIR}"`, {
  cwd: NOTE_CORE_DIR,
  stdio: "inherit",
});

// ---------- 4. tgz を特定 ----------
const tarballs = fs
  .readdirSync(VENDOR_DIR)
  .filter((f) => /^note-research-note-core-.*\.tgz$/.test(f))
  .sort(
    (a, b) =>
      fs.statSync(path.join(VENDOR_DIR, b)).mtimeMs -
      fs.statSync(path.join(VENDOR_DIR, a)).mtimeMs
  );

if (!tarballs.length) {
  throw new Error("note-core tarball not found in .vendor/");
}
const tarball = path.join(VENDOR_DIR, tarballs[0]);

// ---------- 5. CLI に note-core をインストール ----------
console.log(`[bundle] Installing ${tarballs[0]} into CLI...`);
execSync(`npm install --no-save --ignore-scripts "${tarball}"`, {
  cwd: CLI_DIR,
  stdio: "inherit",
});

// ---------- 6. 推移的依存を解決 (Bug 2 fix) ----------
const noteCoreInModules = path.join(
  CLI_DIR,
  "node_modules",
  "@note-research",
  "note-core"
);
if (fs.existsSync(noteCoreInModules)) {
  console.log("[bundle] Installing transitive dependencies for note-core...");
  execSync("npm install --omit=dev", {
    cwd: noteCoreInModules,
    stdio: "inherit",
  });
} else {
  throw new Error(
    `note-core not found at ${noteCoreInModules} after install`
  );
}

console.log("[bundle] Done.");
