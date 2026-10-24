"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
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
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [typing, setTyping] = useState(false);
  const [busy, setBusy] = useState(false);
  const nextId = useRef(1);
  const latest = useRef<Message[]>([]);
  const session = useRef(0); // bumps on "New chat", so late replies from the old chat are ignored
  const opener = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);
  const launcherRef = useRef<HTMLButtonElement | null>(null);
  const greeted = useSyncExternalStore(subscribe, readGreeted, () => true);

  useEffect(() => {
    latest.current = messages;
  }, [messages]);

  // Tell the page whether the chat is open, so the styles can make room for it.
  useEffect(() => {
    const root = document.documentElement;
    if (open) root.dataset.chat = "open";
    else delete root.dataset.chat;
    return () => void delete root.dataset.chat;
  }, [open]);

  // Escape closes the chat. When it closes, focus goes back to whatever opened it.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);
  useEffect(() => {
    if (!open && wasOpen.current) {
      const target = opener.current?.isConnected ? opener.current : launcherRef.current;
      target?.focus();
    }
    wasOpen.current = open;
  }, [open]);

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

  // The nine suggested questions get their counted answer. Anything typed goes to the live AI.
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
    open,
    messages,
    typing,
    busy,
    showGreeting: !greeted && !open,
    launcherRef,
    openChat(answerId, options) {
      const active = document.activeElement;
      opener.current = active instanceof HTMLElement && active !== document.body ? active : null;
      setOpen(true);
      markGreeted();
      const answer = answers.find((candidate) => candidate.id === answerId);
      if (!answer) return;
      const last = latest.current[latest.current.length - 1];
      if (last?.from === "bot" && last.answer?.id === answer.id) return;
      ask(answer.question, answer, options?.instant);
    },
    closeChat: () => setOpen(false),
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
