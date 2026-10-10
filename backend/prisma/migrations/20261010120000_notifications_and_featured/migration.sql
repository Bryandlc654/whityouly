-- Notificaciones enriquecidas y contenido destacado por administracion.
--
-- Notificaciones: se anade quien provoco el aviso (`actorCharacterId`) y el
-- objeto pasa a ser opcional (los avisos de sistema no apuntan a nada). El
-- indice simple por `userId` se sustituye por dos compuestos que cubren la
-- bandeja (destinatario + fecha) y el contador de no leidas (destinatario +
-- estado + fecha).
--
-- Contenido destacado: lista curada por administracion, con orden y fecha de
-- caducidad opcional, independiente del destacado del perfil (`stories.featuredAt`).

-- CreateColumn (notifications)
ALTER TABLE "notifications" ADD COLUMN "actorCharacterId" TEXT;

-- AlterColumn (notifications): el aviso puede no apuntar a una entidad concreta.
ALTER TABLE "notifications" ALTER COLUMN "entityId" DROP NOT NULL;

-- DropIndex
DROP INDEX "notifications_userId_idx";

-- CreateIndex
CREATE INDEX "notifications_userId_createdAt_idx" ON "notifications"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_userId_status_createdAt_idx" ON "notifications"("userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_actorCharacterId_idx" ON "notifications"("actorCharacterId");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actorCharacterId_fkey" FOREIGN KEY ("actorCharacterId") REFERENCES "characters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable (featured_stories)
CREATE TABLE "featured_stories" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "featured_stories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "featured_stories_storyId_key" ON "featured_stories"("storyId");

-- CreateIndex
CREATE INDEX "featured_stories_position_createdAt_idx" ON "featured_stories"("position", "createdAt");

-- AddForeignKey
ALTER TABLE "featured_stories" ADD CONSTRAINT "featured_stories_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
