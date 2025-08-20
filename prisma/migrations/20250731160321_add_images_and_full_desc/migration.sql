-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "fullDescription" TEXT,
ADD COLUMN     "imageUrl" TEXT;

-- AlterTable
ALTER TABLE "PropertySuggestion" ADD COLUMN     "fullDescription" TEXT,
ADD COLUMN     "imageUrl" TEXT;

-- AlterTable
ALTER TABLE "RecommendedArea" ADD COLUMN     "fullDescription" TEXT,
ADD COLUMN     "imageUrl" TEXT;

-- AlterTable
ALTER TABLE "School" ADD COLUMN     "fullDescription" TEXT,
ADD COLUMN     "imageUrl" TEXT;
