-- Historias destacadas en el perfil público y soporte de búsqueda.
-- La columna indica cuándo la persona destacó el relato (null = no destacado).
-- CreateColumn
ALTER TABLE "stories" ADD COLUMN "featuredAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "stories_characterId_featuredAt_idx" ON "stories"("characterId", "featuredAt");