import fetch from "node-fetch";
import { AuthState, buildAuthHeaders, normalizeSessionCookie } from "./auth.js";

const DEFAULT_USER_AGENT = process.env.NOTECLI_USER_AGENT || "note-research-cli/0.2.0";

function extractXsrfFromSetCookie(setCookies: string[] | undefined): string | undefined {
  if (!setCookies || setCookies.length === 0) return undefined;
  for (const cookie of setCookies) {
    const match = cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/i);
    if (match?.[1]) {
      try {
        return decodeURIComponent(match[1]);
      } catch {
        return match[1];
      }
    }
  }
  return undefined;
}

function decodeToken(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  try {
    return decodeURIComponent(trimmed);
  } catch {
    return trimmed;
  }
}

function extractXsrfFromCookieHeader(cookieHeader: string | undefined): string | undefined {
  if (!cookieHeader) return undefined;
  const xsrfPair = cookieHeader
    .split(";")
    .map((v) => v.trim())
    .find((v) => /^XSRF-TOKEN=/i.test(v));
  if (!xsrfPair) return undefined;
  return decodeToken(xsrfPair.replace(/^XSRF-TOKEN=/i, ""));
}

async function extractXsrfFromResponse(res: any): Promise<string | undefined> {
  const headerToken = decodeToken(
    res.headers.get("x-xsrf-token")?.trim() || res.headers.get("x-csrf-token")?.trim()
  );
  if (headerToken) return headerToken;

  const rawHeaders = res.headers as unknown as { raw?: () => Record<string, string[]> };
  const cookieToken = extractXsrfFromSetCookie(rawHeaders.raw?.()["set-cookie"]);
  if (cookieToken) return cookieToken;

  const contentType = res.headers.get("content-type") || "";
  const body = await res.text();
  const htmlTokenMatch =
    body.match(/name=["']csrf-token["'][^>]*content=["']([^"']+)["']/i) ||
    body.match(/content=["']([^"']+)["'][^>]*name=["']csrf-token["']/i);
  if (htmlTokenMatch?.[1]) {
    return decodeToken(htmlTokenMatch[1]);
  }

  if (contentType.includes("application/json")) {
    try {
      const parsed = JSON.parse(body);
      const jsonToken =
        decodeToken(parsed?.data?.csrfToken) ||
        decodeToken(parsed?.data?.xsrfToken) ||
        decodeToken(parsed?.csrfToken) ||
        decodeToken(parsed?.xsrfToken);
      if (jsonToken) return jsonToken;
    } catch {
      // ignore JSON parse errors for non-JSON responses
    }
  }

  return undefined;
}

export class NoteApiClient {
  constructor(
    private readonly auth: AuthState,
    private readonly baseUrl: string = "https://note.com/api"
  ) {}

  async hydrateXsrfToken(): Promise<string | undefined> {
    const cookie = normalizeSessionCookie(this.auth.cookie);
    if (!cookie) return undefined;
    if (this.auth.xsrfToken) return this.auth.xsrfToken;
    const fromCookieHeader = extractXsrfFromCookieHeader(cookie);
    if (fromCookieHeader) {
      this.auth.xsrfToken = fromCookieHeader;
      return fromCookieHeader;
    }

    const endpoints = [
      `${this.baseUrl}/v2/current_user`,
      `${this.baseUrl}/v2/session`,
      "https://editor.note.com/",
      "https://editor.note.com/api/v2/session",
      "https://note.com/",
    ];

    for (const url of endpoints) {
      try {
        const res = await fetch(url, {
          method: "GET",
          headers: {
            accept: "application/json, text/html;q=0.9,*/*;q=0.8",
            "user-agent": DEFAULT_USER_AGENT,
            cookie,
            referer: "https://editor.note.com/",
          },
        });
        const token = await extractXsrfFromResponse(res);
        if (token) {
          this.auth.xsrfToken = token;
          return token;
        }
      } catch {
        // continue fallback chain
      }
    }

    return undefined;
  }

  async request(endpoint: string, method = "GET", body?: unknown, requireAuth = false): Promise<any> {
    if (requireAuth) {
      const cookie = normalizeSessionCookie(this.auth.cookie);
      if (!cookie) {
        throw new Error("AUTH_REQUIRED");
      }
      this.auth.cookie = cookie;
      if (!this.auth.xsrfToken) {
        await this.hydrateXsrfToken();
      }
      // XSRF はベストエフォート。未取得でも一度APIを実行してみる。
      // note側の応答が 401/403 の場合は AUTH_FAILED として返る。
    }

    const headers: Record<string, string> = {
      accept: "application/json",
      "content-type": "application/json",
      "user-agent": DEFAULT_USER_AGENT,
      ...buildAuthHeaders(this.auth),
    };

    if (method === "POST" || method === "PUT") {
      headers.origin = "https://editor.note.com";
      headers.referer = "https://editor.note.com/";
      headers["x-requested-with"] = "XMLHttpRequest";
    }

    const res = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const message = await res.text();
      if (res.status === 401 || res.status === 403) {
        throw new Error(`AUTH_FAILED:${message}`);
      }
      throw new Error(`API_ERROR:${res.status}:${message}`);
    }

    return res.json();
  }

  searchNotes(query: string, size = 10, start = 0, sort: "new" | "popular" | "hot" = "hot") {
    return this.request(
      `/v3/searches?context=note&q=${encodeURIComponent(query)}&size=${size}&start=${start}&sort=${sort}`,
      "GET",
      undefined,
      false
    );
  }

  getNote(noteId: string) {
    const params = new URLSearchParams({ draft: "true", draft_reedit: "false" });
    return this.request(`/v3/notes/${noteId}?${params.toString()}`, "GET", undefined, true);
  }

  searchUsers(query: string, size = 10, start = 0) {
    return this.request(
      `/v3/searches?context=user&q=${encodeURIComponent(query)}&size=${size}&start=${start}`,
      "GET",
      undefined,
      false
    );
  }

  getUserNotes(username: string, page = 1) {
    return this.request(`/v2/creators/${username}/contents?kind=note&page=${page}`, "GET", undefined, false);
  }

  createDraft(title: string) {
    return this.request(
      "/v1/text_notes",
      "POST",
      { body: "<p></p>", body_length: 0, name: title, index: false, is_lead_form: false },
      true
    );
  }

  updateDraft(id: string, title: string, htmlBody: string) {
    return this.request(
      `/v1/text_notes/draft_save?id=${id}&is_temp_saved=true`,
      "POST",
      { body: htmlBody, body_length: htmlBody.length, name: title, index: false, is_lead_form: false },
      true
    );
  }
}
