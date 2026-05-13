-- Enums
CREATE TYPE "ConfigType" AS ENUM ('STRING', 'NUMBER', 'BOOLEAN', 'JSON');
CREATE TYPE "ConfigCategory" AS ENUM ('PRICING', 'SCHEDULE', 'TOURNAMENT', 'FEATURE_FLAG');

-- AdminActionLog: extend
ALTER TABLE "AdminActionLog"
  DROP COLUMN IF EXISTS "target",
  DROP COLUMN IF EXISTS "metadata",
  ADD COLUMN "resource" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "resourceId" TEXT,
  ADD COLUMN "oldValue" JSONB,
  ADD COLUMN "newValue" JSONB,
  ADD COLUMN "ip" TEXT;

-- SystemConfig
CREATE TABLE "SystemConfig" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "type" "ConfigType" NOT NULL,
  "category" "ConfigCategory" NOT NULL,
  "label" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "updatedBy" TEXT,
  CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SystemConfig_key_key" ON "SystemConfig"("key");

-- FreeDailyWindow
CREATE TABLE "FreeDailyWindow" (
  "id" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "windowStart" TEXT NOT NULL,
  "windowEnd" TEXT NOT NULL,
  "prizePool" DOUBLE PRECISION NOT NULL DEFAULT 100,
  "maxWinners" INTEGER NOT NULL DEFAULT 1,
  "daysOfWeek" INTEGER[],
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdBy" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FreeDailyWindow_pkey" PRIMARY KEY ("id")
);

-- UserRole
CREATE TABLE "UserRole" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "UserRole_name_key" ON "UserRole"("name");

-- Permission
CREATE TABLE "Permission" (
  "id" TEXT NOT NULL,
  "resource" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "roleId" TEXT NOT NULL,
  CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Permission_roleId_resource_action_key" ON "Permission"("roleId", "resource", "action");
ALTER TABLE "Permission" ADD CONSTRAINT "Permission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "UserRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- User.roleId
ALTER TABLE "User" ADD COLUMN "roleId" TEXT;
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "UserRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;
