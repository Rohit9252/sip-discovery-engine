"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Answer } from "@/lib/answers";
import { ChartView } from "./charts";
import { ChatIcon } from "./ask";
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
  const { ownSip, openChat, dismissGreeting } = useChat();
  return (
    <div role="region" aria-label="Meet the engine" className="greet fixed bottom-[92px] left-4 right-4 z-40 flex flex-col gap-3 rounded-[18px_18px_6px_18px] border border-line-strong bg-raised p-4 shadow-[0_22px_48px_-20px_rgba(18,20,23,0.35)] sm:bottom-[104px] sm:left-auto sm:right-7 sm:w-[360px]">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-dark"><span className="h-[11px] w-[11px] rounded-full bg-accent" /></span>
        <div className="flex flex-col gap-1">
          <p className="font-semibold">Hi! I&apos;ve read {ownSip} posts about people&apos;s own SIPs.</p>
          <p className="text-sm text-ink-2">Ask me why first SIPs stop, what worries investors, or what they need. I show the posts behind every answer.</p>
        </div>
        <button type="button" onClick={dismissGreeting} aria-label="Close the greeting" className="-mr-2 -mt-2 h-11 w-11 shrink-0 rounded-[10px] text-lg text-ink-3 hover:bg-sunken hover:text-ink">×</button>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => openChat("q3")} className="min-h-11 rounded-full border border-line-strong bg-raised px-4 text-sm font-medium hover:border-ink-3">Why do people stop?</button>
        <button type="button" onClick={() => openChat()} className="min-h-11 rounded-full bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-strong">Ask a question</button>
      </div>
    </div>
  );
}

function Panel() {
  const { open, closeChat, restart, answers, firstTime, messages, typing, busy, ask } = useChat();
  const [text, setText] = useState("");
  const panel = useRef<HTMLElement>(null);
  const thread = useRef<HTMLDivElement>(null);

  // Move focus into the panel when it opens.
  useEffect(() => {
    if (open) panel.current?.focus({ preventScroll: true });
  }, [open]);

  // Keep the newest message in view inside the chat window, without moving the page.
  useEffect(() => {
    // Line the newest question up at the top, so the reader sees it with its answer.
    const box = thread.current;
    const asked = box?.querySelectorAll<HTMLElement>("[data-user]");
    const last = asked && asked.length ? asked[asked.length - 1] : null;
    if (box && last) box.scrollTo({ top: last.offsetTop - 12, behavior: "smooth" });
  }, [messages.length, typing, open]);

  const askedQuestions = new Set(messages.flatMap((message) => (message.from === "user" ? [message.text] : [])));
  const remaining = answers.filter((answer) => !askedQuestions.has(answer.question));
  const empty = messages.length === 0;

  return (
    <section
      ref={panel}
      tabIndex={-1}
      role="dialog"
      aria-label="Ask the engine"
      className={`sheet fixed inset-x-0 top-0 z-50 h-dvh flex-col bg-raised outline-none lg:left-auto lg:right-0 lg:w-[var(--chat-width)] lg:border-l lg:border-line-strong lg:shadow-[-28px_0_56px_-28px_rgba(18,20,23,0.35)] ${open ? "flex" : "hidden"}`}
    >
      <div className="flex items-center gap-3 bg-dark py-2.5 pl-4 pr-3 text-white lg:py-3.5 lg:pl-[18px]">
        <span aria-hidden="true" className="hidden h-9 w-9 shrink-0 place-items-center rounded-xl bg-dark-2 sm:grid"><span className="h-[11px] w-[11px] rounded-full bg-[#5b82f5]" /></span>
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="font-display text-[17px] font-semibold leading-tight">Ask the engine</p>
          <p className="text-xs text-[#b9bdc5]">{firstTime} first-time investors&apos; posts · never investment advice</p>
        </div>
        <button type="button" onClick={restart} className="min-h-11 rounded-lg border border-[#3a3f47] px-3 text-[13px] font-medium hover:bg-dark-2">New chat</button>
        <button type="button" onClick={closeChat} aria-label="Close the chat" className="h-11 w-11 shrink-0 rounded-[10px] bg-dark-2 text-xl hover:bg-[#3a3f47]">×</button>
      </div>

      <div ref={thread} role="log" aria-live="polite" aria-label="Conversation" className="relative flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto p-4 lg:p-[18px]">
        <p className="max-w-[92%] rounded-[4px_16px_16px_16px] bg-sunken px-3.5 py-3 text-[15px]">
          Hi! Pick one of the brief&apos;s questions or type your own. Every answer is counted from first-time investors&apos; posts and shows the posts behind it.
        </p>
        {messages.map((message) =>
          message.from === "user" ? (
            <p key={message.id} data-user className="rise max-w-[85%] self-end rounded-[16px_16px_4px_16px] bg-accent px-3.5 py-2.5 text-[15px] text-white">{message.text}</p>
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

      <div className="flex flex-col gap-2.5 border-t border-line bg-[#fafaf8] px-4 pb-4 pt-3 lg:px-[18px]">
        {remaining.length > 0 && (
          <>
            <p className="text-xs text-ink-3">{empty ? "Start with one of the brief’s nine questions" : "Ask another"}</p>
            {empty ? (
              <ul className="grid max-h-[38dvh] gap-1.5 overflow-y-auto">
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
              <ul className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0 lg:pb-0">
                {remaining.map((answer) => (
                  <li key={answer.id} className="shrink-0">
                    <button type="button" disabled={busy} onClick={() => ask(answer.question, answer)} className="min-h-11 w-[260px] rounded-2xl border border-line-strong bg-raised px-3.5 py-2 text-left text-[13px] font-medium leading-snug hover:border-accent disabled:opacity-60 lg:w-auto">
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
    </section>
  );
}

// Everything that floats: the launcher, the first-visit greeting and the chat window itself.
export function ChatWidget() {
  const { open, showGreeting, openChat, launcherRef } = useChat();
  return (
    <>
      {showGreeting && <Greeting />}
      <button
        ref={launcherRef}
        type="button"
        onClick={() => openChat()}
        className={`launch fixed bottom-5 right-4 z-40 min-h-14 items-center gap-2.5 rounded-full bg-accent px-5 text-[15px] font-semibold text-white hover:bg-accent-strong sm:bottom-7 sm:right-7 sm:px-[22px] ${open ? "hidden" : "flex"}`}
      >
        <ChatIcon size={22} />
        Ask the engine
      </button>
      <Panel />
    </>
  );
}
