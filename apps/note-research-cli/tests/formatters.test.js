import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { markdownToHtml, printResult, projectOutput, readBody, resolveOutputProfile } from "../dist/output/formatters.js";

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

test("resolveOutputProfile validates profile values", () => {
  assert.equal(resolveOutputProfile(undefined), "minimal");
  assert.equal(resolveOutputProfile("minimal"), "minimal");
  assert.equal(resolveOutputProfile("full"), "full");
  assert.throws(() => resolveOutputProfile("invalid"), /--profile/);
});

test("projectOutput trims search-notes to minimal fields by default", () => {
  const payload = {
    data: {
      note_cursor: "5",
      notes: {
        contents: [
          {
            id: 1,
            key: "n1",
            name: "title",
            publish_at: "2026-01-01",
            like_count: 10,
            comment_count: 2,
            user: { name: "u1", urlname: "user1" },
            body: "ignore",
            eyecatch: "ignore",
          },
        ],
      },
    },
  };

  const minimal = projectOutput("search-notes", payload, "minimal");
  assert.deepEqual(minimal, {
    count: 1,
    nextCursor: "5",
    notes: [
      {
        id: "1",
        key: "n1",
        title: "title",
        url: "https://note.com/user1/n/n1",
        publishedAt: "2026-01-01",
        likes: 10,
        comments: 2,
        author: { name: "u1", urlname: "user1" },
      },
    ],
  });

  const full = projectOutput("search-notes", payload, "full");
  assert.deepEqual(full, payload);
});

test("projectOutput returns concise draft create payload", () => {
  const payload = {
    id: "123",
    key: "n123",
    tags: ["a"],
    editUrl: "https://editor.note.com/notes/n123/edit/",
    update: {
      data: { result: true, updated_at: "2026-02-22T00:00:00.000+09:00" },
    },
  };

  assert.deepEqual(projectOutput("draft create", payload, "minimal"), {
    success: true,
    id: "123",
    key: "n123",
    editUrl: "https://editor.note.com/notes/n123/edit/",
    tags: ["a"],
    updatedAt: "2026-02-22T00:00:00.000+09:00",
  });
});
