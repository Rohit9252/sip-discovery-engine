import { writeFileSync } from "node:fs";
import posts from "../src/data/posts.json";
import { openDb } from "../src/pipeline/db";

// Picks the golden set: 30 posts from the pass 2 sample for a person to label by hand, blind.
// A fixed random draw within each source (20 first-time, 10 others), then swaps inside the same
// source until the set covers Hindi or Hinglish, drop-offs, many stages and long posts.
// The coverage swaps use the AI's own labels, which is said in the Evidence Log.
// Usage: npx tsx scripts/golden-pick.mts [--seed 2070]
const SEED = process.argv.includes("--seed") ? Number(process.argv[process.argv.indexOf("--seed") + 1]) : 2070;
type P = (typeof posts)[number];

const group = (post: P) =>
  post.source.startsWith("Play Store review · Groww") ? "play_groww"
  : /^(Play|App) Store/.test(post.source) ? "store_other"
  : post.source === "Reddit post" ? "reddit_post"
  : post.source === "Reddit comment" ? "reddit_comment"
  : post.source === "YouTube comment" ? "youtube" : "tradingqna";

const PLAN: Record<string, number> = {
  "first:reddit_post": 8, "first:youtube": 4, "first:play_groww": 3, "first:reddit_comment": 2, "first:store_other": 2, "first:tradingqna": 1,
  "other:play_groww": 2, "other:store_other": 2, "other:reddit_post": 2, "other:youtube": 2, "other:reddit_comment": 1, "other:tradingqna": 1,
};

function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const next = random(SEED);
const shuffle = <T,>(list: T[]) => {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const pools = new Map<string, P[]>();
for (const post of posts) {
  const key = `${post.first ? "first" : "other"}:${group(post)}`;
  pools.set(key, [...(pools.get(key) ?? []), post]);
}
for (const [key, list] of pools) pools.set(key, shuffle(list));

const chosen = new Map<string, { post: P; key: string; why: string }>();
for (const [key, n] of Object.entries(PLAN)) for (const post of pools.get(key)!.slice(0, n)) chosen.set(post.id, { post, key, why: "random" });

// Coverage checks, each with the posts that would satisfy it.
const HINDI = /[ऀ-ॿ]|\b(hai|nahi|kya|mera|mujhe|karna|paisa|hota|kaise|kyun)\b/i;
const DROPPED = ["reduced", "paused", "stopped", "bounce", "switched_app", "thinking_of_stopping"];
const NEEDS: { name: string; test: (post: P) => boolean; min: number }[] = [
  { name: "Hindi or Hinglish", test: (post) => HINDI.test(post.text), min: 4 },
  { name: "dropping off (AI label)", test: (post) => post.fields.what_happened?.some((code) => DROPPED.includes(code)) ?? false, min: 6 },
  { name: "long post (600+ characters)", test: (post) => post.text.length >= 600, min: 4 },
  { name: "no theme (AI label)", test: (post) => post.theme === "none", min: 2 },
  { name: "stage stated (AI label)", test: (post) => !!post.fields.stage, min: 12 },
];
for (const need of NEEDS) {
  let have = [...chosen.values()].filter((item) => need.test(item.post)).length;
  // Swap a random pick that does not meet any need for a post from the same source that does.
  for (const item of shuffle([...chosen.values()])) {
    if (have >= need.min) break;
    if (item.why !== "random" || NEEDS.some((other) => other.test(item.post))) continue;
    const swap = pools.get(item.key)!.find((post) => need.test(post) && !chosen.has(post.id));
    if (!swap) continue;
    chosen.delete(item.post.id);
    chosen.set(swap.id, { post: swap, key: item.key, why: `swapped in for coverage: ${need.name}` });
    have++;
  }
}

// The text the AI saw in pass 2: title and body, up to 2,000 characters, plus what a reply was under.
const db = openDb();
const full = db.prepare("SELECT title, text, context FROM posts WHERE id = ?");
const set = shuffle([...chosen.values()]).map(({ post, key, why }, index) => {
  const row = full.get(post.id) as { title: string; text: string; context: string | null };
  return {
    n: index + 1,
    id: post.id,
    group: key,
    why,
    source: post.source,
    date: post.date,
    url: post.url,
    context: row.context ?? "",
    text: [row.title, row.text].filter(Boolean).join(": ").replace(/\s+/g, " ").slice(0, 2000).toWellFormed(),
  };
});
writeFileSync(`data/golden-${SEED}.json`, JSON.stringify({ seed: SEED, posts: set }, null, 2) + "\n", "utf8");
for (const need of NEEDS) console.log(`${need.name}: ${set.filter((item) => need.test(chosen.get(item.id)!.post)).length} (wanted ${need.min})`);
console.log(`${set.length} posts, ${set.filter((item) => item.why !== "random").length} swapped in for coverage. Saved data/golden-${SEED}.json`);
