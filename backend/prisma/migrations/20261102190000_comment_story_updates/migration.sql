ALTER TABLE "comments" ADD COLUMN "storyUpdateId" TEXT;

CREATE INDEX "comments_storyUpdateId_createdAt_idx" ON "comments"("storyUpdateId", "createdAt");

ALTER TABLE "comments" ADD CONSTRAINT "comments_storyUpdateId_fkey" FOREIGN KEY ("storyUpdateId") REFERENCES "story_updates"("id") ON DELETE SET NULL ON UPDATE CASCADE;