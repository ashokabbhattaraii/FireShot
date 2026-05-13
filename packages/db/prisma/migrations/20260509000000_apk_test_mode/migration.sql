CREATE TABLE IF NOT EXISTS "AppTestSession" (
  "id" TEXT NOT NULL,
  "adminId" TEXT NOT NULL,
  "buildVersion" TEXT NOT NULL,
  "deviceInfo" JSON,
  "testNotes" TEXT,
  "bugsFound" JSON NOT NULL DEFAULT '[]',
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  CONSTRAINT "AppTestSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AppTestSession_adminId_idx" ON "AppTestSession"("adminId");
