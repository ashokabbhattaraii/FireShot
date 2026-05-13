-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'FINANCE';

-- CreateTable
CREATE TABLE "FinancialRiskProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "riskScore" INTEGER NOT NULL DEFAULT 0,
    "riskLevel" TEXT NOT NULL DEFAULT 'LOW',
    "flags" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "totalDeposited" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalWithdrawn" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalPrizeEarned" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalEntryFeesPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tournamentCount" INTEGER NOT NULL DEFAULT 0,
    "winCount" INTEGER NOT NULL DEFAULT 0,
    "disputeCount" INTEGER NOT NULL DEFAULT 0,
    "rejectedPaymentCount" INTEGER NOT NULL DEFAULT 0,
    "lastDepositAt" TIMESTAMP(3),
    "lastWithdrawAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "accountAgeDays" INTEGER NOT NULL DEFAULT 0,
    "isBlacklisted" BOOLEAN NOT NULL DEFAULT false,
    "blacklistReason" TEXT,
    "reviewedBy" TEXT,
    "reviewNote" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialRiskProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WithdrawalReview" (
    "id" TEXT NOT NULL,
    "withdrawalId" TEXT NOT NULL,
    "reviewedBy" TEXT NOT NULL,
    "riskSnapshot" JSONB NOT NULL,
    "reviewNote" TEXT,
    "decision" TEXT NOT NULL,
    "decisionAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,

    CONSTRAINT "WithdrawalReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepositReview" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "reviewedBy" TEXT NOT NULL,
    "riskSnapshot" JSONB NOT NULL,
    "reviewNote" TEXT,
    "decision" TEXT NOT NULL,
    "decisionAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,

    CONSTRAINT "DepositReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialReport" (
    "id" TEXT NOT NULL,
    "generatedBy" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "fromDate" TIMESTAMP(3) NOT NULL,
    "toDate" TIMESTAMP(3) NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FinancialRiskProfile_userId_key" ON "FinancialRiskProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WithdrawalReview_withdrawalId_key" ON "WithdrawalReview"("withdrawalId");

-- CreateIndex
CREATE UNIQUE INDEX "DepositReview_paymentId_key" ON "DepositReview"("paymentId");

-- AddForeignKey
ALTER TABLE "FinancialRiskProfile" ADD CONSTRAINT "FinancialRiskProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WithdrawalReview" ADD CONSTRAINT "WithdrawalReview_withdrawalId_fkey" FOREIGN KEY ("withdrawalId") REFERENCES "WithdrawalRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepositReview" ADD CONSTRAINT "DepositReview_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
