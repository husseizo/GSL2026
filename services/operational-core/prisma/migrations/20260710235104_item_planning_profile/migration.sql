-- CreateTable
CREATE TABLE "ItemPlanningProfile" (
    "id" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "itemType" "ItemType" NOT NULL,
    "partId" TEXT,
    "lubricantProductId" TEXT,
    "safetyStock" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "minimumOrderQuantity" DECIMAL(14,3),
    "packageQuantity" DECIMAL(14,3),
    "targetCoverageDays" INTEGER NOT NULL DEFAULT 30,
    "maxCoverageDays" INTEGER NOT NULL DEFAULT 90,
    "defaultSupplierId" TEXT,
    "criticality" "CriticalityLevel" NOT NULL DEFAULT 'NORMAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemPlanningProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ItemPlanningProfile_itemKey_key" ON "ItemPlanningProfile"("itemKey");

-- AddForeignKey
ALTER TABLE "ItemPlanningProfile" ADD CONSTRAINT "ItemPlanningProfile_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemPlanningProfile" ADD CONSTRAINT "ItemPlanningProfile_lubricantProductId_fkey" FOREIGN KEY ("lubricantProductId") REFERENCES "LubricantProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemPlanningProfile" ADD CONSTRAINT "ItemPlanningProfile_defaultSupplierId_fkey" FOREIGN KEY ("defaultSupplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
