CREATE TABLE "sync_heartbeat" (
	"id" smallint PRIMARY KEY NOT NULL,
	"last_processed_slot" bigint NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
