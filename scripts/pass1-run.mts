import "dotenv/config";
import { writeFileSync } from "node:fs";
import OpenAI from "openai";
import { openDb } from "../src/pipeline/db";
import { pass1Request, readPass1, PASS1_MODEL, PASS1_VERSION, POSTS_PER_REQUEST, type Pass1Input } from "../src/pipeline/ai/pass1";
import { saveLabels, startAiRun, finishAiRun } from "../src/pipeline/labels";

// Full pass 1 run. Resumable: it only picks posts with no answer from the current
// instruction version, and saves each group of posts as soon as it comes back, so it
// can be stopped at any point and started again tomorrow.
// Usage: npx tsx scripts/pass1-run.mts [--sources play_store,app_store,youtube,tradingqna] [--budget 2200000] [--parallel 5]
//    or: npx tsx scripts/pass1-run.mts --sample reddit:post:4000,reddit:comment:5000 --seed 2031
// A sample is a fixed random draw: the same seed always picks the same posts, so a
// stopped sample run resumes on exactly the same posts.
function arg(name: string, fallback: string) {
  const index = process.argv.indexOf(`--${name}`);
  return index > -1 ? process.argv[index + 1] : fallback;
}
const SOURCES = arg("sources", "play_store,app_store,youtube,tradingqna").split(",");
const BUDGET = Number(arg("budget", "2200000")); // tokens; stop before the 2.5M daily allowance
const PARALLEL = Number(arg("parallel", "5"));

const SAMPLE = arg("sample", "");
const SEED = Number(arg("seed", "2031"));

function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const db = openDb();
const done = new Set((db.prepare(
  "SELECT post_id FROM labels WHERE task = 'pass1' AND rater = ? AND json_extract(value, '$.version') = ?",
).all(PASS1_MODEL, PASS1_VERSION) as { post_id: string }[]).map((row) => row.post_id));

let wanted: string[];
let scope: string;
if (SAMPLE) {
  // Shuffle each group's candidates with the seed and take the first N.
  const next = random(SEED);
  wanted = [];
  for (const spec of SAMPLE.split(",")) {
    const [source, recordType, size] = spec.split(":");
    const ids = (db.prepare("SELECT id FROM posts WHERE keyword_pass = 1 AND source = ? AND record_type = ? ORDER BY id")
      .all(source, recordType) as { id: string }[]).map((row) => row.id);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    wanted.push(...ids.slice(0, Number(size)));
  }
  writeFileSync(`data/sample-${SEED}.json`, JSON.stringify({ seed: SEED, sample: SAMPLE, ids: wanted }, null, 2), "utf8");
  scope = `sample ${SAMPLE}, seed ${SEED}`;
} else {
  const placeholders = SOURCES.map(() => "?").join(",");
  wanted = (db.prepare(`SELECT id FROM posts WHERE keyword_pass = 1 AND source IN (${placeholders}) ORDER BY source, id`)
    .all(...SOURCES) as { id: string }[]).map((row) => row.id);
  scope = SOURCES.join(", ");
}
const fetchPost = db.prepare("SELECT id, source, context, title, text FROM posts WHERE id = ?");
const todo = wanted.filter((id) => !done.has(id)).map((id) => fetchPost.get(id) as unknown as Pass1Input);

console.log(`${todo.length} of ${wanted.length} posts still need ${PASS1_VERSION} (${scope}). Budget ${BUDGET.toLocaleString()} tokens, ${PARALLEL} in parallel.`);
if (todo.length === 0) process.exit(0);

const chunks: Pass1Input[][] = [];
for (let start = 0; start < todo.length; start += POSTS_PER_REQUEST) chunks.push(todo.slice(start, start + POSTS_PER_REQUEST));

const client = new OpenAI({ maxRetries: 5 });
const runId = startAiRun(db, { task: "pass1", model: PASS1_MODEL, mode: "live", posts: todo.length, note: `${PASS1_VERSION} full run on ${scope}` });
let inputTokens = 0;
let outputTokens = 0;
let answered = 0;
let relevant = 0;
let missing = 0;
let doneChunks = 0;
let stopReason = "";
let next = 0;

async function worker() {
  while (!stopReason && next < chunks.length) {
    if (inputTokens + outputTokens >= BUDGET) { stopReason = "token budget reached"; break; }
    const chunk = chunks[next++];
    try {
      const response = await client.chat.completions.create(pass1Request(chunk));
      inputTokens += response.usage?.prompt_tokens ?? 0;
      outputTokens += response.usage?.completion_tokens ?? 0;
      const result = readPass1(chunk, response.choices[0].message.content ?? '{"results":[]}');
      saveLabels(db, "pass1", PASS1_MODEL, runId, result.answers.map((answer) => ({
        postId: answer.postId,
        value: { relevant: answer.relevant, experience: answer.experience, reason: answer.reason, version: PASS1_VERSION },
      })));
      answered += result.answers.length;
      relevant += result.answers.filter((answer) => answer.relevant).length;
      missing += result.missing.length; // left without an answer, so the next run picks them up
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === "insufficient_quota") { stopReason = "OpenAI says the quota is used up"; break; }
      console.log(`a group of ${chunk.length} failed (${(error as Error).message.slice(0, 120)}); it will be retried on the next run`);
    }
    doneChunks++;
    if (doneChunks % 25 === 0) {
      console.log(`${new Date().toLocaleTimeString()}  ${answered} of ${todo.length} answered, ${relevant} relevant, ${(inputTokens + outputTokens).toLocaleString()} tokens`);
      finishAiRun(db, runId, { inputTokens, outputTokens, status: "running" });
    }
  }
}

await Promise.all(Array.from({ length: PARALLEL }, worker));
finishAiRun(db, runId, { inputTokens, outputTokens, status: stopReason ? `stopped: ${stopReason}` : "done" });
console.log(`\n${stopReason ? `Stopped: ${stopReason}.` : "Finished."} ${answered} answered, ${relevant} relevant, ${missing} without an answer. Tokens: ${(inputTokens + outputTokens).toLocaleString()} (${inputTokens.toLocaleString()} in, ${outputTokens.toLocaleString()} out).`);

const summary = db.prepare(`
  SELECT p.source,
    COUNT(*) AS answered,
    SUM(json_extract(l.value, '$.relevant')) AS relevant,
    SUM(json_extract(l.value, '$.relevant') = 1 AND json_extract(l.value, '$.experience') = 'first_time') AS first_time,
    SUM(json_extract(l.value, '$.relevant') = 1 AND json_extract(l.value, '$.experience') = 'experienced') AS experienced
  FROM labels l JOIN posts p ON p.id = l.post_id
  WHERE l.task = 'pass1' AND l.rater = ? AND json_extract(l.value, '$.version') = ?
  GROUP BY p.source
`).all(PASS1_MODEL, PASS1_VERSION);
console.table(summary);
const nowDone = new Set((db.prepare(
  "SELECT post_id FROM labels WHERE task = 'pass1' AND rater = ? AND json_extract(value, '$.version') = ?",
).all(PASS1_MODEL, PASS1_VERSION) as { post_id: string }[]).map((row) => row.post_id));
const left = wanted.filter((id) => !nowDone.has(id)).length;
console.log(`${left} posts still to do. Run the same command again to continue.`);
