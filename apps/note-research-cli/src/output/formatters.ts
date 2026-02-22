import fs from "fs";

export type CliFormat = "json" | "md";
export type OutputProfile = "minimal" | "full";

type UnknownRecord = Record<string, any>;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

export function printMarkdown(title: string, lines: string[]): void {
  console.log(`# ${title}`);
  console.log("");
  for (const line of lines) {
    console.log(line);
  }
}

export function printResult(value: unknown, format: CliFormat = "json", title = "Result"): void {
  if (format === "md") {
    printMarkdown(title, ["```json", JSON.stringify(value, null, 2), "```"]);
    return;
  }
  printJson(value);
}

function getNotesFromPayload(payload: any): any[] {
  const notes = payload?.data?.notes;
  if (Array.isArray(notes)) return notes;
  if (Array.isArray(notes?.contents)) return notes.contents;
  return [];
}

function noteUrl(note: any): string {
  if (typeof note?.external_url === "string" && note.external_url) return note.external_url;
  const urlname = note?.user?.urlname;
  const key = note?.key || note?.id;
  if (urlname && key) return `https://note.com/${urlname}/n/${key}`;
  if (key) return `https://note.com/n/${key}`;
  return "";
}

function minimalNote(note: any): UnknownRecord {
  return {
    id: note?.id ? String(note.id) : "",
    key: note?.key || "",
    title: note?.name || note?.title || "(untitled)",
    url: noteUrl(note),
    publishedAt: note?.publish_at || note?.publishAt || "",
    likes: Number(note?.likeCount ?? note?.like_count ?? note?.like?.count ?? 0),
    comments: Number(note?.comment_count ?? note?.commentsCount ?? note?.comments_count ?? note?.comments?.count ?? 0),
    author: {
      name: note?.user?.name || note?.user?.nickname || "",
      urlname: note?.user?.urlname || "",
    },
  };
}

function toMinimalSearchNotes(payload: any): UnknownRecord {
  const notes = getNotesFromPayload(payload).map(minimalNote);
  return {
    count: notes.length,
    nextCursor: payload?.data?.note_cursor || "",
    notes,
  };
}

function toMinimalGetUserNotes(payload: any): UnknownRecord {
  const notes = getNotesFromPayload(payload).map(minimalNote);
  return {
    count: notes.length,
    notes,
  };
}

function toMinimalGetNote(payload: any): UnknownRecord {
  const note = payload?.data?.note ?? payload?.data ?? payload;
  if (!note || typeof note !== "object") return { note: null };
  return {
    note: {
      ...minimalNote(note),
      body: typeof note?.body === "string" ? note.body : "",
      status: note?.status || "",
      canRead: Boolean(note?.can_read ?? true),
    },
  };
}

function toMinimalSearchUsers(payload: any): UnknownRecord {
  const users = Array.isArray(payload?.data?.users) ? payload.data.users : [];
  return {
    count: users.length,
    users: users.map((user: any) => ({
      id: user?.id ? String(user.id) : "",
      urlname: user?.urlname || "",
      name: user?.name || user?.nickname || "",
    })),
  };
}

function toMinimalDraftCreate(payload: any): UnknownRecord {
  return {
    success: Boolean(payload?.update?.data?.result),
    id: payload?.id ? String(payload.id) : "",
    key: payload?.key || "",
    editUrl: payload?.editUrl || "",
    tags: Array.isArray(payload?.tags) ? payload.tags : [],
    updatedAt: payload?.update?.data?.updated_at || "",
  };
}

function toMinimalDraftUpdate(payload: any): UnknownRecord {
  return {
    success: Boolean(payload?.update?.data?.result),
    id: payload?.id ? String(payload.id) : "",
    updatedAt: payload?.update?.data?.updated_at || "",
  };
}

export function resolveOutputProfile(profile?: string): OutputProfile {
  if (!profile || profile === "minimal") return "minimal";
  if (profile === "full") return "full";
  throw new Error(`INPUT_ERROR: --profile は minimal|full を指定してください (received: ${profile})`);
}

export function projectOutput(command: string, payload: unknown, profile: OutputProfile): unknown {
  if (profile === "full") return payload;

  if (command === "search-notes") return toMinimalSearchNotes(payload);
  if (command === "get-note") return toMinimalGetNote(payload);
  if (command === "search-users") return toMinimalSearchUsers(payload);
  if (command === "get-user-notes") return toMinimalGetUserNotes(payload);
  if (command === "draft create") return toMinimalDraftCreate(payload);
  if (command === "draft update") return toMinimalDraftUpdate(payload);

  return payload;
}

export function readBody(body?: string, bodyFile?: string): string {
  if (body) return body;
  if (!bodyFile) {
    throw new Error("--body または --body-file が必要です");
  }
  return fs.readFileSync(bodyFile, "utf-8");
}

export function markdownToHtml(markdown: string): string {
  const trimmed = markdown.trim();
  if (!trimmed) return "";

  const blocks = trimmed.split(/\n{2,}/);
  return blocks
    .map((block) => {
      const h3 = block.match(/^### (.*)$/);
      if (h3) return `<h3>${escapeHtml(h3[1])}</h3>`;

      const h2 = block.match(/^## (.*)$/);
      if (h2) return `<h2>${escapeHtml(h2[1])}</h2>`;

      const h1 = block.match(/^# (.*)$/);
      if (h1) return `<h1>${escapeHtml(h1[1])}</h1>`;

      return `<p>${escapeHtml(block).replace(/\n/g, "<br>")}</p>`;
    })
    .join("");
}
