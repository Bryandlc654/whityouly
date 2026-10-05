-- Indices for the periodic cleanups and the foreign keys.
-- The session purge and the orphan-avatar sweep filter by columns that were only
-- indexed from the owner side, so both jobs scanned the whole table. The
-- media_assets foreign keys are counted when a file is deleted and Postgres does
-- not index foreign keys on its own.
-- CreateIndex
CREATE INDEX "sessions_expiresAt_idx" ON "sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "characters_avatarUrl_idx" ON "characters"("avatarUrl");

-- CreateIndex
CREATE INDEX "media_assets_entityType_createdAt_idx" ON "media_assets"("entityType", "createdAt");

-- CreateIndex
CREATE INDEX "story_updates_mediaAssetId_idx" ON "story_updates"("mediaAssetId");

-- CreateIndex
CREATE INDEX "creations_mediaAssetId_idx" ON "creations"("mediaAssetId");

-- CreateIndex
CREATE INDEX "music_tracks_mediaAssetId_idx" ON "music_tracks"("mediaAssetId");
