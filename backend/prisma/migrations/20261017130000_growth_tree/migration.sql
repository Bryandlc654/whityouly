-- Árbol de crecimiento: registro de "gotas" (una por camino y día) y marcas
-- "Me ayudó" en comentarios. Ambas tablas son aditivas; no tocan datos previos.

-- CreateEnum
CREATE TYPE "TreePath" AS ENUM ('SELF_KNOWLEDGE', 'CARE_EXPRESSION', 'ACCOMPANIMENT');

-- CreateTable
CREATE TABLE "tree_drops" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "path" "TreePath" NOT NULL,
    "day" DATE NOT NULL,
    "sourceType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tree_drops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comment_helpfuls" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comment_helpfuls_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tree_drops_userId_day_idx" ON "tree_drops"("userId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "tree_drops_userId_path_day_key" ON "tree_drops"("userId", "path", "day");

-- CreateIndex
CREATE INDEX "comment_helpfuls_characterId_createdAt_idx" ON "comment_helpfuls"("characterId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "comment_helpfuls_commentId_characterId_key" ON "comment_helpfuls"("commentId", "characterId");

-- AddForeignKey
ALTER TABLE "tree_drops" ADD CONSTRAINT "tree_drops_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_helpfuls" ADD CONSTRAINT "comment_helpfuls_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_helpfuls" ADD CONSTRAINT "comment_helpfuls_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
