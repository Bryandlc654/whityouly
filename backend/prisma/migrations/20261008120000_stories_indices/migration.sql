-- Indices para el modulo de historias.
-- Postgres no indexa las claves foraneas por su cuenta. El listado del
-- propietario ("mis relatos") filtra por personaje y el feed publico por estado
-- y visibilidad: sin estos indices ambas consultas recorren toda la tabla de
-- relatos. Las etapas se leen siempre por relato y ordenadas.
-- CreateIndex
CREATE INDEX "stories_characterId_createdAt_idx" ON "stories"("characterId", "createdAt");

-- CreateIndex
CREATE INDEX "stories_status_visibility_createdAt_idx" ON "stories"("status", "visibility", "createdAt");

-- CreateIndex
CREATE INDEX "story_updates_storyId_stageOrder_idx" ON "story_updates"("storyId", "stageOrder");
