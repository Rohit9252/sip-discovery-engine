// AI pass 2: the 11 fields for every relevant post. Like pass 1, this file is the single
// source of the instructions, imported by the pipeline and by the site's "Try it" box.
import { THEMES } from "../themes";

export const PASS2_MODEL = "gpt-4.1-mini";
export const PASS2_VERSION = "pass2-v10";
export const PASS2_POSTS_PER_REQUEST = 8;
const MAX_CHARS = 2000;

const NS = "not_stated";

// Allowed answers for each field. "not_stated" is always allowed, and is the answer whenever the post does not say.
export const OPTIONS = {
  stage: ["before_starting", "setting_up", "months_1_3", "months_4_6", "months_7_12", "after_12_months", NS],
  why_started: ["grow_savings", "goal", "save_tax", "saving_habit", "others_doing_it", "other", NS],
  influencer: ["friend_or_colleague", "family", "youtube_or_finfluencer", "app_or_bank_ad", "employer", "advisor_or_agent", "own_decision", NS],
  expectation: ["quick_high_returns", "better_than_fd", "long_term_growth", "tax_saving", "other", NS],
  what_happened: ["continuing", "increased", "reduced", "paused", "stopped", "bounce", "switched_app", "thinking_of_stopping", "not_started_yet", NS],
  trigger: ["market_fall_or_loss", "needed_money", "income_drop_or_delay", "app_or_payment_problem", "someone_advised", "forgot_or_lost_interest", "life_event", "other", NS],
  checks_what: ["total_return", "current_value", "xirr_or_percent", "daily_change", "instalment_status", "progress_to_goal", NS],
  checks_how_often: ["daily", "weekly", "monthly", "rarely", NS],
  confusion: ["payment_or_status", "nav_or_units", "returns_calculation", "charges_or_lock_in", "app_screens", "kyc_or_account", "whether_to_continue", "none_stated"],
  outside_app: ["friends_or_family", "youtube", "finfluencers", "ai_tools", "google_or_articles", "reddit_or_forums", "whatsapp_or_telegram", "advisor", "app_support", "none_stated"],
  income: ["fixed", "variable", "student_or_no_income", NS],
  age: ["under_25", "25_to_34", "35_plus", NS],
  money_source: ["own_earnings", "family", NS],
  app: ["groww", "zerodha_coin", "indmoney", "et_money", "paytm_money", "other", NS],
} as const;

// Facts that must be backed by the post's own words. An answer whose evidence is not in the
// post is thrown away in code and recorded as not_stated, so guessing cannot survive.
export const EVIDENCE_FIELDS = ["stage", "why_started", "influencer", "expectation", "what_happened", "trigger", "income", "age", "money_source"] as const;

const themeList = THEMES.map((theme) => `${theme.id} ${theme.name}: ${theme.need}`).join("\n");

export const PASS2_INSTRUCTIONS = `You read public posts by mutual fund SIP investors in India (store reviews, Reddit, YouTube comments, forum replies; some in Hindi or Hinglish). Every post has already been judged relevant. For each post, fill in the fields below.

The golden rule: only record what the post says about the writer's OWN SIP. If it does not say, answer "not_stated" (or "none_stated"). Never guess from tone, never fill a field because it seems likely. For fields that take a list, answer exactly ["not_stated"] (or ["none_stated"]) when nothing is said, and never mix it with other answers.

If the writer is replying to or advising someone else, record only what they say about their own SIP; everything else is not_stated and the theme is "none".

Each post comes with the date it was written. Use it to work out the stage: a post written in March 2025 that says "started in November 2024" is months_4_6.

Decide the theme first, before any other field (it is the first field in your answer).

Fields:
- stage: where the writer is in the life of their first SIP. before_starting, setting_up, months_1_3, months_4_6, months_7_12, after_12_months. Use the time they give and the post's date ("started 4 months ago" is months_4_6; "almost 1.5 years" is after_12_months). No time given: not_stated.
- why_started (one or more): why they started a SIP.
- influencer: who or what got them to start. own_decision only if they say they decided on their own.
- expectation: what they expected from it.
- what_happened: the main thing that happened to their SIP. continuing, increased, reduced, paused, stopped, bounce (an instalment failed without them choosing it), switched_app (moved it to another app), thinking_of_stopping, not_started_yet.
- trigger: the event just before what_happened changed. Record the event, not the reason behind it.
- checks_what (one or more) and checks_how_often: what they look at in the app, and how often only if they say how often.
- confusion (one or more): what confused or worried them in the app, or none_stated.
- outside_app (one or more): where they went for answers or advice outside the app, or none_stated. Asking in this Reddit thread or under this video counts as reddit_or_forums or youtube.
- income, age, money_source: only when the post says so ("I'm 23", "my salary", "pocket money"). A job title alone does not make income fixed.
- app: the app their SIP is in, if named.
- theme (use the context line to understand what a reply is about): the ONE theme below that best matches the unmet need in the post, or "none". The trigger is what happened; the theme is what they needed and did not get.
  - Answer "none" ONLY when the post shows no unmet need at all: pure praise, jokes, opinions about markets, or advice to someone else.
  - A QUESTION the writer asks about their own SIP or money ("is this right?", "is this good?", "can I...?", "how do I...?", "should I...?", "what do people do?") is ALWAYS an unmet need: they need an answer. Never answer "none" for it. Questions about starting or setting up go to T5; about funds, a portfolio or an advisor to T10; about redeeming, withdrawing or changing bank account to T4; about charges, fees or tax to T9; about how much to invest or whether to increase to T6.
  - Almost every complaint, question or request about the writer's own investing maps to a theme:
    - returns, XIRR, portfolio value, invested amount or daily change not shown, wrong or confusing: T2
    - a payment, order, NAV allotment or SIP debit that is slow, failed, missing or unclear: T3
    - unable to sell, redeem, withdraw, cancel, or money or units gone: T4
    - setting up a SIP, mandate, bank or KYC to start: T5
    - deciding how much to invest, whether to increase, or fitting SIPs around income, savings and life: T6
  - FIRST CHECK: if the writer asks for a portfolio review, feedback on their funds, which fund to add or drop, how to split or rebalance money, or where to park money, the theme is T10. Never answer "none" for such a post.
  - "My SIP is -6% after 4 months, should I stop?" is T1, not T10.
  - Not understanding a payment's status is T3; needing a refund, cancellation, redemption or wrong debit actually fixed is T4.
  - Moving or transferring a SIP or funds from one app, broker or fund house to another is T12.
  - Wanting proof, examples or motivation that a long SIP really pays off is T11.
${themeList}
- need: the unmet need in one plain English sentence, from the writer's point of view ("I need to know if -6% in month 4 is normal"). Empty if theme is "none".
- quote: copy ONE telling sentence from the post itself (never from the context line or thread title) exactly, character for character, in its original language, at most 25 words. Never copy links, never copy the whole post. Do not fix spelling, do not shorten inside it, do not translate it.
- quote_english: an English translation of the quote if it is not in English, otherwise "".
- evidence: for each of stage, why_started, influencer, expectation, what_happened, trigger, income, age and money_source, copy the exact words from the post (at most 12 words) that show your answer. If the answer is not_stated, the evidence is "". An answer without evidence from the post will be thrown away, so do not answer what the post does not say.

Answer for every post, using its id.`;

const enumOf = (values: readonly string[]) => ({ type: "string", enum: [...values] });
const listOf = (values: readonly string[]) => ({ type: "array", items: enumOf(values) });

export const PASS2_SCHEMA = {
  name: "pass2",
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
            theme: enumOf([...THEMES.map((theme) => theme.id), "none"]),
            need: { type: "string" },
            stage: enumOf(OPTIONS.stage),
            why_started: listOf(OPTIONS.why_started),
            influencer: enumOf(OPTIONS.influencer),
            expectation: enumOf(OPTIONS.expectation),
            what_happened: enumOf(OPTIONS.what_happened),
            trigger: enumOf(OPTIONS.trigger),
            checks_what: listOf(OPTIONS.checks_what),
            checks_how_often: enumOf(OPTIONS.checks_how_often),
            confusion: listOf(OPTIONS.confusion),
            outside_app: listOf(OPTIONS.outside_app),
            income: enumOf(OPTIONS.income),
            age: enumOf(OPTIONS.age),
            money_source: enumOf(OPTIONS.money_source),
            app: enumOf(OPTIONS.app),
            quote: { type: "string" },
            quote_english: { type: "string" },
            evidence: {
              type: "object",
              properties: Object.fromEntries(EVIDENCE_FIELDS.map((field) => [field, { type: "string" }])),
              required: [...EVIDENCE_FIELDS],
              additionalProperties: false,
            },
          },
          required: [
            "id", "theme", "need", "stage", "why_started", "influencer", "expectation", "what_happened", "trigger", "checks_what",
            "checks_how_often", "confusion", "outside_app", "income", "age", "money_source", "app",
            "quote", "quote_english", "evidence",
          ],
          additionalProperties: false,
        },
      },
    },
    required: ["results"],
    additionalProperties: false,
  },
} as const;

export interface Pass2Input {
  id: string;
  source: string;
  context: string | null;
  title: string;
  text: string;
  createdAt?: string;
  recordType?: string;
}

export type Pass2Result = { id: string; quote: string } & Record<string, unknown>;

const SOURCE_LABEL: Record<string, string> = {
  play_store: "Play Store review", app_store: "App Store review", reddit: "Reddit",
  youtube: "YouTube comment", tradingqna: "TradingQ&A forum", pasted: "Pasted post",
};

// The text the AI sees and the quote check compares against: links, image links and
// formatting symbols removed, so it is shorter and the AI is not tempted to copy them.
export function bodyOf(post: Pass2Input) {
  return [post.title, post.text].filter(Boolean).join(": ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/&#x200B;|​/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\\([~*_#>-])/g, "$1")
    .replace(/\*\*|__/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function pass2Request(posts: Pass2Input[]) {
  const content = posts.map((post, index) => {
    const body = bodyOf(post);
    const clipped = body.length > MAX_CHARS ? `${body.slice(0, MAX_CHARS)} [cut]` : body;
    const written = post.createdAt ? ` | written: ${post.createdAt.slice(0, 7)}` : "";
    return `### id: p${index + 1} (${SOURCE_LABEL[post.source] ?? post.source}${written}${post.context ? ` | context: ${post.context}` : ""})\n${clipped}`;
  }).join("\n\n");
  return {
    model: PASS2_MODEL,
    temperature: 0,
    // A hard cap, so a batch that gets stuck repeating itself cannot run away with tokens.
    max_tokens: 400 * posts.length + 500,
    response_format: { type: "json_schema" as const, json_schema: PASS2_SCHEMA },
    messages: [
      { role: "system" as const, content: PASS2_INSTRUCTIONS },
      { role: "user" as const, content },
    ],
  };
}

// The quote check (DE-13): a quote must appear in the post word for word. Spaces and
// line breaks are compared loosely; everything else must match exactly.
export function quoteMatches(post: Pass2Input, quote: string) {
  if (!quote.trim()) return false;
  const squash = (text: string) => text.replace(/\s+/g, " ").trim();
  return squash(bodyOf(post)).includes(squash(quote));
}

// Correction by rule (no tokens): the AI often answers "none" for Reddit-style requests for
// a portfolio review. Asking others to review or suggest funds is T10 by our own rule.
export const T10_REQUEST = /review my|roast my|rate my|improve my portfolio|portfolio review|review (this|the|my)|suggestions?|suggest\b|advice|feedback|opinions?|how is (this|it|my)|am i doing (it|this) right|rookie numbers|is this[\w\s]{0,25}(good|ok|okay|fine|solid)|look(s)? (good|solid|ok|fine)|advisor vs|vs diy|what (do|would|should) (people|you|i)|what should i (add|change|do)|help me (choose|pick|rebalance|build)/i;

// Correction by rule (no tokens): a reply on Reddit or TradingQ&A with no first-person
// words and no question is advice to someone else, so it carries no theme of its own.
// (A reply that asks something, like "Can you help what can be better?", is the writer's own question.)
const FIRST_PERSON = /\b(i|i'm|im|i've|ive|i'd|i'll|my|me|mine|myself|main|mein|mera|meri|mere|mujhe|hum|humara)\b|मैं|मेरा|मेरी|मेरे|मुझे|हम/i;

export function applyAdviceRule(post: Pass2Input & { recordType?: string }, result: Record<string, unknown>) {
  const isReply = (post.source === "reddit" || post.source === "tradingqna") && post.recordType === "comment";
  if (isReply && result.theme !== "none" && !FIRST_PERSON.test(post.text) && !post.text.includes("?")) {
    result.theme = "none";
    result.need = "";
    result.theme_by_rule = "advice to someone else";
  }
}

export function applyT10Rule(post: Pass2Input, result: Record<string, unknown>) {
  // Store reviews are about the app, so "I'd suggest a kill switch" there is not a fund request.
  if (result.theme === "none" && post.source !== "play_store" && post.source !== "app_store" && T10_REQUEST.test(bodyOf(post))) {
    result.theme = "T10";
    result.need = "I want someone to tell me which funds to pick or how to split my money.";
    result.theme_by_rule = true;
  }
}

const EMPTY = new Set([NS, "none_stated"]);

// The evidence for these answers must also contain a word that actually supports them,
// so "started step up sip 8k" cannot pass as evidence for an influencer or an expectation.
const CUES: Partial<Record<(typeof EVIDENCE_FIELDS)[number], RegExp>> = {
  stage: /month|year|yr|week|day|since|ago|started|back|last|mahine|mahina|saal|din|महीने|साल|20[12]\d|\bjan|\bfeb|\bmar|\bapr|\bmay|\bjun|\bjul|\baug|\bsep|\boct|\bnov|\bdec/i,
  why_started: /goal|tax|save|saving|habit|house|home|retire|wedding|marriage|education|child|wealth|future|emergency|bachat|ghar|shaadi|savings|grow|corpus|80c/i,
  influencer: /friend|family|father|mother|dad|mom|papa|mummy|bhai|brother|sister|wife|husband|colleague|office|employer|youtube|video|channel|instagram|reel|influencer|advisor|adviser|agent|bank|ad\b|advert|myself|my own|own research|decided|khud|dost|सलाह|दोस्त|वीडियो/i,
  expectation: /return|%|percent|fd\b|fixed deposit|expect|long.?term|crore|lakh|double|profit|grow|wealth|fayda|munafa|उम्मीद|रिटर्न/i,
};

// Lists never mix "not stated" with real answers.
function tidyList(values: unknown) {
  const list = Array.isArray(values) ? (values as string[]) : [];
  const real = list.filter((value) => !EMPTY.has(value));
  return real.length ? real : [list.includes("none_stated") ? "none_stated" : NS];
}

export function readPass2(posts: Pass2Input[], content: string) {
  const parsed = JSON.parse(content) as { results: Pass2Result[] };
  const byShortId = new Map(parsed.results.map((result) => [result.id, result]));
  const answers: (Pass2Result & { postId: string; quoteOk: boolean; unsupported: string[] })[] = [];
  const missing: string[] = [];
  posts.forEach((post, index) => {
    const result = byShortId.get(`p${index + 1}`);
    if (!result) { missing.push(post.id); return; }
    for (const field of ["why_started", "checks_what", "confusion", "outside_app"]) result[field] = tidyList(result[field]);
    applyT10Rule(post, result);
    applyAdviceRule(post, result);
    // Throw away any fact whose evidence is not in the post.
    const evidence = (result.evidence ?? {}) as Record<string, string>;
    const unsupported: string[] = [];
    for (const field of EVIDENCE_FIELDS) {
      const value = result[field];
      const stated = Array.isArray(value) ? !(value.length === 1 && EMPTY.has(value[0])) : !EMPTY.has(String(value));
      const value2 = Array.isArray(value) ? value[0] : String(value);
      // "continuing" must show the SIP is actually running.
      const cue = field === "what_happened" && value2 === "continuing"
        ? /sip|invest|every month|monthly|running|continu|still|never stopped|keep|chal|jaari|जारी|per month|\/month|pm\b/i
        : CUES[field];
      if (stated && (!quoteMatches(post, evidence[field] ?? "") || (cue && !cue.test(evidence[field] ?? "")))) {
        unsupported.push(field);
        result[field] = Array.isArray(value) ? [NS] : NS;
      }
    }
    answers.push({ ...result, postId: post.id, quoteOk: quoteMatches(post, result.quote), unsupported });
  });
  return { answers, missing };
}

type Client = { chat: { completions: { create: (body: ReturnType<typeof pass2Request>) => Promise<{
  usage?: { prompt_tokens?: number; completion_tokens?: number } | null;
  choices: { finish_reason: string; message: { content: string | null } }[];
}> } } };

// Runs one batch. If the answer is cut off or is not valid JSON, the batch is split in
// half and each half retried, down to single posts; a post that still fails is returned
// as missing, so the next run picks it up.
export interface Pass2BatchResult {
  answers: ReturnType<typeof readPass2>["answers"];
  missing: string[];
  inputTokens: number;
  outputTokens: number;
  failed: number;
}

export async function runPass2Batch(client: Client, posts: Pass2Input[]): Promise<Pass2BatchResult> {
  let inputTokens = 0;
  let outputTokens = 0;
  try {
    const response = await client.chat.completions.create(pass2Request(posts));
    inputTokens += response.usage?.prompt_tokens ?? 0;
    outputTokens += response.usage?.completion_tokens ?? 0;
    const choice = response.choices[0];
    if (choice.finish_reason === "length") throw new Error("answer cut off");
    const result = readPass2(posts, choice.message.content ?? '{"results":[]}');
    return { ...result, inputTokens, outputTokens, failed: 0 };
  } catch {
    if (posts.length === 1) return { answers: [], missing: [posts[0].id], inputTokens, outputTokens, failed: 1 };
    const half = Math.ceil(posts.length / 2);
    const [a, b] = await Promise.all([runPass2Batch(client, posts.slice(0, half)), runPass2Batch(client, posts.slice(half))]);
    return {
      answers: [...a.answers, ...b.answers], missing: [...a.missing, ...b.missing],
      inputTokens: inputTokens + a.inputTokens + b.inputTokens, outputTokens: outputTokens + a.outputTokens + b.outputTokens,
      failed: a.failed + b.failed,
    };
  }
}
