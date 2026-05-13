-- Add isSplash to HeroBanner and create AppConfig table

ALTER TABLE "HeroBanner" ADD COLUMN IF NOT EXISTS "isSplash" boolean DEFAULT false;

CREATE TABLE IF NOT EXISTS "AppConfig" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid(),
  "key" text NOT NULL UNIQUE,
  "value" text NOT NULL,
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "updatedBy" text
);

-- Index on key already enforced by UNIQUE constraint
