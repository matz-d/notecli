import fs from "fs";
import os from "os";
import path from "path";

function getSessionDir(): string {
  return path.join(os.homedir(), ".note-research");
}

function getSessionFile(): string {
  return path.join(getSessionDir(), "session.json");
}

export interface AuthState {
  cookie?: string;
  xsrfToken?: string;
  userId?: string;
}

export function normalizeSessionCookie(cookie?: string): string {
  if (!cookie) return "";
  const value = cookie.trim();
  if (!value) return "";
  if (value.includes("=")) return value;
  return `_note_session_v5=${value}`;
}

function loadAuthStateFromEnv(): AuthState {
  return {
    cookie: normalizeSessionCookie(process.env.NOTE_SESSION_V5),
    xsrfToken: process.env.NOTE_XSRF_TOKEN,
    userId: process.env.NOTE_USER_ID,
  };
}

export function loadAuthState(): AuthState {
  const envState = loadAuthStateFromEnv();

  if (fs.existsSync(getSessionFile())) {
    try {
      const raw = fs.readFileSync(getSessionFile(), "utf-8");
      const parsed = JSON.parse(raw) as AuthState;
      return {
        cookie: parsed.cookie ?? envState.cookie,
        xsrfToken: parsed.xsrfToken ?? envState.xsrfToken,
        userId: parsed.userId ?? envState.userId,
      };
    } catch {
      return envState;
    }
  }

  return envState;
}

export function saveAuthState(state: AuthState): void {
  fs.mkdirSync(getSessionDir(), { recursive: true, mode: 0o700 });
  fs.writeFileSync(getSessionFile(), JSON.stringify(state, null, 2), { mode: 0o600 });
}

export function buildAuthHeaders(state: AuthState): Record<string, string> {
  const headers: Record<string, string> = {};
  const cookie = normalizeSessionCookie(state.cookie);
  if (cookie) {
    headers.cookie = cookie;
  }
  if (state.xsrfToken) {
    headers["x-csrf-token"] = state.xsrfToken;
    headers["x-xsrf-token"] = state.xsrfToken;
  }
  if (state.userId) {
    headers["x-note-user-id"] = state.userId;
  }
  return headers;
}

export function maskSecret(value?: string): string {
  if (!value) return "";
  if (value.length <= 8) return "***";
  return `${value.slice(0, 4)}***${value.slice(-4)}`;
}

export function hasAuth(state: AuthState): boolean {
  return Boolean(normalizeSessionCookie(state.cookie));
}

export function authHelpMessage(): string {
  return "認証が必要です。`note-research auth login --cookie \"...\" [--xsrf \"...\"] [--user-id ...]` を実行してください。";
}
