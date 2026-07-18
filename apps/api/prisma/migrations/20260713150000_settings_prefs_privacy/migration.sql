ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bio" VARCHAR(70);

CREATE TABLE IF NOT EXISTS "user_preferences" (
    "user_id" UUID NOT NULL,
    "theme" TEXT NOT NULL DEFAULT 'system',
    "language" TEXT NOT NULL DEFAULT 'en',
    "send_on_enter" BOOLEAN NOT NULL DEFAULT true,
    "message_preview" BOOLEAN NOT NULL DEFAULT true,
    "desktop_notifications" BOOLEAN NOT NULL DEFAULT true,
    "sound_enabled" BOOLEAN NOT NULL DEFAULT true,
    "animation_level" TEXT NOT NULL DEFAULT 'full',
    "auto_download_photos" BOOLEAN NOT NULL DEFAULT true,
    "auto_download_videos" BOOLEAN NOT NULL DEFAULT false,
    "auto_download_files" BOOLEAN NOT NULL DEFAULT false,
    "save_to_gallery" BOOLEAN NOT NULL DEFAULT false,
    "font_size" INTEGER NOT NULL DEFAULT 16,
    "chat_background" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("user_id")
);

DO $$ BEGIN
  ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "privacy_settings" (
    "user_id" UUID NOT NULL,
    "field" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'EVERYONE',

    CONSTRAINT "privacy_settings_pkey" PRIMARY KEY ("user_id","field")
);

DO $$ BEGIN
  ALTER TABLE "privacy_settings" ADD CONSTRAINT "privacy_settings_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "user_blocks" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "blocked_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_blocks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_blocks_owner_id_blocked_id_key" ON "user_blocks"("owner_id", "blocked_id");
CREATE INDEX IF NOT EXISTS "user_blocks_owner_id_idx" ON "user_blocks"("owner_id");

DO $$ BEGIN
  ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_owner_id_fkey"
    FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blocked_id_fkey"
    FOREIGN KEY ("blocked_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
