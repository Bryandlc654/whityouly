-- Preferencias de lectura y avisos internos.
CREATE TYPE "ReadingSize" AS ENUM ('NORMAL', 'LARGE', 'LARGER');

ALTER TABLE "user_preferences" ADD COLUMN "notificationsEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "user_preferences" ADD COLUMN "readingSize" "ReadingSize" NOT NULL DEFAULT 'NORMAL';

-- Pausa de comentarios por el autor.
ALTER TABLE "stories" ADD COLUMN "commentsPaused" BOOLEAN NOT NULL DEFAULT false;

-- Borradores privados del compositor de comentarios (uno por persona y relato).
CREATE TABLE "comment_drafts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comment_drafts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "comment_drafts_userId_storyId_key" ON "comment_drafts"("userId", "storyId");
CREATE INDEX "comment_drafts_userId_updatedAt_idx" ON "comment_drafts"("userId", "updatedAt");

ALTER TABLE "comment_drafts" ADD CONSTRAINT "comment_drafts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "comment_drafts" ADD CONSTRAINT "comment_drafts_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
