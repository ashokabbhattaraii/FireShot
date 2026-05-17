-- Add a stable timestamp for when a tournament actually went live.
ALTER TABLE "Tournament"
ADD COLUMN "liveStartedAt" TIMESTAMP(3);

-- Help the scheduler find live tournaments that have run past the configured window.
CREATE INDEX "Tournament_status_liveStartedAt_idx"
ON "Tournament"("status", "liveStartedAt");