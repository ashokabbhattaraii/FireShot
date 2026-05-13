-- Extra indexes for hot public/admin API list endpoints.
CREATE INDEX "Tournament_dateTime_idx" ON "Tournament"("dateTime");
CREATE INDEX "Tournament_mode_dateTime_idx" ON "Tournament"("mode", "dateTime");
CREATE INDEX "Tournament_type_dateTime_idx" ON "Tournament"("type", "dateTime");

CREATE INDEX "Challenge_isPrivate_status_createdAt_idx" ON "Challenge"("isPrivate", "status", "createdAt");
CREATE INDEX "Challenge_creatorId_createdAt_idx" ON "Challenge"("creatorId", "createdAt");
CREATE INDEX "Challenge_opponentId_createdAt_idx" ON "Challenge"("opponentId", "createdAt");
CREATE INDEX "Challenge_status_endedAt_idx" ON "Challenge"("status", "endedAt");

CREATE INDEX "ChallengeResult_userId_submittedAt_idx" ON "ChallengeResult"("userId", "submittedAt");
CREATE INDEX "ChallengeDispute_status_createdAt_idx" ON "ChallengeDispute"("status", "createdAt");
