/*
  Warnings:

  - You are about to drop the column `education` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "education",
ADD COLUMN     "education1" TEXT,
ADD COLUMN     "education2" TEXT;
