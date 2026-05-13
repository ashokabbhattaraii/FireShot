CREATE TABLE "BannedFreeFireUid" (
    "id" TEXT NOT NULL,
    "freeFireUid" TEXT NOT NULL,
    "userId" TEXT,
    "reason" TEXT,
    "bannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BannedFreeFireUid_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BannedFreeFireUid_freeFireUid_key" ON "BannedFreeFireUid"("freeFireUid");
CREATE INDEX "BannedFreeFireUid_userId_idx" ON "BannedFreeFireUid"("userId");
CREATE INDEX "BannedFreeFireUid_bannedAt_idx" ON "BannedFreeFireUid"("bannedAt");

ALTER TABLE "BannedFreeFireUid"
  ADD CONSTRAINT "BannedFreeFireUid_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
