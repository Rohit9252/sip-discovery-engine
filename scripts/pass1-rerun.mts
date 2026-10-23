import "dotenv/config";
import { readFileSync } from "node:fs";
import OpenAI from "openai";
import { openDb } from "../src/pipeline/db";
import { pass1Request, readPass1, PASS1_MODEL, PASS1_VERSION, POSTS_PER_REQUEST, type Pass1Input } from "../src/pipeline/ai/pass1";
import { saveLabels, startAiRun, finishAiRun } from "../src/pipeline/labels";

// Reruns the current pass 1 instructions on the posts of an earlier check
// (data/check-<seed>-posts.txt), so a new version can be compared on the same posts.
// Usage: npx tsx scripts/pass1-rerun.mts 2028
const seed = process.argv[2] ?? "2028";
const ids = [...readFileSync(`data/check-${seed}-posts.txt`, "utf8").matchAll(/^#\d+ (\S+) \[/gm)].map((match) => match[1]);
const db = openDb();
const posts = ids.map((id) => db.prepare("SELECT id, source, context, title, text FROM posts WHERE id = ?").get(id) as unknown as Pass1Input);

const client = new OpenAI();
const runId = startAiRun(db, { task: "pass1", model: PASS1_MODEL, mode: "live", posts: posts.length, note: `${PASS1_VERSION} rerun on check ${seed}` });
let inputTokens = 0;
let outputTokens = 0;
const answers: Awaited<ReturnType<typeof readPass1>>["answers"] = [];
for (let start = 0; start < posts.length; start += POSTS_PER_REQUEST) {
  const chunk = posts.slice(start, start + POSTS_PER_REQUEST);
  const response = await client.chat.completions.create(pass1Request(chunk));
  inputTokens += response.usage?.prompt_tokens ?? 0;
  outputTokens += response.usage?.completion_tokens ?? 0;
  const result = readPass1(chunk, response.choices[0].message.content ?? '{"results":[]}');
  if (result.missing.length) console.log("missing answers for:", result.missing);
  answers.push(...result.answers);
}
saveLabels(db, "pass1", PASS1_MODEL, runId, answers.map((answer) => ({
  postId: answer.postId,
  value: { relevant: answer.relevant, experience: answer.experience, reason: answer.reason, version: PASS1_VERSION },
})));
finishAiRun(db, runId, { inputTokens, outputTokens, status: "done" });
console.log(`${answers.length} answered with ${PASS1_VERSION}. Tokens: ${inputTokens + outputTokens}.`);
