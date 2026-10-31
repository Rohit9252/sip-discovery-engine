"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Answer } from "@/lib/answers";
import { ChatContext, useChat, type ChatApi, type Live, type Message } from "./chat-state";
import { ChatWidget } from "./chat";

// The greeting shows on the first visit only. We remember that in localStorage, and fall back to
// memory when the browser blocks it (private windows, blocked site data).
const GREETED_KEY = "sip-engine-greeted";
const listeners = new Set<() => void>();
let greetedInMemory = false;
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}
function readGreeted() {
  if (greetedInMemory) return true;
  try {
    return window.localStorage.getItem(GREETED_KEY) === "1";
  } catch {
    return false;
  }
}
function markGreeted() {
  if (greetedInMemory) return;
  greetedInMemory = true;
  try {
    window.localStorage.setItem(GREETED_KEY, "1");
  } catch {
    // Blocked storage: the in-memory flag is enough for this visit.
  }
  listeners.forEach((listener) => listener());
}

type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;

export function ChatProvider({ answers, ownSip, firstTime, children }: { answers: Answer[]; ownSip: string; firstTime: string; children: React.ReactNode }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [typing, setTyping] = useState(false);
  const [busy, setBusy] = useState(false);
  const nextId = useRef(1);
  const latest = useRef<Message[]>([]);
  const session = useRef(0); // bumps on "New chat", so late replies from the old chat are ignored
  const greeted = useSyncExternalStore(subscribe, readGreeted, () => true);
  // There is one chat: the full-screen page at /chat. Every "Ask" button leads there.
  const onChatPage = usePathname() === "/chat";
  const router = useRouter();

  useEffect(() => {
    latest.current = messages;
  }, [messages]);

  const show = (message: DistributiveOmit<Message, "id">) => setMessages((all) => [...all, { ...message, id: nextId.current++ } as Message]);

  async function askLive(question: string, mine: number) {
    setBusy(true);
    const history = latest.current.slice(-4).map((message) => message.from === "user"
      ? { role: "user" as const, content: message.text }
      : { role: "assistant" as const, content: message.live?.answer ?? message.answer?.headline ?? message.text ?? "" });
    const reply = (live: Live) => {
      if (mine !== session.current) return;
      setTyping(false);
      show({ from: "bot", live });
    };
    const failed = (answer: string): Live => ({ answer, points: [], quotes: [], followUp: "", searched: 0, dropped: 0, error: true });
    try {
      const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question, history }) });
      const body = await response.json().catch(() => ({ error: "" }));
      reply(response.ok ? (body as Live) : failed(body.error || "Sorry, something went wrong. Please try again."));
    } catch {
      reply(failed("Sorry, I couldn't reach the engine. Please try again."));
    } finally {
      if (mine === session.current) setBusy(false);
    }
  }

  // The suggested questions get their counted answer. Anything typed goes to the live AI.
  function ask(question: string, answer?: Answer, instant = false) {
    if (busy) return;
    show({ from: "user", text: question });
    if (answer) {
      if (instant) {
        show({ from: "bot", answer });
        return;
      }
      const mine = session.current;
      setTyping(true);
      setTimeout(() => {
        if (mine !== session.current) return;
        setTyping(false);
        show({ from: "bot", answer });
      }, 700);
      return;
    }
    setTyping(true);
    void askLive(question, session.current);
  }

  const api: ChatApi = {
    answers,
    ownSip,
    firstTime,
    messages,
    typing,
    busy,
    showGreeting: !greeted && !onChatPage,
    openChat(answerId, options) {
      markGreeted();
      // From any other page, go to the chat page; it asks the question from the ?q= in the link.
      if (!onChatPage) {
        router.push(answerId ? `/chat?q=${answerId}` : "/chat");
        return;
      }
      const answer = answers.find((candidate) => candidate.id === answerId);
      if (!answer) {
        document.getElementById("chat-box")?.focus();
        return;
      }
      const last = latest.current[latest.current.length - 1];
      if (last?.from === "bot" && last.answer?.id === answer.id) return;
      ask(answer.question, answer, options?.instant);
    },
    restart() {
      session.current++;
      nextId.current = 1;
      setMessages([]);
      setTyping(false);
      setBusy(false);
    },
    dismissGreeting: markGreeted,
    ask: (question, answer) => ask(question, answer),
  };

  return (
    <ChatContext.Provider value={api}>
      {children}
      <ChatWidget />
    </ChatContext.Provider>
  );
}

// Reads the answer id from a link like /?q=q3 (the page passes it in) and opens the chat on it.
export function OpenFromLink({ id }: { id?: string }) {
  const { openChat } = useChat();
  const done = useRef(false);
  useEffect(() => {
    if (id && !done.current) {
      done.current = true;
      openChat(id, { instant: true });
    }
  }, [id, openChat]);
  return null;
}
