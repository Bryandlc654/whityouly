ALTER TABLE "sessions" ADD COLUMN "absoluteExpiresAt" TIMESTAMP(3);
UPDATE "sessions" SET "absoluteExpiresAt" = "expiresAt" WHERE "absoluteExpiresAt" IS NULL;
ALTER TABLE "sessions" ALTER COLUMN "absoluteExpiresAt" SET NOT NULL;
