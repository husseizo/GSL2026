-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('PENDING', 'SYNCED', 'CONFLICT', 'ERROR');

-- CreateEnum
CREATE TYPE "DecodeConfidence" AS ENUM ('EXACT', 'HIGH', 'MEDIUM', 'LOW', 'UNVERIFIED');

-- CreateEnum
CREATE TYPE "PartNumberType" AS ENUM ('ALTERNATE_OEM', 'MANUFACTURER', 'SUPPLIER', 'SUPERSEDED', 'CROSS_REFERENCE');

-- CreateEnum
CREATE TYPE "MatchStage" AS ENUM ('RULE_BASED', 'SIMILARITY');

-- CreateEnum
CREATE TYPE "MatchCandidateStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DeadLetterStage" AS ENUM ('VALIDATE', 'NORMALIZE', 'UPSERT');

-- CreateEnum
CREATE TYPE "SyncRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SYSTEM_ADMINISTRATOR', 'OWNER', 'GENERAL_MANAGER', 'BRANCH_MANAGER', 'PARTS_MANAGER', 'LUBRICANTS_MANAGER', 'STOREKEEPER', 'PURCHASING_OFFICER', 'PURCHASING_MANAGER', 'SALESPERSON', 'DATA_QUALITY_REVIEWER', 'AUDITOR', 'READ_ONLY_VIEWER');

-- CreateEnum
CREATE TYPE "ItemType" AS ENUM ('PART', 'LUBRICANT', 'LABOUR', 'SERVICE', 'MISCELLANEOUS', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "RecommendationConfidence" AS ENUM ('HIGH', 'MEDIUM', 'LOW', 'INSUFFICIENT_DATA');

-- CreateEnum
CREATE TYPE "WarehouseType" AS ENUM ('MAIN', 'RETAIL', 'GARAGE', 'LUBRICANTS', 'TRANSIT', 'QUARANTINE', 'DAMAGED', 'RETURNS');

-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('INDIVIDUAL', 'CORPORATE', 'DEALER', 'GARAGE', 'FLEET', 'GOVERNMENT', 'INTERNAL');

-- CreateEnum
CREATE TYPE "LubricantCategory" AS ENUM ('ENGINE_OIL', 'ATF', 'DSG_FLUID', 'GEAR_OIL', 'DIFFERENTIAL_OIL', 'TRANSFER_CASE_FLUID', 'COOLANT', 'BRAKE_FLUID', 'HYDRAULIC_FLUID', 'POWER_STEERING_FLUID', 'ADBLUE', 'ADDITIVE', 'CLEANER', 'WORKSHOP_CHEMICAL');

-- CreateEnum
CREATE TYPE "SalesDocumentType" AS ENUM ('QUOTATION', 'SALES_ORDER', 'DELIVERY', 'INVOICE', 'CREDIT_NOTE', 'RETURN', 'COUNTER_SALE');

-- CreateEnum
CREATE TYPE "SalesDocumentStatus" AS ENUM ('DRAFT', 'OPEN', 'PARTIALLY_FULFILLED', 'FULFILLED', 'CLOSED', 'CANCELLED', 'RETURNED');

-- CreateEnum
CREATE TYPE "PurchaseDocumentType" AS ENUM ('PURCHASE_REQUEST', 'REQUEST_FOR_QUOTATION', 'PURCHASE_ORDER', 'GOODS_RECEIPT', 'SUPPLIER_INVOICE', 'PURCHASE_RETURN');

-- CreateEnum
CREATE TYPE "PurchaseDocumentStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InventoryMovementType" AS ENUM ('OPENING_BALANCE', 'PURCHASE_RECEIPT', 'SALE_ISSUE', 'GARAGE_ISSUE', 'CUSTOMER_RETURN', 'SUPPLIER_RETURN', 'TRANSFER_OUT', 'TRANSFER_IN', 'RESERVATION', 'RESERVATION_RELEASE', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'DAMAGE', 'QUARANTINE', 'WARRANTY_ISSUE', 'WARRANTY_RETURN', 'STOCK_COUNT_CORRECTION');

-- CreateEnum
CREATE TYPE "MovementDirection" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('ACTIVE', 'RELEASED', 'CONSUMED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "StockTransferStatus" AS ENUM ('DRAFT', 'APPROVED', 'IN_TRANSIT', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AdjustmentDirection" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "AppEventType" AS ENUM ('USER_LOGIN', 'USER_LOGOUT', 'SEARCH', 'PRODUCT_VIEW', 'PRICE_CHECK', 'STOCK_CHECK', 'VIN_LOOKUP', 'CUSTOMER_LOOKUP', 'QUOTE_CREATED', 'QUOTE_ABANDONED', 'ORDER_CREATED', 'ORDER_FAILED', 'PAYMENT_FAILED', 'API_ERROR', 'SYNC_ERROR', 'OUT_OF_STOCK_VIEW', 'ZERO_RESULT_SEARCH', 'ALTERNATIVE_SELECTED', 'PERMISSION_DENIED');

-- CreateEnum
CREATE TYPE "LostSaleReason" AS ENUM ('ZERO_RESULT_SEARCH', 'OUT_OF_STOCK_VIEW', 'INSUFFICIENT_STOCK_CHECK', 'QUOTE_ABANDONED', 'ORDER_FAILED_STOCK', 'MANUAL_REPORT', 'REPEATED_SEARCH_NO_SALE');

-- CreateEnum
CREATE TYPE "LostSaleStatus" AS ENUM ('OPEN', 'CONFIRMED', 'DISMISSED', 'CONVERTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AbcClass" AS ENUM ('A', 'B', 'C');

-- CreateEnum
CREATE TYPE "XyzClass" AS ENUM ('X', 'Y', 'Z');

-- CreateEnum
CREATE TYPE "MovementClass" AS ENUM ('FAST_MOVING', 'MEDIUM_MOVING', 'SLOW_MOVING', 'NON_MOVING', 'DEAD_STOCK', 'NEW_ITEM', 'INSUFFICIENT_HISTORY');

-- CreateEnum
CREATE TYPE "CriticalityLevel" AS ENUM ('CRITICAL', 'IMPORTANT', 'NORMAL', 'LOW');

-- CreateEnum
CREATE TYPE "PurchaseRecommendationAction" AS ENUM ('BUY_NOW', 'BUY_SOON', 'MONITOR', 'TRANSFER', 'DO_NOT_BUY', 'PURCHASE_ON_CONFIRMED_ORDER', 'CLEAR_EXISTING_STOCK', 'REVIEW_DATA');

-- CreateEnum
CREATE TYPE "RecommendationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'IMPLEMENTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "DataQualitySeverity" AS ENUM ('FATAL', 'RECOVERABLE', 'WARNING', 'MANUAL_REVIEW');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "branchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationSource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "adapterType" TEXT NOT NULL,
    "lastCommittedCursor" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncRun" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "status" "SyncRunStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "cursorBefore" TEXT,
    "cursorAfter" TEXT,
    "recordsFetched" INTEGER NOT NULL DEFAULT 0,
    "recordsUpserted" INTEGER NOT NULL DEFAULT 0,
    "recordsSkipped" INTEGER NOT NULL DEFAULT 0,
    "recordsFailed" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,

    CONSTRAINT "SyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncDeadLetter" (
    "id" TEXT NOT NULL,
    "sourceSystem" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "stage" "DeadLetterStage" NOT NULL,
    "rawPayload" JSONB NOT NULL,
    "error" TEXT NOT NULL,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "resolution" TEXT,

    CONSTRAINT "SyncDeadLetter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "sourceSystem" TEXT,
    "sourceRecordId" TEXT,
    "externalId" TEXT,
    "syncedAt" TIMESTAMP(3),
    "recordVersion" TEXT,
    "checksum" TEXT,
    "syncStatus" "SyncStatus" NOT NULL DEFAULT 'SYNCED',
    "syncError" TEXT,
    "vin" TEXT,
    "registrationNumber" TEXT,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "variant" TEXT,
    "modelYear" INTEGER,
    "productionDate" TIMESTAMP(3),
    "engineCode" TEXT,
    "engineFamily" TEXT,
    "displacementCc" INTEGER,
    "fuelType" TEXT,
    "powertrainType" TEXT,
    "transmissionCode" TEXT,
    "driveType" TEXT,
    "bodyType" TEXT,
    "marketSpec" TEXT,
    "decodeConfidence" JSONB,
    "decodeSource" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleAttributeHistory" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "reason" TEXT,
    "confidence" "DecodeConfidence" NOT NULL DEFAULT 'UNVERIFIED',
    "changedById" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleAttributeHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Part" (
    "id" TEXT NOT NULL,
    "sourceSystem" TEXT,
    "sourceRecordId" TEXT,
    "externalId" TEXT,
    "syncedAt" TIMESTAMP(3),
    "recordVersion" TEXT,
    "checksum" TEXT,
    "syncStatus" "SyncStatus" NOT NULL DEFAULT 'SYNCED',
    "syncError" TEXT,
    "internalItemCode" TEXT,
    "oemNumber" TEXT NOT NULL,
    "brand" TEXT,
    "productName" TEXT NOT NULL,
    "standardizedProductName" TEXT NOT NULL,
    "category" TEXT,
    "subcategory" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Part_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartAlternateNumber" (
    "id" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "type" "PartNumberType" NOT NULL,

    CONSTRAINT "PartAlternateNumber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartCompatibility" (
    "id" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT,
    "modelYearFrom" INTEGER,
    "modelYearTo" INTEGER,
    "engineCode" TEXT,
    "transmissionCode" TEXT,

    CONSTRAINT "PartCompatibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartMatchCandidate" (
    "id" TEXT NOT NULL,
    "partAId" TEXT NOT NULL,
    "partBId" TEXT NOT NULL,
    "stage" "MatchStage" NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "rationale" TEXT NOT NULL,
    "status" "MatchCandidateStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartMatchCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Dar_es_Salaam',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Warehouse" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "warehouseType" "WarehouseType" NOT NULL DEFAULT 'MAIN',
    "isSellable" BOOLEAN NOT NULL DEFAULT true,
    "isServiceWarehouse" BOOLEAN NOT NULL DEFAULT false,
    "isTransitWarehouse" BOOLEAN NOT NULL DEFAULT false,
    "isQuarantineWarehouse" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "customerCode" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "customerType" "CustomerType" NOT NULL DEFAULT 'INDIVIDUAL',
    "phone" TEXT,
    "secondaryPhone" TEXT,
    "email" TEXT,
    "taxNumber" TEXT,
    "creditLimit" DECIMAL(14,2),
    "pricingGroup" TEXT,
    "preferredBranchId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sourceSystem" TEXT,
    "sourceRecordId" TEXT,
    "externalId" TEXT,
    "syncedAt" TIMESTAMP(3),
    "recordVersion" TEXT,
    "checksum" TEXT,
    "syncStatus" "SyncStatus" NOT NULL DEFAULT 'SYNCED',
    "syncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerContact" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "name" TEXT,
    "role" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerAddress" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "label" TEXT,
    "line1" TEXT,
    "line2" TEXT,
    "city" TEXT,
    "region" TEXT,
    "country" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerVehicleLink" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "relationship" TEXT NOT NULL DEFAULT 'OWNER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerVehicleLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerExternalReference" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "sourceSystem" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerExternalReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LubricantProduct" (
    "id" TEXT NOT NULL,
    "internalCode" TEXT,
    "brand" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "category" "LubricantCategory" NOT NULL,
    "viscosity" TEXT,
    "packageSize" DECIMAL(10,3),
    "packageUnit" TEXT,
    "apiClassification" TEXT,
    "aceaClassification" TEXT,
    "currentCost" DECIMAL(14,4),
    "defaultSellingPrice" DECIMAL(14,4),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sourceSystem" TEXT,
    "sourceRecordId" TEXT,
    "externalId" TEXT,
    "syncedAt" TIMESTAMP(3),
    "recordVersion" TEXT,
    "checksum" TEXT,
    "syncStatus" "SyncStatus" NOT NULL DEFAULT 'SYNCED',
    "syncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LubricantProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LubricantApproval" (
    "id" TEXT NOT NULL,
    "lubricantProductId" TEXT NOT NULL,
    "oemBrand" TEXT NOT NULL,
    "approvalCode" TEXT NOT NULL,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LubricantApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LubricantCompatibility" (
    "id" TEXT NOT NULL,
    "lubricantProductId" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT,
    "modelYearFrom" INTEGER,
    "modelYearTo" INTEGER,
    "engineCode" TEXT,
    "transmissionCode" TEXT,
    "serviceIntervalKm" INTEGER,
    "estimatedFillLitres" DECIMAL(6,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LubricantCompatibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LubricantAlternative" (
    "id" TEXT NOT NULL,
    "lubricantId" TEXT NOT NULL,
    "alternativeId" TEXT NOT NULL,
    "alternativeType" TEXT NOT NULL,
    "status" "MatchCandidateStatus" NOT NULL DEFAULT 'PENDING',
    "rationale" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LubricantAlternative_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LubricantExternalReference" (
    "id" TEXT NOT NULL,
    "lubricantProductId" TEXT NOT NULL,
    "sourceSystem" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LubricantExternalReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesDocument" (
    "id" TEXT NOT NULL,
    "documentNumber" TEXT NOT NULL,
    "externalDocumentNumber" TEXT,
    "documentType" "SalesDocumentType" NOT NULL,
    "status" "SalesDocumentStatus" NOT NULL DEFAULT 'OPEN',
    "customerId" TEXT,
    "unresolvedCustomerRef" TEXT,
    "branchId" TEXT,
    "warehouseId" TEXT,
    "salespersonExternalId" TEXT,
    "documentDate" TIMESTAMP(3) NOT NULL,
    "postingDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "currency" TEXT NOT NULL DEFAULT 'TZS',
    "exchangeRate" DECIMAL(12,6) NOT NULL DEFAULT 1,
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "discountTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "grandTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "paidAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "outstandingAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "isCancelled" BOOLEAN NOT NULL DEFAULT false,
    "sourceSystem" TEXT,
    "sourceRecordId" TEXT,
    "externalId" TEXT,
    "syncedAt" TIMESTAMP(3),
    "recordVersion" TEXT,
    "checksum" TEXT,
    "syncStatus" "SyncStatus" NOT NULL DEFAULT 'SYNCED',
    "syncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesDocumentLine" (
    "id" TEXT NOT NULL,
    "salesDocumentId" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "itemType" "ItemType" NOT NULL DEFAULT 'UNKNOWN',
    "partId" TEXT,
    "lubricantProductId" TEXT,
    "unresolvedItemCode" TEXT,
    "originalDescription" TEXT,
    "normalizedDescription" TEXT,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unitPrice" DECIMAL(14,4) NOT NULL,
    "discountAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL(14,2) NOT NULL,
    "costAtSale" DECIMAL(14,4),
    "warehouseId" TEXT,
    "vehicleId" TEXT,
    "garageJobExternalId" TEXT,
    "sourceSystem" TEXT,
    "sourceRecordId" TEXT,
    "checksum" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesDocumentLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesExternalReference" (
    "id" TEXT NOT NULL,
    "salesDocumentId" TEXT NOT NULL,
    "sourceSystem" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesExternalReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "supplierCode" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "paymentTerms" TEXT,
    "defaultLeadTimeDays" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sourceSystem" TEXT,
    "sourceRecordId" TEXT,
    "externalId" TEXT,
    "syncedAt" TIMESTAMP(3),
    "recordVersion" TEXT,
    "checksum" TEXT,
    "syncStatus" "SyncStatus" NOT NULL DEFAULT 'SYNCED',
    "syncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierExternalReference" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "sourceSystem" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierExternalReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseDocument" (
    "id" TEXT NOT NULL,
    "documentNumber" TEXT NOT NULL,
    "externalDocumentNumber" TEXT,
    "documentType" "PurchaseDocumentType" NOT NULL,
    "status" "PurchaseDocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "supplierId" TEXT,
    "branchId" TEXT,
    "warehouseId" TEXT,
    "documentDate" TIMESTAMP(3) NOT NULL,
    "expectedDeliveryDate" TIMESTAMP(3),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "exchangeRate" DECIMAL(12,6) NOT NULL DEFAULT 1,
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "grandTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "isCancelled" BOOLEAN NOT NULL DEFAULT false,
    "sourceSystem" TEXT,
    "sourceRecordId" TEXT,
    "externalId" TEXT,
    "syncedAt" TIMESTAMP(3),
    "recordVersion" TEXT,
    "checksum" TEXT,
    "syncStatus" "SyncStatus" NOT NULL DEFAULT 'SYNCED',
    "syncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseDocumentLine" (
    "id" TEXT NOT NULL,
    "purchaseDocumentId" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "itemType" "ItemType" NOT NULL DEFAULT 'UNKNOWN',
    "partId" TEXT,
    "lubricantProductId" TEXT,
    "unresolvedItemCode" TEXT,
    "orderedQuantity" DECIMAL(12,3) NOT NULL,
    "receivedQuantity" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "unitCost" DECIMAL(14,4) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "taxAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "expectedDeliveryDate" TIMESTAMP(3),
    "actualReceiptDate" TIMESTAMP(3),
    "supplierItemCode" TEXT,
    "sourceSystem" TEXT,
    "sourceRecordId" TEXT,
    "checksum" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseDocumentLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoodsReceipt" (
    "id" TEXT NOT NULL,
    "purchaseDocumentId" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "isCancelled" BOOLEAN NOT NULL DEFAULT false,
    "sourceSystem" TEXT,
    "sourceRecordId" TEXT,
    "checksum" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoodsReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoodsReceiptLine" (
    "id" TEXT NOT NULL,
    "goodsReceiptId" TEXT NOT NULL,
    "purchaseDocumentLineId" TEXT,
    "partId" TEXT,
    "lubricantProductId" TEXT,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unitCost" DECIMAL(14,4) NOT NULL,
    "batchNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoodsReceiptLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryMovement" (
    "id" TEXT NOT NULL,
    "itemType" "ItemType" NOT NULL,
    "partId" TEXT,
    "lubricantProductId" TEXT,
    "warehouseId" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "direction" "MovementDirection" NOT NULL,
    "movementType" "InventoryMovementType" NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "sourceSystem" TEXT,
    "sourceRecordId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unitCost" DECIMAL(14,4),
    "batchNumber" TEXT,
    "serialNumber" TEXT,
    "reason" TEXT,
    "createdByActor" TEXT,
    "correlationId" TEXT,
    "checksum" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryBalance" (
    "id" TEXT NOT NULL,
    "itemType" "ItemType" NOT NULL,
    "partId" TEXT,
    "lubricantProductId" TEXT,
    "warehouseId" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "onHand" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "reserved" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "incoming" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "inTransit" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "damaged" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "quarantined" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "hasNegativeStockIssue" BOOLEAN NOT NULL DEFAULT false,
    "lastMovementAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockReservation" (
    "id" TEXT NOT NULL,
    "itemType" "ItemType" NOT NULL,
    "partId" TEXT,
    "lubricantProductId" TEXT,
    "warehouseId" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "status" "ReservationStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" TIMESTAMP(3),

    CONSTRAINT "StockReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockTransfer" (
    "id" TEXT NOT NULL,
    "transferNumber" TEXT NOT NULL,
    "sourceWarehouseId" TEXT NOT NULL,
    "destinationWarehouseId" TEXT NOT NULL,
    "status" "StockTransferStatus" NOT NULL DEFAULT 'DRAFT',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockTransferLine" (
    "id" TEXT NOT NULL,
    "stockTransferId" TEXT NOT NULL,
    "itemType" "ItemType" NOT NULL,
    "partId" TEXT,
    "lubricantProductId" TEXT,
    "quantity" DECIMAL(14,3) NOT NULL,

    CONSTRAINT "StockTransferLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryAdjustment" (
    "id" TEXT NOT NULL,
    "itemType" "ItemType" NOT NULL,
    "partId" TEXT,
    "lubricantProductId" TEXT,
    "warehouseId" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "direction" "AdjustmentDirection" NOT NULL,
    "reason" TEXT NOT NULL,
    "requestedById" TEXT,
    "approvedById" TEXT,
    "movementId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryExternalReference" (
    "id" TEXT NOT NULL,
    "movementId" TEXT NOT NULL,
    "sourceSystem" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryExternalReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockSnapshot" (
    "id" TEXT NOT NULL,
    "itemType" "ItemType" NOT NULL,
    "partId" TEXT,
    "lubricantProductId" TEXT,
    "warehouseId" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "snapshotDate" TIMESTAMP(3) NOT NULL,
    "onHand" DECIMAL(14,3) NOT NULL,
    "reserved" DECIMAL(14,3) NOT NULL,
    "available" DECIMAL(14,3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppEvent" (
    "id" TEXT NOT NULL,
    "sourceApplication" TEXT NOT NULL,
    "sourceEventId" TEXT NOT NULL,
    "eventType" "AppEventType" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "userExternalId" TEXT,
    "customerExternalId" TEXT,
    "branchCode" TEXT,
    "warehouseCode" TEXT,
    "searchQuery" TEXT,
    "itemCode" TEXT,
    "partId" TEXT,
    "lubricantProductId" TEXT,
    "vin" TEXT,
    "vehicleId" TEXT,
    "sessionId" TEXT,
    "correlationId" TEXT,
    "endpoint" TEXT,
    "durationMs" INTEGER,
    "statusCode" INTEGER,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "metadata" JSONB,
    "checksum" TEXT NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LostSaleCandidate" (
    "id" TEXT NOT NULL,
    "reason" "LostSaleReason" NOT NULL,
    "rawQuery" TEXT,
    "partId" TEXT,
    "lubricantProductId" TEXT,
    "customerId" TEXT,
    "vehicleId" TEXT,
    "branchId" TEXT,
    "warehouseId" TEXT,
    "requestedQuantity" DECIMAL(12,3),
    "estimatedValue" DECIMAL(14,2),
    "confidence" "RecommendationConfidence" NOT NULL DEFAULT 'MEDIUM',
    "status" "LostSaleStatus" NOT NULL DEFAULT 'OPEN',
    "dedupeKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "resolutionReason" TEXT,

    CONSTRAINT "LostSaleCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LostSaleEvidence" (
    "id" TEXT NOT NULL,
    "lostSaleCandidateId" TEXT NOT NULL,
    "appEventId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LostSaleEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItemMetric" (
    "id" TEXT NOT NULL,
    "itemType" "ItemType" NOT NULL,
    "partId" TEXT,
    "lubricantProductId" TEXT,
    "warehouseId" TEXT,
    "itemKey" TEXT NOT NULL,
    "warehouseKey" TEXT NOT NULL,
    "qtySold7d" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "qtySold30d" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "qtySold60d" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "qtySold90d" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "avgDailyDemand" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "avgWeeklyDemand" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "demandStdDev" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "coefficientOfVariation" DECIMAL(8,4),
    "salesFrequencyDays" DECIMAL(8,2),
    "daysSinceLastSale" INTEGER,
    "salesTransactionCount" INTEGER NOT NULL DEFAULT 0,
    "garageQty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "retailQty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "wholesaleQty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "availableStock" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "daysOfSupply" DECIMAL(10,2),
    "stockOutRisk" TEXT,
    "noMovementDays" INTEGER,
    "stockAgeDays" INTEGER,
    "grossMarginPct" DECIMAL(6,2),
    "lostSaleCount" INTEGER NOT NULL DEFAULT 0,
    "lostSaleQuantity" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "searchCount" INTEGER NOT NULL DEFAULT 0,
    "outOfStockSearchCount" INTEGER NOT NULL DEFAULT 0,
    "incomingQuantity" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "openPurchaseQuantity" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "historyDays" INTEGER NOT NULL,
    "hasSufficientHistory" BOOLEAN NOT NULL DEFAULT true,
    "abcClass" "AbcClass",
    "abcConfidenceReduced" BOOLEAN NOT NULL DEFAULT false,
    "xyzClass" "XyzClass",
    "movementClass" "MovementClass" NOT NULL DEFAULT 'INSUFFICIENT_HISTORY',
    "criticality" "CriticalityLevel" NOT NULL DEFAULT 'NORMAL',
    "criticalityIsManual" BOOLEAN NOT NULL DEFAULT false,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryItemMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseRecommendation" (
    "id" TEXT NOT NULL,
    "itemType" "ItemType" NOT NULL,
    "partId" TEXT,
    "lubricantProductId" TEXT,
    "warehouseId" TEXT,
    "action" "PurchaseRecommendationAction" NOT NULL,
    "suggestedQuantity" DECIMAL(14,3) NOT NULL,
    "confidence" "RecommendationConfidence" NOT NULL,
    "evidence" JSONB NOT NULL,
    "warnings" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "RecommendationStatus" NOT NULL DEFAULT 'PENDING',
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransferRecommendation" (
    "id" TEXT NOT NULL,
    "itemType" "ItemType" NOT NULL,
    "partId" TEXT,
    "lubricantProductId" TEXT,
    "sourceWarehouseId" TEXT NOT NULL,
    "destinationWarehouseId" TEXT NOT NULL,
    "suggestedQuantity" DECIMAL(14,3) NOT NULL,
    "reason" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,
    "status" "RecommendationStatus" NOT NULL DEFAULT 'PENDING',
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransferRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierMetric" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "avgLeadTimeDays" DECIMAL(8,2),
    "leadTimeVariance" DECIMAL(8,2),
    "onTimeDeliveryPct" DECIMAL(6,2),
    "fillRatePct" DECIMAL(6,2),
    "priceVariancePct" DECIMAL(6,2),
    "quantityAccuracyPct" DECIMAL(6,2),
    "receiptCompletionPct" DECIMAL(6,2),
    "returnCount" INTEGER,
    "activePurchaseOrders" INTEGER NOT NULL DEFAULT 0,
    "latePurchaseOrders" INTEGER NOT NULL DEFAULT 0,
    "dataSufficiency" "RecommendationConfidence" NOT NULL DEFAULT 'INSUFFICIENT_DATA',
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" TEXT,
    "actorRole" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "beforeState" JSONB,
    "afterState" JSONB,
    "branchId" TEXT,
    "sourceApplication" TEXT,
    "correlationId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataQualityIssue" (
    "id" TEXT NOT NULL,
    "checkName" TEXT NOT NULL,
    "severity" "DataQualitySeverity" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "message" TEXT NOT NULL,
    "context" JSONB,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataQualityIssue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationSource_name_key" ON "IntegrationSource"("name");

-- CreateIndex
CREATE INDEX "SyncRun_sourceId_startedAt_idx" ON "SyncRun"("sourceId", "startedAt");

-- CreateIndex
CREATE INDEX "SyncDeadLetter_sourceSystem_resolvedAt_idx" ON "SyncDeadLetter"("sourceSystem", "resolvedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SyncDeadLetter_sourceSystem_sourceRecordId_entityType_stage_key" ON "SyncDeadLetter"("sourceSystem", "sourceRecordId", "entityType", "stage");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_vin_key" ON "Vehicle"("vin");

-- CreateIndex
CREATE INDEX "Vehicle_brand_model_modelYear_idx" ON "Vehicle"("brand", "model", "modelYear");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_sourceSystem_sourceRecordId_key" ON "Vehicle"("sourceSystem", "sourceRecordId");

-- CreateIndex
CREATE INDEX "VehicleAttributeHistory_vehicleId_field_idx" ON "VehicleAttributeHistory"("vehicleId", "field");

-- CreateIndex
CREATE UNIQUE INDEX "Part_internalItemCode_key" ON "Part"("internalItemCode");

-- CreateIndex
CREATE INDEX "Part_oemNumber_idx" ON "Part"("oemNumber");

-- CreateIndex
CREATE INDEX "Part_standardizedProductName_idx" ON "Part"("standardizedProductName");

-- CreateIndex
CREATE UNIQUE INDEX "Part_sourceSystem_sourceRecordId_key" ON "Part"("sourceSystem", "sourceRecordId");

-- CreateIndex
CREATE INDEX "PartAlternateNumber_number_idx" ON "PartAlternateNumber"("number");

-- CreateIndex
CREATE UNIQUE INDEX "PartAlternateNumber_partId_number_type_key" ON "PartAlternateNumber"("partId", "number", "type");

-- CreateIndex
CREATE INDEX "PartCompatibility_brand_model_idx" ON "PartCompatibility"("brand", "model");

-- CreateIndex
CREATE INDEX "PartCompatibility_partId_idx" ON "PartCompatibility"("partId");

-- CreateIndex
CREATE INDEX "PartMatchCandidate_status_idx" ON "PartMatchCandidate"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PartMatchCandidate_partAId_partBId_stage_key" ON "PartMatchCandidate"("partAId", "partBId", "stage");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_code_key" ON "Organization"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Branch_organizationId_code_key" ON "Branch"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_branchId_code_key" ON "Warehouse"("branchId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_customerCode_key" ON "Customer"("customerCode");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_sourceSystem_sourceRecordId_key" ON "Customer"("sourceSystem", "sourceRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerVehicleLink_customerId_vehicleId_key" ON "CustomerVehicleLink"("customerId", "vehicleId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerExternalReference_sourceSystem_sourceRecordId_key" ON "CustomerExternalReference"("sourceSystem", "sourceRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "LubricantProduct_internalCode_key" ON "LubricantProduct"("internalCode");

-- CreateIndex
CREATE INDEX "LubricantProduct_normalizedName_idx" ON "LubricantProduct"("normalizedName");

-- CreateIndex
CREATE INDEX "LubricantProduct_category_idx" ON "LubricantProduct"("category");

-- CreateIndex
CREATE UNIQUE INDEX "LubricantProduct_sourceSystem_sourceRecordId_key" ON "LubricantProduct"("sourceSystem", "sourceRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "LubricantApproval_lubricantProductId_oemBrand_approvalCode_key" ON "LubricantApproval"("lubricantProductId", "oemBrand", "approvalCode");

-- CreateIndex
CREATE INDEX "LubricantCompatibility_brand_model_idx" ON "LubricantCompatibility"("brand", "model");

-- CreateIndex
CREATE UNIQUE INDEX "LubricantAlternative_lubricantId_alternativeId_key" ON "LubricantAlternative"("lubricantId", "alternativeId");

-- CreateIndex
CREATE UNIQUE INDEX "LubricantExternalReference_sourceSystem_sourceRecordId_key" ON "LubricantExternalReference"("sourceSystem", "sourceRecordId");

-- CreateIndex
CREATE INDEX "SalesDocument_documentNumber_idx" ON "SalesDocument"("documentNumber");

-- CreateIndex
CREATE INDEX "SalesDocument_branchId_documentDate_idx" ON "SalesDocument"("branchId", "documentDate");

-- CreateIndex
CREATE INDEX "SalesDocument_customerId_idx" ON "SalesDocument"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "SalesDocument_sourceSystem_sourceRecordId_key" ON "SalesDocument"("sourceSystem", "sourceRecordId");

-- CreateIndex
CREATE INDEX "SalesDocumentLine_partId_idx" ON "SalesDocumentLine"("partId");

-- CreateIndex
CREATE INDEX "SalesDocumentLine_lubricantProductId_idx" ON "SalesDocumentLine"("lubricantProductId");

-- CreateIndex
CREATE INDEX "SalesDocumentLine_vehicleId_idx" ON "SalesDocumentLine"("vehicleId");

-- CreateIndex
CREATE UNIQUE INDEX "SalesDocumentLine_salesDocumentId_lineNumber_key" ON "SalesDocumentLine"("salesDocumentId", "lineNumber");

-- CreateIndex
CREATE UNIQUE INDEX "SalesExternalReference_sourceSystem_sourceRecordId_key" ON "SalesExternalReference"("sourceSystem", "sourceRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_supplierCode_key" ON "Supplier"("supplierCode");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_sourceSystem_sourceRecordId_key" ON "Supplier"("sourceSystem", "sourceRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierExternalReference_sourceSystem_sourceRecordId_key" ON "SupplierExternalReference"("sourceSystem", "sourceRecordId");

-- CreateIndex
CREATE INDEX "PurchaseDocument_documentNumber_idx" ON "PurchaseDocument"("documentNumber");

-- CreateIndex
CREATE INDEX "PurchaseDocument_supplierId_idx" ON "PurchaseDocument"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseDocument_sourceSystem_sourceRecordId_key" ON "PurchaseDocument"("sourceSystem", "sourceRecordId");

-- CreateIndex
CREATE INDEX "PurchaseDocumentLine_partId_idx" ON "PurchaseDocumentLine"("partId");

-- CreateIndex
CREATE INDEX "PurchaseDocumentLine_lubricantProductId_idx" ON "PurchaseDocumentLine"("lubricantProductId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseDocumentLine_purchaseDocumentId_lineNumber_key" ON "PurchaseDocumentLine"("purchaseDocumentId", "lineNumber");

-- CreateIndex
CREATE UNIQUE INDEX "GoodsReceipt_sourceSystem_sourceRecordId_key" ON "GoodsReceipt"("sourceSystem", "sourceRecordId");

-- CreateIndex
CREATE INDEX "InventoryMovement_partId_warehouseId_occurredAt_idx" ON "InventoryMovement"("partId", "warehouseId", "occurredAt");

-- CreateIndex
CREATE INDEX "InventoryMovement_lubricantProductId_warehouseId_occurredAt_idx" ON "InventoryMovement"("lubricantProductId", "warehouseId", "occurredAt");

-- CreateIndex
CREATE INDEX "InventoryMovement_warehouseId_movementType_idx" ON "InventoryMovement"("warehouseId", "movementType");

-- CreateIndex
CREATE INDEX "InventoryMovement_correlationId_idx" ON "InventoryMovement"("correlationId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryMovement_sourceSystem_sourceRecordId_key" ON "InventoryMovement"("sourceSystem", "sourceRecordId");

-- CreateIndex
CREATE INDEX "InventoryBalance_warehouseId_idx" ON "InventoryBalance"("warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryBalance_itemKey_warehouseId_key" ON "InventoryBalance"("itemKey", "warehouseId");

-- CreateIndex
CREATE INDEX "StockReservation_warehouseId_status_idx" ON "StockReservation"("warehouseId", "status");

-- CreateIndex
CREATE INDEX "StockReservation_partId_status_idx" ON "StockReservation"("partId", "status");

-- CreateIndex
CREATE INDEX "StockReservation_lubricantProductId_status_idx" ON "StockReservation"("lubricantProductId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "StockTransfer_transferNumber_key" ON "StockTransfer"("transferNumber");

-- CreateIndex
CREATE INDEX "InventoryAdjustment_warehouseId_idx" ON "InventoryAdjustment"("warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryExternalReference_sourceSystem_sourceRecordId_key" ON "InventoryExternalReference"("sourceSystem", "sourceRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "StockSnapshot_itemKey_warehouseId_snapshotDate_key" ON "StockSnapshot"("itemKey", "warehouseId", "snapshotDate");

-- CreateIndex
CREATE INDEX "AppEvent_eventType_occurredAt_idx" ON "AppEvent"("eventType", "occurredAt");

-- CreateIndex
CREATE INDEX "AppEvent_sessionId_idx" ON "AppEvent"("sessionId");

-- CreateIndex
CREATE INDEX "AppEvent_itemCode_idx" ON "AppEvent"("itemCode");

-- CreateIndex
CREATE INDEX "AppEvent_partId_idx" ON "AppEvent"("partId");

-- CreateIndex
CREATE INDEX "AppEvent_lubricantProductId_idx" ON "AppEvent"("lubricantProductId");

-- CreateIndex
CREATE UNIQUE INDEX "AppEvent_sourceApplication_sourceEventId_key" ON "AppEvent"("sourceApplication", "sourceEventId");

-- CreateIndex
CREATE UNIQUE INDEX "LostSaleCandidate_dedupeKey_key" ON "LostSaleCandidate"("dedupeKey");

-- CreateIndex
CREATE INDEX "LostSaleCandidate_status_idx" ON "LostSaleCandidate"("status");

-- CreateIndex
CREATE INDEX "LostSaleCandidate_partId_idx" ON "LostSaleCandidate"("partId");

-- CreateIndex
CREATE INDEX "LostSaleCandidate_lubricantProductId_idx" ON "LostSaleCandidate"("lubricantProductId");

-- CreateIndex
CREATE UNIQUE INDEX "LostSaleEvidence_lostSaleCandidateId_appEventId_key" ON "LostSaleEvidence"("lostSaleCandidateId", "appEventId");

-- CreateIndex
CREATE INDEX "InventoryItemMetric_movementClass_idx" ON "InventoryItemMetric"("movementClass");

-- CreateIndex
CREATE INDEX "InventoryItemMetric_abcClass_idx" ON "InventoryItemMetric"("abcClass");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItemMetric_itemKey_warehouseKey_key" ON "InventoryItemMetric"("itemKey", "warehouseKey");

-- CreateIndex
CREATE INDEX "PurchaseRecommendation_action_status_idx" ON "PurchaseRecommendation"("action", "status");

-- CreateIndex
CREATE INDEX "PurchaseRecommendation_partId_idx" ON "PurchaseRecommendation"("partId");

-- CreateIndex
CREATE INDEX "PurchaseRecommendation_lubricantProductId_idx" ON "PurchaseRecommendation"("lubricantProductId");

-- CreateIndex
CREATE INDEX "PurchaseRecommendation_warehouseId_idx" ON "PurchaseRecommendation"("warehouseId");

-- CreateIndex
CREATE INDEX "TransferRecommendation_status_idx" ON "TransferRecommendation"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierMetric_supplierId_key" ON "SupplierMetric"("supplierId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_occurredAt_idx" ON "AuditLog"("occurredAt");

-- CreateIndex
CREATE INDEX "DataQualityIssue_checkName_severity_idx" ON "DataQualityIssue"("checkName", "severity");

-- CreateIndex
CREATE INDEX "DataQualityIssue_entityType_entityId_idx" ON "DataQualityIssue"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "SyncRun" ADD CONSTRAINT "SyncRun_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "IntegrationSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncDeadLetter" ADD CONSTRAINT "SyncDeadLetter_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleAttributeHistory" ADD CONSTRAINT "VehicleAttributeHistory_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleAttributeHistory" ADD CONSTRAINT "VehicleAttributeHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartAlternateNumber" ADD CONSTRAINT "PartAlternateNumber_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartCompatibility" ADD CONSTRAINT "PartCompatibility_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartMatchCandidate" ADD CONSTRAINT "PartMatchCandidate_partAId_fkey" FOREIGN KEY ("partAId") REFERENCES "Part"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartMatchCandidate" ADD CONSTRAINT "PartMatchCandidate_partBId_fkey" FOREIGN KEY ("partBId") REFERENCES "Part"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartMatchCandidate" ADD CONSTRAINT "PartMatchCandidate_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_preferredBranchId_fkey" FOREIGN KEY ("preferredBranchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerContact" ADD CONSTRAINT "CustomerContact_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerAddress" ADD CONSTRAINT "CustomerAddress_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerVehicleLink" ADD CONSTRAINT "CustomerVehicleLink_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerVehicleLink" ADD CONSTRAINT "CustomerVehicleLink_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerExternalReference" ADD CONSTRAINT "CustomerExternalReference_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LubricantApproval" ADD CONSTRAINT "LubricantApproval_lubricantProductId_fkey" FOREIGN KEY ("lubricantProductId") REFERENCES "LubricantProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LubricantCompatibility" ADD CONSTRAINT "LubricantCompatibility_lubricantProductId_fkey" FOREIGN KEY ("lubricantProductId") REFERENCES "LubricantProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LubricantAlternative" ADD CONSTRAINT "LubricantAlternative_lubricantId_fkey" FOREIGN KEY ("lubricantId") REFERENCES "LubricantProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LubricantAlternative" ADD CONSTRAINT "LubricantAlternative_alternativeId_fkey" FOREIGN KEY ("alternativeId") REFERENCES "LubricantProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LubricantExternalReference" ADD CONSTRAINT "LubricantExternalReference_lubricantProductId_fkey" FOREIGN KEY ("lubricantProductId") REFERENCES "LubricantProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesDocument" ADD CONSTRAINT "SalesDocument_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesDocument" ADD CONSTRAINT "SalesDocument_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesDocument" ADD CONSTRAINT "SalesDocument_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesDocumentLine" ADD CONSTRAINT "SalesDocumentLine_salesDocumentId_fkey" FOREIGN KEY ("salesDocumentId") REFERENCES "SalesDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesDocumentLine" ADD CONSTRAINT "SalesDocumentLine_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesDocumentLine" ADD CONSTRAINT "SalesDocumentLine_lubricantProductId_fkey" FOREIGN KEY ("lubricantProductId") REFERENCES "LubricantProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesDocumentLine" ADD CONSTRAINT "SalesDocumentLine_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesDocumentLine" ADD CONSTRAINT "SalesDocumentLine_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesExternalReference" ADD CONSTRAINT "SalesExternalReference_salesDocumentId_fkey" FOREIGN KEY ("salesDocumentId") REFERENCES "SalesDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierExternalReference" ADD CONSTRAINT "SupplierExternalReference_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseDocument" ADD CONSTRAINT "PurchaseDocument_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseDocument" ADD CONSTRAINT "PurchaseDocument_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseDocument" ADD CONSTRAINT "PurchaseDocument_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseDocumentLine" ADD CONSTRAINT "PurchaseDocumentLine_purchaseDocumentId_fkey" FOREIGN KEY ("purchaseDocumentId") REFERENCES "PurchaseDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseDocumentLine" ADD CONSTRAINT "PurchaseDocumentLine_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseDocumentLine" ADD CONSTRAINT "PurchaseDocumentLine_lubricantProductId_fkey" FOREIGN KEY ("lubricantProductId") REFERENCES "LubricantProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceipt" ADD CONSTRAINT "GoodsReceipt_purchaseDocumentId_fkey" FOREIGN KEY ("purchaseDocumentId") REFERENCES "PurchaseDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceipt" ADD CONSTRAINT "GoodsReceipt_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptLine" ADD CONSTRAINT "GoodsReceiptLine_goodsReceiptId_fkey" FOREIGN KEY ("goodsReceiptId") REFERENCES "GoodsReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptLine" ADD CONSTRAINT "GoodsReceiptLine_purchaseDocumentLineId_fkey" FOREIGN KEY ("purchaseDocumentLineId") REFERENCES "PurchaseDocumentLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptLine" ADD CONSTRAINT "GoodsReceiptLine_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptLine" ADD CONSTRAINT "GoodsReceiptLine_lubricantProductId_fkey" FOREIGN KEY ("lubricantProductId") REFERENCES "LubricantProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_lubricantProductId_fkey" FOREIGN KEY ("lubricantProductId") REFERENCES "LubricantProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryBalance" ADD CONSTRAINT "InventoryBalance_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryBalance" ADD CONSTRAINT "InventoryBalance_lubricantProductId_fkey" FOREIGN KEY ("lubricantProductId") REFERENCES "LubricantProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryBalance" ADD CONSTRAINT "InventoryBalance_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReservation" ADD CONSTRAINT "StockReservation_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReservation" ADD CONSTRAINT "StockReservation_lubricantProductId_fkey" FOREIGN KEY ("lubricantProductId") REFERENCES "LubricantProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReservation" ADD CONSTRAINT "StockReservation_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_sourceWarehouseId_fkey" FOREIGN KEY ("sourceWarehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_destinationWarehouseId_fkey" FOREIGN KEY ("destinationWarehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransferLine" ADD CONSTRAINT "StockTransferLine_stockTransferId_fkey" FOREIGN KEY ("stockTransferId") REFERENCES "StockTransfer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransferLine" ADD CONSTRAINT "StockTransferLine_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransferLine" ADD CONSTRAINT "StockTransferLine_lubricantProductId_fkey" FOREIGN KEY ("lubricantProductId") REFERENCES "LubricantProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryAdjustment" ADD CONSTRAINT "InventoryAdjustment_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryAdjustment" ADD CONSTRAINT "InventoryAdjustment_lubricantProductId_fkey" FOREIGN KEY ("lubricantProductId") REFERENCES "LubricantProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryAdjustment" ADD CONSTRAINT "InventoryAdjustment_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryExternalReference" ADD CONSTRAINT "InventoryExternalReference_movementId_fkey" FOREIGN KEY ("movementId") REFERENCES "InventoryMovement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockSnapshot" ADD CONSTRAINT "StockSnapshot_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockSnapshot" ADD CONSTRAINT "StockSnapshot_lubricantProductId_fkey" FOREIGN KEY ("lubricantProductId") REFERENCES "LubricantProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockSnapshot" ADD CONSTRAINT "StockSnapshot_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppEvent" ADD CONSTRAINT "AppEvent_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppEvent" ADD CONSTRAINT "AppEvent_lubricantProductId_fkey" FOREIGN KEY ("lubricantProductId") REFERENCES "LubricantProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppEvent" ADD CONSTRAINT "AppEvent_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LostSaleCandidate" ADD CONSTRAINT "LostSaleCandidate_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LostSaleCandidate" ADD CONSTRAINT "LostSaleCandidate_lubricantProductId_fkey" FOREIGN KEY ("lubricantProductId") REFERENCES "LubricantProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LostSaleCandidate" ADD CONSTRAINT "LostSaleCandidate_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LostSaleCandidate" ADD CONSTRAINT "LostSaleCandidate_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LostSaleCandidate" ADD CONSTRAINT "LostSaleCandidate_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LostSaleCandidate" ADD CONSTRAINT "LostSaleCandidate_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LostSaleEvidence" ADD CONSTRAINT "LostSaleEvidence_lostSaleCandidateId_fkey" FOREIGN KEY ("lostSaleCandidateId") REFERENCES "LostSaleCandidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LostSaleEvidence" ADD CONSTRAINT "LostSaleEvidence_appEventId_fkey" FOREIGN KEY ("appEventId") REFERENCES "AppEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItemMetric" ADD CONSTRAINT "InventoryItemMetric_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItemMetric" ADD CONSTRAINT "InventoryItemMetric_lubricantProductId_fkey" FOREIGN KEY ("lubricantProductId") REFERENCES "LubricantProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItemMetric" ADD CONSTRAINT "InventoryItemMetric_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRecommendation" ADD CONSTRAINT "PurchaseRecommendation_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRecommendation" ADD CONSTRAINT "PurchaseRecommendation_lubricantProductId_fkey" FOREIGN KEY ("lubricantProductId") REFERENCES "LubricantProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRecommendation" ADD CONSTRAINT "PurchaseRecommendation_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferRecommendation" ADD CONSTRAINT "TransferRecommendation_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferRecommendation" ADD CONSTRAINT "TransferRecommendation_lubricantProductId_fkey" FOREIGN KEY ("lubricantProductId") REFERENCES "LubricantProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferRecommendation" ADD CONSTRAINT "TransferRecommendation_sourceWarehouseId_fkey" FOREIGN KEY ("sourceWarehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferRecommendation" ADD CONSTRAINT "TransferRecommendation_destinationWarehouseId_fkey" FOREIGN KEY ("destinationWarehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierMetric" ADD CONSTRAINT "SupplierMetric_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
