/*
  Warnings:

  - You are about to drop the column `imageUrl` on the `PropertySuggestion` table. All the data in the column will be lost.
  - You are about to drop the column `imageUrl` on the `RecommendedArea` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "PropertySuggestion" DROP COLUMN "imageUrl";

-- AlterTable
ALTER TABLE "RecommendedArea" DROP COLUMN "imageUrl";

-- CreateTable
CREATE TABLE "SocialLife" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "fullDescription" TEXT,
    "website" TEXT NOT NULL,
    "areaId" INTEGER NOT NULL,

    CONSTRAINT "SocialLife_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shopping" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "fullDescription" TEXT,
    "website" TEXT NOT NULL,
    "areaId" INTEGER NOT NULL,

    CONSTRAINT "Shopping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GreenSpace" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "fullDescription" TEXT,
    "website" TEXT NOT NULL,
    "areaId" INTEGER NOT NULL,

    CONSTRAINT "GreenSpace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sport" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "fullDescription" TEXT,
    "website" TEXT NOT NULL,
    "areaId" INTEGER NOT NULL,

    CONSTRAINT "Sport_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "SocialLife" ADD CONSTRAINT "SocialLife_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "RecommendedArea"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shopping" ADD CONSTRAINT "Shopping_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "RecommendedArea"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GreenSpace" ADD CONSTRAINT "GreenSpace_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "RecommendedArea"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sport" ADD CONSTRAINT "Sport_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "RecommendedArea"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
