export interface NormalizedNote {
  id: string;
  title: string;
  likes: number;
  comments: number;
  body?: string;
  user?: string;
}

type ThemeCounts = Map<string, number>;

interface PatternStats {
  howTo: number;
  comparison: number;
  caseStudy: number;
  listicle: number;
  opinion: number;
  other: number;
}

const THEME_STOPWORDS = new Set([
  "です",
  "ます",
  "する",
  "した",
  "して",
  "いる",
  "ある",
  "ない",
  "これ",
  "それ",
  "ため",
  "よう",
  "こと",
  "もの",
  "ai",
]);

function normalizeThemeSource(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[【】「」『』（）\[\]{}<>＜＞〈〉《》]/g, " ")
    .replace(/[!！?？:：;；"“”'`’]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeThemeToken(token: string): string | null {
  const normalized = token.trim();
  if (!normalized) return null;
  const stripped = normalized.replace(/^[ぁ-んー]+/, "").replace(/[ぁ-んー]+$/, "");
  if (!stripped) return null;
  if (stripped.length < 2 || stripped.length > 20) return null;
  if (/^[0-9]+$/.test(stripped)) return null;
  if (/^[ぁ-んー]+$/.test(stripped)) return null;
  if (THEME_STOPWORDS.has(stripped)) return null;
  return stripped;
}

function toThemeTokens(text: string): string[] {
  const normalized = normalizeThemeSource(text);
  const matches = normalized.match(/[a-z][a-z0-9+.#-]{1,20}|[ぁ-んァ-ヶ一-龠々ー]{2,20}/g) || [];
  const seen = new Set<string>();
  const tokens: string[] = [];
  for (const match of matches) {
    const token = sanitizeThemeToken(match);
    if (!token || seen.has(token)) continue;
    seen.add(token);
    tokens.push(token);
  }
  return tokens;
}

function collectThemeCounts(notes: NormalizedNote[]): ThemeCounts {
  const themes = new Map<string, number>();
  for (const n of notes) {
    toThemeTokens(n.title).forEach((t) => themes.set(t, (themes.get(t) || 0) + 1));
  }
  return themes;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function detectContentPatterns(notes: NormalizedNote[]): PatternStats {
  const stats: PatternStats = {
    howTo: 0,
    comparison: 0,
    caseStudy: 0,
    listicle: 0,
    opinion: 0,
    other: 0,
  };

  for (const n of notes) {
    const text = `${n.title} ${n.body || ""}`.toLowerCase();
    if (/(how to|やり方|手順|入門|チュートリアル)/.test(text)) {
      stats.howTo += 1;
    } else if (/(比較|vs|違い|選び方)/.test(text)) {
      stats.comparison += 1;
    } else if (/(事例|ケーススタディ|導入事例|実例)/.test(text)) {
      stats.caseStudy += 1;
    } else if (/(まとめ|選|ランキング|ベスト|top)/.test(text)) {
      stats.listicle += 1;
    } else if (/(考察|所感|意見|思う|レビュー)/.test(text)) {
      stats.opinion += 1;
    } else {
      stats.other += 1;
    }
  }

  return stats;
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

export function normalizeNotes(payload: any): NormalizedNote[] {
  const raw = payload?.data?.notes;
  const notes = Array.isArray(raw) ? raw : Array.isArray(raw?.contents) ? raw.contents : [];
  return notes.map((n: any) => ({
    id: n?.id || n?.key || "",
    title: n?.name || n?.title || "(untitled)",
    likes: toNumber(n?.likeCount ?? n?.like_count ?? n?.like?.count),
    comments: toNumber(n?.commentsCount ?? n?.comments_count ?? n?.comment_count ?? n?.comments?.count),
    body: n?.body || "",
    user: n?.user?.urlname || n?.user?.name,
  }));
}

export function discoverCompetitors(notes: NormalizedNote[]) {
  const byUser = new Map<string, { user: string; notes: number; likes: number }>();
  for (const n of notes) {
    if (!n.user) continue;
    const stat = byUser.get(n.user) || { user: n.user, notes: 0, likes: 0 };
    stat.notes += 1;
    stat.likes += n.likes;
    byUser.set(n.user, stat);
  }
  return [...byUser.values()].sort((a, b) => b.likes - a.likes).slice(0, 10);
}

export function analyzeCompetitors(notes: NormalizedNote[]) {
  const likes = notes.map((n) => n.likes).sort((a, b) => a - b);
  const themes = collectThemeCounts(notes);
  const median = percentile(likes, 0.5);
  const topThemes = [...themes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  return {
    medianLikes: median,
    likeDistribution: {
      min: likes.length ? likes[0] : 0,
      q1: percentile(likes, 0.25),
      median,
      q3: percentile(likes, 0.75),
      max: likes.length ? likes[likes.length - 1] : 0,
    },
    topThemes,
    contentPatterns: detectContentPatterns(notes),
    sampleSize: notes.length,
  };
}

export function diffMineVsCompetitors(mine: NormalizedNote[], competitors: NormalizedNote[]) {
  const mineAvg = mine.length ? mine.reduce((a, b) => a + b.likes, 0) / mine.length : 0;
  const compAvg = competitors.length
    ? competitors.reduce((a, b) => a + b.likes, 0) / competitors.length
    : 0;

  const gap = compAvg - mineAvg;
  const mineThemes = collectThemeCounts(mine);
  const competitorThemes = collectThemeCounts(competitors);
  const primary = [...competitorThemes.entries()]
    .filter(([theme, count]) => count >= 2 && !mineThemes.has(theme))
    .sort((a, b) => b[1] - a[1]);
  const fallback = [...competitorThemes.entries()]
    .filter(([theme]) => !mineThemes.has(theme))
    .sort((a, b) => b[1] - a[1]);
  const merged = [...primary];
  for (const item of fallback) {
    if (merged.some(([theme]) => theme === item[0])) continue;
    merged.push(item);
  }
  const gapCandidates = merged
    .slice(0, 5)
    .map(([theme, count]) => `${theme}（競合頻出:${count}件 / 自分:0件）`);
  while (gapCandidates.length < 3) {
    gapCandidates.push(`訴求軸候補${gapCandidates.length + 1}（競合テーマの言い換えで検証）`);
  }

  return {
    mineAverageLikes: mineAvg,
    competitorAverageLikes: compAvg,
    likeGap: gap,
    gapCandidates,
    suggestions: [
      gap > 0 ? "競合より反応が低いため、タイトル改善と投稿頻度増を検討" : "現状の方針を維持",
      "上位テーマを次回記事企画に転用",
      "導入文に結論を先出しして離脱を減らす",
    ],
  };
}
