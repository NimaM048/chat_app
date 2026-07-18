-- AlterTable
ALTER TABLE "messages" ADD COLUMN "is_pinned" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "messages" ADD COLUMN "reply_to_id" UUID;
ALTER TABLE "messages" ADD COLUMN "forwarded_from_id" UUID;

-- CreateIndex
CREATE INDEX "messages_conversation_id_is_pinned_idx" ON "messages"("conversation_id", "is_pinned");

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_reply_to_id_fkey" FOREIGN KEY ("reply_to_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_forwarded_from_id_fkey" FOREIGN KEY ("forwarded_from_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
