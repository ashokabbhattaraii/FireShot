UPDATE "Tournament"
SET "entryFeeNpr" = 50
WHERE "entryFeeNpr" > 50;

UPDATE "Tournament"
SET "entryFeeNpr" = 20
WHERE "entryFeeNpr" < 20;

UPDATE "Tournament"
SET "registrationFeeNpr" = 10
WHERE "registrationFeeNpr" NOT IN (10, 15) OR "registrationFeeNpr" > "entryFeeNpr";

UPDATE "Challenge"
SET "entryFeeNpr" = 50
WHERE "entryFeeNpr" > 50;

UPDATE "Challenge"
SET "entryFeeNpr" = 20
WHERE "entryFeeNpr" < 20;
