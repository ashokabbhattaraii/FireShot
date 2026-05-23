-- Assign tournaments to a specific admin while keeping super admin override.
ALTER TABLE "Tournament" ADD COLUMN "assignedAdminId" TEXT;

ALTER TABLE "Tournament"
  ADD CONSTRAINT "Tournament_assignedAdminId_fkey"
  FOREIGN KEY ("assignedAdminId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Tournament_assignedAdminId_status_idx" ON "Tournament"("assignedAdminId", "status");
