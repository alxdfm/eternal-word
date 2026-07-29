-- UX-02: recreate the search_vector generated column with the `simple` text
-- search config (keeps stop-words like "the"/"you" searchable) instead of
-- `english` (which strips them). Dropping the column also drops its dependent
-- GIN index, so it is dropped explicitly first and recreated after — otherwise
-- search would fall back to a sequential scan.
DROP INDEX IF EXISTS "verse_texts_search_idx";--> statement-breakpoint
ALTER TABLE "verse_texts" drop column "search_vector";--> statement-breakpoint
ALTER TABLE "verse_texts" ADD COLUMN "search_vector" "tsvector" GENERATED ALWAYS AS (to_tsvector('simple', coalesce(text, ''))) STORED;--> statement-breakpoint
CREATE INDEX "verse_texts_search_idx" ON "verse_texts" USING gin ("search_vector");
