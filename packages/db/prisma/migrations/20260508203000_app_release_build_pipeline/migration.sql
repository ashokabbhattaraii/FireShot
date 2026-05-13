ALTER TABLE "AppRelease"
  ADD COLUMN "buildStatus" TEXT NOT NULL DEFAULT 'UPLOADED',
  ADD COLUMN "testStatus" TEXT NOT NULL DEFAULT 'NOT_TESTED',
  ADD COLUMN "testReport" JSONB,
  ADD COLUMN "fileSizeBytes" INTEGER,
  ADD COLUMN "sha256" TEXT,
  ADD COLUMN "buildLog" TEXT,
  ADD COLUMN "builtAt" TIMESTAMP(3),
  ADD COLUMN "testedAt" TIMESTAMP(3),
  ADD COLUMN "publishedAt" TIMESTAMP(3),
  ADD COLUMN "generatedById" TEXT;

CREATE INDEX "AppRelease_buildStatus_idx" ON "AppRelease"("buildStatus");
CREATE INDEX "AppRelease_testStatus_idx" ON "AppRelease"("testStatus");
