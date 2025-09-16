-- AlterTable
ALTER TABLE "RecommendedArea"
  ALTER COLUMN "schoolsSummary" SET DATA TYPE TEXT[] USING ARRAY["schoolsSummary"],
  ALTER COLUMN "schoolsSummary" SET DEFAULT ARRAY[]::TEXT[];
