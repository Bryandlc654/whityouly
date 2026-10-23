-- Listas públicas de seguidores y seguidos. La consulta filtra por un lado de
-- la relación y pagina por `createdAt` descendente; estos índices evitan
-- ordenar toda la tabla en cada página.
CREATE INDEX "followers_followingCharacterId_createdAt_idx" ON "followers"("followingCharacterId", "createdAt");

CREATE INDEX "followers_followerId_createdAt_idx" ON "followers"("followerId", "createdAt");
