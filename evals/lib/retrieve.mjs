/**
 * Mirrors src/lib/ai.ts retrieval pipeline so eval results reflect production.
 * If src/lib/ai.ts changes, update this file too (or refactor to share).
 */
import { sql } from "./db.mjs";
import { openai, embed, parseJsonLoose } from "./openai.mjs";
import { JUDGE_MODEL, COHERE_API_KEY, COHERE_RERANK_MODEL } from "./env.mjs";

async function synthesizeSearchQuery(latestQuery, priorMessages) {
  if (!priorMessages || priorMessages.length === 0) return latestQuery;
  try {
    const recent = priorMessages.slice(-6);
    const history = recent
      .map(
        (m) =>
          `${m.role === "user" ? "User" : "Assistant"}: ${m.content.slice(0, 400)}`
      )
      .join("\n");
    const r = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 60,
      temperature: 0,
      messages: [
        {
          role: "user",
          content:
            `You are a search query optimizer. Given a conversation and the user's latest message, ` +
            `rewrite the latest message as a complete, standalone search query that includes all ` +
            `necessary context from the conversation. Output ONLY the query — no explanation, no quotes.\n\n` +
            `Conversation so far:\n${history}\n\n` +
            `Latest message: ${latestQuery}\n\n` +
            `Standalone search query:`,
        },
      ],
    });
    const t = r.choices[0].message.content?.trim() ?? "";
    return t.length > 0 ? t : latestQuery;
  } catch {
    return latestQuery;
  }
}

async function cohereRerank(query, candidates, topK) {
  const documents = candidates.map(
    (c) => `[${c.documentTitle}] ${c.content.slice(0, 1500)}`
  );
  const res = await fetch("https://api.cohere.com/v2/rerank", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${COHERE_API_KEY}`,
    },
    body: JSON.stringify({
      model: COHERE_RERANK_MODEL,
      query,
      documents,
      top_n: topK,
    }),
  });
  if (!res.ok) {
    throw new Error(`Cohere ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  return data.results.map((r) => r.index);
}

async function llmRerank(query, candidates, topK) {
  try {
    const chunkList = candidates
      .map(
        (c, i) =>
          `${i + 1}. [${c.documentTitle}] ${c.content
            .slice(0, 300)
            .replace(/\n+/g, " ")}`
      )
      .join("\n");
    const r = await openai.chat.completions.create({
      model: JUDGE_MODEL,
      max_tokens: 120,
      temperature: 0,
      messages: [
        {
          role: "user",
          content:
            `Score each chunk 0–10 for relevance to the query. ` +
            `Output ONLY a JSON object: {"scores":[n,n,...]} with one number per chunk.\n\n` +
            `Query: ${query}\n\n` +
            `Chunks:\n${chunkList}`,
        },
      ],
    });
    const text = r.choices[0].message.content ?? "";
    const parsed = parseJsonLoose(text);
    const scores = parsed.scores;
    if (!Array.isArray(scores) || scores.length !== candidates.length) {
      throw new Error("bad scores");
    }
    return scores
      .map((score, idx) => ({ score, idx }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map((x) => x.idx);
  } catch {
    return candidates.slice(0, topK).map((_, i) => i);
  }
}

async function rerankChunks(query, candidates, topK) {
  if (candidates.length <= topK) return candidates.map((_, i) => i);
  if (COHERE_API_KEY) {
    try {
      return await cohereRerank(query, candidates, topK);
    } catch (e) {
      console.warn("  ⚠ Cohere rerank failed, falling back to gpt-4o-mini:", e.message);
    }
  }
  return llmRerank(query, candidates, topK);
}

/**
 * Full retrieval: synthesize → embed → vector search → rerank.
 * Returns both the reranked top-k AND the raw vector candidates (for recall@10 etc).
 */
export async function searchKnowledge({
  query,
  userId,
  priorMessages = [],
  limit = 5,
}) {
  const searchQuery = await synthesizeSearchQuery(query, priorMessages);
  const queryEmbedding = await embed(searchQuery);
  const vectorString = `[${queryEmbedding.join(",")}]`;

  const candidateLimit = Math.min(limit * 3, 15);
  const perRetriever = Math.max(candidateLimit * 2, 20);
  const rrfK = 60;

  // Hybrid: vector + BM25 fused via Reciprocal Rank Fusion.
  // Mirrors src/lib/ai.ts.
  const rows = await sql`
    WITH vector_hits AS (
      SELECT id, ROW_NUMBER() OVER (ORDER BY embedding <=> ${vectorString}::vector) AS rank
      FROM document_chunks
      WHERE user_id = ${userId}
        AND embedding IS NOT NULL
      ORDER BY embedding <=> ${vectorString}::vector
      LIMIT ${perRetriever}
    ),
    bm25_query AS (
      SELECT plainto_tsquery('english', ${searchQuery}) AS q
    ),
    bm25_hits AS (
      SELECT
        dc.id,
        ROW_NUMBER() OVER (ORDER BY ts_rank_cd(dc.content_tsv, bq.q) DESC) AS rank
      FROM document_chunks dc, bm25_query bq
      WHERE dc.user_id = ${userId}
        AND dc.content_tsv @@ bq.q
      ORDER BY ts_rank_cd(dc.content_tsv, bq.q) DESC
      LIMIT ${perRetriever}
    ),
    fused AS (
      SELECT id, SUM(1.0 / (${rrfK} + rank)) AS rrf_score
      FROM (
        SELECT id, rank FROM vector_hits
        UNION ALL
        SELECT id, rank FROM bm25_hits
      ) combined
      GROUP BY id
    )
    SELECT
      dc.id,
      dc.content,
      dc.chunk_index,
      dc.metadata,
      d.title AS document_title,
      d.id AS document_id,
      1 - (dc.embedding <=> ${vectorString}::vector) AS similarity,
      f.rrf_score
    FROM fused f
    JOIN document_chunks dc ON dc.id = f.id
    JOIN documents d ON d.id = dc.document_id
    ORDER BY f.rrf_score DESC
    LIMIT ${candidateLimit}
  `;

  // Diagnostic: also fetch pure-vector top-15 (no fusion) so eval can compare
  // "fused candidate quality" vs "vector-only candidate quality" side-by-side.
  const pureVectorRows = await sql`
    SELECT id
    FROM document_chunks
    WHERE user_id = ${userId}
      AND embedding IS NOT NULL
    ORDER BY embedding <=> ${vectorString}::vector
    LIMIT 15
  `;
  const pureVectorCandidates = pureVectorRows.map((r) => ({ chunkId: r.id }));

  if (rows.length === 0) {
    return { searchQuery, vectorCandidates: [], pureVectorCandidates, rerankedTopK: [] };
  }

  const topIndices = await rerankChunks(
    searchQuery,
    rows.map((r) => ({ content: r.content, documentTitle: r.document_title })),
    limit
  );

  const rerankedTopK = topIndices
    .map((i) => rows[i])
    .filter((r) => r !== undefined)
    .map((r) => ({
      chunkId: r.id,
      documentId: r.document_id,
      documentTitle: r.document_title,
      content: r.content,
      chunkIndex: r.chunk_index,
      similarity: Math.round((r.similarity ?? 0) * 100) / 100,
    }));

  // `vectorCandidates` now holds fused (RRF) candidates — name kept for
  // schema compatibility with baseline eval. New `pureVectorCandidates`
  // captures vector-only ranks for diagnostic comparison.
  const vectorCandidates = rows.map((r) => ({
    chunkId: r.id,
    documentId: r.document_id,
    documentTitle: r.document_title,
    similarity: r.similarity,
  }));

  return { searchQuery, vectorCandidates, pureVectorCandidates, rerankedTopK };
}
