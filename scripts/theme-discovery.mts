import "dotenv/config";
import { writeFileSync } from "node:fs";
import OpenAI from "openai";
import { openDb } from "../src/pipeline/db";
import { PASS1_MODEL, PASS1_VERSION } from "../src/pipeline/ai/pass1";
import { startAiRun, finishAiRun } from "../src/pipeline/labels";

// DE-11 theme discovery: the AI reads 300 relevant posts (half from first-time investors)
// in groups of 50, lists the unmet needs it sees, then merges them into 10 to 15 suggested
// themes. The team reviews and freezes at most 12 (data/themes-suggested.md).
// Usage: npx tsx scripts/theme-discovery.mts [seed]
const SEED = Number(process.argv[2]) || 2033;
const MODEL = "gpt-4.1-mini";
const GROUP_SIZE = 50;
const MAX_CHARS = 700;

// How many posts to take from each group, so every source is heard.
const PLAN = [
  { experience: "first_time", where: "p.source = 'reddit' AND p.record_type = 'post'", take: 94 },
  { experience: "first_time", where: "p.source = 'youtube'", take: 33 },
  { experience: "first_time", where: "p.source = 'play_store'", take: 15 },
  { experience: "first_time", where: "p.source = 'reddit' AND p.record_type = 'comment'", take: 5 },
  { experience: "first_time", where: "p.source IN ('app_store', 'tradingqna')", take: 3 },
  { experience: "other", where: "p.source = 'play_store'", take: 45 },
  { experience: "other", where: "p.source = 'reddit' AND p.record_type = 'post'", take: 45 },
  { experience: "other", where: "p.source = 'youtube'", take: 25 },
  { experience: "other", where: "p.source = 'reddit' AND p.record_type = 'comment'", take: 15 },
  { experience: "other", where: "p.source = 'app_store'", take: 10 },
  { experience: "other", where: "p.source = 'tradingqna'", take: 10 },
];

const DISCOVER = `You are helping a product manager at Groww, an Indian investing app. The business goal: more first-time mutual fund investors still have an active SIP 12 months after starting.

You will read posts by investors. Find the UNMET NEEDS behind them: what the investor needed, at some point in their SIP journey, and did not get. Write each need from the investor's point of view, in plain words ("I need to know whether a fall in month 4 is normal"), never as a solution or feature.

Rules:
- Look underneath the trigger. "The market fell" or "returns are negative" is a trigger, not a need. Ask what the person lacked that turned the trigger into stopping, pausing or worry (for example, no idea what normal looks like early on).
- Include needs about money problems in the app (failed debits, NAV not allotted, stuck redemptions), what people check, confusion, who they turn to, and why they started or kept going.
- Only list a need if at least 2 posts show it. Give the ids of every post that shows it.
- Ignore fund-picking questions.`;

const DISCOVER_SCHEMA = {
  name: "needs",
  strict: true,
  schema: {
    type: "object",
    properties: {
      needs: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            need: { type: "string" },
            stage: { type: "string", enum: ["before starting", "setting up", "months 1 to 3", "months 4 to 6", "months 7 to 12", "after 12 months", "any time"] },
            post_ids: { type: "array", items: { type: "string" } },
          },
          required: ["name", "need", "stage", "post_ids"],
          additionalProperties: false,
        },
      },
    },
    required: ["needs"],
    additionalProperties: false,
  },
} as const;

const MERGE = `Below are unmet needs that were found separately in six groups of investor posts. Many overlap. Merge them into 10 to 15 distinct themes.

Each theme: a short name (at most 6 words), one plain sentence saying the need from the investor's point of view, and the numbers of the candidate needs it absorbs. Keep needs about different things apart (for example, "money stuck in the app" is not the same as "not knowing if a fall is normal"). Every candidate must go into exactly one theme. Never name a solution.`;

const MERGE_SCHEMA = {
  name: "themes",
  strict: true,
  schema: {
    type: "object",
    properties: {
      themes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            need: { type: "string" },
            candidates: { type: "array", items: { type: "integer" } },
          },
          required: ["name", "need", "candidates"],
          additionalProperties: false,
        },
      },
    },
    required: ["themes"],
    additionalProperties: false,
  },
} as const;

function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Row = { id: string; source: string; context: string | null; title: string; text: string; experience: string };
const db = openDb();
const next = random(SEED);
const posts: Row[] = [];
for (const group of PLAN) {
  const experience = group.experience === "first_time" ? "= 'first_time'" : "!= 'first_time'";
  const rows = db.prepare(`
    SELECT p.id, p.source, p.context, p.title, p.text, json_extract(l.value, '$.experience') AS experience
    FROM labels l JOIN posts p ON p.id = l.post_id
    WHERE l.task = 'pass1' AND l.rater = ? AND json_extract(l.value, '$.version') = ?
      AND json_extract(l.value, '$.relevant') = 1 AND json_extract(l.value, '$.experience') ${experience} AND ${group.where}
    ORDER BY p.id
  `).all(PASS1_MODEL, PASS1_VERSION) as unknown as Row[];
  for (let i = rows.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [rows[i], rows[j]] = [rows[j], rows[i]];
  }
  posts.push(...rows.slice(0, group.take));
}
// Mix the groups so each batch of 50 sees every source.
for (let i = posts.length - 1; i > 0; i--) {
  const j = Math.floor(next() * (i + 1));
  [posts[i], posts[j]] = [posts[j], posts[i]];
}
const shortId = new Map(posts.map((post, index) => [`t${index + 1}`, post]));
console.log(`${posts.length} posts sampled (${posts.filter((post) => post.experience === "first_time").length} first-time).`);

const client = new OpenAI({ maxRetries: 5 });
const runId = startAiRun(db, { task: "themes", model: MODEL, mode: "live", posts: posts.length, note: `theme discovery, seed ${SEED}` });
let inputTokens = 0;
let outputTokens = 0;

const candidates: { name: string; need: string; stage: string; post_ids: string[] }[] = [];
const batches = [...shortId.entries()];
await Promise.all(Array.from({ length: Math.ceil(batches.length / GROUP_SIZE) }, async (_, index) => {
  const batch = batches.slice(index * GROUP_SIZE, (index + 1) * GROUP_SIZE);
  const content = batch.map(([id, post]) => {
    const body = [post.title, post.text].filter(Boolean).join(": ").replace(/\s+/g, " ");
    return `### ${id} (${post.source}${post.context ? `, under: ${post.context}` : ""})\n${body.slice(0, MAX_CHARS)}`;
  }).join("\n\n");
  const response = await client.chat.completions.create({
    model: MODEL, temperature: 0.2,
    response_format: { type: "json_schema", json_schema: DISCOVER_SCHEMA },
    messages: [{ role: "system", content: DISCOVER }, { role: "user", content }],
  });
  inputTokens += response.usage?.prompt_tokens ?? 0;
  outputTokens += response.usage?.completion_tokens ?? 0;
  const found = JSON.parse(response.choices[0].message.content ?? '{"needs":[]}').needs as typeof candidates;
  candidates.push(...found.map((need) => ({ ...need, post_ids: need.post_ids.filter((id) => shortId.has(id)) })));
}));
console.log(`${candidates.length} candidate needs found.`);

const mergeInput = candidates.map((c, index) => `${index + 1}. ${c.name}: ${c.need} [${c.stage}, ${c.post_ids.length} posts]`).join("\n");
const merged = await client.chat.completions.create({
  model: MODEL, temperature: 0,
  response_format: { type: "json_schema", json_schema: MERGE_SCHEMA },
  messages: [{ role: "system", content: MERGE }, { role: "user", content: mergeInput }],
});
inputTokens += merged.usage?.prompt_tokens ?? 0;
outputTokens += merged.usage?.completion_tokens ?? 0;
const themes = JSON.parse(merged.choices[0].message.content ?? '{"themes":[]}').themes as { name: string; need: string; candidates: number[] }[];
finishAiRun(db, runId, { inputTokens, outputTokens, status: "done" });

// Count each theme's posts and pick quotes, preferring first-time investors and different sources.
const report = themes.map((theme) => {
  const ids = new Set<string>();
  const stages = new Map<string, number>();
  for (const number of theme.candidates) {
    const candidate = candidates[number - 1];
    if (!candidate) continue;
    candidate.post_ids.forEach((id) => ids.add(id));
    stages.set(candidate.stage, (stages.get(candidate.stage) ?? 0) + candidate.post_ids.length);
  }
  const themePosts = [...ids].map((id) => shortId.get(id)!).filter(Boolean);
  const ordered = [...themePosts].sort((a, b) => Number(b.experience === "first_time") - Number(a.experience === "first_time"));
  const quotes: Row[] = [];
  for (const post of ordered) {
    if (quotes.length === 3) break;
    if (quotes.filter((quote) => quote.source === post.source).length < 2) quotes.push(post);
  }
  return {
    ...theme,
    posts: themePosts.length,
    firstTime: themePosts.filter((post) => post.experience === "first_time").length,
    stages: [...stages.entries()].sort((a, b) => b[1] - a[1]).map(([stage]) => stage).slice(0, 2),
    quotes: quotes.map((post) => ({ id: post.id, source: post.source, experience: post.experience, text: [post.title, post.text].filter(Boolean).join(": ").replace(/\s+/g, " ").slice(0, 300) })),
  };
}).sort((a, b) => b.posts - a.posts);

writeFileSync(`data/themes-suggested-${SEED}.json`, JSON.stringify({ seed: SEED, model: MODEL, candidates, themes: report }, null, 2), "utf8");
const md = [`# Suggested themes (AI, seed ${SEED})`, "", `From ${posts.length} relevant posts (${posts.filter((p) => p.experience === "first_time").length} from first-time investors). ${candidates.length} candidate needs, merged into ${report.length} themes. Counts are posts out of the ${posts.length} that show the theme; one post can show several.`, ""];
report.forEach((theme, index) => {
  md.push(`## ${index + 1}. ${theme.name}`, "", `**Need:** ${theme.need}`, "", `**Posts:** ${theme.posts} of ${posts.length} (${theme.firstTime} first-time) · **Mostly:** ${theme.stages.join(", ")}`, "");
  theme.quotes.forEach((quote) => md.push(`> "${quote.text}"`, `> (${quote.source}${quote.experience === "first_time" ? ", first-time" : ""})`, ""));
});
writeFileSync(`data/themes-suggested-${SEED}.md`, md.join("\n"), "utf8");
console.log(`${report.length} themes written to data/themes-suggested-${SEED}.md. Tokens: ${inputTokens + outputTokens}.`);
