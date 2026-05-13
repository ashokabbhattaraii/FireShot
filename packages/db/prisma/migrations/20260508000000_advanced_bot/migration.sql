-- Enums
CREATE TYPE "FlagSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "FlagStatus" AS ENUM ('PENDING', 'REVIEWED_CORRECT', 'REVIEWED_WRONG', 'IGNORED', 'AUTO_RESOLVED');

-- Add to existing enums
ALTER TYPE "PaymentStatus" ADD VALUE 'EXPIRED';
ALTER TYPE "TournamentStatus" ADD VALUE 'PENDING_RESULTS';

-- BotJob extensions
ALTER TABLE "BotJob"
  ADD COLUMN "dryRunEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "maxActionsPerRun" INTEGER NOT NULL DEFAULT 50,
  ADD COLUMN "accuracyScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "falsePositives" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "truePositives" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastDryRunAt" TIMESTAMP(3),
  ADD COLUMN "lastDryRunLog" TEXT,
  ADD COLUMN "config" JSONB NOT NULL DEFAULT '{}';

-- User additions
ALTER TABLE "User" ADD COLUMN "lastLoginAt" TIMESTAMP(3);

-- Payment additions
ALTER TABLE "Payment" ADD COLUMN "ipAddress" TEXT;

-- BotFlag
CREATE TABLE "BotFlag" (
  "id" TEXT NOT NULL,
  "jobName" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "severity" "FlagSeverity" NOT NULL,
  "evidence" JSONB NOT NULL,
  "status" "FlagStatus" NOT NULL DEFAULT 'PENDING',
  "reviewedBy" TEXT,
  "reviewNote" TEXT,
  "actionTaken" TEXT,
  "wasCorrect" BOOLEAN,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "BotFlag_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "BotFlag_jobName_status_idx" ON "BotFlag"("jobName", "status");
CREATE INDEX "BotFlag_targetType_targetId_idx" ON "BotFlag"("targetType", "targetId");

-- BotRollback
CREATE TABLE "BotRollback" (
  "id" TEXT NOT NULL,
  "jobName" TEXT NOT NULL,
  "jobLogId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "beforeState" JSONB NOT NULL,
  "afterState" JSONB NOT NULL,
  "rolledBack" BOOLEAN NOT NULL DEFAULT false,
  "rolledBackBy" TEXT,
  "rolledBackAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BotRollback_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "BotRollback_jobName_rolledBack_idx" ON "BotRollback"("jobName", "rolledBack");
