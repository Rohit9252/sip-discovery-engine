import "dotenv/config";
import OpenAI from "openai";
import { openDb } from "../src/pipeline/db";
import { pass1Request, readPass1, PASS1_MODEL, PASS1_VERSION, type Pass1Input } from "../src/pipeline/ai/pass1";
import { saveLabels, startAiRun, finishAiRun } from "../src/pipeline/labels";

// DE-09 / DE-10: run pass 1 live on a small, mixed sample and print every answer next to
// its post, so a person can judge the instructions before any batch run.
// Usage: npx tsx scripts/pass1-test.mts [size] [seed] [--blind]
//   20 posts by default. --blind draws only posts with no pass 1 answer yet, saves the
//   engine's answers without printing them, and writes the posts alone to
//   data/check-<seed>-posts.txt so a second rater can label them without seeing the engine.
const SIZE = Number(process.argv[2]) || 20;
const SEED = Number(process.argv[3]) || 2027;
const BLIND = process.argv.includes("--blind");

// Mix for the 20-post test; scaled up for larger runs. Store reviews, YouTube and TradingQ&A only.
const MIX: { label: string; where: string; share: number }[] = [
  { label: "Play Store Groww", where: "source = 'play_store' AND app = 'groww'", share: 6 },
  { label: "Play Store other apps", where: "source = 'play_store' AND app != 'groww'", share: 3 },
  { label: "App Store", where: "source = 'app_store'", share: 2 },
  { label: "YouTube", where: "source = 'youtube'", share: 6 },
  { label: "TradingQ&A", where: "source = 'tradingqna'", share: 3 },
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
const posts: (Pass1Input & { group: string })[] = [];
for (const group of MIX) {
  const take = Math.round((group.share / 20) * SIZE);
  const fresh = BLIND ? "AND id NOT IN (SELECT post_id FROM labels WHERE task = 'pass1')" : "";
  const ids = db.prepare(`SELECT id FROM posts WHERE keyword_pass = 1 AND ${group.where} ${fresh} ORDER BY id`).all() as { id: string }[];
  const chosen = new Set<number>();
  while (chosen.size < Math.min(take, ids.length)) chosen.add(Math.floor(next() * ids.length));
  for (const index of chosen) {
    const row = db.prepare("SELECT id, source, context, title, text FROM posts WHERE id = ?").get(ids[index].id) as unknown as Pass1Input;
    posts.push({ ...row, group: group.label });
  }
}

const client = new OpenAI();
const runId = startAiRun(db, { task: "pass1", model: PASS1_MODEL, mode: "live", posts: posts.length, note: `${PASS1_VERSION} test, ${posts.length} posts, seed ${SEED}` });
let inputTokens = 0;
let outputTokens = 0;
const answers: Awaited<ReturnType<typeof readPass1>>["answers"] = [];
for (let start = 0; start < posts.length; start += 20) {
  const chunk = posts.slice(start, start + 20);
  const response = await client.chat.completions.create(pass1Request(chunk));
  inputTokens += response.usage?.prompt_tokens ?? 0;
  outputTokens += response.usage?.completion_tokens ?? 0;
  const result = readPass1(chunk, response.choices[0].message.content ?? '{"results":[]}');
  if (result.missing.length) console.log("missing answers for:", result.missing);
  answers.push(...result.answers);
}
// Keep the previous answers so the printout can show what a new instruction version changed.
const previous = new Map(
  (db.prepare("SELECT post_id, value FROM labels WHERE task = 'pass1' AND rater = ?").all(PASS1_MODEL) as { post_id: string; value: string }[])
    .map((row) => [row.post_id, JSON.parse(row.value) as { relevant: boolean; experience: string; version: string }]),
);
saveLabels(db, "pass1", PASS1_MODEL, runId, answers.map((answer) => ({
  postId: answer.postId,
  value: { relevant: answer.relevant, experience: answer.experience, reason: answer.reason, version: PASS1_VERSION },
})));
finishAiRun(db, runId, { inputTokens, outputTokens, status: "done" });

if (BLIND) {
  const { writeFileSync } = await import("node:fs");
  const sheet = posts.map((post, index) => {
    const body = [post.title, post.text].filter(Boolean).join(": ").replace(/\s+/g, " ");
    return `#${index + 1} ${post.id} [${post.group}]${post.context ? ` (under: ${post.context})` : ""}\n${body.slice(0, 1500)}`;
  });
  writeFileSync(`data/check-${SEED}-posts.txt`, sheet.join("\n\n") + "\n", "utf8");
  console.log(`${answers.length} answered (answers saved, not shown). Posts for blind labelling: data/check-${SEED}-posts.txt`);
  console.log(`Tokens: ${inputTokens} in + ${outputTokens} out = ${inputTokens + outputTokens} (${Math.round((inputTokens + outputTokens) / posts.length)} per post).`);
  process.exit(0);
}
const byId = new Map(answers.map((answer) => [answer.postId, answer]));
posts.forEach((post, index) => {
  const answer = byId.get(post.id);
  const body = [post.title, post.text].filter(Boolean).join(": ").replace(/\s+/g, " ");
  console.log(`\n#${index + 1} [${post.group}]${post.context ? ` (under: ${post.context.slice(0, 70)})` : ""}`);
  console.log(`   POST: ${body.slice(0, 220)}${body.length > 220 ? "..." : ""}`);
  console.log(`   AI:   ${answer ? `${answer.relevant ? "RELEVANT" : "not relevant"} | ${answer.experience} | ${answer.reason}` : "NO ANSWER"}`);
  const before = previous.get(post.id);
  if (answer && before && before.version !== PASS1_VERSION && (before.relevant !== answer.relevant || before.experience !== answer.experience)) {
    console.log(`   CHANGED from ${before.version}: was ${before.relevant ? "RELEVANT" : "not relevant"} | ${before.experience}`);
  }
});
const relevant = answers.filter((answer) => answer.relevant).length;
console.log(`\n${answers.length} answered, ${relevant} relevant. Tokens: ${inputTokens} in + ${outputTokens} out = ${inputTokens + outputTokens} (${Math.round((inputTokens + outputTokens) / posts.length)} per post).`);
