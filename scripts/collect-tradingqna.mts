import { SINCE } from "../src/pipeline/sources";
import { openDb, startRun, finishRun, savePosts } from "../src/pipeline/db";
import { getJson } from "../src/pipeline/http";
import type { Post } from "../src/pipeline/types";

// TradingQ&A runs on Discourse, which has a public JSON search and thread API.
const BASE = "https://tradingqna.com";
const QUERIES = [
  "stop sip", "pause sip", "sip mandate", "sip loss", "first sip", "continue sip",
  "sip negative returns", "coin sip", "sip bounce", "sip failed", "sip returns", "sip skip",
];
const SEARCH_PAGES = 3;

type Search = { topics?: { id: number; title: string; slug: string }[] };
type Thread = { title: string; slug: string; post_stream: { posts: { id: number; post_number: number; cooked: string; created_at: string }[] } };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const plain = (html: string) =>
  html.replace(/<aside[\s\S]*?<\/aside>/g, " ").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();

const db = openDb();
const runId = startRun(db, "tradingqna");
const errors: object[] = [];
const topics = new Map<number, string>();

for (const q of QUERIES) {
  for (let page = 1; page <= SEARCH_PAGES; page++) {
    try {
      const result = await getJson<Search>(`${BASE}/search.json?${new URLSearchParams({ q: `${q} after:${SINCE}`, page: String(page) })}`);
      const found = result.topics ?? [];
      for (const topic of found) topics.set(topic.id, topic.title);
      if (found.length < 50) break;
    } catch (error) {
      errors.push({ query: q, page, error: String(error) });
      break;
    }
    await sleep(1200);
  }
}
console.log(`${topics.size} threads found`);

let total = 0;
for (const [id] of topics) {
  let thread: Thread;
  try {
    thread = await getJson<Thread>(`${BASE}/t/${id}.json`);
  } catch (error) {
    errors.push({ thread: id, error: String(error) });
    continue;
  }
  const posts: Post[] = thread.post_stream.posts
    .filter((post) => new Date(post.created_at) >= new Date(SINCE))
    .map((post): Post => ({
      id: `tradingqna:${post.id}`,
      source: "tradingqna",
      app: null,
      url: `${BASE}/t/${thread.slug}/${id}/${post.post_number}`,
      createdAt: new Date(post.created_at).toISOString(),
      title: post.post_number === 1 ? thread.title : "",
      text: plain(post.cooked),
      rating: null,
      context: thread.title,
      recordType: post.post_number === 1 ? "post" : "comment",
    }))
    .filter((post) => post.text.length > 0);
  total += savePosts(db, posts, runId);
  await sleep(1200);
}

finishRun(db, runId, { since: SINCE, queries: QUERIES, threads: topics.size, postsAdded: total, errors });
console.table(db.prepare(`
  SELECT record_type, COUNT(*) AS total, SUM(keyword_pass) AS kept, MIN(created_at) AS oldest, MAX(created_at) AS newest
  FROM posts WHERE source = 'tradingqna' GROUP BY record_type
`).all());
if (errors.length) console.log("errors:", errors);
