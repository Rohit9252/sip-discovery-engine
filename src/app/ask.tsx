"use client";

import { useChat } from "./chat-state";

export function ChatIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
    </svg>
  );
}

// Any button on the page that opens the chat, optionally straight onto one of the nine answers.
export function AskButton({ answerId, className, children }: { answerId?: string; className?: string; children: React.ReactNode }) {
  const { openChat } = useChat();
  return (
    <button type="button" className={className} onClick={() => openChat(answerId)}>
      {children}
    </button>
  );
}
