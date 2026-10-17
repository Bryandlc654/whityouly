-- El Mapa Emocional lista y agrega los registros siempre por usuario y fecha.
-- Sin este índice, tanto la lista paginada como el resumen del periodo recorren
-- la tabla entera, que crece con cada registro de cada cuenta.
-- CreateIndex
CREATE INDEX "emotional_logs_userId_loggedAt_idx" ON "emotional_logs"("userId", "loggedAt");
