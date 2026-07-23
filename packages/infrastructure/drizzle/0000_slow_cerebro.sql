CREATE TYPE "public"."testament" AS ENUM('OLD', 'NEW');--> statement-breakpoint
CREATE TYPE "public"."verse_status" AS ENUM('AVAILABLE', 'PENDING', 'REGISTERED', 'FAILED');--> statement-breakpoint
CREATE TABLE "books" (
	"id" smallint PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"abbreviation" text NOT NULL,
	"testament" "testament" NOT NULL,
	"chapters_count" smallint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "translations" (
	"id" "smallserial" PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"language" text NOT NULL,
	"license" text NOT NULL,
	"source_url" text NOT NULL,
	"is_canonical" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verse_texts" (
	"translation_id" smallint NOT NULL,
	"book" smallint NOT NULL,
	"chapter" smallint NOT NULL,
	"verse" smallint NOT NULL,
	"text" text,
	CONSTRAINT "verse_texts_translation_id_book_chapter_verse_pk" PRIMARY KEY("translation_id","book","chapter","verse")
);
--> statement-breakpoint
CREATE TABLE "verses" (
	"book" smallint NOT NULL,
	"chapter" smallint NOT NULL,
	"verse" smallint NOT NULL,
	"status" "verse_status" DEFAULT 'AVAILABLE' NOT NULL,
	"adopter" text,
	"transaction" text,
	"account" text,
	"slot" bigint,
	"registered_at" timestamp with time zone,
	CONSTRAINT "verses_book_chapter_verse_pk" PRIMARY KEY("book","chapter","verse")
);
--> statement-breakpoint
ALTER TABLE "verse_texts" ADD CONSTRAINT "verse_texts_translation_id_translations_id_fk" FOREIGN KEY ("translation_id") REFERENCES "public"."translations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verse_texts" ADD CONSTRAINT "verse_texts_book_books_id_fk" FOREIGN KEY ("book") REFERENCES "public"."books"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verses" ADD CONSTRAINT "verses_book_books_id_fk" FOREIGN KEY ("book") REFERENCES "public"."books"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "books_slug_key" ON "books" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "translations_code_key" ON "translations" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "translations_single_canonical" ON "translations" USING btree ("is_canonical") WHERE "translations"."is_canonical";--> statement-breakpoint
CREATE INDEX "verses_status_idx" ON "verses" USING btree ("status");--> statement-breakpoint
CREATE INDEX "verses_adopter_idx" ON "verses" USING btree ("adopter");