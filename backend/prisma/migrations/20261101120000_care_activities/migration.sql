CREATE TYPE "CareActivityType" AS ENUM ('BREATHING', 'UNRAVEL', 'SMALL_STEP', 'VENT', 'COMPANY', 'DISTRACT');

CREATE TYPE "CareActivityStatus" AS ENUM ('PLANNED', 'COMPLETED');

CREATE TABLE "care_activities" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "activity" "CareActivityType" NOT NULL,
    "status" "CareActivityStatus" NOT NULL DEFAULT 'COMPLETED',
    "reflection" TEXT,
    "outcome" TEXT,
    "metadata" JSONB,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "care_activities_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "care_activities_userId_createdAt_idx" ON "care_activities"("userId", "createdAt");

CREATE INDEX "care_activities_userId_status_idx" ON "care_activities"("userId", "status");

ALTER TABLE "care_activities" ADD CONSTRAINT "care_activities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
