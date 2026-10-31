import OpenAI from "openai";
import { CHAT_INSTRUCTIONS, CHAT_MODEL, CHAT_SCHEMA, FACT_SHEET, backedByCount, evidence, numbersFound, quoteFound, shorten } from "@/lib/chat-prompt";
import { search } from "@/lib/search";
import { adviceReply, asksForAdvice } from "@/lib/advice";

// The live chat. Nothing a visitor types is stored. Limits keep the shared daily token
// allowance safe: 15 questions per visitor and 100 in total per day (about 600k tokens).
// The counts live in memory, so a fresh server starts them again; that is fine for a demo.
const PER_VISITOR = 15;
const PER_DAY = 100;
const MAX_QUESTION = 400;

let day = "";
let total = 0;
const visitors = new Map<string, number>();

function allow(visitor: string) {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== day) {
    day = today;
    total = 0;
    visitors.clear();
  }
  const used = visitors.get(visitor) ?? 0;
  if (used >= PER_VISITOR || total >= PER_DAY) return false;
  visitors.set(visitor, used + 1);
  total++;
  return true;
}

type Turn = { role: "user" | "assistant"; content: string };
type Reply = { answer: string; points: string[]; quotes: { tag: string; text: string; english: string }[]; follow_up: string };

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { question?: string; history?: Turn[] } | null;
  const question = body?.question?.trim().slice(0, MAX_QUESTION);
  if (!question) return Response.json({ error: "Ask a question first." }, { status: 400 });
  // Advice questions are refused before any AI call: no tokens, and no chance of a fund name.
  if (asksForAdvice(question)) return Response.json(adviceReply());
  const visitor = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  if (!allow(visitor)) return Response.json({ error: "That's the question limit for today. The suggested questions still work." }, { status: 429 });

  // Follow-ups like "and for students?" need the earlier question to find the right posts.
  const history = (body?.history ?? []).filter((turn) => turn.content).slice(-4).map((turn) => ({ role: turn.role, content: turn.content.slice(0, 1200) }));
  const lastQuestion = [...history].reverse().find((turn) => turn.role === "user")?.content ?? "";
  const posts = search(`${question} ${question.length < 60 ? lastQuestion : ""}`);

  try {
    const response = await new OpenAI().chat.completions.create({
      model: CHAT_MODEL,
      temperature: 0.2,
      max_tokens: 600,
      response_format: { type: "json_schema", json_schema: CHAT_SCHEMA },
      messages: [
        { role: "system", content: CHAT_INSTRUCTIONS },
        { role: "system", content: `FACT SHEET\n\n${FACT_SHEET}` },
        ...history,
        { role: "user", content: `POSTS FOUND FOR THIS QUESTION\n\n${posts.length ? evidence(posts) : "(none found)"}\n\nQUESTION: ${question}` },
      ],
    });
    const reply = JSON.parse(response.choices[0]?.message?.content ?? "{}") as Reply;

    // Code checks: a quote must be in its post word for word, and every "n of N" must be in
    // the fact sheet. Anything that fails is dropped, and the count is shown on the page.
    const postOf = (tag: string) => posts[Number(tag.replace(/\D/g, "")) - 1];
    // Long quotes are shortened first; a translation is kept only if the quote was not cut.
    const checked = reply.quotes.map((quote) => ({ ...quote, short: shorten(quote.text) }));
    for (const quote of checked) if (!quoteFound(quote.short, postOf(quote.tag))) console.log(`chat: quote dropped (${quote.tag}): ${quote.text.slice(0, 160)}`);
    const quotes = checked.filter((quote) => quoteFound(quote.short, postOf(quote.tag))).slice(0, 2).map((quote) => {
      const post = postOf(quote.tag);
      const english = quote.short === quote.text.trim() ? quote.english : "";
      // A quote cut mid-sentence gets a trailing "…" so the reader knows the post goes on.
      const text = quote.short !== quote.text.trim() && !/[.!?]$/.test(quote.short) ? `${quote.short}…` : quote.short;
      return { text, ...(english ? { english } : {}), source: post.source, date: post.date, url: post.url };
    });
    const points = reply.points.filter((point) => numbersFound(point) && backedByCount(point)).slice(0, 3);
    const answerOk = numbersFound(reply.answer);
    const dropped = Math.min(reply.quotes.length, 2) - quotes.length + (reply.points.length - points.length) + (answerOk ? 0 : 1);
    return Response.json({
      answer: answerOk ? reply.answer.replace(/—/g, ",") : "Our posts don't give a counted answer to that. Try one of the suggested questions.",
      points: points.map((point) => point.replace(/—/g, ",")),
      quotes,
      followUp: reply.follow_up,
      searched: posts.length,
      dropped,
    });
  } catch {
    return Response.json({ error: "Sorry, the engine couldn't answer just now. Please try again." }, { status: 502 });
  }
}
