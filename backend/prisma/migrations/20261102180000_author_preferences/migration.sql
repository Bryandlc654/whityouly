CREATE TYPE "AuthorPreferenceKind" AS ENUM ('MUTE', 'BLOCK', 'LESS');

CREATE TABLE "author_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "kind" "AuthorPreferenceKind" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "author_preferences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "author_preferences_userId_authorName_kind_key" ON "author_preferences"("userId", "authorName", "kind");
CREATE INDEX "author_preferences_userId_kind_idx" ON "author_preferences"("userId", "kind");
ALTER TABLE "author_preferences" ADD CONSTRAINT "author_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;