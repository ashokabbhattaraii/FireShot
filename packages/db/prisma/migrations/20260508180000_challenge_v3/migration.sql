-- Drop old challenge tables (dev data — destructive replacement)
DROP TABLE IF EXISTS "ChallengeParticipant" CASCADE;
DROP TABLE IF EXISTS "Challenge" CASCADE;

-- Extend ChallengeStatus enum (recreate to include new values + drop old LIVE)
ALTER TYPE "ChallengeStatus" RENAME TO "ChallengeStatus_old";
CREATE TYPE "ChallengeStatus" AS ENUM (
  'OPEN', 'MATCHED', 'ROOM_SHARED', 'ONGOING',
  'PENDING_RESULTS', 'COMPLETED', 'CANCELLED', 'DISPUTED'
);
DROP TYPE "ChallengeStatus_old";

-- New enums
CREATE TYPE "ChallengGameMode" AS ENUM ('BR', 'CS');
CREATE TYPE "DisputeReason" AS ENUM ('SUSPECTED_HACKER', 'TEAMING', 'GLITCH_ABUSE', 'WRONG_RESULT', 'DISCONNECTION', 'OTHER');
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED_CREATOR', 'RESOLVED_OPPONENT', 'REFUNDED');

-- Challenge
CREATE TABLE "Challenge" (
  "id" TEXT NOT NULL,
  "challengeNumber" TEXT NOT NULL,
  "creatorId" TEXT NOT NULL,
  "opponentId" TEXT,
  "title" TEXT NOT NULL,
  "gameMode" "ChallengGameMode" NOT NULL,
  "entryFee" DOUBLE PRECISION NOT NULL,
  "prizeToWinner" DOUBLE PRECISION NOT NULL,
  "platformFee" DOUBLE PRECISION NOT NULL,
  "status" "ChallengeStatus" NOT NULL DEFAULT 'OPEN',
  "isPrivate" BOOLEAN NOT NULL DEFAULT false,
  "inviteCode" TEXT,
  "brMap" TEXT,
  "brTeamMode" TEXT,
  "brWinCondition" TEXT,
  "brTargetKills" INTEGER,
  "brBannedGuns" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "brHeadshotOnly" BOOLEAN NOT NULL DEFAULT false,
  "csTeamMode" TEXT,
  "csRounds" INTEGER NOT NULL DEFAULT 7,
  "csCoins" TEXT NOT NULL DEFAULT 'DEFAULT',
  "csThrowable" BOOLEAN NOT NULL DEFAULT true,
  "csLoadout" BOOLEAN NOT NULL DEFAULT false,
  "csCompulsoryWeapon" TEXT,
  "csCompulsoryArmour" TEXT,
  "characterSkill" BOOLEAN NOT NULL DEFAULT true,
  "gunAttribute" BOOLEAN NOT NULL DEFAULT false,
  "headshotOnly" BOOLEAN NOT NULL DEFAULT false,
  "noEmulator" BOOLEAN NOT NULL DEFAULT true,
  "minLevel" INTEGER NOT NULL DEFAULT 0,
  "maxHeadshotRate" DOUBLE PRECISION NOT NULL DEFAULT 100,
  "povRequired" BOOLEAN NOT NULL DEFAULT true,
  "screenshotRequired" BOOLEAN NOT NULL DEFAULT true,
  "reportWindowMins" INTEGER NOT NULL DEFAULT 60,
  "roomId" TEXT,
  "roomPassword" TEXT,
  "scheduledAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "endedAt" TIMESTAMP(3),
  "winnerId" TEXT,
  "disputeId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Challenge_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Challenge_challengeNumber_key" ON "Challenge"("challengeNumber");
CREATE UNIQUE INDEX "Challenge_inviteCode_key" ON "Challenge"("inviteCode");
ALTER TABLE "Challenge" ADD CONSTRAINT "Challenge_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Challenge" ADD CONSTRAINT "Challenge_opponentId_fkey" FOREIGN KEY ("opponentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ChallengeResult
CREATE TABLE "ChallengeResult" (
  "id" TEXT NOT NULL,
  "challengeId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "kills" INTEGER NOT NULL DEFAULT 0,
  "headshots" INTEGER NOT NULL DEFAULT 0,
  "damage" INTEGER NOT NULL DEFAULT 0,
  "survivalTimeSecs" INTEGER NOT NULL DEFAULT 0,
  "gotBooyah" BOOLEAN NOT NULL DEFAULT false,
  "screenshotUrl" TEXT,
  "povUrl" TEXT,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "verifiedBy" TEXT,
  "verifiedAt" TIMESTAMP(3),
  "isDisputed" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "ChallengeResult_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ChallengeResult_challengeId_userId_key" ON "ChallengeResult"("challengeId", "userId");
ALTER TABLE "ChallengeResult" ADD CONSTRAINT "ChallengeResult_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChallengeResult" ADD CONSTRAINT "ChallengeResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ChallengeDispute
CREATE TABLE "ChallengeDispute" (
  "id" TEXT NOT NULL,
  "challengeId" TEXT NOT NULL,
  "raisedBy" TEXT NOT NULL,
  "reason" "DisputeReason" NOT NULL,
  "description" TEXT NOT NULL,
  "evidenceUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
  "resolvedBy" TEXT,
  "resolution" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "ChallengeDispute_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ChallengeDispute_challengeId_key" ON "ChallengeDispute"("challengeId");

-- ChallengeInvite
CREATE TABLE "ChallengeInvite" (
  "id" TEXT NOT NULL,
  "challengeId" TEXT NOT NULL,
  "invitedEmail" TEXT,
  "invitedUserId" TEXT,
  "inviteCode" TEXT NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChallengeInvite_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ChallengeInvite_inviteCode_key" ON "ChallengeInvite"("inviteCode");

-- Drop now-unused columns referencing old Challenge
ALTER TABLE "Payment" DROP COLUMN IF EXISTS "challengeId";
