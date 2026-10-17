-- Apelaciones de publicaciones moderadas. A diferencia del reporte (que lo
-- escribe quien observa), la apelación la escribe el autor del contenido
-- ocultado y la revisa administración, que puede restaurar la publicación.
-- CreateEnum
CREATE TYPE "AppealStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateTable
CREATE TABLE "appeals" (
    "id" TEXT NOT NULL,
    "appellantUserId" TEXT NOT NULL,
    "targetType" "ReportedType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "reportId" TEXT,
    "message" TEXT NOT NULL,
    "status" "AppealStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedByUserId" TEXT,
    "resolutionNote" TEXT,

    CONSTRAINT "appeals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "appeals_status_createdAt_idx" ON "appeals"("status", "createdAt");

-- CreateIndex
CREATE INDEX "appeals_appellantUserId_createdAt_idx" ON "appeals"("appellantUserId", "createdAt");

-- CreateIndex
CREATE INDEX "appeals_targetType_targetId_idx" ON "appeals"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "appeals_resolvedByUserId_idx" ON "appeals"("resolvedByUserId");

-- AddForeignKey
ALTER TABLE "appeals" ADD CONSTRAINT "appeals_appellantUserId_fkey" FOREIGN KEY ("appellantUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appeals" ADD CONSTRAINT "appeals_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- La bandeja de moderación lista los reportes por estado y fecha; el chequeo de
-- duplicados filtra por autor, tipo y objeto. Sin estos índices, ambas
-- consultas recorren toda la tabla de reportes.
-- CreateIndex
CREATE INDEX "reports_status_createdAt_idx" ON "reports"("status", "createdAt");

-- CreateIndex
CREATE INDEX "reports_reporterUserId_reportedType_reportedId_idx" ON "reports"("reporterUserId", "reportedType", "reportedId");
