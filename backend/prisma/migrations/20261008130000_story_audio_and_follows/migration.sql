-- Audio por etapa e indices de seguimiento.
-- Cada etapa de un relato puede llevar texto, imagen y audio a la vez, asi que
-- el audio vive en su propia columna (con su clave foranea e indice, porque
-- Postgres no indexa las FK por su cuenta).
-- CreateColumn
ALTER TABLE "story_updates" ADD COLUMN "audioAssetId" TEXT;

-- CreateIndex
CREATE INDEX "story_updates_audioAssetId_idx" ON "story_updates"("audioAssetId");

-- AddForeignKey
ALTER TABLE "story_updates" ADD CONSTRAINT "story_updates_audioAssetId_fkey" FOREIGN KEY ("audioAssetId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Indices de seguimiento: "a quien sigo" (followerId) y "quien me sigue"
-- (followingCharacterId), que Postgres no crea solo para las claves foraneas.
-- CreateIndex
CREATE INDEX "followers_followerId_followingCharacterId_idx" ON "followers"("followerId", "followingCharacterId");

-- CreateIndex
CREATE INDEX "followers_followingCharacterId_idx" ON "followers"("followingCharacterId");
