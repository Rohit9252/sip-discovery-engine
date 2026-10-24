import "dotenv/config";
import { writeFileSync } from "node:fs";
import OpenAI from "openai";
import { openDb } from "../src/pipeline/db";
import { PASS1_MODEL, PASS1_VERSION } from "../src/pipeline/ai/pass1";
import { runPass2Batch, PASS2_MODEL, PASS2_VERSION, PASS2_POSTS_PER_REQUEST, type Pass2Input } from "../src/pipeline/ai/pass2";
import { saveLabels, startAiRun, finishAiRun } from "../src/pipeline/labels";

// Full pass 2 run. The sample: every relevant post from a first-time investor, plus a
// fixed random draw of other relevant posts spread across sources, about 3,000 in all.
// First-time posts go first, so the most important ones are done earliest. Resumable:
// posts that already have an answer from this instruction version are skipped.
// Usage: npx tsx scripts/pass2-run.mts [--budget 450000] [--parallel 4] [--others 1740] [--seed 2050] [--first-only]
// --first-only: only the first-time posts (used for v11, after the golden set showed their tags needed fixing).
function arg(name: string, fallback: string) {
  const index = process.argv.indexOf(`--${name}`);
  return index > -1 ? process.argv[index + 1] : fallback;
}
const BUDGET = Number(arg("budget", "450000"));
const PARALLEL = Number(arg("parallel", "4"));
const OTHERS = Number(arg("others", "1740"));
const SEED = Number(arg("seed", "2050"));
const FIRST_ONLY = process.argv.includes("--first-only");

function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const db = openDb();
type Candidate = { id: string; grp: string; first: number };
const relevant = db.prepare(`
  SELECT p.id,
    CASE WHEN p.source = 'play_store' AND p.app = 'groww' THEN 'play_groww' WHEN p.source = 'play_store' THEN 'play_other'
         ELSE p.source || '_' || p.record_type END AS grp,
    json_extract(l.value, '$.experience') = 'first_time' AS first
  FROM labels l JOIN posts p ON p.id = l.post_id
  WHERE l.task = 'pass1' AND l.rater = ? AND json_extract(l.value, '$.version') = ? AND json_extract(l.value, '$.relevant') = 1
  ORDER BY p.id
`).all(PASS1_MODEL, PASS1_VERSION) as unknown as Candidate[];

// Others: a random draw in proportion to each source's share of the non-first-time pile.
const next = random(SEED);
const firstTime = relevant.filter((row) => row.first).map((row) => row.id);
const others = relevant.filter((row) => !row.first);
const groups = new Map<string, string[]>();
for (const row of others) groups.set(row.grp, [...(groups.get(row.grp) ?? []), row.id]);
const chosen: string[] = [];
for (const [, ids] of groups) {
  const take = Math.round((ids.length / others.length) * OTHERS);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  chosen.push(...ids.slice(0, take));
}
const wanted = [...firstTime, ...chosen];
writeFileSync(`data/pass2-sample-${SEED}.json`, JSON.stringify({ seed: SEED, firstTime: firstTime.length, others: chosen.length, ids: wanted }, null, 2), "utf8");

const done = new Set((db.prepare("SELECT post_id FROM labels WHERE task = 'pass2' AND rater = ? AND json_extract(value, '$.version') = ?")
  .all(PASS2_MODEL, PASS2_VERSION) as { post_id: string }[]).map((row) => row.post_id));
const fetchPost = db.prepare("SELECT id, source, context, title, text, created_at AS createdAt, record_type AS recordType FROM posts WHERE id = ?");
const todo = (FIRST_ONLY ? firstTime : wanted).filter((id) => !done.has(id)).map((id) => fetchPost.get(id) as unknown as Pass2Input);
console.log(`Sample: ${firstTime.length} first-time + ${chosen.length} others = ${wanted.length}. ${todo.length} still need ${PASS2_VERSION}. Budget ${BUDGET.toLocaleString()} tokens.`);

const chunks: Pass2Input[][] = [];
for (let start = 0; start < todo.length; start += PASS2_POSTS_PER_REQUEST) chunks.push(todo.slice(start, start + PASS2_POSTS_PER_REQUEST));
const client = new OpenAI({ maxRetries: 5 });
const runId = startAiRun(db, { task: "pass2", model: PASS2_MODEL, mode: "live", posts: todo.length, note: `${PASS2_VERSION} full run, seed ${SEED}` });
let inputTokens = 0;
let outputTokens = 0;
let answered = 0;
let missing = 0;
let stopReason = "";
let nextChunk = 0;
let doneChunks = 0;

await Promise.all(Array.from({ length: PARALLEL }, async () => {
  while (!stopReason && nextChunk < chunks.length) {
    if (inputTokens + outputTokens >= BUDGET) { stopReason = "token budget reached"; break; }
    const chunk = chunks[nextChunk++];
    try {
      const result = await runPass2Batch(client, chunk);
      inputTokens += result.inputTokens;
      outputTokens += result.outputTokens;
      saveLabels(db, "pass2", PASS2_MODEL, runId, result.answers.map(({ postId, id, ...fields }) => ({ postId, value: { ...fields, version: PASS2_VERSION } })));
      answered += result.answers.length;
      missing += result.missing.length;
    } catch (error) {
      if ((error as { code?: string }).code === "insufficient_quota") { stopReason = "OpenAI says the quota is used up"; break; }
      console.log(`a group failed (${(error as Error).message.slice(0, 100)}); it will be retried on the next run`);
    }
    doneChunks++;
    if (doneChunks % 15 === 0) {
      console.log(`${new Date().toLocaleTimeString()}  ${answered} of ${todo.length} answered, ${(inputTokens + outputTokens).toLocaleString()} tokens`);
      finishAiRun(db, runId, { inputTokens, outputTokens, status: "running" });
    }
  }
}));
finishAiRun(db, runId, { inputTokens, outputTokens, status: stopReason ? `stopped: ${stopReason}` : "done" });
const total = (db.prepare("SELECT COUNT(*) AS n FROM labels WHERE task = 'pass2' AND rater = ? AND json_extract(value, '$.version') = ?").get(PASS2_MODEL, PASS2_VERSION) as { n: number }).n;
console.log(`\n${stopReason ? `Stopped: ${stopReason}.` : "Finished."} ${answered} answered this run, ${missing} without an answer. Tokens: ${(inputTokens + outputTokens).toLocaleString()}.`);
console.log(`${total} posts have ${PASS2_VERSION} answers; ${wanted.length - total} of the ${wanted.length}-post sample still to do. Run the same command again to continue.`);
