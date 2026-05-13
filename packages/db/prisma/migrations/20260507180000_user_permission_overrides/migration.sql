CREATE TYPE "PermissionEffect" AS ENUM ('ALLOW', 'DENY');

CREATE TABLE "UserPermission" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "resource" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "effect" "PermissionEffect" NOT NULL DEFAULT 'ALLOW',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserPermission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserPermission_userId_resource_action_key"
  ON "UserPermission"("userId", "resource", "action");

ALTER TABLE "UserPermission"
  ADD CONSTRAINT "UserPermission_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
