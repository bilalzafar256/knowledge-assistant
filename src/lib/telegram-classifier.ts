import { generateObject } from "ai";
import { z } from "zod";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { openai } from "./ai";

const CLASSIFIER_MODEL = "gpt-4o-mini";

const ClassificationSchema = z.object({
  kind: z.enum(["requirement", "discussion"]),
  reply: z
    .string()
    .nullable()
    .describe(
      "A concise answer to the user's question. REQUIRED (non-null) when kind='discussion'. MUST be null when kind='requirement'.",
    ),
  reasoning: z
    .string()
    .describe("One sentence explaining the classification choice."),
});

export type Classification = z.infer<typeof ClassificationSchema>;

let cachedProjectContext: string | null = null;
function getProjectContext(): string {
  if (cachedProjectContext !== null) return cachedProjectContext;
  try {
    cachedProjectContext = readFileSync(
      join(process.cwd(), "CLAUDE.md"),
      "utf8",
    );
  } catch {
    cachedProjectContext = "";
  }
  return cachedProjectContext;
}

const SYSTEM_PROMPT = `You triage messages for a developer's personal coding bot that operates on a single GitHub repository.

Classify the user's message as exactly one of:

  • "requirement"  — the user wants the code changed, added, removed, refactored, fixed, renamed, deleted, configured, deployed, or any other action that produces a code diff. Anything imperative about THIS repo.

  • "discussion"   — the user is asking a question, asking for an explanation, brainstorming, chatting, or otherwise NOT asking for a code change yet.

If "discussion", produce a concise reply (1–4 short paragraphs, plain text — no markdown headings, no code blocks unless essential). Use the project context below to keep the answer grounded. Never write code that should land in the repo — that's the requirement path's job.

If "requirement", leave \`reply\` empty.

═══════════ PROJECT CONTEXT (from CLAUDE.md) ═══════════
{{PROJECT_CONTEXT}}
═══════════════════════════════════════════════════════`;

export async function classifyMessage(
  message: string,
): Promise<Classification> {
  const systemPrompt = SYSTEM_PROMPT.replace(
    "{{PROJECT_CONTEXT}}",
    getProjectContext(),
  );

  const { object } = await generateObject({
    model: openai(CLASSIFIER_MODEL),
    schema: ClassificationSchema,
    system: systemPrompt,
    prompt: message,
  });

  return object;
}
