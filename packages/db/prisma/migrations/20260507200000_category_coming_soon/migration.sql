CREATE TABLE "GameCategory" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "coverUrl" TEXT,
  "gameMode" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "comingSoon" BOOLEAN NOT NULL DEFAULT false,
  "parentId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GameCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GameCategory_slug_key" ON "GameCategory"("slug");

ALTER TABLE "GameCategory"
  ADD CONSTRAINT "GameCategory_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "GameCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
