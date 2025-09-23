/*
  Warnings:

  - You are about to drop the column `selectedCities` on the `Journey` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Journey" DROP COLUMN "selectedCities",
ADD COLUMN     "selectedCity" TEXT;

-- AlterTable
ALTER TABLE "UserProfileVersion" ALTER COLUMN "city" DROP NOT NULL,
ALTER COLUMN "city" DROP DEFAULT,
ALTER COLUMN "city" SET DATA TYPE TEXT;
