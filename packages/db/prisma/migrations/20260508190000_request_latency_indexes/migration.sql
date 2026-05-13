-- Hot-path indexes for player wallets, admin queues, and tournament lists.
CREATE INDEX "User_role_idx" ON "User"("role");
CREATE INDEX "User_roleId_idx" ON "User"("roleId");
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

CREATE INDEX "UserPushToken_userId_idx" ON "UserPushToken"("userId");

CREATE INDEX "Tournament_status_dateTime_idx" ON "Tournament"("status", "dateTime");
CREATE INDEX "Tournament_mode_status_idx" ON "Tournament"("mode", "status");
CREATE INDEX "Tournament_type_status_idx" ON "Tournament"("type", "status");
CREATE INDEX "Tournament_createdById_createdAt_idx" ON "Tournament"("createdById", "createdAt");

CREATE INDEX "TournamentParticipant_userId_joinedAt_idx" ON "TournamentParticipant"("userId", "joinedAt");
CREATE INDEX "TournamentParticipant_tournamentId_paid_idx" ON "TournamentParticipant"("tournamentId", "paid");

CREATE INDEX "Payment_userId_createdAt_idx" ON "Payment"("userId", "createdAt");
CREATE INDEX "Payment_status_createdAt_idx" ON "Payment"("status", "createdAt");
CREATE INDEX "Payment_tournamentId_status_idx" ON "Payment"("tournamentId", "status");

CREATE INDEX "WalletTransaction_walletId_createdAt_idx" ON "WalletTransaction"("walletId", "createdAt");

CREATE INDEX "WithdrawalRequest_userId_createdAt_idx" ON "WithdrawalRequest"("userId", "createdAt");
CREATE INDEX "WithdrawalRequest_status_createdAt_idx" ON "WithdrawalRequest"("status", "createdAt");

CREATE INDEX "MatchResult_verified_createdAt_idx" ON "MatchResult"("verified", "createdAt");
CREATE INDEX "MatchResult_tournamentId_verified_idx" ON "MatchResult"("tournamentId", "verified");
CREATE INDEX "MatchResult_submittedById_createdAt_idx" ON "MatchResult"("submittedById", "createdAt");

CREATE INDEX "Notification_userId_read_createdAt_idx" ON "Notification"("userId", "read", "createdAt");

CREATE INDEX "AdminActionLog_adminId_createdAt_idx" ON "AdminActionLog"("adminId", "createdAt");
CREATE INDEX "AdminActionLog_resource_createdAt_idx" ON "AdminActionLog"("resource", "createdAt");
