ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "isLocked" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "sessionVersion" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "BalanceAdjustment" (
  "id" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "targetUserId" TEXT NOT NULL,
  "walletTxId" TEXT,
  "actionType" TEXT NOT NULL,
  "amountNpr" INTEGER NOT NULL,
  "previousBalance" INTEGER NOT NULL,
  "newBalance" INTEGER NOT NULL,
  "comment" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "BalanceAdjustment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "BalanceAdjustment_actorId_createdAt_idx"
  ON "BalanceAdjustment"("actorId", "createdAt");

CREATE INDEX IF NOT EXISTS "BalanceAdjustment_targetUserId_createdAt_idx"
  ON "BalanceAdjustment"("targetUserId", "createdAt");

CREATE INDEX IF NOT EXISTS "BalanceAdjustment_actionType_createdAt_idx"
  ON "BalanceAdjustment"("actionType", "createdAt");

ALTER TABLE "BalanceAdjustment"
  ADD CONSTRAINT "BalanceAdjustment_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BalanceAdjustment"
  ADD CONSTRAINT "BalanceAdjustment_targetUserId_fkey"
  FOREIGN KEY ("targetUserId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
