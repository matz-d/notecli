import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";
import { NoteApiClient } from "@note-research/note-core";

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
              contents: [{ id: 1, name: "page 1" }],
              isLastPage: false,
              totalCount: 2,
            },
          }
        : {
            data: {
              contents: [{ id: 2, name: "page 2" }],
              isLastPage: true,
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
  const result = await client.getUserNotes("user/name", 1);

  assert.deepEqual(
    result.data.contents.map((note) => note.id),
    [1, 2]
  );
  assert.equal(result.data.totalCount, 2);
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

test("getUserNotes rejects invalid start pages before making a request", async () => {
  const client = new NoteApiClient({}, "http://127.0.0.1:1/api");
  await assert.rejects(client.getUserNotes("example", 0), /page は1以上の整数/);
});
