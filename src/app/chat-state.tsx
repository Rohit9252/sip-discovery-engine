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
  open: boolean;
  messages: Message[];
  typing: boolean;
  busy: boolean;
  showGreeting: boolean;
  /** Opens the chat. With an answer id, it also asks that question. */
  openChat: (answerId?: string, options?: { instant?: boolean }) => void;
  closeChat: () => void;
  restart: () => void;
  dismissGreeting: () => void;
  /** Ask a question. Pass an answer for the nine counted answers; leave it out for the live AI. */
  ask: (question: string, answer?: Answer) => void;
  /** The launcher button, so focus can go back to it when the chat closes. */
  launcherRef: React.RefObject<HTMLButtonElement | null>;
};

export const ChatContext = createContext<ChatApi | null>(null);

export function useChat() {
  const api = useContext(ChatContext);
  if (!api) throw new Error("useChat must be used inside <ChatProvider>");
  return api;
}
