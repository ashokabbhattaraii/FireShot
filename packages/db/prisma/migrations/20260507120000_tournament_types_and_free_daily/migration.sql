-- TournamentType enum
CREATE TYPE "TournamentType" AS ENUM ('FREE_DAILY', 'SOLO_1ST', 'SOLO_TOP3', 'SQUAD_TOP10', 'KILL_RACE', 'COMBO');

-- Tournament additions
ALTER TABLE "Tournament"
  ADD COLUMN "type" "TournamentType" NOT NULL DEFAULT 'SOLO_1ST',
  ADD COLUMN "systemFeePercent" DOUBLE PRECISION NOT NULL DEFAULT 25,
  ADD COLUMN "killPrize" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "prizeStructure" JSONB;

-- FreeDailySlot
CREATE TABLE "FreeDailySlot" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tournamentId" TEXT NOT NULL,
  "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FreeDailySlot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FreeDailySlot_userId_usedAt_idx" ON "FreeDailySlot"("userId", "usedAt");

ALTER TABLE "FreeDailySlot"
  ADD CONSTRAINT "FreeDailySlot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
