-- Baja reversible: la cuenta queda en DELETION_PENDING durante la ventana de
-- gracia. El registro permite cancelar antes de eligibleAt y deja constancia de
-- la purga completada.
ALTER TYPE "Status" ADD VALUE 'DELETION_PENDING';

CREATE TABLE "account_deletion_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eligibleAt" TIMESTAMP(3) NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "account_deletion_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "account_deletion_requests_userId_requestedAt_idx" ON "account_deletion_requests"("userId", "requestedAt");
CREATE INDEX "account_deletion_requests_eligibleAt_completedAt_cancelledAt_idx" ON "account_deletion_requests"("eligibleAt", "completedAt", "cancelledAt");

ALTER TABLE "account_deletion_requests" ADD CONSTRAINT "account_deletion_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
