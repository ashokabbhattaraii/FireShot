-- Tournament additions
ALTER TABLE "Tournament"
  ADD COLUMN "perKillReward" DOUBLE PRECISION,
  ADD COLUMN "booyahPrize" DOUBLE PRECISION,
  ADD COLUMN "actualPlayers" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "roomLocked" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "roomLockedAt" TIMESTAMP(3),
  ADD COLUMN "minLevel" INTEGER NOT NULL DEFAULT 40,
  ADD COLUMN "maxHeadshotRate" DOUBLE PRECISION NOT NULL DEFAULT 70,
  ADD COLUMN "allowEmulator" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "bannedGuns" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "characterSkillOn" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "gunAttributesOn" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "matchRules" JSONB,
  ADD COLUMN "booyahPrizeNote" TEXT;

-- PlayerProfile additions
ALTER TABLE "PlayerProfile"
  ADD COLUMN "headshotRate" DOUBLE PRECISION,
  ADD COLUMN "isEmulator" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "isBlacklisted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "blacklistReason" TEXT;

-- TournamentEligibilityCheck
CREATE TABLE "TournamentEligibilityCheck" (
  "id" TEXT NOT NULL,
  "tournamentId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "passed" BOOLEAN NOT NULL,
  "failReason" TEXT,
  "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TournamentEligibilityCheck_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TournamentEligibilityCheck_tournamentId_userId_key"
  ON "TournamentEligibilityCheck"("tournamentId", "userId");
