-- AlterTable
ALTER TABLE "RecommendedArea" ADD COLUMN     "familySummary" TEXT,
ADD COLUMN     "greenSpacesSummary" TEXT,
ADD COLUMN     "hobbiesSummary" TEXT,
ADD COLUMN     "petsSummary" TEXT,
ADD COLUMN     "restaurantsSummary" TEXT,
ADD COLUMN     "schoolsSummary" TEXT,
ADD COLUMN     "shoppingSummary" TEXT,
ADD COLUMN     "socialLifeSummary" TEXT,
ADD COLUMN     "sportsSummary" TEXT,
ADD COLUMN     "transportationSummary" TEXT;

-- CreateTable
CREATE TABLE "Transportation" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "fullDescription" TEXT,
    "imageUrl" TEXT,
    "website" TEXT,
    "areaId" INTEGER NOT NULL,

    CONSTRAINT "Transportation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Family" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "fullDescription" TEXT,
    "imageUrl" TEXT,
    "website" TEXT,
    "areaId" INTEGER NOT NULL,

    CONSTRAINT "Family_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Restaurant" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "fullDescription" TEXT,
    "imageUrl" TEXT,
    "website" TEXT,
    "areaId" INTEGER NOT NULL,

    CONSTRAINT "Restaurant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pet" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "fullDescription" TEXT,
    "imageUrl" TEXT,
    "website" TEXT,
    "areaId" INTEGER NOT NULL,

    CONSTRAINT "Pet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hobby" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "fullDescription" TEXT,
    "imageUrl" TEXT,
    "website" TEXT,
    "areaId" INTEGER NOT NULL,

    CONSTRAINT "Hobby_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Transportation" ADD CONSTRAINT "Transportation_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "RecommendedArea"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Family" ADD CONSTRAINT "Family_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "RecommendedArea"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Restaurant" ADD CONSTRAINT "Restaurant_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "RecommendedArea"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pet" ADD CONSTRAINT "Pet_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "RecommendedArea"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hobby" ADD CONSTRAINT "Hobby_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "RecommendedArea"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

