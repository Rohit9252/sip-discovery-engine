// The frozen list of themes (unmet needs) every relevant post is tagged against in pass 2.
// Frozen on 22 Oct 2026 by the team from the AI's 14 suggestions (data/themes-suggested-2033.md):
// payment, support and cancellation themes merged; fund-picking kept only to count it;
// quiet drift and switching apps added by the team.
export interface Theme {
  id: string;
  name: string;
  need: string;
  origin: "ai" | "ai, merged" | "team";
  withinRules?: "yes" | "partly" | "no"; // decided by the team in DE-19
}

export const THEMES: Theme[] = [
  { id: "T1", name: "Is this fall normal?", need: "I need to know whether a fall or loss this early is normal, so I don't panic and stop.", origin: "ai" },
  { id: "T2", name: "Am I on track?", need: "I need to see whether my SIP is on track for my goal, compared with something I understand.", origin: "ai, merged" },
  { id: "T3", name: "What is happening with my money?", need: "I need to know what is happening to my payment: debited, processing, allotted or failed, and why.", origin: "ai, merged" },
  { id: "T4", name: "Get my stuck money sorted", need: "When my money is stuck (refund, redemption, cancellation, wrong debit), I need someone to actually fix it quickly.", origin: "ai, merged" },
  { id: "T5", name: "Help me start properly", need: "I need simple guidance to set up my first SIP correctly: amount, date, mandate, how it works.", origin: "ai" },
  { id: "T6", name: "Make my SIP fit my life", need: "I need my SIP to fit my income and life: change the amount, skip a month, step up, or handle an emergency without quitting.", origin: "ai, merged" },
  { id: "T7", name: "Is my money safe?", need: "I need to trust that my money is safe and that I can get it back.", origin: "ai" },
  { id: "T8", name: "See everything in one place", need: "I need to see all my investments, including ones outside this app, in one place.", origin: "ai" },
  { id: "T9", name: "Understand charges and lock-ins", need: "I need to understand charges, exit loads, lock-ins and tax before they surprise me.", origin: "ai" },
  { id: "T10", name: "Help me choose funds", need: "I want someone to tell me which funds to pick or how to split my money.", origin: "ai", withinRules: "no" },
  { id: "T11", name: "Remind me why I started", need: "I need to stay connected to why I started, so my SIP doesn't quietly fade from my mind.", origin: "team" },
  { id: "T12", name: "Move without losing my SIP", need: "I need to move my SIP to another app without it lapsing.", origin: "team" },
];
