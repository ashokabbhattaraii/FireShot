/*
  Warnings:

  - Made the column `isSplash` on table `HeroBanner` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterEnum
ALTER TYPE "ChallengGameMode" ADD VALUE 'LW';

-- DropIndex
DROP INDEX "AppTestSession_adminId_idx";

-- AlterTable
ALTER TABLE "AppConfig" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "AppTestSession" ALTER COLUMN "deviceInfo" SET DATA TYPE JSONB,
ALTER COLUMN "bugsFound" SET DATA TYPE JSONB;

-- AlterTable
ALTER TABLE "Challenge" ADD COLUMN     "lwTeamMode" TEXT,
ADD COLUMN     "matchedAt" TIMESTAMP(3),
ADD COLUMN     "roomDeadline" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ChallengeResult" ADD COLUMN     "outcome" TEXT;

-- AlterTable
ALTER TABLE "FinancialRiskProfile" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "HeroBanner" ALTER COLUMN "isSplash" SET NOT NULL;

-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN     "minSlots" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "DisputeNote" (
    "id" TEXT NOT NULL,
    "disputeId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorRole" TEXT NOT NULL DEFAULT 'PLAYER',
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DisputeNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureFlag" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "group" TEXT NOT NULL,
    "description" TEXT,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentTeamMember" (
    "id" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "slotIndex" INTEGER NOT NULL,
    "freefireUid" TEXT NOT NULL,
    "igName" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TournamentTeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientLog" (
    "id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "href" TEXT,
    "native" BOOLEAN NOT NULL DEFAULT false,
    "details" TEXT,
    "ip" TEXT,
    "ua" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DisputeNote_disputeId_createdAt_idx" ON "DisputeNote"("disputeId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureFlag_key_key" ON "FeatureFlag"("key");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentTeamMember_participantId_slotIndex_key" ON "TournamentTeamMember"("participantId", "slotIndex");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentTeamMember_participantId_freefireUid_key" ON "TournamentTeamMember"("participantId", "freefireUid");

-- CreateIndex
CREATE INDEX "ClientLog_event_idx" ON "ClientLog"("event");

-- CreateIndex
CREATE INDEX "ClientLog_createdAt_idx" ON "ClientLog"("createdAt");

-- AddForeignKey
ALTER TABLE "DisputeNote" ADD CONSTRAINT "DisputeNote_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "ChallengeDispute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentTeamMember" ADD CONSTRAINT "TournamentTeamMember_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "TournamentParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
