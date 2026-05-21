/**
 * Generate a synthetic golden Q&A set from chunks in the database.
 *
 * For each sampled chunk, asks gpt-4o-mini to create one question whose answer
 * lives in that chunk. The chunk is the "ground truth" retrieval target.
 *
 * Usage:
 *   node evals/generate-golden.mjs              # default: up to 25 questions
 *   node evals/generate-golden.mjs --max 50     # cap at 50
 *   EVAL_USER_ID=user_xxx node evals/generate-golden.mjs
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { sql } from "./lib/db.mjs";
import { openai, parseJsonLoose } from "./lib/openai.mjs";
import { EVAL_USER_ID, JUDGE_MODEL } from "./lib/env.mjs";

const __dir = dirname(fileURLToPath(import.meta.url));

const argv = process.argv.slice(2);
const maxIdx = argv.indexOf("--max");
const MAX_Q = maxIdx !== -1 ? parseInt(argv[maxIdx + 1], 10) : 25;

console.log(`▸ Generating up to ${MAX_Q} Q&A pairs for user ${EVAL_USER_ID}`);

const chunks = await sql`
  SELECT
    dc.id            AS chunk_id,
    dc.content       AS content,
    dc.chunk_index   AS chunk_index,
    d.id             AS document_id,
    d.title          AS document_title
  FROM document_chunks dc
  JOIN documents d ON d.id = dc.document_id
  WHERE dc.user_id = ${EVAL_USER_ID}
    AND dc.embedding IS NOT NULL
    AND length(dc.content) > 200
  ORDER BY random()
  LIMIT ${MAX_Q}
`;

console.log(`▸ Sampled ${chunks.length} chunks across documents`);

async function generateQuestion(chunk) {
  const prompt =
    `You are creating an evaluation question for a company knowledge base search system.\n\n` +
    `Given the text below from a document titled "${chunk.document_title}", write ONE specific, ` +
    `realistic question that an employee might ask, and whose answer is clearly contained in this text.\n\n` +
    `Rules:\n` +
    `- The question must be self-contained (no "this document" / "above" / "the text").\n` +
    `- It must be answerable strictly from the text below.\n` +
    `- It should be specific enough that a vector search could find this exact chunk.\n` +
    `- Avoid yes/no questions.\n\n` +
    `Text:\n"""${chunk.content.slice(0, 1500)}"""\n\n` +
    `Output JSON only: {"question": "...", "expected_answer_excerpt": "shortest substring of the text that answers it"}`;

  try {
    const r = await openai.chat.completions.create({
      model: JUDGE_MODEL,
      temperature: 0.3,
      max_tokens: 250,
      messages: [{ role: "user", content: prompt }],
    });
    const parsed = parseJsonLoose(r.choices[0].message.content ?? "{}");
    if (!parsed.question) return null;
    return {
      question: parsed.question,
      expected_answer_excerpt: parsed.expected_answer_excerpt ?? "",
    };
  } catch (e) {
    console.warn(`  ✗ failed for chunk ${chunk.chunk_id}: ${e.message}`);
    return null;
  }
}

const goldenSet = [];
for (let i = 0; i < chunks.length; i++) {
  const c = chunks[i];
  process.stdout.write(`  [${i + 1}/${chunks.length}] ${c.document_title.slice(0, 40)}… `);
  const q = await generateQuestion(c);
  if (q) {
    goldenSet.push({
      id: `q_${i + 1}`,
      question: q.question,
      expected_chunk_id: c.chunk_id,
      expected_document_id: c.document_id,
      expected_document_title: c.document_title,
      expected_chunk_index: c.chunk_index,
      expected_answer_excerpt: q.expected_answer_excerpt,
      source_chunk_content: c.content,
    });
    console.log("✓");
  } else {
    console.log("skipped");
  }
}

mkdirSync(join(__dir, "golden"), { recursive: true });
const outPath = join(__dir, "golden", "golden-set.json");
writeFileSync(
  outPath,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      userId: EVAL_USER_ID,
      generatorModel: JUDGE_MODEL,
      count: goldenSet.length,
      questions: goldenSet,
    },
    null,
    2
  )
);

console.log(`\n✓ Wrote ${goldenSet.length} Q&A pairs → ${outPath}`);
