-- AlterTable
ALTER TABLE "Family" ADD COLUMN     "imageGallery" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "GreenSpace" ADD COLUMN     "imageGallery" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Hobby" ADD COLUMN     "imageGallery" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Pet" ADD COLUMN     "imageGallery" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN     "imageGallery" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "School" ADD COLUMN     "imageGallery" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Shopping" ADD COLUMN     "imageGallery" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "SocialLife" ADD COLUMN     "imageGallery" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Sport" ADD COLUMN     "imageGallery" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Transportation" ADD COLUMN     "imageGallery" TEXT[] DEFAULT ARRAY[]::TEXT[];
