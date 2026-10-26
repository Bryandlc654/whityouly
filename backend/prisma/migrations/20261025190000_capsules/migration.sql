CREATE TABLE "capsules" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "mood" TEXT,
    "openAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "capsules_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "capsules_userId_openAt_idx" ON "capsules"("userId", "openAt");

ALTER TABLE "capsules" ADD CONSTRAINT "capsules_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
