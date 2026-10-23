import "dotenv/config";
import { SINCE } from "../src/pipeline/sources";
import { openDb, startRun, finishRun, savePosts } from "../src/pipeline/db";
import { getJson } from "../src/pipeline/http";
import { matchedTerms } from "../src/pipeline/keywords";
import type { Post } from "../src/pipeline/types";

const API = "https://www.googleapis.com/youtube/v3";
const KEY = process.env.YOUTUBE_API_KEY;
if (!KEY) throw new Error("YOUTUBE_API_KEY is missing from .env");

// English and Hindi searches, India region. We keep the 25 videos with the most
// comments, so nobody can say we hand-picked friendly ones.
const QUERIES: { q: string; lang: string }[] = [
  { q: "should I stop my SIP", lang: "en" },
  { q: "SIP negative returns", lang: "en" },
  { q: "my first SIP experience", lang: "en" },
  { q: "SIP 1 year results", lang: "en" },
  { q: "Groww SIP", lang: "en" },
  { q: "SIP for beginners mistakes", lang: "en" },
  { q: "stop SIP market crash", lang: "en" },
  { q: "SIP pause or stop", lang: "en" },
  { q: "SIP band karna chahiye", lang: "hi" },
  { q: "SIP me loss kya kare", lang: "hi" },
  { q: "SIP kaise shuru kare", lang: "hi" },
  { q: "SIP बंद करें या नहीं", lang: "hi" },
];
const VIDEOS_TO_KEEP = 25;
const PAGES_PER_VIDEO = 3; // 100 comments per page

type SearchResult = { items: { id: { videoId?: string } }[] };
type VideoList = { items: { id: string; snippet: { title: string; publishedAt: string }; statistics: { commentCount?: string } }[] };
type CommentPage = {
  nextPageToken?: string;
  items: { id: string; snippet: { topLevelComment: { id: string; snippet: { textOriginal?: string; publishedAt: string } } } }[];
};

const db = openDb();
const runId = startRun(db, "youtube");
const errors: object[] = [];

const found = new Map<string, string>(); // video id -> query that found it
for (const { q, lang } of QUERIES) {
  const params = new URLSearchParams({ key: KEY, part: "snippet", q, type: "video", regionCode: "IN", relevanceLanguage: lang, maxResults: "25" });
  try {
    const result = await getJson<SearchResult>(`${API}/search?${params}`);
    for (const item of result.items) if (item.id.videoId && !found.has(item.id.videoId)) found.set(item.id.videoId, q);
  } catch (error) {
    errors.push({ query: q, error: String(error) });
  }
}

const videos: VideoList["items"] = [];
const ids = [...found.keys()];
for (let start = 0; start < ids.length; start += 50) {
  const params = new URLSearchParams({ key: KEY, part: "snippet,statistics", id: ids.slice(start, start + 50).join(",") });
  videos.push(...(await getJson<VideoList>(`${API}/videos?${params}`)).items);
}
videos.sort((a, b) => Number(b.statistics.commentCount ?? 0) - Number(a.statistics.commentCount ?? 0));
// Search matched "sip" as in sipping tea once ("How to use a new matcha whisk"), so a
// video only counts if its own title mentions SIPs or mutual funds (DE-07 correction).
const offTopic = videos.filter((video) => matchedTerms(video.snippet.title).length === 0);
const chosen = videos.filter((video) => matchedTerms(video.snippet.title).length > 0).slice(0, VIDEOS_TO_KEEP);

const chosenList: object[] = [];
let total = 0;
for (const video of chosen) {
  const posts: Post[] = [];
  let token: string | undefined;
  for (let page = 0; page < PAGES_PER_VIDEO; page++) {
    const params = new URLSearchParams({ key: KEY, part: "snippet", videoId: video.id, textFormat: "plainText", order: "relevance", maxResults: "100" });
    if (token) params.set("pageToken", token);
    let data: CommentPage;
    try {
      data = await getJson<CommentPage>(`${API}/commentThreads?${params}`);
    } catch (error) {
      errors.push({ video: video.id, error: String(error) });
      break;
    }
    for (const item of data.items) {
      const comment = item.snippet.topLevelComment;
      const text = comment.snippet.textOriginal?.trim() ?? "";
      if (!text || new Date(comment.snippet.publishedAt) < new Date(SINCE)) continue;
      posts.push({
        id: `youtube:${comment.id}`,
        source: "youtube",
        app: null,
        url: `https://www.youtube.com/watch?v=${video.id}&lc=${comment.id}`,
        createdAt: new Date(comment.snippet.publishedAt).toISOString(),
        title: "",
        text,
        rating: null,
        context: video.snippet.title,
        recordType: "comment",
      });
    }
    token = data.nextPageToken;
    if (!token) break;
  }
  total += savePosts(db, posts, runId);
  chosenList.push({ id: video.id, title: video.snippet.title, comments: Number(video.statistics.commentCount ?? 0), kept: posts.length, foundBy: found.get(video.id) });
  console.log(`${posts.length} comments: ${video.snippet.title}`);
}

finishRun(db, runId, {
  since: SINCE, queries: QUERIES, videosFound: videos.length, chosen: chosenList,
  offTopicSkipped: offTopic.map((video) => ({ id: video.id, title: video.snippet.title })), commentsAdded: total, errors });
console.table(db.prepare(`
  SELECT COUNT(*) AS total, SUM(keyword_pass) AS kept, MIN(created_at) AS oldest, MAX(created_at) AS newest
  FROM posts WHERE source = 'youtube'
`).all());
if (errors.length) console.log("errors:", errors);
