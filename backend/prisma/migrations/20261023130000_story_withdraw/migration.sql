-- Retiro reversible de relatos propios. WITHDRAWN se distingue de DELETED y de
-- los estados de moderación; al restaurar se vuelve a PUBLISHED y se limpia la
-- fecha de retiro.
ALTER TYPE "StoryStatus" ADD VALUE 'WITHDRAWN';

ALTER TABLE "stories" ADD COLUMN "withdrawnAt" TIMESTAMP(3);

-- Bandeja "Relatos retirados": filtra por autor y estado, ordena por fecha de
-- retiro. Sin este índice, cada visita ordena todos los relatos del personaje.
CREATE INDEX "stories_characterId_status_withdrawnAt_idx" ON "stories"("characterId", "status", "withdrawnAt");
