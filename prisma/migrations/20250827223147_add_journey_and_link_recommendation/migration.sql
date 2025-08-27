/*
  Warnings:

  - A unique constraint covering the columns `[journeyId]` on the table `Recommendation` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "JourneyStatus" AS ENUM ('DRAFT', 'RUNNING', 'COMPLETED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Recommendation" ADD COLUMN     "journeyId" INTEGER;

-- CreateTable
CREATE TABLE "Journey" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "status" "JourneyStatus" NOT NULL DEFAULT 'DRAFT',
    "index" INTEGER NOT NULL,
    "label" TEXT,
    "selectedState" TEXT,
    "selectedCities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "inputs" JSONB,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "Journey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Journey_userId_createdAt_idx" ON "Journey"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Journey_userId_index_key" ON "Journey"("userId", "index");

-- CreateIndex
CREATE UNIQUE INDEX "Recommendation_journeyId_key" ON "Recommendation"("journeyId");

-- CreateIndex
CREATE INDEX "Recommendation_userId_createdAt_idx" ON "Recommendation"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "Journey" ADD CONSTRAINT "Journey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "Journey"("id") ON DELETE SET NULL ON UPDATE CASCADE;
