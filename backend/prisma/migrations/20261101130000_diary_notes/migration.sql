ALTER TABLE "emotional_logs"
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "deletedAt" TIMESTAMP(3);

UPDATE "emotional_logs" SET "updatedAt" = "createdAt";

CREATE INDEX "emotional_logs_userId_deletedAt_loggedAt_idx" ON "emotional_logs"("userId", "deletedAt", "loggedAt");

CREATE TABLE "diary_notes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "diary_notes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "diary_notes_userId_deletedAt_createdAt_idx" ON "diary_notes"("userId", "deletedAt", "createdAt");

ALTER TABLE "diary_notes" ADD CONSTRAINT "diary_notes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
