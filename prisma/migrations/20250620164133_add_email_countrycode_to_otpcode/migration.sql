/*
  Warnings:

  - Added the required column `countryCode` to the `OtpCode` table without a default value. This is not possible if the table is not empty.
  - Added the required column `email` to the `OtpCode` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "OtpCode" ADD COLUMN     "countryCode" TEXT NOT NULL,
ADD COLUMN     "email" TEXT NOT NULL;
