CREATE TABLE "UserPushToken" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "platform" TEXT NOT NULL DEFAULT 'android',
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserPushToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "UserPushToken_token_key" ON "UserPushToken"("token");
ALTER TABLE "UserPushToken"
  ADD CONSTRAINT "UserPushToken_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AppRelease" (
  "id" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "releaseNotes" TEXT,
  "filename" TEXT NOT NULL,
  "downloadCount" INTEGER NOT NULL DEFAULT 0,
  "isLatest" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AppRelease_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AppRelease_isLatest_idx" ON "AppRelease"("isLatest");
