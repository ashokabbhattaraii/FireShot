CREATE TYPE "TicketCategory" AS ENUM ('PAYMENT_ISSUE', 'TOURNAMENT_ISSUE', 'WITHDRAWAL_ISSUE', 'ACCOUNT_ISSUE', 'RESULT_DISPUTE', 'GENERAL');
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'AWAITING_PLAYER', 'RESOLVED', 'CLOSED');
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

CREATE TABLE "BotJob" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "isEnabled" BOOLEAN NOT NULL DEFAULT false,
  "intervalMins" INTEGER NOT NULL DEFAULT 30,
  "lastRunAt" TIMESTAMP(3),
  "lastRunStatus" TEXT,
  "lastRunLog" TEXT,
  "runCount" INTEGER NOT NULL DEFAULT 0,
  "errorCount" INTEGER NOT NULL DEFAULT 0,
  "nextRunAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BotJob_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BotJob_name_key" ON "BotJob"("name");

CREATE TABLE "BotJobLog" (
  "id" TEXT NOT NULL,
  "jobName" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "details" JSONB,
  "durationMs" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BotJobLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "BotJobLog_jobName_createdAt_idx" ON "BotJobLog"("jobName", "createdAt");

CREATE TABLE "SupportTicket" (
  "id" TEXT NOT NULL,
  "ticketNumber" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "assignedTo" TEXT,
  "category" "TicketCategory" NOT NULL,
  "subject" TEXT NOT NULL,
  "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
  "priority" "TicketPriority" NOT NULL DEFAULT 'MEDIUM',
  "relatedTournamentId" TEXT,
  "relatedPaymentId" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SupportTicket_ticketNumber_key" ON "SupportTicket"("ticketNumber");
CREATE INDEX "SupportTicket_userId_createdAt_idx" ON "SupportTicket"("userId", "createdAt");
CREATE INDEX "SupportTicket_status_idx" ON "SupportTicket"("status");
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "TicketMessage" (
  "id" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "senderId" TEXT NOT NULL,
  "senderRole" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "attachmentUrl" TEXT,
  "isInternal" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TicketMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TicketMessage_ticketId_createdAt_idx" ON "TicketMessage"("ticketId", "createdAt");
ALTER TABLE "TicketMessage" ADD CONSTRAINT "TicketMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "LeaderboardEntry" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "totalEarnings" INTEGER NOT NULL DEFAULT 0,
  "rank" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LeaderboardEntry_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LeaderboardEntry_userId_key" ON "LeaderboardEntry"("userId");
