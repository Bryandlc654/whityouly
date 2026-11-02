ALTER TABLE "user_preferences" ADD COLUMN "countryCode" TEXT;

ALTER TABLE "stories"
ADD COLUMN "language" TEXT NOT NULL DEFAULT 'es',
ADD COLUMN "countryCode" TEXT,
ADD COLUMN "translations" JSONB;

CREATE INDEX "stories_language_status_visibility_idx" ON "stories"("language", "status", "visibility");
