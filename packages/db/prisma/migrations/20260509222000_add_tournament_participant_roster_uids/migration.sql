-- AlterTable
ALTER TABLE "TournamentParticipant"
ADD COLUMN "submittedPlayerUids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
