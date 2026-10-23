import "dotenv/config";
import { writeFileSync } from "node:fs";
import OpenAI from "openai";
import { openDb } from "../src/pipeline/db";
import { pass1Request, readPass1, PASS1_MODEL, PASS1_VERSION, POSTS_PER_REQUEST, type Pass1Input } from "../src/pipeline/ai/pass1";
import { saveLabels, startAiRun, finishAiRun } from "../src/pipeline/labels";

// DE-08 recall check: run pass 1 on a random sample of posts the keyword filter dropped,
// in proportion to the dropped pile, and list the ones the AI calls relevant for a person
// to confirm. Saved as task "recall", so these never mix into the pass 1 results.
// Usage: npx tsx scripts/recall-check.mts [size] [seed]
const SIZE = Number(process.argv[2]) || 1000;
const SEED = Number(process.argv[3]) || 2032;

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
const pile = db.prepare("SELECT source, COUNT(*) AS n FROM posts WHERE keyword_pass = 0 GROUP BY source").all() as { source: string; n: number }[];
const total = pile.reduce((sum, row) => sum + row.n, 0);
const posts: Pass1Input[] = [];
const plan: Record<string, number> = {};
for (const { source, n } of pile) {
  const take = Math.max(1, Math.round((n / total) * SIZE));
  plan[source] = take;
  const ids = db.prepare("SELECT id FROM posts WHERE keyword_pass = 0 AND source = ? ORDER BY id").all(source) as { id: string }[];
  const chosen = new Set<number>();
  while (chosen.size < Math.min(take, ids.length)) chosen.add(Math.floor(next() * ids.length));
  for (const index of chosen) posts.push(db.prepare("SELECT id, source, context, title, text FROM posts WHERE id = ?").get(ids[index].id) as unknown as Pass1Input);
}
console.log(`Dropped pile: ${total.toLocaleString()} posts. Sample of ${posts.length}:`, plan);

const client = new OpenAI({ maxRetries: 5 });
const runId = startAiRun(db, { task: "recall", model: PASS1_MODEL, mode: "live", posts: posts.length, note: `${PASS1_VERSION} on ${posts.length} dropped posts, seed ${SEED}` });
let inputTokens = 0;
let outputTokens = 0;
const answers: Awaited<ReturnType<typeof readPass1>>["answers"] = [];
const chunks: Pass1Input[][] = [];
for (let start = 0; start < posts.length; start += POSTS_PER_REQUEST) chunks.push(posts.slice(start, start + POSTS_PER_REQUEST));
let cursor = 0;
await Promise.all(Array.from({ length: 5 }, async () => {
  while (cursor < chunks.length) {
    const chunk = chunks[cursor++];
    const response = await client.chat.completions.create(pass1Request(chunk));
    inputTokens += response.usage?.prompt_tokens ?? 0;
    outputTokens += response.usage?.completion_tokens ?? 0;
    answers.push(...readPass1(chunk, response.choices[0].message.content ?? '{"results":[]}').answers);
  }
}));
saveLabels(db, "recall", PASS1_MODEL, runId, answers.map((answer) => ({
  postId: answer.postId,
  value: { relevant: answer.relevant, experience: answer.experience, reason: answer.reason, version: PASS1_VERSION },
})));
finishAiRun(db, runId, { inputTokens, outputTokens, status: "done" });

const flagged = answers.filter((answer) => answer.relevant);
const lines = flagged.map((answer, index) => {
  const post = posts.find((row) => row.id === answer.postId)!;
  const body = [post.title, post.text].filter(Boolean).join(": ").replace(/\s+/g, " ");
  return `#${index + 1} ${post.id} [${post.source}]${post.context ? ` (under: ${post.context})` : ""}\n${body.slice(0, 800)}\nAI: ${answer.reason}`;
});
writeFileSync(`data/recall-${SEED}-flagged.txt`, lines.join("\n\n") + "\n", "utf8");
writeFileSync(`data/recall-${SEED}-sample.json`, JSON.stringify({ seed: SEED, plan, ids: posts.map((post) => post.id) }, null, 2), "utf8");
console.log(`${answers.length} answered, ${flagged.length} flagged relevant (written to data/recall-${SEED}-flagged.txt). Tokens: ${inputTokens + outputTokens}.`);
