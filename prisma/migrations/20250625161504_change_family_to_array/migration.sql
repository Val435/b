/*
  Warnings:

  - The `city` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `employment1` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `employment2` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `family` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `greenSpace` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `hobbies` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `pets` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `restaurants` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `shopping` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `socialLife` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `transportation` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `education1` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `education2` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "city",
ADD COLUMN     "city" TEXT[],
DROP COLUMN "employment1",
ADD COLUMN     "employment1" TEXT[],
DROP COLUMN "employment2",
ADD COLUMN     "employment2" TEXT[],
DROP COLUMN "family",
ADD COLUMN     "family" TEXT[],
DROP COLUMN "greenSpace",
ADD COLUMN     "greenSpace" TEXT[],
DROP COLUMN "hobbies",
ADD COLUMN     "hobbies" TEXT[],
DROP COLUMN "pets",
ADD COLUMN     "pets" TEXT[],
DROP COLUMN "restaurants",
ADD COLUMN     "restaurants" TEXT[],
DROP COLUMN "shopping",
ADD COLUMN     "shopping" TEXT[],
DROP COLUMN "socialLife",
ADD COLUMN     "socialLife" TEXT[],
DROP COLUMN "transportation",
ADD COLUMN     "transportation" TEXT[],
DROP COLUMN "education1",
ADD COLUMN     "education1" TEXT[],
DROP COLUMN "education2",
ADD COLUMN     "education2" TEXT[];
