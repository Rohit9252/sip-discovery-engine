import { writeFileSync } from "node:fs";
import { CHAT_INSTRUCTIONS, FACT_SHEET } from "../src/lib/chat-prompt";

// Writes the chat's instructions and fact sheet to a file, for a reviewer to check answers against.
writeFileSync("data/chat-context.md", `# Instructions\n\n${CHAT_INSTRUCTIONS}\n\n# Fact sheet\n\n${FACT_SHEET}\n`, "utf8");
console.log("data/chat-context.md");
