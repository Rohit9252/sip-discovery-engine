import "dotenv/config";
import { readFileSync } from "node:fs";
import OpenAI from "openai";
import { openDb } from "../src/pipeline/db";
import { runPass2Batch, PASS2_MODEL, PASS2_VERSION, PASS2_POSTS_PER_REQUEST, type Pass2Input } from "../src/pipeline/ai/pass2";
import { saveLabels, startAiRun, finishAiRun } from "../src/pipeline/labels";

// Runs the current pass 2 instructions on the golden set only, so a new version is scored
// against the answer key before any full run. Usage: npx tsx scripts/golden-run.mts [--seed 2070]
const SEED = process.argv.includes("--seed") ? process.argv[process.argv.indexOf("--seed") + 1] : "2070";
const { posts } = JSON.parse(readFileSync(`data/golden-${SEED}.json`, "utf8")) as { posts: { id: string }[] };
const db = openDb();
const fetchPost = db.prepare("SELECT id, source, context, title, text, created_at AS createdAt, record_type AS recordType FROM posts WHERE id = ?");
const inputs = posts.map(({ id }) => fetchPost.get(id) as unknown as Pass2Input);
const client = new OpenAI({ maxRetries: 5 });
const runId = startAiRun(db, { task: "pass2", model: PASS2_MODEL, mode: "live", posts: inputs.length, note: `${PASS2_VERSION} golden set ${SEED}` });
let inputTokens = 0;
let outputTokens = 0;
const chunks: Pass2Input[][] = [];
for (let i = 0; i < inputs.length; i += PASS2_POSTS_PER_REQUEST) chunks.push(inputs.slice(i, i + PASS2_POSTS_PER_REQUEST));
for (const result of await Promise.all(chunks.map((chunk) => runPass2Batch(client, chunk)))) {
  inputTokens += result.inputTokens;
  outputTokens += result.outputTokens;
  saveLabels(db, "pass2", PASS2_MODEL, runId, result.answers.map(({ postId, id, ...fields }) => ({ postId, value: { ...fields, version: PASS2_VERSION } })));
  if (result.missing.length) console.log("no answer for", result.missing);
}
finishAiRun(db, runId, { inputTokens, outputTokens, status: "done" });
console.log(`${PASS2_VERSION} on ${inputs.length} golden posts: ${(inputTokens + outputTokens).toLocaleString("en-US")} tokens`);
