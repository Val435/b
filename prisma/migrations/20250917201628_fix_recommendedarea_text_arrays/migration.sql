/*
  Warnings:

  - The `familySummary` column on the `RecommendedArea` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `greenSpacesSummary` column on the `RecommendedArea` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `hobbiesSummary` column on the `RecommendedArea` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `petsSummary` column on the `RecommendedArea` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `restaurantsSummary` column on the `RecommendedArea` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `shoppingSummary` column on the `RecommendedArea` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `socialLifeSummary` column on the `RecommendedArea` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `sportsSummary` column on the `RecommendedArea` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `transportationSummary` column on the `RecommendedArea` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
--- TEXT -> TEXT[] para TODOS los *Summary
ALTER TABLE "RecommendedArea"
  ALTER COLUMN "familySummary"         TYPE TEXT[] USING COALESCE(ARRAY["familySummary"], ARRAY[]::text[]),
  ALTER COLUMN "greenSpacesSummary"    TYPE TEXT[] USING COALESCE(ARRAY["greenSpacesSummary"], ARRAY[]::text[]),
  ALTER COLUMN "hobbiesSummary"        TYPE TEXT[] USING COALESCE(ARRAY["hobbiesSummary"], ARRAY[]::text[]),
  ALTER COLUMN "petsSummary"           TYPE TEXT[] USING COALESCE(ARRAY["petsSummary"], ARRAY[]::text[]),
  ALTER COLUMN "restaurantsSummary"    TYPE TEXT[] USING COALESCE(ARRAY["restaurantsSummary"], ARRAY[]::text[]),
  ALTER COLUMN "shoppingSummary"       TYPE TEXT[] USING COALESCE(ARRAY["shoppingSummary"], ARRAY[]::text[]),
  ALTER COLUMN "socialLifeSummary"     TYPE TEXT[] USING COALESCE(ARRAY["socialLifeSummary"], ARRAY[]::text[]),
  ALTER COLUMN "sportsSummary"         TYPE TEXT[] USING COALESCE(ARRAY["sportsSummary"], ARRAY[]::text[]),
  ALTER COLUMN "transportationSummary" TYPE TEXT[] USING COALESCE(ARRAY["transportationSummary"], ARRAY[]::text[]);

-- Defaults a []
ALTER TABLE "RecommendedArea"
  ALTER COLUMN "familySummary"         SET DEFAULT ARRAY[]::text[],
  ALTER COLUMN "greenSpacesSummary"    SET DEFAULT ARRAY[]::text[],
  ALTER COLUMN "hobbiesSummary"        SET DEFAULT ARRAY[]::text[],
  ALTER COLUMN "petsSummary"           SET DEFAULT ARRAY[]::text[],
  ALTER COLUMN "restaurantsSummary"    SET DEFAULT ARRAY[]::text[],
  ALTER COLUMN "shoppingSummary"       SET DEFAULT ARRAY[]::text[],
  ALTER COLUMN "socialLifeSummary"     SET DEFAULT ARRAY[]::text[],
  ALTER COLUMN "sportsSummary"         SET DEFAULT ARRAY[]::text[],
  ALTER COLUMN "transportationSummary" SET DEFAULT ARRAY[]::text[];
