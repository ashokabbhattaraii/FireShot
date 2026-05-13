-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN     "filledTeams" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "maxTeams" INTEGER;
