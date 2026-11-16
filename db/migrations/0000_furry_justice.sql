CREATE TABLE "document_versions" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"key" text NOT NULL,
	"body" jsonb,
	"schema_version" integer NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"saved_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"user_id" text NOT NULL,
	"key" text NOT NULL,
	"body" jsonb,
	"schema_version" integer NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "documents_user_id_key_pk" PRIMARY KEY("user_id","key"),
	CONSTRAINT "documents_key_check" CHECK ("documents"."key" in ('data', 'settings', 'template'))
);
--> statement-breakpoint
CREATE INDEX "document_versions_user_key_saved_at_idx" ON "document_versions" USING btree ("user_id","key","saved_at" DESC NULLS LAST);