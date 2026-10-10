-- Indices de descubrimiento y escalabilidad.
--
-- 1. Comentarios: es la tabla que mas crece (una fila por interaccion escrita) y
--    no tenia ningun indice. El listado de un relato filtra por `storyId` y
--    ordena por fecha; las tendencias agrupan los comentarios de la ultima
--    ventana filtrando por estado y fecha. Sin estos indices, ambas consultas
--    recorren la tabla entera.
-- 2. Relatos destacados por su autor: el contenido destacado cae a ellos cuando
--    no hay curacion y ordena por `featuredAt` sola (sin `characterId`).

-- CreateIndex
CREATE INDEX "comments_storyId_createdAt_idx" ON "comments"("storyId", "createdAt");

-- CreateIndex
CREATE INDEX "comments_status_createdAt_idx" ON "comments"("status", "createdAt");

-- CreateIndex
CREATE INDEX "stories_featuredAt_idx" ON "stories"("featuredAt");