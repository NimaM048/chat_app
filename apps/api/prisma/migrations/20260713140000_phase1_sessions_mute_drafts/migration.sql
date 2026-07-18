-- AlterTable refresh_tokens: session metadata
ALTER TABLE "refresh_tokens" ADD COLUMN IF NOT EXISTS "device_id" TEXT;
ALTER TABLE "refresh_tokens" ADD COLUMN IF NOT EXISTS "device_name" TEXT;
ALTER TABLE "refresh_tokens" ADD COLUMN IF NOT EXISTS "platform" TEXT;
ALTER TABLE "refresh_tokens" ADD COLUMN IF NOT EXISTS "ip" TEXT;
ALTER TABLE "refresh_tokens" ADD COLUMN IF NOT EXISTS "user_agent" TEXT;
ALTER TABLE "refresh_tokens" ADD COLUMN IF NOT EXISTS "last_active_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS "refresh_tokens_user_id_revoked_at_idx" ON "refresh_tokens"("user_id", "revoked_at");

-- AlterTable conversation_members
ALTER TABLE "conversation_members" ADD COLUMN IF NOT EXISTS "is_pinned" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "conversation_members" ADD COLUMN IF NOT EXISTS "pin_order" INTEGER;
ALTER TABLE "conversation_members" ADD COLUMN IF NOT EXISTS "muted_until" TIMESTAMP(3);
ALTER TABLE "conversation_members" ADD COLUMN IF NOT EXISTS "marked_unread" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "conversation_members_user_id_is_pinned_idx" ON "conversation_members"("user_id", "is_pinned");

-- CreateTable drafts
CREATE TABLE IF NOT EXISTS "drafts" (
    "user_id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "reply_to_id" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "drafts_pkey" PRIMARY KEY ("user_id","conversation_id")
);

DO $$ BEGIN
  ALTER TABLE "drafts" ADD CONSTRAINT "drafts_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "drafts" ADD CONSTRAINT "drafts_conversation_id_fkey"
    FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
