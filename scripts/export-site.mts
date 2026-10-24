import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { openDb } from "../src/pipeline/db";
import { PASS1_MODEL, PASS1_VERSION } from "../src/pipeline/ai/pass1";

// Writes the files the site reads, so the site never touches the database.
// Usage: npx tsx scripts/export-site.mts
const db = openDb();
const SOURCES = [
  { key: "play_store", name: "Play Store reviews" },
  { key: "app_store", name: "App Store reviews" },
  { key: "reddit", name: "Reddit posts and comments" },
  { key: "youtube", name: "YouTube comments" },
  { key: "tradingqna", name: "TradingQ&A" },
];

const pass1 = `FROM labels l JOIN posts p ON p.id = l.post_id
  WHERE l.task = 'pass1' AND l.rater = ? AND json_extract(l.value, '$.version') = ?`;
const bySource = (sql: string, ...params: (string | number)[]) =>
  new Map((db.prepare(sql).all(...params) as { source: string; n: number }[]).map((row) => [row.source, row.n]));

const collected = bySource("SELECT source, COUNT(*) AS n FROM posts GROUP BY source");
const kept = bySource("SELECT source, SUM(keyword_pass) AS n FROM posts GROUP BY source");
const read = bySource(`SELECT p.source, COUNT(*) AS n ${pass1} GROUP BY p.source`, PASS1_MODEL, PASS1_VERSION);
const relevant = bySource(`SELECT p.source, COUNT(*) AS n ${pass1} AND json_extract(l.value, '$.relevant') = 1 GROUP BY p.source`, PASS1_MODEL, PASS1_VERSION);
const firstTime = bySource(`SELECT p.source, COUNT(*) AS n ${pass1} AND json_extract(l.value, '$.relevant') = 1 AND json_extract(l.value, '$.experience') = 'first_time' GROUP BY p.source`, PASS1_MODEL, PASS1_VERSION);
const dates = db.prepare("SELECT substr(MIN(created_at), 1, 10) AS oldest, substr(MAX(created_at), 1, 10) AS newest FROM posts").get() as { oldest: string; newest: string };

const sources = SOURCES.map(({ key, name }) => ({
  name,
  collected: collected.get(key) ?? 0,
  kept: kept.get(key) ?? 0,
  read: read.get(key) ?? 0,
  relevant: relevant.get(key) ?? 0,
  firstTime: firstTime.get(key) ?? 0,
}));
const total = (field: keyof Omit<(typeof sources)[number], "name">) => sources.reduce((sum, row) => sum + row[field], 0);

// Run after analyse.mts: the first-time count after the date check comes from answers.json.
const checkedFirstTime = (JSON.parse(readFileSync("src/data/answers.json", "utf8")) as { firstTimePosts: number }).firstTimePosts;

const overview = {
  exportedAt: new Date().toISOString(),
  dates,
  funnel: [
    { step: "Collected", n: total("collected"), note: `Public posts from ${dates.oldest} to ${dates.newest}` },
    { step: "Kept by the keyword filter", n: total("kept"), note: "Mention SIPs, mutual funds or investing" },
    { step: "Read by the AI (pass 1)", n: total("read"), note: "All kept store reviews, YouTube and TradingQ&A, plus a fixed Reddit sample" },
    { step: "About someone's own SIP", n: total("relevant"), note: "Their own SIP or mutual fund journey, not fund picking or praise" },
    { step: "From a first-time investor", n: checkedFirstTime, note: `Their first SIP, on any app. AI pass 1 flagged ${total("firstTime").toLocaleString("en-US")}; ${(total("firstTime") - checkedFirstTime).toLocaleString("en-US")} were dropped because the post shows more than a year of investing and never calls it their first SIP. Headline numbers come from these` },
  ],
  sources,
};

// Accuracy: the golden set scores before and after the fixes, plus the other checks.
// Each number is read from the file that holds it, named beside it.
type Score = { results: { field: string; key: boolean; agree: number; of: number }[] };
const readScore = (version: string) => JSON.parse(readFileSync(`data/golden-2070-score-${version}.json`, "utf8")) as Score;
const before = readScore("pass2-v10");
const after = readScore("pass2-v11");
const FIELD_NAMES: Record<string, string> = {
  own_sip: "About their own SIP", experience: "First-time or not", stage: "Journey stage", what_happened: "What happened to the SIP",
  trigger: "What set it off", theme: "Unmet need (theme)", why_started: "Why they started", confusion: "In-app confusion", outside_app: "Where they asked outside the app",
};
const quoteRows = db.prepare(`SELECT COUNT(*) AS n, SUM(json_extract(value, '$.quoteOk')) AS ok FROM labels WHERE task = 'pass2' AND json_extract(value, '$.version') IN ('pass2-v10', 'pass2-v11')`).get() as { n: number; ok: number };
const accuracy = {
  golden: {
    posts: after.results[0].of,
    method: "30 posts picked at random within each source (seed 2070). Answer key drafted blind by Claude (Opus 5.5) from the post text only, before seeing the engine's answers, then reviewed by the team, who set 2 labels themselves and corrected 2.",
    caveat: "The v11 fixes were made after looking at these same 30 posts, so the 'after' scores are optimistic until checked on posts the fixes have not seen.",
    bar: 0.8,
    fields: after.results.map((row) => ({ field: FIELD_NAMES[row.field], key: row.key, before: before.results.find((b) => b.field === row.field)!.agree, after: row.agree, of: row.of })),
  },
  checks: [
    { name: "Keyword filter recall", value: "about 85%", detail: "1,000 posts the filter dropped were read: 8 were relevant (data/recall-2032-claude.json)" },
    { name: "Pass 1 agreement", value: "270 of 300 (90%)", detail: "Own SIP or not, first time or not, against a second AI reading the same posts blind (data/check-2028 to 2030)" },
    { name: "Theme check by an AI judge", value: "90 of 100", detail: "Claude Sonnet judged the themes on 100 posts it had not seen (data/review-2061-sonnet.json, on v9)" },
    { name: "Quotes found word for word", value: `${quoteRows.ok.toLocaleString("en-US")} of ${quoteRows.n.toLocaleString("en-US")}`, detail: "Every quote is checked in code against its post; the rest are hidden" },
    { name: "Chat refuses advice", value: "26 of 26", detail: "Advice questions refused in code before any AI call; 0 of 15 research questions wrongly refused (scripts/advice-test.mts)" },
  ],
};
// The unbiased check: v11 on 20 first-time posts the fixes never saw (data/holdout-2071.json).
let holdout: { posts: number; fields: { field: string; key: boolean; agree: number; of: number }[] } | undefined;
try {
  const fresh = JSON.parse(readFileSync("data/holdout-2071-score-pass2-v11.json", "utf8")) as Score;
  holdout = { posts: fresh.results[0].of, fields: fresh.results.map((row) => ({ field: FIELD_NAMES[row.field], key: row.key, agree: row.agree, of: row.of })) };
} catch {
  holdout = undefined;
}
writeFileSync("src/data/accuracy.json", JSON.stringify({ ...accuracy, ...(holdout ? { holdout } : {}) }, null, 2) + "\n", "utf8");

mkdirSync("src/data", { recursive: true });
writeFileSync("src/data/overview.json", JSON.stringify(overview, null, 2) + "\n", "utf8");
console.log(`src/data/overview.json: ${overview.funnel.map((row) => `${row.step} ${row.n}`).join(", ")}`);
