"use client";

import { createContext, useContext } from "react";
import type { Answer } from "@/lib/answers";

// The shape of a live (typed) answer, as sent back by POST /api/chat.
export type Live = {
  answer: string;
  points: string[];
  quotes: { text: string; english?: string; source: string; date: string; url: string }[];
  followUp: string;
  searched: number;
  dropped: number;
  error?: boolean;
};

export type Message =
  | { id: number; from: "user"; text: string }
  | { id: number; from: "bot"; text?: string; answer?: Answer; live?: Live };

export type ChatApi = {
  answers: Answer[];
  ownSip: string;
  firstTime: string;
  messages: Message[];
  typing: boolean;
  busy: boolean;
  showGreeting: boolean;
  /** Goes to the chat page. With an answer id, it also asks that question. */
  openChat: (answerId?: string, options?: { instant?: boolean }) => void;
  restart: () => void;
  dismissGreeting: () => void;
  /** Ask a question. Pass an answer for the counted answers; leave it out for the live AI. */
  ask: (question: string, answer?: Answer) => void;
};

export const ChatContext = createContext<ChatApi | null>(null);

export function useChat() {
  const api = useContext(ChatContext);
  if (!api) throw new Error("useChat must be used inside <ChatProvider>");
  return api;
}
