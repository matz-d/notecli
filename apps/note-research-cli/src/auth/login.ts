import process from "node:process";
import readline from "node:readline/promises";
import { createRequire } from "node:module";
import { AuthState, normalizeSessionCookie } from "@note-research/note-core";

type LoginMode = "auto" | "browser" | "manual" | "env";

export interface AuthLoginOptions {
  cookie?: string;
  cookieStdin?: boolean;
  xsrf?: string;
  userId?: string;
  mode?: string;
  browser?: boolean;
  manual?: boolean;
  env?: boolean;
}

function clean(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function isInteractive(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

function toInputError(message: string): Error {
  return new Error(`INPUT_ERROR: ${message}`);
}

function toRuntimeMessage(error: unknown): string {
  if (error instanceof Error && typeof error.message === "string") {
    return error.message;
  }
  return String(error);
}

export function chromiumInstallHintForError(message: string): string | null {
  if (message.includes("Executable doesn't exist") || message.includes("Please run the following command")) {
    return "Playwright のブラウザ実体が見つかりません。`npx playwright install chromium` を実行してください。";
  }
  return null;
}

function resolveMode(opts: AuthLoginOptions): LoginMode {
  const flagModes: LoginMode[] = [];
  if (opts.browser) flagModes.push("browser");
  if (opts.manual) flagModes.push("manual");
  if (opts.env) flagModes.push("env");

  const modeFromOption = clean(opts.mode);
  if (modeFromOption && modeFromOption !== "auto") {
    if (modeFromOption !== "browser" && modeFromOption !== "manual" && modeFromOption !== "env") {
      throw toInputError(`--mode は auto|browser|manual|env を指定してください (received: ${modeFromOption})`);
    }
    flagModes.push(modeFromOption);
  }

  const uniqueModes = Array.from(new Set(flagModes));
  if (uniqueModes.length > 1) {
    throw toInputError("--browser/--manual/--env/--mode は同時に1つだけ指定できます。");
  }

  if (uniqueModes.length === 1) {
    return uniqueModes[0];
  }

  if (clean(opts.cookie) || opts.cookieStdin) {
    return "manual";
  }

  return "auto";
}

async function promptSelectMode(): Promise<LoginMode> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    console.log("認証モードを選択してください:");
    console.log("1) Browser login (Playwright, recommended)");
    console.log("2) Manual input (_note_session_v5 / XSRF)");
    console.log("3) Environment variables (NOTE_SESSION_V5 / NOTE_XSRF_TOKEN)");
    const answer = (await rl.question("Select [1/2/3] (default: 1): ")).trim();
    if (answer === "" || answer === "1") return "browser";
    if (answer === "2") return "manual";
    if (answer === "3") return "env";
    throw toInputError("不正な選択です。1 / 2 / 3 を指定してください。");
  } finally {
    rl.close();
  }
}

async function readCookieFromStdin(): Promise<string> {
  if (process.stdin.isTTY) {
    throw toInputError("--cookie-stdin はパイプ入力時に使用してください。");
  }
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  const value = Buffer.concat(chunks).toString("utf-8").trim();
  if (!value) {
    throw toInputError("標準入力から cookie を読み取れませんでした。");
  }
  return value;
}

async function promptManualFields(): Promise<{ cookie: string; xsrf?: string; userId?: string }> {
  if (!isInteractive()) {
    throw toInputError("cookie が未指定です。`--cookie` または `--cookie-stdin` を指定してください。");
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const cookie = (await rl.question("Cookie (_note_session_v5 value or full key=value): ")).trim();
    const xsrf = clean(await rl.question("XSRF token (optional): "));
    const userId = clean(await rl.question("User ID (optional): "));
    return { cookie, xsrf, userId };
  } finally {
    rl.close();
  }
}

async function resolveManualState(opts: AuthLoginOptions): Promise<AuthState> {
  if (opts.cookie && opts.cookieStdin) {
    throw toInputError("--cookie と --cookie-stdin は同時に指定できません。");
  }

  let cookieValue = clean(opts.cookie);
  if (opts.cookieStdin) {
    cookieValue = clean(await readCookieFromStdin());
  }

  let xsrfToken = clean(opts.xsrf);
  let userId = clean(opts.userId);

  if (!cookieValue) {
    const prompted = await promptManualFields();
    cookieValue = clean(prompted.cookie);
    xsrfToken = xsrfToken || prompted.xsrf;
    userId = userId || prompted.userId;
  }

  const cookie = normalizeSessionCookie(cookieValue);
  if (!cookie) {
    throw toInputError("cookie が空です。");
  }

  return { cookie, xsrfToken, userId };
}

function resolveEnvState(opts: AuthLoginOptions): AuthState {
  const cookie = normalizeSessionCookie(process.env.NOTE_SESSION_V5);
  if (!cookie) {
    throw toInputError("--mode env を使うには NOTE_SESSION_V5 を設定してください。");
  }

  return {
    cookie,
    xsrfToken: clean(opts.xsrf) || clean(process.env.NOTE_XSRF_TOKEN),
    userId: clean(opts.userId) || clean(process.env.NOTE_USER_ID),
  };
}

function decodeToken(value?: string): string | undefined {
  const token = clean(value);
  if (!token) return undefined;
  try {
    return decodeURIComponent(token);
  } catch {
    return token;
  }
}

async function waitForEnter(message: string): Promise<void> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    await rl.question(message);
  } finally {
    rl.close();
  }
}

async function resolveBrowserState(opts: AuthLoginOptions): Promise<AuthState> {
  if (!isInteractive()) {
    throw toInputError("--mode browser は対話端末で実行してください。");
  }

  const require = createRequire(import.meta.url);
  let playwright: any;
  try {
    playwright = require("playwright");
  } catch {
    throw toInputError(
      "browser モードには playwright が必要です。`npm install -w note-research-cli playwright` を実行してください。"
    );
  }

  let browser: any;
  try {
    try {
      browser = await playwright.chromium.launch({ headless: false });
    } catch (error) {
      const message = toRuntimeMessage(error);
      const hint = chromiumInstallHintForError(message);
      if (hint) throw toInputError(hint);
      throw error;
    }
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto("https://note.com/login", { waitUntil: "domcontentloaded" });
    console.log("ブラウザを起動しました。note.com でログインを完了してください。");
    await waitForEnter("ログイン完了後に Enter を押してください: ");

    const cookies = (await context.cookies(["https://note.com", "https://editor.note.com"])) as Array<{
      name: string;
      value: string;
    }>;

    const noteSession = cookies.find((cookie) => cookie.name === "_note_session_v5")?.value;
    if (!noteSession) {
      throw toInputError(
        "_note_session_v5 cookie を取得できませんでした。ログイン状態を確認し、再度 `auth login --browser` を実行してください。"
      );
    }

    const xsrfToken =
      clean(opts.xsrf) ||
      decodeToken(cookies.find((cookie) => cookie.name.toUpperCase() === "XSRF-TOKEN")?.value);
    const userId = clean(opts.userId) || clean(process.env.NOTE_USER_ID);

    return {
      cookie: normalizeSessionCookie(noteSession),
      xsrfToken,
      userId,
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

export async function resolveLoginState(opts: AuthLoginOptions): Promise<AuthState> {
  let mode = resolveMode(opts);
  if (mode === "auto") {
    if (clean(process.env.NOTE_SESSION_V5)) {
      mode = "env";
    } else if (isInteractive()) {
      mode = await promptSelectMode();
    } else {
      throw toInputError(
        "認証情報が不足しています。`--cookie` / `--cookie-stdin` / `--mode env` / `--browser` のいずれかを指定してください。"
      );
    }
  }

  if (mode === "manual") {
    return resolveManualState(opts);
  }
  if (mode === "env") {
    return resolveEnvState(opts);
  }
  return resolveBrowserState(opts);
}
