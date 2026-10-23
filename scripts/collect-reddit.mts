import { SINCE, SUBREDDITS } from "../src/pipeline/sources";
import { openDb, startRun, finishRun, savePosts } from "../src/pipeline/db";
import { getJson } from "../src/pipeline/http";
import { matchedTerms } from "../src/pipeline/keywords";
import type { Post } from "../src/pipeline/types";

// Reddit archive. Its keyword search times out, so we page each subreddit by date
// and filter locally, as in attempt one.
const API = "https://arctic-shift.photon-reddit.com/api";
const PAGES_PER_SUBREDDIT = 150; // 100 posts per page
const THREADS_FOR_COMMENTS = 300;
const COMMENTS_PER_THREAD = 100;

// Threads worth opening for comments: they mention SIPs and also talk about keeping,
// stopping or how it is going, which is where people tell their own story.
const STORY_HINT = /\b(stop|stopped|pause|paused|continue|continuing|kept|keep going|red|loss|losses|negative|first|beginner|started|starting|months?|years?|returns?|expect|worth|quit|redeem|withdraw|discipline|xirr)\b/i;

type RedditPost = { id: string; title?: string; selftext?: string; created_utc: number; num_comments?: number; permalink?: string };
type RedditComment = { id: string; body?: string; created_utc: number };
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// The archive sometimes answers a busy moment with {"data": null, "error": "Timeout"}
// and a 200 status. That is not "no more posts", so wait and ask again.
async function archive<T>(url: string): Promise<T[]> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const body = await getJson<{ data: T[] | null; error?: string }>(url, 5);
    if (body.data) return body.data;
    if (!body.error) return [];
    await sleep(5000 * (attempt + 1));
  }
  throw new Error("Archive kept timing out");
}
const clean = (text?: string) => (text && !["[removed]", "[deleted]"].includes(text.trim()) ? text.trim() : "");

const db = openDb();
const runId = startRun(db, "reddit");
const errors: object[] = [];
const summary: Record<string, object> = {};
const candidates: { post: RedditPost; subreddit: string }[] = [];

for (const subreddit of SUBREDDITS) {
  const posts: Post[] = [];
  let before: number | undefined;
  for (let page = 0; page < PAGES_PER_SUBREDDIT; page++) {
    const params = new URLSearchParams({ subreddit, limit: "100", sort: "desc", after: SINCE });
    if (before) params.set("before", String(before));
    let items: RedditPost[] = [];
    try {
      items = await archive<RedditPost>(`${API}/posts/search?${params}`);
    } catch (error) {
      errors.push({ subreddit, page, error: String(error) });
      break;
    }
    if (items.length === 0) break;
    for (const item of items) {
      const title = clean(item.title);
      const body = clean(item.selftext);
      if (!title && !body) continue;
      posts.push({
        id: `reddit:${item.id}`,
        source: "reddit",
        app: null,
        url: `https://www.reddit.com${item.permalink ?? `/r/${subreddit}/comments/${item.id}/`}`,
        createdAt: new Date(item.created_utc * 1000).toISOString(),
        title,
        text: body,
        rating: null,
        context: `r/${subreddit}`,
        recordType: "post",
      });
      const text = `${title}\n${body}`;
      if ((item.num_comments ?? 0) >= 3 && matchedTerms(text).length > 0 && STORY_HINT.test(text)) {
        candidates.push({ post: item, subreddit });
      }
    }
    const oldest = Math.min(...items.map((item) => item.created_utc));
    if (items.length < 100 || (before !== undefined && oldest >= before)) break;
    before = oldest;
    if ((page + 1) % 10 === 0) console.log(`r/${subreddit}: ${page + 1} pages, back to ${new Date(oldest * 1000).toISOString().slice(0, 10)}`);
    await sleep(1500);
  }
  summary[subreddit] = { posts: posts.length, added: savePosts(db, posts, runId) };
  console.log(`r/${subreddit}: ${posts.length} posts`);
}

// Open the most-discussed story threads and keep their comments.
candidates.sort((a, b) => (b.post.num_comments ?? 0) - (a.post.num_comments ?? 0));
const threads = candidates.slice(0, THREADS_FOR_COMMENTS);
let commentTotal = 0;
for (const [index, { post, subreddit }] of threads.entries()) {
  const params = new URLSearchParams({ link_id: post.id, limit: String(COMMENTS_PER_THREAD), sort: "desc" });
  let items: RedditComment[] = [];
  try {
    items = await archive<RedditComment>(`${API}/comments/search?${params}`);
  } catch (error) {
    errors.push({ thread: post.id, error: String(error) });
    continue;
  }
  const comments: Post[] = items
    .filter((item) => clean(item.body))
    .map((item) => ({
      id: `reddit:comment_${item.id}`,
      source: "reddit",
      app: null,
      url: `https://www.reddit.com/comments/${post.id}/_/${item.id}/`,
      createdAt: new Date(item.created_utc * 1000).toISOString(),
      title: "",
      text: clean(item.body),
      rating: null,
      context: clean(post.title) || `r/${subreddit}`,
      recordType: "comment",
    }));
  commentTotal += savePosts(db, comments, runId);
  if ((index + 1) % 25 === 0) console.log(`comments: ${index + 1} of ${threads.length} threads, ${commentTotal} new comments`);
  await sleep(1500);
}

finishRun(db, runId, {
  since: SINCE, subreddits: SUBREDDITS, pagesPerSubreddit: PAGES_PER_SUBREDDIT,
  storyThreadsFound: candidates.length, threadsOpened: threads.length, commentsAdded: commentTotal,
  summary, errors,
});
console.table(db.prepare(`
  SELECT record_type, COUNT(*) AS total, SUM(keyword_pass) AS kept, MIN(created_at) AS oldest, MAX(created_at) AS newest
  FROM posts WHERE source = 'reddit' GROUP BY record_type
`).all());
if (errors.length) console.log("errors:", errors.slice(0, 10), errors.length > 10 ? `...and ${errors.length - 10} more` : "");
