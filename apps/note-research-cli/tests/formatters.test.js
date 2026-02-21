import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { markdownToHtml, printResult, readBody } from "../dist/output/formatters.js";

test("markdownToHtml converts headings and paragraphs", () => {
  const html = markdownToHtml("# Title\n\nbody line1\nbody line2");
  assert.match(html, /<h1>Title<\/h1>/);
  assert.match(html, /<p>body line1<br>body line2<\/p>/);
});

test("markdownToHtml escapes HTML special characters in headings", () => {
  const html = markdownToHtml("# <script>alert(1)</script>");
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});

test("markdownToHtml escapes HTML special characters in paragraphs", () => {
  const html = markdownToHtml('<img src=x onerror=alert(1)>\n\n<b>bold</b>');
  assert.doesNotMatch(html, /<img/);
  assert.doesNotMatch(html, /<b>/);
  assert.match(html, /&lt;img/);
  assert.match(html, /&lt;b&gt;/);
});

test("readBody loads from file when body is omitted", () => {
  const tempPath = path.join(os.tmpdir(), "note-research-read-body-test.md");
  fs.writeFileSync(tempPath, "from-file", "utf-8");
  assert.equal(readBody(undefined, tempPath), "from-file");
  fs.unlinkSync(tempPath);
});

test("printResult outputs json and markdown wrapper", () => {
  const lines = [];
  const originalLog = console.log;
  console.log = (...args) => lines.push(args.join(" "));
  try {
    printResult({ ok: true }, "json", "Result");
    printResult({ ok: true }, "md", "Result");
  } finally {
    console.log = originalLog;
  }
  const output = lines.join("\n");
  assert.match(output, /"ok": true/);
  assert.match(output, /# Result/);
  assert.match(output, /```json/);
});
