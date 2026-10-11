-- Niveles de seguimiento de relato y avisos agrupados.
--
-- `followers.notifyLevel`: distingue "Seguir relato" (ALL, recibe las etapas
-- nuevas) de "Estoy contigo" (CONSERVATIVE, sigue el relato en silencio). El
-- valor por defecto ALL mantiene el comportamiento de los vínculos existentes.
--
-- `notifications.count`: agrupa en un único aviso los comentarios y los
-- acompañamientos de un mismo relato, incrementando el contador en vez de crear
-- una fila por cada interacción. Las filas existentes arrancan en 1.

-- AlterTable (followers)
ALTER TABLE "followers" ADD COLUMN "notifyLevel" TEXT NOT NULL DEFAULT 'ALL';

-- AlterTable (notifications)
ALTER TABLE "notifications" ADD COLUMN "count" INTEGER NOT NULL DEFAULT 1;
