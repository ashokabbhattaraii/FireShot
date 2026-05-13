ALTER TABLE "User" ADD COLUMN "referralCode" TEXT;
CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");

CREATE TABLE "Referral" (
  "id" TEXT NOT NULL,
  "referrerId" TEXT NOT NULL,
  "referredId" TEXT NOT NULL,
  "codeUsed" TEXT NOT NULL,
  "signupRewardNpr" INTEGER NOT NULL DEFAULT 0,
  "referrerDepositRewardNpr" INTEGER NOT NULL DEFAULT 0,
  "signupRewardedAt" TIMESTAMP(3),
  "depositRewardedAt" TIMESTAMP(3),
  "firstDepositPaymentId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Referral_referredId_key" ON "Referral"("referredId");
CREATE INDEX "Referral_referrerId_createdAt_idx" ON "Referral"("referrerId", "createdAt");
CREATE INDEX "Referral_codeUsed_idx" ON "Referral"("codeUsed");

ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referredId_fkey" FOREIGN KEY ("referredId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
