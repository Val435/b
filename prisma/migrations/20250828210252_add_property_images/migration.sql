/*
  Warnings:

  - A unique constraint covering the columns `[journeyId]` on the table `Recommendation` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "JourneyStatus" AS ENUM ('DRAFT', 'RUNNING', 'COMPLETED', 'CANCELLED');

-- AlterTable
ALTER TABLE "GreenSpace" ALTER COLUMN "website" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Property" ALTER COLUMN "imageUrls" SET DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Recommendation" ADD COLUMN     "journeyId" INTEGER;

-- AlterTable
ALTER TABLE "RecommendedArea" ALTER COLUMN "placesOfInterest" SET DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "lifestyleTags" SET DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "School" ALTER COLUMN "website" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Shopping" ALTER COLUMN "website" DROP NOT NULL;

-- AlterTable
ALTER TABLE "SocialLife" ALTER COLUMN "website" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Sport" ALTER COLUMN "website" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "city" SET DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "employment1" SET DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "employment2" SET DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "family" SET DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "greenSpace" SET DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "hobbies" SET DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "pets" SET DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "restaurants" SET DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "shopping" SET DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "socialLife" SET DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "transportation" SET DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "education1" SET DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "education2" SET DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "Journey" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "status" "JourneyStatus" NOT NULL DEFAULT 'DRAFT',
    "label" TEXT,
    "selectedState" TEXT,
    "selectedCities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "inputs" JSONB,
    "index" INTEGER NOT NULL DEFAULT 0,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "Journey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Journey_userId_createdAt_idx" ON "Journey"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Recommendation_journeyId_key" ON "Recommendation"("journeyId");

-- CreateIndex
CREATE INDEX "Recommendation_userId_createdAt_idx" ON "Recommendation"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "Journey" ADD CONSTRAINT "Journey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "Journey"("id") ON DELETE SET NULL ON UPDATE CASCADE;
