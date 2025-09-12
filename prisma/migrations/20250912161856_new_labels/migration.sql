/*
  Warnings:

  - You are about to drop the column `selectedCities` on the `Journey` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Journey" DROP COLUMN "selectedCities",
ADD COLUMN     "selectedCity" TEXT;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "city" DROP NOT NULL,
ALTER COLUMN "city" DROP DEFAULT,
ALTER COLUMN "city" SET DATA TYPE TEXT;

-- CreateTable
CREATE TABLE "UserProfileVersion" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER NOT NULL,
    "journeyId" INTEGER NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "countryCode" TEXT,
    "state" TEXT,
    "city" TEXT,
    "environment" TEXT,
    "education1" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "education2" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "family" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "employment1" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "employment2" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "socialLife" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "hobbies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "transportation" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pets" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "greenSpace" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "shopping" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "restaurants" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "occupancy" TEXT,
    "property" TEXT,
    "timeframe" TEXT,
    "priceRange" TEXT,
    "downPayment" TEXT,
    "employmentStatus" TEXT,
    "grossAnnual" INTEGER,
    "credit" TEXT,

    CONSTRAINT "UserProfileVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserProfileVersion_journeyId_key" ON "UserProfileVersion"("journeyId");

-- CreateIndex
CREATE INDEX "UserProfileVersion_userId_createdAt_idx" ON "UserProfileVersion"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "UserProfileVersion" ADD CONSTRAINT "UserProfileVersion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProfileVersion" ADD CONSTRAINT "UserProfileVersion_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "Journey"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
