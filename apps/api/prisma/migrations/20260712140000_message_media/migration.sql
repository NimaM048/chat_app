-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('TEXT', 'IMAGE', 'FILE', 'VOICE');

-- AlterTable
ALTER TABLE "messages" ADD COLUMN "type" "MessageType" NOT NULL DEFAULT 'TEXT';
ALTER TABLE "messages" ADD COLUMN "file_url" TEXT;
ALTER TABLE "messages" ADD COLUMN "file_name" TEXT;
ALTER TABLE "messages" ADD COLUMN "file_size" INTEGER;
ALTER TABLE "messages" ADD COLUMN "mime_type" TEXT;
ALTER TABLE "messages" ADD COLUMN "duration_ms" INTEGER;
ALTER TABLE "messages" ALTER COLUMN "content" SET DEFAULT '';
