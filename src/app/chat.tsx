"use client";

import { useEffect, useRef, useState } from "react";
import type { Answer } from "@/lib/answers";
import { ChartView } from "./charts";

type Live = {
  answer: string;
  points: string[];
  quotes: { text: string; english?: string; source: string; date: string; url: string }[];
  followUp: string;
  searched: number;
  dropped: number;
  error?: boolean;
};
type Message =
  | { id: number; from: "user"; text: string }
  | { id: number; from: "bot"; text?: string; answer?: Answer; live?: Live };

function Avatar() {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/icon.svg" alt="" className="mt-0.5 h-8 w-8 shrink-0 rounded-lg" />;
}

function AnswerMessage({ answer }: { answer: Answer }) {
  const [more, setMore] = useState(false);
  const [first, ...rest] = answer.charts;
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-accent-strong">{answer.short}</p>
        <p className="mt-1 text-lg font-semibold leading-snug">{answer.headline}</p>
        <p className="mt-1.5 text-sm text-ink-2">{answer.base}</p>
      </div>
      {first && <ChartView chart={first} />}
      <div className="space-y-2">
        {answer.quotes.slice(0, 2).map((quote) => (
          <blockquote key={quote.url + quote.text} className="rounded-xl border-l-4 border-warm bg-tint-warm px-4 py-3">
            <p className="text-[15px] leading-relaxed">&ldquo;{quote.text}&rdquo;</p>
            {quote.english && <p className="mt-1 text-sm italic text-ink-2">{quote.english}</p>}
            <footer className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-2">
              <span className="rounded-full bg-raised px-2 py-0.5 font-medium text-ink">{quote.source}</span>
              {quote.stage && <span>{quote.stage}</span>}
              <a href={quote.url} target="_blank" rel="noopener noreferrer" className="ml-auto text-accent-strong hover:underline">Open post ↗</a>
            </footer>
          </blockquote>
        ))}
      </div>
      {more && (
        <div className="rise space-y-5 border-t border-line pt-4">
          <ul className="space-y-2 text-[15px] leading-relaxed">
            {answer.points.map((point) => (
              <li key={point} className="flex gap-2.5"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />{point}</li>
            ))}
          </ul>
          {rest.map((chart) => <ChartView key={chart.title} chart={chart} />)}
        </div>
      )}
      <button onClick={() => setMore(!more)} className="text-sm font-medium text-accent-strong hover:underline">
        {more ? "Show less" : "Show more detail"}
      </button>
    </div>
  );
}

// The AI's reply, after the code checks: answer, points, checked quotes and a follow-up.
function LiveMessage({ live, onAsk }: { live: Live; onAsk: (question: string) => void }) {
  return (
    <div className="space-y-4">
      <p className={`leading-relaxed ${live.error ? "text-[15px] text-ink-2" : "text-[17px] font-semibold"}`}>{live.answer}</p>
      {live.points.length > 0 && (
        <ul className="space-y-2 text-[15px] leading-relaxed">
          {live.points.map((point) => (
            <li key={point} className="flex gap-2.5"><span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />{point}</li>
          ))}
        </ul>
      )}
      {live.quotes.length > 0 && (
        <div className="space-y-2">
          {live.quotes.map((quote) => (
            <blockquote key={quote.url + quote.text} className="rounded-xl border-l-4 border-warm bg-tint-warm px-4 py-3">
              <p className="text-[15px] leading-relaxed">&ldquo;{quote.text}&rdquo;</p>
              {quote.english && <p className="mt-1 text-sm italic text-ink-2">{quote.english}</p>}
              <footer className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-2">
                <span className="rounded-full bg-raised px-2 py-0.5 font-medium text-ink">{quote.source}</span>
                <span>{quote.date}</span>
                <a href={quote.url} target="_blank" rel="noopener noreferrer" className="ml-auto text-accent-strong hover:underline">Open post ↗</a>
              </footer>
            </blockquote>
          ))}
        </div>
      )}
      {live.followUp && !live.error && (
        <button onClick={() => onAsk(live.followUp)} className="rounded-full border border-accent/40 bg-accent-soft/50 px-3 py-1.5 text-left text-sm text-accent-strong hover:bg-accent-soft">
          {live.followUp} →
        </button>
      )}
      {!live.error && (
        <p className="text-xs text-ink-3">
          Written by AI from {live.searched} matching posts and our counted findings. Quotes and numbers are checked in code{live.dropped ? `; ${live.dropped} that failed the check ${live.dropped === 1 ? "was" : "were"} removed` : ""}.
        </p>
      )}
    </div>
  );
}

// `linked` comes from a link like /?q=q3#chat, so the deck can open one answer directly.
export function Chat({ answers, firstTime, linked }: { answers: Answer[]; firstTime: string; linked?: string }) {
  const start = answers.find((answer) => answer.id === linked);
  const [messages, setMessages] = useState<Message[]>(start ? [{ id: 1, from: "user", text: start.question }, { id: 2, from: "bot", answer: start }] : []);
  const [text, setText] = useState("");
  const [typing, setTyping] = useState(false);
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState<string | null>(start?.id ?? null);
  const thread = useRef<HTMLDivElement>(null);
  const nextId = useRef(3);

  // Keep the newest message in view inside the chat window, without moving the page.
  useEffect(() => {
    const box = thread.current;
    const last = box?.lastElementChild as HTMLElement | null;
    if (box && last) box.scrollTo({ top: last.offsetTop - 16, behavior: "smooth" });
  }, [messages.length, typing]);

  // The nine suggested questions get their counted answer. Anything typed goes to the live AI.
  function ask(question: string, answer?: Answer) {
    if (busy) return;
    setActive(answer?.id ?? null);
    setMessages((all) => [...all, { id: nextId.current++, from: "user", text: question }]);
    setTyping(true);
    if (answer) {
      setTimeout(() => {
        setTyping(false);
        setMessages((all) => [...all, { id: nextId.current++, from: "bot", answer }]);
      }, 700);
      return;
    }
    void askLive(question);
  }

  async function askLive(question: string) {
    setBusy(true);
    const history = messages.slice(-4).map((message) => message.from === "user"
      ? { role: "user" as const, content: message.text }
      : { role: "assistant" as const, content: message.live?.answer ?? message.answer?.headline ?? message.text ?? "" });
    const show = (live: Live) => {
      setTyping(false);
      setMessages((all) => [...all, { id: nextId.current++, from: "bot", live }]);
    };
    const failed = (answer: string): Live => ({ answer, points: [], quotes: [], followUp: "", searched: 0, dropped: 0, error: true });
    try {
      const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question, history }) });
      const reply = await response.json().catch(() => ({ error: "" }));
      show(response.ok ? (reply as Live) : failed(reply.error || "Sorry, something went wrong. Please try again."));
    } catch {
      show(failed("Sorry, I couldn't reach the engine. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="chat" className="scroll-mt-16 mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <p className="text-sm font-medium text-accent-strong">Ask the engine</p>
      <h2 className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight">Ask the brief&apos;s questions, get answers counted from {firstTime} first-time investors</h2>

      <div className="mt-8 grid grid-cols-1 overflow-hidden rounded-3xl border border-line bg-raised shadow-[0_24px_60px_-30px_rgba(23,23,26,0.25)] lg:h-[50rem] lg:grid-cols-[19rem_1fr]">
        <aside className="hidden border-r border-line bg-surface lg:flex lg:flex-col">
          <p className="px-5 pb-2 pt-5 text-xs font-medium uppercase tracking-wide text-ink-3">Suggested questions</p>
          <ul className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
            {answers.map((answer, index) => (
              <li key={answer.id}>
                <button
                  onClick={() => ask(answer.question, answer)}
                  className={`flex w-full gap-3 rounded-xl px-3 py-2.5 text-left transition ${active === answer.id ? "bg-accent-soft" : "hover:bg-sunken"}`}
                >
                  <span className={`num flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${active === answer.id ? "bg-accent text-white" : "bg-accent-soft text-accent-strong"}`}>{index + 1}</span>
                  <span>
                    <span className="block text-sm font-medium leading-snug">{answer.short}</span>
                    <span className="mt-0.5 block text-xs leading-snug text-ink-3">{answer.question}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <div className="flex h-[80vh] min-h-0 min-w-0 flex-col lg:h-auto">
          <div className="flex items-center gap-3 border-b border-line px-5 py-3.5">
            <Avatar />
            <div>
              <p className="text-sm font-semibold">SIP Discovery Engine</p>
              <p className="text-xs text-ink-3">Answers only from public posts · no investment advice</p>
            </div>
          </div>

          <div ref={thread} className="relative min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6">
            <div className="flex gap-3">
              <Avatar />
              <div className="max-w-[46rem] rounded-2xl rounded-tl-md bg-sunken px-4 py-3 text-[15px] leading-relaxed">
                Hi! I&apos;ve read thousands of posts by people investing through SIPs. Pick a question{" "}
                <span className="hidden lg:inline">on the left</span><span className="lg:hidden">below</span> or type your own, like
                &ldquo;Do people stop after their first loss?&rdquo; Every number I give says how many posts it comes from.
              </div>
            </div>
            {messages.map((message) =>
              message.from === "user" ? (
                <div key={message.id} className="rise flex justify-end">
                  <p className="max-w-[80%] rounded-2xl rounded-tr-md bg-accent px-4 py-2.5 text-white">{message.text}</p>
                </div>
              ) : (
                <div key={message.id} className="rise flex gap-3">
                  <Avatar />
                  <div className="min-w-0 max-w-[46rem] flex-1 rounded-2xl rounded-tl-md border border-line bg-raised px-4 py-4 sm:px-5">
                    {message.answer ? <AnswerMessage answer={message.answer} /> : message.live ? <LiveMessage live={message.live} onAsk={(q) => ask(q)} /> : <p className="text-[15px] leading-relaxed">{message.text}</p>}
                  </div>
                </div>
              ),
            )}
            {typing && (
              <div className="flex gap-3">
                <Avatar />
                <p className="flex gap-1 rounded-2xl rounded-tl-md bg-sunken px-4 py-4" aria-label="Typing">
                  {[0, 1, 2].map((dot) => <span key={dot} className="h-2 w-2 animate-bounce rounded-full bg-ink-3" style={{ animationDelay: `${dot * 120}ms` }} />)}
                </p>
              </div>
            )}
          </div>

          <div className="border-t border-line px-3 pb-3 pt-2 sm:px-4">
            <div className="-mx-1 mb-2 flex gap-2 overflow-x-auto px-1 pb-1 lg:hidden">
              {answers.map((answer) => (
                <button key={answer.id} onClick={() => ask(answer.question, answer)} className="shrink-0 rounded-full border border-line bg-surface px-3 py-1.5 text-sm hover:border-accent">
                  {answer.short}
                </button>
              ))}
            </div>
            <form
              className="flex items-center gap-2 rounded-2xl border border-line bg-surface p-1.5 focus-within:border-accent"
              onSubmit={(event) => {
                event.preventDefault();
                if (text.trim() && !busy) {
                  ask(text.trim());
                  setText("");
                }
              }}
            >
              <input
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="Ask about first SIPs…"
                aria-label="Your question"
                maxLength={400}
                className="min-w-0 flex-1 bg-transparent px-3 py-2 outline-none placeholder:text-ink-3"
              />
              <button type="submit" disabled={busy} aria-label="Send" className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-white hover:bg-accent-strong disabled:opacity-50">
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden><path d="M3 10l14-7-5 14-2.5-5.5L3 10z" /></svg>
              </button>
            </form>
            <p className="mt-1.5 px-1 text-[11px] text-ink-3">Typed questions are answered by AI and are not saved. Please don&apos;t type personal details.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
