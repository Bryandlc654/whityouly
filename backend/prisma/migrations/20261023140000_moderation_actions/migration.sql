-- Auditoría de decisiones de moderación. Se guarda el actor, el motivo y el
-- objetivo; revertir no borra la fila, solo completa revertedAt/revertedBy.
CREATE TYPE "ModerationActionKind" AS ENUM ('DISMISS', 'HIDE', 'SUSPEND', 'RESTORE');

CREATE TABLE "moderation_actions" (
    "id" TEXT NOT NULL,
    "reportId" TEXT,
    "actorUserId" TEXT NOT NULL,
    "action" "ModerationActionKind" NOT NULL,
    "targetType" "ReportedType",
    "targetId" TEXT,
    "subjectUserId" TEXT,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revertedAt" TIMESTAMP(3),
    "revertedByUserId" TEXT,
    "revertReason" TEXT,

    CONSTRAINT "moderation_actions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "moderation_actions_createdAt_id_idx" ON "moderation_actions"("createdAt", "id");
CREATE INDEX "moderation_actions_reportId_idx" ON "moderation_actions"("reportId");
CREATE INDEX "moderation_actions_targetType_targetId_idx" ON "moderation_actions"("targetType", "targetId");
CREATE INDEX "moderation_actions_actorUserId_createdAt_idx" ON "moderation_actions"("actorUserId", "createdAt");
CREATE INDEX "moderation_actions_revertedByUserId_idx" ON "moderation_actions"("revertedByUserId");
CREATE INDEX "moderation_actions_subjectUserId_idx" ON "moderation_actions"("subjectUserId");

ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_revertedByUserId_fkey" FOREIGN KEY ("revertedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_subjectUserId_fkey" FOREIGN KEY ("subjectUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
