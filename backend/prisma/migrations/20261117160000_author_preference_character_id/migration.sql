-- El bloqueo deja de depender del seudónimo: se guarda el id del personaje y se
-- rellena para las preferencias existentes resolviendo el nombre actual.
ALTER TABLE "author_preferences" ADD COLUMN "characterId" TEXT;

UPDATE "author_preferences" AS "ap"
SET "characterId" = "c"."id"
FROM "characters" AS "c"
WHERE lower("c"."name") = lower("ap"."authorName");

CREATE INDEX "author_preferences_userId_kind_characterId_idx"
  ON "author_preferences"("userId", "kind", "characterId");
