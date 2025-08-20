-- CreateTable
CREATE TABLE "Recommendation" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "Recommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecommendedArea" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "recommendationId" INTEGER NOT NULL,
    "placesOfInterest" TEXT[],
    "lifestyleTags" TEXT[],

    CONSTRAINT "RecommendedArea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RaceEthnicity" (
    "id" SERIAL NOT NULL,
    "white" DOUBLE PRECISION NOT NULL,
    "hispanic" DOUBLE PRECISION NOT NULL,
    "asian" DOUBLE PRECISION NOT NULL,
    "black" DOUBLE PRECISION NOT NULL,
    "other" DOUBLE PRECISION NOT NULL,
    "areaId" INTEGER NOT NULL,

    CONSTRAINT "RaceEthnicity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncomeLevels" (
    "id" SERIAL NOT NULL,
    "perCapitaIncome" DOUBLE PRECISION NOT NULL,
    "medianHouseholdIncome" DOUBLE PRECISION NOT NULL,
    "areaId" INTEGER NOT NULL,

    CONSTRAINT "IncomeLevels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrimeData" (
    "id" SERIAL NOT NULL,
    "violentCrimes" INTEGER NOT NULL,
    "propertyCrimes" INTEGER NOT NULL,
    "totalCrimes" INTEGER NOT NULL,
    "violentRate" DOUBLE PRECISION NOT NULL,
    "propertyRate" DOUBLE PRECISION NOT NULL,
    "totalRate" DOUBLE PRECISION NOT NULL,
    "areaId" INTEGER NOT NULL,

    CONSTRAINT "CrimeData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "School" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "website" TEXT NOT NULL,
    "areaId" INTEGER NOT NULL,

    CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Property" (
    "id" SERIAL NOT NULL,
    "address" TEXT NOT NULL,
    "price" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "builtYear" INTEGER NOT NULL,
    "lotSizeSqFt" INTEGER NOT NULL,
    "parkingSpaces" INTEGER NOT NULL,
    "inUnitLaundry" BOOLEAN NOT NULL,
    "district" TEXT NOT NULL,
    "areaId" INTEGER NOT NULL,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertySuggestion" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "idealFor" TEXT NOT NULL,
    "priceRange" TEXT NOT NULL,
    "recommendationId" INTEGER NOT NULL,

    CONSTRAINT "PropertySuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RaceEthnicity_areaId_key" ON "RaceEthnicity"("areaId");

-- CreateIndex
CREATE UNIQUE INDEX "IncomeLevels_areaId_key" ON "IncomeLevels"("areaId");

-- CreateIndex
CREATE UNIQUE INDEX "CrimeData_areaId_key" ON "CrimeData"("areaId");

-- CreateIndex
CREATE UNIQUE INDEX "PropertySuggestion_recommendationId_key" ON "PropertySuggestion"("recommendationId");

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendedArea" ADD CONSTRAINT "RecommendedArea_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "Recommendation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaceEthnicity" ADD CONSTRAINT "RaceEthnicity_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "RecommendedArea"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomeLevels" ADD CONSTRAINT "IncomeLevels_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "RecommendedArea"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrimeData" ADD CONSTRAINT "CrimeData_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "RecommendedArea"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "School" ADD CONSTRAINT "School_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "RecommendedArea"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "RecommendedArea"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertySuggestion" ADD CONSTRAINT "PropertySuggestion_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "Recommendation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
