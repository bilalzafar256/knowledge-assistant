ALTER TABLE "document_chunks" ADD COLUMN "contextualized_content" text;--> statement-breakpoint
-- Contextual Retrieval: BM25 should index the contextualized text when present.
-- A generated column's expression can't be ALTERed in place, so drop + recreate
-- (the dependent GIN index drops with the column; recreate it too). Backfilled
-- rows have contextualized_content = NULL, so COALESCE falls back to content and
-- existing BM25 behaviour is unchanged until a re-ingest populates the column.
DROP INDEX IF EXISTS "chunks_content_tsv_idx";--> statement-breakpoint
ALTER TABLE "document_chunks" DROP COLUMN IF EXISTS "content_tsv";--> statement-breakpoint
ALTER TABLE "document_chunks" ADD COLUMN "content_tsv" tsvector GENERATED ALWAYS AS (to_tsvector('english', COALESCE("contextualized_content", "content"))) STORED;--> statement-breakpoint
CREATE INDEX "chunks_content_tsv_idx" ON "document_chunks" USING GIN ("content_tsv");