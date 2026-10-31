"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Answer } from "@/lib/answers";
import { ChartView } from "./charts";
import { useChat, type Live } from "./chat-state";

const QUOTE = "rounded-xl border-l-4 border-warm bg-tint-warm px-3.5 py-3";
const SOURCE_PILL = "rounded-full bg-raised px-2 py-0.5 font-medium text-ink";
const OPEN_POST = "-my-2 ml-auto inline-flex min-h-11 items-center font-medium text-accent-strong hover:underline";

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2 text-[15px] leading-relaxed">
      {items.map((point) => (
        <li key={point} className="flex gap-2.5"><span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />{point}</li>
      ))}
    </ul>
  );
}

function AnswerMessage({ answer }: { answer: Answer }) {
  const [more, setMore] = useState(false);
  const [first, ...rest] = answer.charts;
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[13px] font-medium text-accent-strong">{answer.question}</p>
        <p className="mt-1.5 font-display text-[19px] font-semibold leading-snug">{answer.headline}</p>
        <p className="mt-1.5 text-sm text-ink-2">{answer.base}</p>
      </div>
      {first && <ChartView chart={first} />}
      <div className="space-y-2">
        {answer.quotes.slice(0, 2).map((quote) => (
          <blockquote key={quote.url + quote.text} className={QUOTE}>
            <p className="text-[14px] leading-relaxed">&ldquo;{quote.text}&rdquo;</p>
            {quote.english && <p className="mt-1 text-sm italic text-ink-2">{quote.english}</p>}
            <footer className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-2">
              <span className={SOURCE_PILL}>{quote.source}</span>
              {quote.stage && <span>{quote.stage}</span>}
              <a href={quote.url} target="_blank" rel="noopener noreferrer" className={OPEN_POST}>Open post ↗</a>
            </footer>
          </blockquote>
        ))}
      </div>
      {more && (
        <div className="rise space-y-5 border-t border-line pt-4">
          <Bullets items={answer.points} />
          {rest.map((chart) => <ChartView key={chart.title} chart={chart} />)}
          <Link href={answer.explore.href} className="inline-flex min-h-11 items-center text-sm font-semibold text-accent-strong hover:underline">{answer.explore.label} →</Link>
        </div>
      )}
      <button type="button" onClick={() => setMore(!more)} aria-expanded={more} className="-my-1 min-h-11 text-sm font-semibold text-accent-strong hover:underline">
        {more ? "Show less" : "Show more detail"}
      </button>
    </div>
  );
}

// The AI's reply, after the code checks: answer, points, checked quotes and a follow-up.
function LiveMessage({ live, onAsk }: { live: Live; onAsk: (question: string) => void }) {
  return (
    <div className="space-y-4">
      <p className={`leading-relaxed ${live.error ? "text-[15px] text-ink-2" : "font-display text-[18px] font-semibold"}`}>{live.answer}</p>
      {live.points.length > 0 && <Bullets items={live.points} />}
      {live.quotes.length > 0 && (
        <div className="space-y-2">
          {live.quotes.map((quote) => (
            <blockquote key={quote.url + quote.text} className={QUOTE}>
              <p className="text-[14px] leading-relaxed">&ldquo;{quote.text}&rdquo;</p>
              {quote.english && <p className="mt-1 text-sm italic text-ink-2">{quote.english}</p>}
              <footer className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-2">
                <span className={SOURCE_PILL}>{quote.source}</span>
                <span>{quote.date}</span>
                <a href={quote.url} target="_blank" rel="noopener noreferrer" className={OPEN_POST}>Open post ↗</a>
              </footer>
            </blockquote>
          ))}
        </div>
      )}
      {live.followUp && !live.error && (
        <button type="button" onClick={() => onAsk(live.followUp)} className="min-h-11 rounded-2xl border border-accent/40 bg-accent-soft px-3.5 py-2 text-left text-sm text-accent-strong hover:border-accent">
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

function Greeting() {
  const { openChat, dismissGreeting } = useChat();
  return (
    <div role="region" aria-label="Meet the engine" className="greet fixed bottom-[92px] left-4 right-4 z-40 flex flex-col gap-3 rounded-[18px_18px_6px_18px] border border-line-strong bg-raised p-4 shadow-[0_22px_48px_-20px_rgba(18,20,23,0.35)] sm:bottom-[104px] sm:left-auto sm:right-7 sm:w-[360px]">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent text-xl">👋</span>
        <div className="flex flex-col gap-1">
          <p className="font-display text-[17px] font-semibold leading-snug">Hey, I&apos;m here to help you!</p>
          <p className="text-sm text-ink-2">I&apos;m your SIP discovery engine. Curious why people start a SIP, what worries them, or why they stop? Just ask. I&apos;ve got you.</p>
        </div>
        <button type="button" onClick={dismissGreeting} aria-label="Close the greeting" className="-mr-2 -mt-2 h-11 w-11 shrink-0 rounded-[10px] text-lg text-ink-3 hover:bg-sunken hover:text-ink">×</button>
      </div>
      <div className="flex flex-col gap-2">
        <button type="button" onClick={() => openChat()} className="min-h-11 rounded-full bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-strong">Start chatting →</button>
        <button type="button" onClick={() => openChat("q0")} className="min-h-11 rounded-2xl border border-line-strong bg-raised px-4 py-2 text-left text-sm font-medium hover:border-ink-3">Or try: Why do people stop their SIP in their first year?</button>
      </div>
    </div>
  );
}

// The engine's opening message, the same in the side panel and on the full-screen chat page.
function Hello() {
  return (
    <div className="max-w-[92%] rounded-[4px_16px_16px_16px] bg-sunken px-3.5 py-3 text-[15px] leading-relaxed">
      <p className="font-semibold">Hey, I&apos;m here to help you! 👋</p>
      <p className="mt-1">
        I&apos;m your SIP discovery engine. Ask me anything about first-time SIP investors: why they start, what worries them, and why some stop while others keep going.
        Pick a question below, or type your own.
      </p>
    </div>
  );
}

// The conversation and the box to ask in. The page scrolls; the box stays pinned to the bottom.
function Conversation({ page = false }: { page?: boolean }) {
  const { answers, messages, typing, busy, ask } = useChat();
  const [text, setText] = useState("");
  const thread = useRef<HTMLDivElement>(null);

  // Line the newest question up at the top, so the reader sees it with its answer.
  useEffect(() => {
    const box = thread.current;
    const asked = box?.querySelectorAll<HTMLElement>("[data-user]");
    const last = asked && asked.length ? asked[asked.length - 1] : null;
    if (!box || !last) return;
    if (page) last.scrollIntoView({ behavior: "smooth", block: "start" });
    else box.scrollTo({ top: last.offsetTop - 12, behavior: "smooth" });
  }, [messages.length, typing, page]);

  const askedQuestions = new Set(messages.flatMap((message) => (message.from === "user" ? [message.text] : [])));
  const remaining = answers.filter((answer) => !askedQuestions.has(answer.question));
  const empty = messages.length === 0;

  return (
    <>
      <div
        ref={thread}
        role="log"
        aria-live="polite"
        aria-label="Conversation"
        className={page ? "flex flex-1 flex-col gap-4 py-6" : "relative flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto p-4 lg:p-[18px]"}
      >
        <Hello />
        {messages.map((message) =>
          message.from === "user" ? (
            <p key={message.id} data-user className="rise max-w-[85%] scroll-mt-24 self-end rounded-[16px_16px_4px_16px] bg-accent px-3.5 py-2.5 text-[15px] text-white">{message.text}</p>
          ) : (
            <div key={message.id} className="rise min-w-0 rounded-[4px_16px_16px_16px] border border-line bg-raised p-4">
              {message.answer ? <AnswerMessage answer={message.answer} /> : message.live ? <LiveMessage live={message.live} onAsk={(question) => ask(question)} /> : <p className="text-[15px] leading-relaxed">{message.text}</p>}
            </div>
          ),
        )}
        {typing && (
          <p className="flex w-fit gap-1 rounded-[4px_16px_16px_16px] bg-sunken px-4 py-4" role="status" aria-label="Typing">
            {[0, 1, 2].map((dot) => <span key={dot} className="h-2 w-2 rounded-full bg-ink-3 motion-safe:animate-bounce" style={{ animationDelay: `${dot * 120}ms` }} />)}
          </p>
        )}
      </div>

      <div className={page ? "sticky bottom-0 -mx-4 flex flex-col gap-2.5 border-t border-line bg-surface/95 px-4 pb-4 pt-3 backdrop-blur sm:-mx-8 sm:px-8" : "flex flex-col gap-2.5 border-t border-line bg-[#fafaf8] px-4 pb-4 pt-3 lg:px-[18px]"}>
        {remaining.length > 0 && (
          <>
            <p className="text-xs text-ink-3">{empty ? "Start with one of these questions" : "Ask another"}</p>
            {empty ? (
              <ul className={page ? "grid max-h-[40dvh] gap-1.5 overflow-y-auto md:grid-cols-2" : "grid max-h-[38dvh] gap-1.5 overflow-y-auto"}>
                {remaining.map((answer, index) => (
                  <li key={answer.id}>
                    <button type="button" disabled={busy} onClick={() => ask(answer.question, answer)} className="flex min-h-11 w-full items-center gap-2.5 rounded-xl border border-line bg-raised px-3 py-2 text-left text-sm font-medium hover:border-accent disabled:opacity-60">
                      <span className="num grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent-soft text-xs text-accent-strong">{index + 1}</span>
                      {answer.question}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <ul className={page ? "flex max-h-[30dvh] flex-wrap gap-1.5 overflow-y-auto" : "-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0 lg:pb-0"}>
                {remaining.map((answer) => (
                  <li key={answer.id} className="shrink-0">
                    <button type="button" disabled={busy} onClick={() => ask(answer.question, answer)} className={`min-h-11 rounded-2xl border border-line-strong bg-raised px-3.5 py-2 text-left text-[13px] font-medium leading-snug hover:border-accent disabled:opacity-60 ${page ? "" : "w-[260px] lg:w-auto"}`}>
                      {answer.question}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (text.trim() && !busy) {
              ask(text.trim());
              setText("");
            }
          }}
        >
          <label htmlFor="chat-box" className="sr-only">Your question</label>
          <input
            id="chat-box"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Or type your own question"
            maxLength={400}
            className="min-h-12 min-w-0 flex-1 rounded-xl border border-line-strong bg-raised px-3.5 text-[15px] placeholder:text-ink-3"
          />
          <button type="submit" disabled={busy} aria-label="Send" className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-accent text-lg font-semibold text-white hover:bg-accent-strong disabled:opacity-50">→</button>
        </form>
        <p className="text-[11px] text-ink-3">Typed questions are answered by AI from our counted findings. Advice questions are refused. Nothing is saved.</p>
      </div>
    </>
  );
}

// The chat, full screen on its own page. Every "Ask" button on the site leads here.
export function ChatPage() {
  const { messages, restart } = useChat();
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-4.5rem)] w-full max-w-[880px] flex-col px-4 sm:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-5">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-dark"><span className="h-3 w-3 rounded-full bg-accent" /></span>
          <div>
            <h1 className="font-display text-2xl font-semibold leading-tight">Chat with the engine</h1>
            <p className="text-sm text-ink-3">Your guide to first-time SIP investors · never investment advice</p>
          </div>
        </div>
        {messages.length > 0 && (
          <button type="button" onClick={restart} className="min-h-11 rounded-lg border border-line-strong px-3.5 text-sm font-medium hover:border-ink-3">New chat</button>
        )}
      </div>
      <Conversation page />
    </div>
  );
}

// Everything that floats: the launcher, the first-visit greeting and the chat window itself.
// A small robot face that blinks, with a hand that waves hello. Pure decoration.
function BotFace() {
  return (
    <span aria-hidden="true" className="bot-float relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <line x1="12" y1="2.5" x2="12" y2="5.5" stroke="#2f5bea" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="12" cy="2.2" r="1.4" fill="#f0701f" />
        <rect x="4" y="6" width="16" height="13" rx="5" fill="#2f5bea" />
        <g className="bot-blink">
          <circle cx="9" cy="12" r="1.7" fill="#fff" />
          <circle cx="15" cy="12" r="1.7" fill="#fff" />
        </g>
        <path d="M9.5 15.6c1.4 1 3.6 1 5 0" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <span className="bot-wave absolute -bottom-1 -right-2 text-[15px] leading-none">👋</span>
    </span>
  );
}

// The little "Can I help?" bubble above the launcher. Clicking it opens the chat; × hides it for this visit.
function HelpBubble({ onOpen, onHide }: { onOpen: () => void; onHide: () => void }) {
  return (
    <div className="bubble-in fixed bottom-[88px] right-4 z-40 flex max-w-[270px] items-start gap-1 rounded-[16px_16px_4px_16px] border border-line-strong bg-raised py-1.5 pl-3.5 pr-1.5 shadow-[0_18px_40px_-18px_rgba(18,20,23,0.35)] sm:bottom-[100px] sm:right-7">
      <button type="button" onClick={onOpen} className="min-h-11 py-1.5 text-left text-sm leading-snug">
        <span className="font-semibold">Hi, I&apos;m here to assist you.</span> Do you want help?
      </button>
      <button type="button" onClick={onHide} aria-label="Hide this message" className="h-9 w-9 shrink-0 rounded-[10px] text-lg text-ink-3 hover:bg-sunken hover:text-ink">×</button>
    </div>
  );
}

// The floating launcher, the first-visit greeting and the help bubble. All lead to the chat page, so they hide there.
export function ChatWidget() {
  const { showGreeting, openChat } = useChat();
  const [bubbleHidden, setBubbleHidden] = useState(false);
  const pathname = usePathname();
  if (pathname === "/chat") return null;
  return (
    <>
      {showGreeting && <Greeting />}
      {!showGreeting && !bubbleHidden && <HelpBubble onOpen={() => openChat()} onHide={() => setBubbleHidden(true)} />}
      <div className="fixed bottom-5 right-4 z-40 sm:bottom-7 sm:right-7">
        <span aria-hidden="true" className="ai-glow pointer-events-none absolute -inset-[2px] rounded-full" />
        <button
          type="button"
          onClick={() => openChat()}
          className={`launch relative flex min-h-14 items-center gap-2.5 rounded-full bg-accent py-2 pl-2.5 pr-5 text-[15px] font-semibold text-white hover:bg-accent-strong sm:pr-[22px] ${showGreeting ? "launch-new" : ""}`}
        >
          <BotFace />
          Ask the engine
          {showGreeting && (
            <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-warm opacity-75 motion-safe:animate-ping" />
              <span className="relative inline-flex h-3.5 w-3.5 rounded-full border-2 border-white bg-warm" />
            </span>
          )}
        </button>
      </div>
    </>
  );
}
