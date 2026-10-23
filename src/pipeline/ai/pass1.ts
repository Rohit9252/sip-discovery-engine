// AI pass 1: is a post relevant, and is its author a first-time investor?
// This file is the single source of these instructions. The pipeline (live and batch)
// and the site's "Try it" box both import it, so a pasted post is judged exactly as the
// pipeline judges it.

export const PASS1_MODEL = "gpt-4.1-mini";
export const PASS1_VERSION = "pass1-v5";
export const POSTS_PER_REQUEST = 20;
const MAX_CHARS = 1500;

export const PASS1_INSTRUCTIONS = `You read public posts by investors in India: app store reviews, Reddit posts and comments, YouTube comments and forum replies. Some are in Hindi or Hinglish.

For each post, answer two questions.

1. relevant (true or false)
Relevant means the post tells us something about a real person's own SIP or mutual fund investing: what they did, what happened to them, what they check, how they feel, or a decision they face. A SIP here means a SIP in mutual funds, including index funds. SIPs in stocks or ETFs bought through a broker, and basket orders, do not count. The words "SIP" or "mutual fund" alone never make a post relevant.

True when the writer, or someone they describe:
- starts, keeps, pauses, skips, reduces, increases, steps up, stops or redeems a SIP or their mutual fund investment, or is deciding whether to
- has a problem with their own SIP or mutual fund money, even if they never say SIP: an instalment failed or was missed, autopay or mandate trouble, money debited but not showing, NAV not allotted after paying, unable to redeem or withdraw, KYC blocking their investment, the app moving their funds to another plan, a penalty
- checks their returns or portfolio, or asks the app to show something about their returns or holdings (XIRR, daily gain or loss, 1-day change, gain or loss per SIP, a goal view, a portfolio breakdown). Such a request is relevant even when it reads like a feature request, because it tells us what investors check.
- shares what they expected from a SIP, how its returns made them feel, or their own returns
- describes how their view of SIPs changed, or who or what convinced them to start (friends, family, videos, an app)
- states a plan for their own SIP ("I will step up 10% every year", "I'll review my SIP")
- asks whether or when to start, continue or stop a SIP (but not which fund)

False when the post:
- asks or advises which fund, stock or ETF to pick, or is about sorting, filtering, comparing or finding funds, or a fund not being available ("kis fund mein SIP karu" is false)
- tells someone else what to do (a reply giving instructions or advice), or is a bare reaction with no situation in it ("13 lakh portfolio 😱")
- is about a paid app subscription or membership rather than mutual fund money
- is praise or a description that only mentions SIPs or mutual funds ("best app for SIP", "investment ho ya SIP dono sahi", "easy to start and cancel SIPs")
- is a reply from the company's staff, a product announcement, news, a newsletter, or a general explainer about tax rules or charges
- is a general opinion about markets or SIPs with no personal situation in it
- is about stock trading, F&O, IPOs (including IPO mandates), gold, FDs, PPF, loans, or app problems unrelated to mutual funds
- is thanks or praise for a video

Judge the post's own words. The context line (the video or thread title) only helps you understand what the post refers to. A post must say something relevant itself.

2. experience ("first_time", "experienced" or "not_stated")
first_time: the writer says it is their first SIP or first time investing, or that they started less than a year ago.
experienced: the writer gives a time of a year or more, such as "5 years of SIP", "investing since 2019" or "my SIP is 2 years old". Having several SIPs, or sounding confident, is not a time.
not_stated: anything else. Never guess from tone or wording.

reason: at most 12 words in English saying why.

Answer for every post, using its id.`;

export const PASS1_SCHEMA = {
  name: "pass1",
  strict: true,
  schema: {
    type: "object",
    properties: {
      results: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            relevant: { type: "boolean" },
            experience: { type: "string", enum: ["first_time", "experienced", "not_stated"] },
            reason: { type: "string" },
          },
          required: ["id", "relevant", "experience", "reason"],
          additionalProperties: false,
        },
      },
    },
    required: ["results"],
    additionalProperties: false,
  },
} as const;

export interface Pass1Input {
  id: string;
  source: string;
  context: string | null;
  title: string;
  text: string;
}

export interface Pass1Result {
  id: string;
  relevant: boolean;
  experience: "first_time" | "experienced" | "not_stated";
  reason: string;
}

const SOURCE_LABEL: Record<string, string> = {
  play_store: "Play Store review",
  app_store: "App Store review",
  reddit: "Reddit",
  youtube: "YouTube comment",
  tradingqna: "TradingQ&A forum",
  pasted: "Pasted post",
};

// Posts go in with short ids (p1, p2, ...) to save tokens; the caller maps them back.
export function formatPosts(posts: Pass1Input[]): string {
  return posts
    .map((post, index) => {
      const body = [post.title, post.text].filter(Boolean).join(": ");
      const clipped = body.length > MAX_CHARS ? `${body.slice(0, MAX_CHARS)} [cut]` : body;
      const context = post.context ? ` | context: ${post.context}` : "";
      return `### id: p${index + 1} (${SOURCE_LABEL[post.source] ?? post.source}${context})\n${clipped}`;
    })
    .join("\n\n");
}

// The body of one chat completion request; used as-is for live calls and batch lines.
export function pass1Request(posts: Pass1Input[]) {
  return {
    model: PASS1_MODEL,
    temperature: 0,
    response_format: { type: "json_schema" as const, json_schema: PASS1_SCHEMA },
    messages: [
      { role: "system" as const, content: PASS1_INSTRUCTIONS },
      { role: "user" as const, content: formatPosts(posts) },
    ],
  };
}

// Maps the model's p1, p2, ... answers back to post ids. Posts it skipped are returned
// as missing so they can be sent again.
export function readPass1(posts: Pass1Input[], content: string) {
  const parsed = JSON.parse(content) as { results: Pass1Result[] };
  const byShortId = new Map(parsed.results.map((result) => [result.id, result]));
  const answers: (Pass1Result & { postId: string })[] = [];
  const missing: string[] = [];
  posts.forEach((post, index) => {
    const result = byShortId.get(`p${index + 1}`);
    if (result) answers.push({ ...result, postId: post.id });
    else missing.push(post.id);
  });
  return { answers, missing };
}
