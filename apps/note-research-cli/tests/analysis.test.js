import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  analyzeCompetitors,
  diffMineVsCompetitors,
  normalizeNotes,
} from "../dist/analysis/competitor.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.resolve(__dirname, "../fixtures");

function readJson(file) {
  const raw = fs.readFileSync(path.join(fixturesDir, file), "utf-8");
  return JSON.parse(raw);
}

test("analyzeCompetitors: themes/patterns/quartiles are calculated", () => {
  const payload = readJson("search-notes.json");
  const notes = normalizeNotes(payload);
  const result = analyzeCompetitors(notes);

  assert.equal(result.sampleSize, 6);
  assert.ok(result.topThemes.length > 0);
  assert.ok(result.contentPatterns.howTo >= 1);
  assert.ok(result.contentPatterns.comparison >= 1);
  assert.ok(result.contentPatterns.caseStudy >= 1);
  assert.ok(result.likeDistribution.q1 <= result.likeDistribution.median);
  assert.ok(result.likeDistribution.median <= result.likeDistribution.q3);
});

test("diffMineVsCompetitors: returns 3-5 gap candidates", () => {
  const mine = normalizeNotes({
    data: {
      notes: [
        { id: "m1", name: "日記", likeCount: 10, commentsCount: 1, user: { urlname: "me" } },
        { id: "m2", name: "作業メモ", likeCount: 12, commentsCount: 1, user: { urlname: "me" } },
      ],
    },
  });
  const competitors = normalizeNotes(readJson("search-notes.json"));
  const result = diffMineVsCompetitors(mine, competitors);

  assert.ok(Array.isArray(result.gapCandidates));
  assert.ok(result.gapCandidates.length >= 3 && result.gapCandidates.length <= 5);
});

test("analyzeCompetitors filters noisy theme tokens", () => {
  const notes = normalizeNotes({
    data: {
      notes: [
        {
          id: "x1",
          name: "【Google大反撃】Gemini Proの衝撃。もう「プロンプト」は書かなくていい",
          likeCount: 9,
          commentsCount: 1,
          user: { urlname: "noisy" },
        },
      ],
    },
  });

  const result = analyzeCompetitors(notes);
  const themes = result.topThemes.map(([token]) => token);
  assert.ok(themes.includes("google"));
  assert.ok(themes.includes("gemini"));
  assert.ok(!themes.some((token) => token.includes("【")));
  assert.ok(!themes.some((token) => token.includes(" ")));
});
