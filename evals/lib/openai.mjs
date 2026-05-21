import OpenAI from "openai";
import { OPENAI_API_KEY, EMBEDDING_MODEL } from "./env.mjs";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const baseClient = new OpenAI({ apiKey: OPENAI_API_KEY });

/**
 * Wrap a method so 429s are retried with backoff that respects the API's
 * "Please try again in X.Ys" hint. Up to 5 attempts, capped at 30s wait.
 */
function withRetry(fn, label) {
  return async function (...args) {
    let lastErr;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        return await fn.apply(this, args);
      } catch (e) {
        lastErr = e;
        const status = e?.status ?? e?.response?.status;
        if (status !== 429 && status !== 503) throw e;
        const msg = e?.message ?? "";
        const m = msg.match(/try again in ([\d.]+)\s*s/i);
        const waitMs = m
          ? Math.min(parseFloat(m[1]) * 1000 + 500, 30_000)
          : Math.min(2000 * Math.pow(2, attempt), 30_000);
        console.warn(
          `  ⏳ ${label} 429 — sleeping ${Math.round(waitMs)}ms (attempt ${attempt + 1}/5)`
        );
        await sleep(waitMs);
      }
    }
    throw lastErr;
  };
}

export const openai = {
  chat: {
    completions: {
      create: withRetry(
        baseClient.chat.completions.create.bind(baseClient.chat.completions),
        "chat"
      ),
    },
  },
  embeddings: {
    create: withRetry(
      baseClient.embeddings.create.bind(baseClient.embeddings),
      "embed"
    ),
  },
};

export async function embed(text) {
  const r = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text.replace(/\n/g, " "),
  });
  return r.data[0].embedding;
}

/**
 * Robust JSON parse — strips ```json fences and finds the first {...} block.
 */
export function parseJsonLoose(text) {
  let s = text.trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  }
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start !== -1 && end !== -1) s = s.slice(start, end + 1);
  return JSON.parse(s);
}
