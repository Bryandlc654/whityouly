-- Unicidad de interacciones e indices de consulta.
-- Un personaje no puede acompanar dos veces el mismo objetivo ni seguir dos
-- veces la misma historia, y un usuario no guarda dos veces el mismo elemento.
-- Los indices parciales garantizan la unicidad en la base (p. ej. dos peticiones
-- concurrentes): la aplicacion tambien lo comprueba, pero este es el muro final.
-- UniquenessStorySupport
CREATE UNIQUE INDEX "companionships_character_story_key" ON "companionships"("characterId", "targetStoryId") WHERE "targetStoryId" IS NOT NULL;

-- UniquenessCharacterSupport
CREATE UNIQUE INDEX "companionships_character_target_key" ON "companionships"("characterId", "targetCharacterId") WHERE "targetCharacterId" IS NOT NULL;

-- CreateIndex
CREATE INDEX "companionships_targetStoryId_idx" ON "companionships"("targetStoryId");

-- CreateIndex
CREATE INDEX "companionships_targetCharacterId_idx" ON "companionships"("targetCharacterId");

-- UniquenessStoryFollow
CREATE UNIQUE INDEX "followers_follower_story_key" ON "followers"("followerId", "followingStoryId") WHERE "followingStoryId" IS NOT NULL;

-- CreateIndex
CREATE INDEX "followers_followingStoryId_idx" ON "followers"("followingStoryId");

-- UniquenessBookmark
CREATE UNIQUE INDEX "bookmarks_user_target_key" ON "bookmarks"("userId", "targetType", "targetId");

-- CreateIndex
CREATE INDEX "bookmarks_userId_idx" ON "bookmarks"("userId");