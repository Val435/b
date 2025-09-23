-- Add direction columns to amenity tables
ALTER TABLE "School" ADD COLUMN     "direction" TEXT NOT NULL DEFAULT '';
ALTER TABLE "SocialLife" ADD COLUMN     "direction" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Shopping" ADD COLUMN     "direction" TEXT NOT NULL DEFAULT '';
ALTER TABLE "GreenSpace" ADD COLUMN     "direction" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Sport" ADD COLUMN     "direction" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Transportation" ADD COLUMN     "direction" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Family" ADD COLUMN     "direction" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Restaurant" ADD COLUMN     "direction" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Pet" ADD COLUMN     "direction" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Hobby" ADD COLUMN     "direction" TEXT NOT NULL DEFAULT '';
