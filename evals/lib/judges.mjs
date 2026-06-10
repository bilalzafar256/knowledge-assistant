/**
 * LLM-as-judge primitives. All use claude-haiku-4-5 for cost.
 * Each returns a number in [0, 1] plus a short rationale.
 */
import { anthropic, generateText, parseJsonLoose } from "./ai.mjs";
import { JUDGE_MODEL } from "./env.mjs";

async function judge({ system, user }) {
  const { text } = await generateText({
    model: anthropic(JUDGE_MODEL),
    temperature: 0,
    maxOutputTokens: 200,
    system,
    prompt: user,
  });
  try {
    const parsed = parseJsonLoose(text ?? "{}");
    return {
      score: typeof parsed.score === "number" ? parsed.score : 0,
      rationale: parsed.rationale ?? "",
    };
  } catch {
    return { score: 0, rationale: "parse_error" };
  }
}

/** Of the retrieved chunks, what fraction are actually relevant to the question? */
export async function contextPrecision({ question, retrievedChunks }) {
  if (retrievedChunks.length === 0) return { score: 0, rationale: "no chunks" };
  const list = retrievedChunks
    .map(
      (c, i) =>
        `[${i + 1}] (${c.documentTitle}) ${c.content.slice(0, 400).replace(/\n+/g, " ")}`
    )
    .join("\n");
  const { text } = await generateText({
    model: anthropic(JUDGE_MODEL),
    temperature: 0,
    maxOutputTokens: 120,
    prompt:
      `Question: ${question}\n\nFor each chunk, mark 1 if it contains information that helps answer the question, 0 otherwise.\n\nChunks:\n${list}\n\nOutput JSON only: {"verdicts":[0|1,0|1,...]}`,
  });
  try {
    const parsed = parseJsonLoose(text ?? "{}");
    const v = parsed.verdicts;
    if (!Array.isArray(v) || v.length !== retrievedChunks.length) {
      return { score: 0, rationale: "bad_format" };
    }
    const sum = v.reduce((a, b) => a + (b ? 1 : 0), 0);
    return { score: sum / v.length, rationale: `${sum}/${v.length} relevant` };
  } catch {
    return { score: 0, rationale: "parse_error" };
  }
}

/** Is the answer grounded in the retrieved context (no hallucinations)? */
export async function answerFaithfulness({ answer, retrievedChunks }) {
  if (!answer.trim()) return { score: 0, rationale: "empty answer" };
  const ctx = retrievedChunks
    .map(
      (c, i) =>
        `[${i + 1}] (${c.documentTitle}) ${c.content.slice(0, 500).replace(/\n+/g, " ")}`
    )
    .join("\n");
  return judge({
    system:
      'You are a strict grader. Score 0-1 (float). 1 = every factual claim in the answer is supported by the context. 0 = answer invents facts not in context. Output JSON only: {"score":number,"rationale":"short"}.',
    user: `Context:\n${ctx}\n\nAnswer:\n${answer}\n\nScore:`,
  });
}

/** Does the answer semantically match the reference (the source chunk content)? */
export async function answerCorrectness({ question, answer, referenceText }) {
  if (!answer.trim()) return { score: 0, rationale: "empty answer" };
  return judge({
    system:
      'You are a strict grader. Score 0-1 (float). 1 = the answer correctly addresses the question using information consistent with the reference. 0 = answer is wrong or contradicts the reference. Partial credit for partially correct. Output JSON only: {"score":number,"rationale":"short"}.',
    user: `Question: ${question}\n\nReference (the source the question was generated from):\n${referenceText}\n\nAnswer:\n${answer}\n\nScore:`,
  });
}

/** Does the answer cite the expected document title? Cheap string check + tolerant. */
export function citationAccuracy({ answer, expectedDocTitle }) {
  if (!answer || !expectedDocTitle) return { score: 0, rationale: "missing" };
  const a = answer.toLowerCase();
  const t = expectedDocTitle.toLowerCase();
  // Try full match, then progressive token coverage
  if (a.includes(t)) return { score: 1, rationale: "full title match" };
  const tokens = t.split(/[\s._\-]+/).filter((w) => w.length > 3);
  if (tokens.length === 0) return { score: 0, rationale: "no useful tokens" };
  const hits = tokens.filter((tok) => a.includes(tok)).length;
  const ratio = hits / tokens.length;
  return {
    score: ratio >= 0.6 ? 1 : ratio >= 0.3 ? 0.5 : 0,
    rationale: `${hits}/${tokens.length} title tokens matched`,
  };
}
