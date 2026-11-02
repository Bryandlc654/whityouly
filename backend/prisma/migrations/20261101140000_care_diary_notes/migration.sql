ALTER TABLE "diary_notes" ADD COLUMN "sourceId" TEXT;

CREATE UNIQUE INDEX "diary_notes_userId_sourceId_key" ON "diary_notes"("userId", "sourceId");
