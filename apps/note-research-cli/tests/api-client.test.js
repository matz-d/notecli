import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";
import { NoteApiClient } from "@note-research/note-core";
import { analyzeCompetitors, normalizeNotes } from "../dist/analysis/competitor.js";

test("getUserNotes aggregates creator contents until the last page", async (t) => {
  const requests = [];
  const server = http.createServer((req, res) => {
    requests.push({ method: req.method, url: req.url });
    const url = new URL(req.url, "http://localhost");
    const page = Number(url.searchParams.get("page"));
    const payload =
      page === 1
        ? {
            data: {
              contents: [
                { id: 7, name: "note 7", likeCount: 0 },
                { id: 6, name: "note 6", likeCount: 0 },
                { id: 5, name: "note 5", likeCount: 0 },
                { id: 4, name: "note 4", likeCount: 0 },
                { id: 3, name: "note 3", likeCount: 0 },
                { id: 2, name: "note 2", likeCount: 60 },
              ],
              isLastPage: false,
              totalCount: 7,
            },
          }
        : {
            data: {
              contents: [
                { id: 2, name: "note 2", likeCount: 60 },
                { id: 1, name: "note 1", likeCount: 0 },
              ],
              isLastPage: true,
              totalCount: 7,
            },
          };

    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(payload));
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => server.close());

  const address = server.address();
  assert.ok(address && typeof address === "object");
  const client = new NoteApiClient({}, `http://127.0.0.1:${address.port}/api`);
  const result = await client.getUserNotes("user/name", 1);

  assert.deepEqual(
    result.data.contents.map((note) => note.id),
    [7, 6, 5, 4, 3, 2, 1]
  );
  assert.equal(result.data.totalCount, 7);
  const analysis = analyzeCompetitors(normalizeNotes(result));
  assert.equal(analysis.sampleSize, 7);
  assert.equal(analysis.likeDistribution.q3, 0);
  assert.deepEqual(requests, [
    {
      method: "GET",
      url: "/api/v2/creators/user%2Fname/contents?kind=note&page=1",
    },
    {
      method: "GET",
      url: "/api/v2/creators/user%2Fname/contents?kind=note&page=2",
    },
  ]);
});

test("getUserNotes falls back to the note key when id is missing", async (t) => {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    const page = Number(url.searchParams.get("page"));
    const payload = {
      data: {
        contents:
          page === 1
            ? [{ key: "n2", name: "first seen" }]
            : [
                { key: "n2", name: "duplicate" },
                { key: "n1", name: "new note" },
              ],
        isLastPage: page === 2,
        totalCount: 2,
      },
    };
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(payload));
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => server.close());

  const address = server.address();
  assert.ok(address && typeof address === "object");
  const client = new NoteApiClient({}, `http://127.0.0.1:${address.port}/api`);
  const result = await client.getUserNotes("example");

  assert.deepEqual(
    result.data.contents.map((note) => note.name),
    ["first seen", "new note"]
  );
});

test("getUserNotes rejects invalid start pages before making a request", async () => {
  const client = new NoteApiClient({}, "http://127.0.0.1:1/api");
  await assert.rejects(client.getUserNotes("example", 0), /page は1以上の整数/);
});
