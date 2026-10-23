import "dotenv/config";
import { writeFileSync } from "node:fs";
import OpenAI from "openai";
import { openDb } from "../src/pipeline/db";
import { PASS1_MODEL, PASS1_VERSION } from "../src/pipeline/ai/pass1";
import { runPass2Batch, readPass2, PASS2_MODEL, PASS2_VERSION, PASS2_POSTS_PER_REQUEST, type Pass2Input } from "../src/pipeline/ai/pass2";
import { saveLabels, startAiRun, finishAiRun } from "../src/pipeline/labels";

// Runs pass 2 live on a small mixed sample of relevant posts and prints every answer
// next to its post. --blind saves the answers without printing them and writes the posts
// to data/check2-<seed>-posts.txt for a second rater.
// Usage: npx tsx scripts/pass2-test.mts [size] [seed] [--blind] [--rerun <earlier version>] [--from <blind check seed>] [--review]
const SIZE = Number(process.argv[2]) || 20;
const SEED = Number(process.argv[3]) || 2040;
const BLIND = process.argv.includes("--blind");
const RERUN = process.argv.includes("--rerun") ? process.argv[process.argv.indexOf("--rerun") + 1] : "";

const MIX = [
  { label: "Reddit post", where: "p.source = 'reddit' AND p.record_type = 'post'", share: 7 },
  { label: "Play Store Groww", where: "p.source = 'play_store' AND p.app = 'groww'", share: 4 },
  { label: "YouTube", where: "p.source = 'youtube'", share: 4 },
  { label: "Reddit comment", where: "p.source = 'reddit' AND p.record_type = 'comment'", share: 2 },
  { label: "App Store or other app", where: "(p.source = 'app_store' OR (p.source = 'play_store' AND p.app != 'groww'))", share: 2 },
  { label: "TradingQ&A", where: "p.source = 'tradingqna'", share: 1 },
];

function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const db = openDb();
const next = random(SEED);
const posts: (Pass2Input & { group: string })[] = [];
const FROM = process.argv.includes("--from") ? process.argv[process.argv.indexOf("--from") + 1] : "";
if (FROM) {
  // The posts of an earlier blind check (data/check2-<seed>-posts.txt), in the same order.
  const { readFileSync } = await import("node:fs");
  for (const match of readFileSync(`data/check2-${FROM}-posts.txt`, "utf8").matchAll(/^#\d+ (\S+) \[/gm)) {
    posts.push({ ...(db.prepare("SELECT id, source, context, title, text, created_at AS createdAt, record_type AS recordType FROM posts WHERE id = ?").get(match[1]) as unknown as Pass2Input), group: "recheck" });
  }
}
if (RERUN) {
  // The same posts an earlier instruction version was tested on, so versions can be compared.
  const ids = db.prepare("SELECT post_id FROM labels WHERE task = 'pass2' AND json_extract(value, '$.version') = ? ORDER BY post_id").all(RERUN) as { post_id: string }[];
  for (const { post_id } of ids) {
    posts.push({ ...(db.prepare("SELECT id, source, context, title, text, created_at AS createdAt, record_type AS recordType FROM posts WHERE id = ?").get(post_id) as unknown as Pass2Input), group: "rerun" });
  }
}
for (const group of RERUN || FROM ? [] : MIX) {
  const take = Math.round((group.share / 20) * SIZE);
  const ids = db.prepare(`
    SELECT p.id FROM labels l JOIN posts p ON p.id = l.post_id
    WHERE l.task = 'pass1' AND l.rater = ? AND json_extract(l.value, '$.version') = ? AND json_extract(l.value, '$.relevant') = 1
      AND ${group.where} AND p.id NOT IN (SELECT post_id FROM labels WHERE task = 'pass2')
    ORDER BY p.id
  `).all(PASS1_MODEL, PASS1_VERSION) as { id: string }[];
  const chosen = new Set<number>();
  while (chosen.size < Math.min(take, ids.length)) chosen.add(Math.floor(next() * ids.length));
  for (const index of chosen) {
    posts.push({ ...(db.prepare("SELECT id, source, context, title, text, created_at AS createdAt, record_type AS recordType FROM posts WHERE id = ?").get(ids[index].id) as unknown as Pass2Input), group: group.label });
  }
}

const client = new OpenAI({ maxRetries: 5 });
const runId = startAiRun(db, { task: "pass2", model: PASS2_MODEL, mode: "live", posts: posts.length, note: `${PASS2_VERSION} test, ${posts.length} posts, seed ${SEED}${BLIND ? ", blind" : ""}` });
let inputTokens = 0;
let outputTokens = 0;
const answers: Awaited<ReturnType<typeof readPass2>>["answers"] = [];
const chunks: Pass2Input[][] = [];
for (let start = 0; start < posts.length; start += PASS2_POSTS_PER_REQUEST) chunks.push(posts.slice(start, start + PASS2_POSTS_PER_REQUEST));
await Promise.all(chunks.map(async (chunk) => {
  const result = await runPass2Batch(client, chunk);
  inputTokens += result.inputTokens;
  outputTokens += result.outputTokens;
  if (result.missing.length) console.log("no answer after retries for:", result.missing);
  answers.push(...result.answers);
}));
saveLabels(db, "pass2", PASS2_MODEL, runId, answers.map(({ postId, id, ...fields }) => ({ postId, value: { ...fields, version: PASS2_VERSION } })));
finishAiRun(db, runId, { inputTokens, outputTokens, status: "done" });

const tokens = `Tokens: ${inputTokens} in + ${outputTokens} out = ${inputTokens + outputTokens} (${Math.round((inputTokens + outputTokens) / posts.length)} per post). Quote check: ${answers.filter((a) => a.quoteOk).length} of ${answers.length} quotes match the post word for word. Evidence check: ${answers.reduce((n, a) => n + a.unsupported.length, 0)} answers thrown away for lack of evidence.`;
if (BLIND && !FROM) {
  const sheet = posts.map((post, index) => {
    const body = [post.title, post.text].filter(Boolean).join(": ").replace(/\s+/g, " ");
    return `#${index + 1} ${post.id} [${post.group}]${post.context ? ` (under: ${post.context})` : ""}\n${body.slice(0, 2000)}`;
  });
  writeFileSync(`data/check2-${SEED}-posts.txt`, sheet.join("\n\n") + "\n", "utf8");
  console.log(`${answers.length} answered (saved, not shown). Posts: data/check2-${SEED}-posts.txt\n${tokens}`);
  process.exit(0);
}
const byId = new Map(answers.map((answer) => [answer.postId, answer]));
if (process.argv.includes("--review")) {
  // A file for a separate reviewer: each post next to the engine's theme and key fields.
  const { THEMES } = await import("../src/pipeline/themes");
  const lines = [`# Pass 2 review set (${PASS2_VERSION}, seed ${SEED}, ${posts.length} posts)`, "", "## Themes", "", ...THEMES.map((t) => `- **${t.id} ${t.name}**: ${t.need}`), "- **none**: no unmet need (praise, jokes, opinions, advice to someone else)", "", "## Posts", ""];
  posts.forEach((post, index) => {
    const a = byId.get(post.id);
    const body = [post.title, post.text].filter(Boolean).join(": ").replace(/\s+/g, " ");
    lines.push(`### #${index + 1} (${post.source}${post.context ? `, under: ${post.context.slice(0, 80)}` : ""})`, body.slice(0, 1200) + (body.length > 1200 ? " [cut]" : ""), "");
    lines.push(a ? `**Engine:** theme **${a.theme}**${a.theme_by_rule ? " (set by rule)" : ""} | stage ${a.stage} | what happened ${a.what_happened} | need: ${a.need || "(none)"}` : "**Engine:** no answer", "");
  });
  writeFileSync(`data/review-${SEED}.md`, lines.join("\n"), "utf8");
  console.log(`Review file: data/review-${SEED}.md`);
}
posts.forEach((post, index) => {
  const a = byId.get(post.id);
  const body = [post.title, post.text].filter(Boolean).join(": ").replace(/\s+/g, " ");
  console.log(`\n#${index + 1} [${post.group}] ${body.slice(0, 260)}${body.length > 260 ? "..." : ""}`);
  if (!a) { console.log("   NO ANSWER"); return; }
  console.log(`   theme ${a.theme} | stage ${a.stage} | happened ${a.what_happened} | trigger ${a.trigger} | app ${a.app}`);
  console.log(`   why ${a.why_started} | influencer ${a.influencer} | expected ${a.expectation} | checks ${a.checks_what} (${a.checks_how_often})`);
  console.log(`   confusion ${a.confusion} | outside ${a.outside_app} | income ${a.income} | age ${a.age} | money ${a.money_source}`);
  console.log(`   need: ${a.need}`);
  if (a.unsupported.length) console.log(`   thrown away (no evidence in the post): ${a.unsupported.join(", ")}`);
  console.log(`   quote${a.quoteOk ? "" : " (DOES NOT MATCH THE POST)"}: "${a.quote}"${a.quote_english ? ` | EN: ${a.quote_english}` : ""}`);
});
console.log(`\n${tokens}`);
