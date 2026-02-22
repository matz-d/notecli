#!/usr/bin/env node
import "dotenv/config";
import { createRequire } from "node:module";
import { Command } from "commander";
import {
  NoteApiClient,
  authHelpMessage,
  hasAuth,
  loadAuthState,
  maskSecret,
  saveAuthState,
} from "@note-research/note-core";
import { resolveLoginState, type AuthLoginOptions } from "./auth/login.js";
import {
  analyzeCompetitors,
  diffMineVsCompetitors,
  discoverCompetitors,
  normalizeNotes,
} from "./analysis/competitor.js";
import {
  markdownToHtml,
  projectOutput,
  printJson,
  printMarkdown,
  printResult,
  readBody,
  resolveOutputProfile,
  type CliFormat,
  type OutputProfile,
} from "./output/formatters.js";

const require = createRequire(import.meta.url);
const cliPackage = require("../package.json") as { version?: string };

const program = new Command();
program
  .name("note-research")
  .description("note競合調査CLI（下書き作成/更新まで対応）")
  .version(cliPackage.version || "0.0.0");

function getClient() {
  return new NoteApiClient(loadAuthState());
}

function handleError(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("AUTH_REQUIRED") || message.includes("AUTH_FAILED")) {
    console.error(`E_AUTH: ${authHelpMessage()}`);
    process.exit(2);
  }

  if (message.includes("INPUT_ERROR:")) {
    console.error(`E_INPUT: ${message.replace("INPUT_ERROR:", "").trim()}`);
    process.exit(3);
  }

  if (message.includes("--body") || message.includes("--id")) {
    console.error(`E_INPUT: ${message}`);
    process.exit(3);
  }

  if (message.includes("API_ERROR")) {
    console.error(`E_API: ${message}`);
    process.exit(4);
  }

  console.error(`E_RUNTIME: ${message}`);
  process.exit(1);
}

function printNeedsReport(
  query: string,
  analyzed: ReturnType<typeof analyzeCompetitors>,
  format: CliFormat,
  profile: OutputProfile
) {
  if (format === "md") {
    printMarkdown("Needs Report", [
      `- Query: ${query}`,
      `- Sample size: ${analyzed.sampleSize}`,
      "",
      "## 頻出テーマ",
      ...analyzed.topThemes.slice(0, 5).map(([theme, count], i) => `${i + 1}. ${theme} (${count})`),
      "",
      "## 構成パターン",
      `- HowTo: ${analyzed.contentPatterns.howTo}`,
      `- 比較: ${analyzed.contentPatterns.comparison}`,
      `- 事例: ${analyzed.contentPatterns.caseStudy}`,
      `- まとめ: ${analyzed.contentPatterns.listicle}`,
      `- 考察: ${analyzed.contentPatterns.opinion}`,
      `- その他: ${analyzed.contentPatterns.other}`,
      "",
      "## 反応指標分布",
      `- Min: ${analyzed.likeDistribution.min.toFixed(2)}`,
      `- Q1: ${analyzed.likeDistribution.q1.toFixed(2)}`,
      `- Median: ${analyzed.likeDistribution.median.toFixed(2)}`,
      `- Q3: ${analyzed.likeDistribution.q3.toFixed(2)}`,
      `- Max: ${analyzed.likeDistribution.max.toFixed(2)}`,
    ]);
    return;
  }
  if (profile === "full") {
    printJson({ query, ...analyzed, needs: analyzed.topThemes.slice(0, 5) });
    return;
  }
  printJson({
    query,
    sampleSize: analyzed.sampleSize,
    topThemes: analyzed.topThemes.slice(0, 5),
    contentPatterns: analyzed.contentPatterns,
    likeDistribution: analyzed.likeDistribution,
  });
}

function printGapReport(result: ReturnType<typeof diffMineVsCompetitors>, format: CliFormat, _profile: OutputProfile) {
  if (format === "md") {
    printMarkdown("Gap Report", [
      `- Mine average likes: ${result.mineAverageLikes.toFixed(2)}`,
      `- Competitor average likes: ${result.competitorAverageLikes.toFixed(2)}`,
      `- Like gap: ${result.likeGap.toFixed(2)}`,
      "",
      "## Gap Candidates",
      ...(result.gapCandidates.length
        ? result.gapCandidates.map((candidate, i) => `${i + 1}. ${candidate}`)
        : ["1. 既存テーマで差分が小さいため、訴求軸を再設計"]),
      "",
      "## Suggestions",
      ...result.suggestions.map((s, i) => `${i + 1}. ${s}`),
    ]);
    return;
  }
  printJson(result);
}

program
  .command("search-notes")
  .requiredOption("--query <query>")
  .option("--size <size>", "", "10")
  .option("--sort <sort>", "new|popular|hot", "hot")
  .option("--json", "output as json")
  .option("--format <format>", "json|md", "json")
  .option("--profile <profile>", "minimal|full", "minimal")
  .action(async (opts) => {
    try {
      const data = await getClient().searchNotes(opts.query, Number(opts.size), 0, opts.sort);
      const profile = resolveOutputProfile(opts.profile);
      const format = opts.json ? "json" : opts.format;
      printResult(projectOutput("search-notes", data, profile), format, "search-notes");
    } catch (e) {
      handleError(e);
    }
  });

program
  .command("get-note")
  .requiredOption("--id <id>")
  .option("--format <format>", "json|md", "json")
  .option("--profile <profile>", "minimal|full", "minimal")
  .action(async (opts) => {
    try {
      const data = await getClient().getNote(opts.id);
      const profile = resolveOutputProfile(opts.profile);
      printResult(projectOutput("get-note", data, profile), opts.format, "get-note");
    } catch (e) {
      handleError(e);
    }
  });

program
  .command("search-users")
  .requiredOption("--query <query>")
  .option("--size <size>", "", "10")
  .option("--format <format>", "json|md", "json")
  .option("--profile <profile>", "minimal|full", "minimal")
  .action(async (opts) => {
    try {
      const data = await getClient().searchUsers(opts.query, Number(opts.size));
      const profile = resolveOutputProfile(opts.profile);
      printResult(projectOutput("search-users", data, profile), opts.format, "search-users");
    } catch (e) {
      handleError(e);
    }
  });

program
  .command("get-user-notes")
  .requiredOption("--user <user>")
  .option("--page <page>", "", "1")
  .option("--format <format>", "json|md", "json")
  .option("--profile <profile>", "minimal|full", "minimal")
  .action(async (opts) => {
    try {
      const data = await getClient().getUserNotes(opts.user, Number(opts.page));
      const profile = resolveOutputProfile(opts.profile);
      printResult(projectOutput("get-user-notes", data, profile), opts.format, "get-user-notes");
    } catch (e) {
      handleError(e);
    }
  });

const competitor = program.command("competitor");
competitor
  .command("discover")
  .requiredOption("--query <query>")
  .option("--size <size>", "", "20")
  .option("--format <format>", "json|md", "json")
  .option("--profile <profile>", "minimal|full", "minimal")
  .action(async (opts) => {
    try {
      const data = await getClient().searchNotes(opts.query, Number(opts.size));
      const result = discoverCompetitors(normalizeNotes(data));
      const profile = resolveOutputProfile(opts.profile);
      printResult(projectOutput("competitor discover", result, profile), opts.format, "competitor discover");
    } catch (e) {
      handleError(e);
    }
  });

competitor
  .command("analyze")
  .requiredOption("--query <query>")
  .option("--size <size>", "", "40")
  .option("--format <format>", "json|md", "json")
  .option("--profile <profile>", "minimal|full", "minimal")
  .action(async (opts) => {
    try {
      const data = await getClient().searchNotes(opts.query, Number(opts.size));
      const result = analyzeCompetitors(normalizeNotes(data));
      const profile = resolveOutputProfile(opts.profile);
      printResult(projectOutput("competitor analyze", result, profile), opts.format, "competitor analyze");
    } catch (e) {
      handleError(e);
    }
  });

const diff = program.command("diff");
diff
  .command("mine-vs-competitors")
  .requiredOption("--mine-query <mineQuery>")
  .requiredOption("--competitor-query <competitorQuery>")
  .option("--format <format>", "json|md", "json")
  .option("--profile <profile>", "minimal|full", "minimal")
  .action(async (opts) => {
    try {
      const client = getClient();
      const mine = normalizeNotes(await client.searchNotes(opts.mineQuery, 20));
      const competitors = normalizeNotes(await client.searchNotes(opts.competitorQuery, 20));
      const result = diffMineVsCompetitors(mine, competitors);
      const profile = resolveOutputProfile(opts.profile);
      printResult(projectOutput("diff mine-vs-competitors", result, profile), opts.format, "diff mine-vs-competitors");
    } catch (e) {
      handleError(e);
    }
  });

const report = program.command("report");
report
  .command("needs")
  .requiredOption("--query <query>")
  .option("--format <format>", "json|md", "md")
  .option("--profile <profile>", "minimal|full", "minimal")
  .action(async (opts) => {
    try {
      const data = await getClient().searchNotes(opts.query, 30);
      const analyzed = analyzeCompetitors(normalizeNotes(data));
      const profile = resolveOutputProfile(opts.profile);
      printNeedsReport(opts.query, analyzed, opts.format, profile);
    } catch (e) {
      handleError(e);
    }
  });

report
  .command("gap")
  .requiredOption("--mine-query <mineQuery>")
  .requiredOption("--competitor-query <competitorQuery>")
  .option("--format <format>", "json|md", "md")
  .option("--profile <profile>", "minimal|full", "minimal")
  .action(async (opts) => {
    try {
      const client = getClient();
      const mine = normalizeNotes(await client.searchNotes(opts.mineQuery, 20));
      const competitors = normalizeNotes(await client.searchNotes(opts.competitorQuery, 20));
      const profile = resolveOutputProfile(opts.profile);
      printGapReport(diffMineVsCompetitors(mine, competitors), opts.format, profile);
    } catch (e) {
      handleError(e);
    }
  });

const draft = program.command("draft");
draft
  .command("create")
  .requiredOption("--title <title>")
  .option("--body <body>")
  .option("--body-file <bodyFile>")
  .option("--tags <tags>", "comma separated tags", "")
  .option("--format <format>", "json|md", "json")
  .option("--profile <profile>", "minimal|full", "minimal")
  .action(async (opts) => {
    try {
      const client = getClient();
      const body = readBody(opts.body, opts.bodyFile);
      const create = await client.createDraft(opts.title);
      const draftId = create?.data?.id;
      if (draftId == null) {
        throw new Error("AUTH_FAILED:draft_create_response_missing_id");
      }
      const id = String(draftId);
      const key = create?.data?.key || `n${id}`;
      const update = await client.updateDraft(id, opts.title, markdownToHtml(body));
      const tags = opts.tags
        ? String(opts.tags)
            .split(",")
            .map((v: string) => v.trim())
            .filter(Boolean)
        : [];
      const profile = resolveOutputProfile(opts.profile);
      const output = { id, key, tags, editUrl: `https://editor.note.com/notes/${key}/edit/`, update };
      printResult(projectOutput("draft create", output, profile), opts.format, "draft create");
    } catch (e) {
      handleError(e);
    }
  });

draft
  .command("update")
  .requiredOption("--id <id>")
  .option("--title <title>", "", "無題")
  .option("--body <body>")
  .option("--body-file <bodyFile>")
  .option("--format <format>", "json|md", "json")
  .option("--profile <profile>", "minimal|full", "minimal")
  .action(async (opts) => {
    try {
      if (!/^[0-9]+$/.test(opts.id)) throw new Error("--id は数値IDを指定してください");
      const body = readBody(opts.body, opts.bodyFile);
      const update = await getClient().updateDraft(opts.id, opts.title, markdownToHtml(body));
      const profile = resolveOutputProfile(opts.profile);
      printResult(projectOutput("draft update", { id: opts.id, update }, profile), opts.format, "draft update");
    } catch (e) {
      handleError(e);
    }
  });

const user = program.command("user");
user
  .command("analyze")
  .description("指定ユーザーの記事を取得してコンテンツ傾向を分析します")
  .requiredOption("--user <user>", "note ユーザー名 (urlname)")
  .option("--page <page>", "取得ページ番号", "1")
  .option("--format <format>", "json|md", "json")
  .option("--profile <profile>", "minimal|full", "minimal")
  .action(async (opts) => {
    try {
      const data = await getClient().getUserNotes(opts.user, Number(opts.page));
      const notes = normalizeNotes(data);
      if (notes.length === 0) {
        console.error(`E_INPUT: ユーザー "${opts.user}" の記事が見つかりませんでした`);
        process.exit(3);
      }
      const result = analyzeCompetitors(notes);
      const profile = resolveOutputProfile(opts.profile);
      printResult(
        projectOutput(`user analyze: ${opts.user}`, { user: opts.user, page: Number(opts.page), ...result }, profile),
        opts.format,
        `user analyze: ${opts.user}`
      );
    } catch (e) {
      handleError(e);
    }
  });

const auth = program.command("auth");
auth.command("status").action(() => {
  const state = loadAuthState();
  printJson({
    authenticated: hasAuth(state),
    cookie: maskSecret(state.cookie),
    xsrfToken: maskSecret(state.xsrfToken),
    userId: state.userId || "",
  });
});

auth
  .command("login")
  .option("--cookie <cookie>")
  .option("--cookie-stdin", "read cookie from stdin")
  .option("--xsrf <xsrf>")
  .option("--user-id <userId>")
  .option("--mode <mode>", "auto|browser|manual|env", "auto")
  .option("--browser", "shortcut for --mode browser")
  .option("--manual", "shortcut for --mode manual")
  .option("--env", "shortcut for --mode env")
  .action(async (opts) => {
    try {
      const state = await resolveLoginState(opts as AuthLoginOptions);
      if (!state.cookie) {
        throw new Error("INPUT_ERROR: cookie が未設定です。");
      }

      if (!state.xsrfToken) {
        const client = new NoteApiClient(state);
        state.xsrfToken = await client.hydrateXsrfToken();
      }

      saveAuthState(state);
      console.log("Saved auth session. `note-research auth status` で確認してください。");
    } catch (e) {
      handleError(e);
    }
  });

program.on("command:*", (operands: string[]) => {
  const unknown = operands && operands.length > 0 ? operands[0] : "";
  if (unknown) {
    console.error(`Unsupported command: "${unknown}"`);
  } else {
    console.error("Unsupported command.");
  }
  console.error("publish/public/post は提供していません。");
  console.error("利用可能なコマンドは --help を参照してください。");
  program.outputHelp();
  process.exit(1);
});

program.parseAsync();
