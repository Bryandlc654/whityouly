CREATE TABLE "tree_gardens" (
    "userId" TEXT NOT NULL,
    "decoration" TEXT NOT NULL DEFAULT 'none',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tree_gardens_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "tree_styles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "treeIndex" INTEGER NOT NULL,
    "species" TEXT NOT NULL DEFAULT 'bonsai',
    "pot" TEXT NOT NULL DEFAULT 'violet',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tree_styles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tree_styles_userId_treeIndex_key" ON "tree_styles"("userId", "treeIndex");

CREATE INDEX "tree_styles_userId_idx" ON "tree_styles"("userId");

ALTER TABLE "tree_gardens" ADD CONSTRAINT "tree_gardens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tree_styles" ADD CONSTRAINT "tree_styles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
