/* eslint-disable no-console */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import * as fs from 'fs';
import * as path from 'path';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { IntegrationService } from '../src/integration/integration.service';
import { VehicleSyncHandler } from '../src/integration/handlers/vehicle-sync.handler';
import { PartSyncHandler } from '../src/integration/handlers/part-sync.handler';
import { FileDropAdapter } from '../src/integration/adapters/file-drop.adapter';
import { SalesDocumentSyncHandler } from '../src/sales/handlers/sales-document-sync.handler';
import { PurchaseDocumentSyncHandler } from '../src/purchases/handlers/purchase-document-sync.handler';
import { GoodsReceiptsService } from '../src/purchases/goods-receipts.service';
import { InventoryLedgerService } from '../src/inventory/inventory-ledger.service';
import { AppEventsService } from '../src/app-events/app-events.service';
import { LostSalesEngineService } from '../src/lost-sales/lost-sales-engine.service';
import { LostSalesService } from '../src/lost-sales/lost-sales.service';
import { InventoryAnalyticsService } from '../src/inventory-analytics/inventory-analytics.service';
import { PurchaseRecommendationsService } from '../src/purchase-recommendations/purchase-recommendations.service';
import { TransferRecommendationsService } from '../src/transfer-recommendations/transfer-recommendations.service';
import { SupplierAnalyticsService } from '../src/supplier-analytics/supplier-analytics.service';
import { InventoryMovementType, MovementDirection } from '@prisma/client';

const SAMPLE_DIR = path.join(__dirname, '..', 'sample-data');

function header(title: string) {
  console.log('\n' + '='.repeat(80));
  console.log(title);
  console.log('='.repeat(80));
}

function readJson<T>(relativePath: string): T {
  return JSON.parse(fs.readFileSync(path.join(SAMPLE_DIR, relativePath), 'utf-8'));
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const prisma = app.get(PrismaService);

  try {
    // ---------------------------------------------------------------------
    header('STEP 1-2: Seed organization / branches / warehouses');
    // ---------------------------------------------------------------------
    const orgs = readJson<Array<{ code: string; name: string }>>('master/organizations.json');
    const orgIdByCode = new Map<string, string>();
    for (const o of orgs) {
      const org = await prisma.organization.upsert({ where: { code: o.code }, create: o, update: { name: o.name } });
      orgIdByCode.set(o.code, org.id);
    }
    console.log(`Organizations seeded: ${orgs.length}`);

    const branches = readJson<
      Array<{ organizationCode: string; code: string; name: string; address?: string; phone?: string; timezone?: string }>
    >('master/branches.json');
    const branchIdByCode = new Map<string, string>();
    for (const b of branches) {
      const organizationId = orgIdByCode.get(b.organizationCode)!;
      const branch = await prisma.branch.upsert({
        where: { organizationId_code: { organizationId, code: b.code } },
        create: { organizationId, code: b.code, name: b.name, address: b.address, phone: b.phone, timezone: b.timezone },
        update: { name: b.name, address: b.address, phone: b.phone },
      });
      branchIdByCode.set(b.code, branch.id);
    }
    console.log(`Branches seeded: ${branches.length} (${[...branchIdByCode.keys()].join(', ')})`);

    const warehouses = readJson<
      Array<{ branchCode: string; code: string; name: string; warehouseType: string; isSellable?: boolean; isServiceWarehouse?: boolean }>
    >('master/warehouses.json');
    const warehouseIdByCode = new Map<string, string>();
    for (const w of warehouses) {
      const branchId = branchIdByCode.get(w.branchCode)!;
      const warehouse = await prisma.warehouse.upsert({
        where: { branchId_code: { branchId, code: w.code } },
        create: {
          branchId,
          code: w.code,
          name: w.name,
          warehouseType: w.warehouseType as never,
          isSellable: w.isSellable ?? true,
          isServiceWarehouse: w.isServiceWarehouse ?? false,
        },
        update: { name: w.name },
      });
      warehouseIdByCode.set(w.code, warehouse.id);
    }
    console.log(`Warehouses seeded: ${warehouses.length} (${[...warehouseIdByCode.keys()].join(', ')})`);
    console.log(`Note: branch MBY01 deliberately has no warehouse mapped (missing-warehouse data-quality scenario).`);

    // ---------------------------------------------------------------------
    header('STEP 2: Seed customers');
    // ---------------------------------------------------------------------
    const customers = readJson<
      Array<{ customerCode: string; legalName: string; displayName: string; customerType: string; phone?: string; email?: string; preferredBranchCode?: string }>
    >('master/customers.json');
    const customerIdByCode = new Map<string, string>();
    for (const c of customers) {
      const customer = await prisma.customer.upsert({
        where: { customerCode: c.customerCode },
        create: {
          customerCode: c.customerCode,
          legalName: c.legalName,
          displayName: c.displayName,
          customerType: c.customerType as never,
          phone: c.phone,
          email: c.email,
          preferredBranchId: c.preferredBranchCode ? branchIdByCode.get(c.preferredBranchCode) : undefined,
        },
        update: { legalName: c.legalName, displayName: c.displayName },
      });
      customerIdByCode.set(c.customerCode, customer.id);
    }
    console.log(`Customers seeded: ${customers.length}`);

    const suppliers = readJson<
      Array<{ supplierCode: string; legalName: string; displayName: string; currency?: string; paymentTerms?: string; defaultLeadTimeDays?: number }>
    >('master/suppliers.json');
    const supplierIdByCode = new Map<string, string>();
    for (const s of suppliers) {
      const supplier = await prisma.supplier.upsert({
        where: { supplierCode: s.supplierCode },
        create: s,
        update: { legalName: s.legalName, defaultLeadTimeDays: s.defaultLeadTimeDays },
      });
      supplierIdByCode.set(s.supplierCode, supplier.id);
    }
    console.log(`Suppliers seeded: ${suppliers.length}`);

    // ---------------------------------------------------------------------
    header('STEP 3: Seed lubricants (parts already exist from Phase 1 sync below)');
    // ---------------------------------------------------------------------
    const lubricants = readJson<
      Array<{
        internalCode: string;
        brand: string;
        productName: string;
        category: string;
        viscosity?: string;
        packageSize?: number;
        packageUnit?: string;
        apiClassification?: string;
        aceaClassification?: string;
        currentCost?: number;
        defaultSellingPrice?: number;
        approvals?: Array<{ oemBrand: string; approvalCode: string }>;
      }>
    >('master/lubricants.json');
    const lubricantIdByCode = new Map<string, string>();
    for (const l of lubricants) {
      const { approvals, ...productFields } = l;
      const product = await prisma.lubricantProduct.upsert({
        where: { internalCode: l.internalCode },
        create: { ...productFields, category: l.category as never, normalizedName: l.productName.toLowerCase() },
        update: { productName: l.productName },
      });
      lubricantIdByCode.set(l.internalCode, product.id);
      for (const approval of approvals ?? []) {
        await prisma.lubricantApproval.upsert({
          where: { lubricantProductId_oemBrand_approvalCode: { lubricantProductId: product.id, oemBrand: approval.oemBrand, approvalCode: approval.approvalCode } },
          create: { lubricantProductId: product.id, oemBrand: approval.oemBrand, approvalCode: approval.approvalCode },
          update: {},
        });
      }
    }
    console.log(`Lubricants seeded: ${lubricants.length}`);

    // ---------------------------------------------------------------------
    header('STEP 4a: Sync vehicles + parts (Phase 1 pipeline) — first run');
    // ---------------------------------------------------------------------
    const integration = app.get(IntegrationService);
    const vehicleHandler = app.get(VehicleSyncHandler);
    const partHandler = app.get(PartSyncHandler);

    const vehicleSync1 = await integration.runSync(
      new FileDropAdapter('LEGACY_POS', 'VEHICLE', path.join(SAMPLE_DIR, 'legacy-vehicles')),
      vehicleHandler,
    );
    console.log('Vehicle sync (run 1):', vehicleSync1);
    const partSync1 = await integration.runSync(
      new FileDropAdapter('LEGACY_ERP', 'PART', path.join(SAMPLE_DIR, 'legacy-parts')),
      partHandler,
    );
    console.log('Part sync (run 1):', partSync1);

    header('STEP 4b: Re-run vehicle + part sync — prove no duplicates');
    const vehicleCountBefore = await prisma.vehicle.count();
    const partCountBefore = await prisma.part.count();
    const vehicleSync2 = await integration.runSync(
      new FileDropAdapter('LEGACY_POS', 'VEHICLE', path.join(SAMPLE_DIR, 'legacy-vehicles')),
      vehicleHandler,
    );
    const partSync2 = await integration.runSync(
      new FileDropAdapter('LEGACY_ERP', 'PART', path.join(SAMPLE_DIR, 'legacy-parts')),
      partHandler,
    );
    const vehicleCountAfter = await prisma.vehicle.count();
    const partCountAfter = await prisma.part.count();
    console.log('Vehicle sync (run 2, replay):', vehicleSync2);
    console.log('Part sync (run 2, replay):', partSync2);
    console.log(`Vehicle count unchanged: ${vehicleCountBefore} -> ${vehicleCountAfter} (${vehicleCountBefore === vehicleCountAfter ? 'OK' : 'MISMATCH'})`);
    console.log(`Part count unchanged: ${partCountBefore} -> ${partCountAfter} (${partCountBefore === partCountAfter ? 'OK' : 'MISMATCH'})`);

    // ---------------------------------------------------------------------
    header('STEP 5: Seed ItemPlanningProfile (safety stock, MOQ, package qty, lead-time supplier)');
    // ---------------------------------------------------------------------
    const profiles = readJson<
      Array<{
        itemCode: string;
        itemKind: 'PART' | 'LUBRICANT';
        safetyStock: number;
        targetCoverageDays: number;
        maxCoverageDays: number;
        minimumOrderQuantity?: number;
        packageQuantity?: number;
        defaultSupplierCode: string;
        criticality: string;
      }>
    >('master/item-planning-profiles.json');
    for (const p of profiles) {
      const part = p.itemKind === 'PART' ? await prisma.part.findFirst({ where: { oemNumber: p.itemCode } }) : null;
      const lubricant = p.itemKind === 'LUBRICANT' ? await prisma.lubricantProduct.findUnique({ where: { internalCode: p.itemCode } }) : null;
      const itemKey = part ? `part:${part.id}` : lubricant ? `lubricant:${lubricant.id}` : null;
      if (!itemKey) {
        console.log(`  WARNING: could not resolve item ${p.itemCode} for planning profile`);
        continue;
      }
      await prisma.itemPlanningProfile.upsert({
        where: { itemKey },
        create: {
          itemKey,
          itemType: p.itemKind,
          partId: part?.id,
          lubricantProductId: lubricant?.id,
          safetyStock: p.safetyStock,
          targetCoverageDays: p.targetCoverageDays,
          maxCoverageDays: p.maxCoverageDays,
          minimumOrderQuantity: p.minimumOrderQuantity,
          packageQuantity: p.packageQuantity,
          defaultSupplierId: supplierIdByCode.get(p.defaultSupplierCode),
          criticality: p.criticality as never,
        },
        update: { safetyStock: p.safetyStock, targetCoverageDays: p.targetCoverageDays },
      });
    }
    console.log(`Planning profiles seeded: ${profiles.length}`);

    // ---------------------------------------------------------------------
    header('STEP 6: Post opening-balance inventory movements — first run + idempotent replay');
    // ---------------------------------------------------------------------
    const ledger = app.get(InventoryLedgerService);
    const movements = readJson<
      Array<{ sourceRecordId: string; itemCode: string; itemKind: 'PART' | 'LUBRICANT'; warehouseCode: string; quantity: number; unitCost: number; occurredAt: string }>
    >('inventory-movements.json');

    async function postOpeningBalances() {
      let posted = 0;
      for (const m of movements) {
        const part = m.itemKind === 'PART' ? await prisma.part.findFirst({ where: { oemNumber: m.itemCode } }) : null;
        const lubricant = m.itemKind === 'LUBRICANT' ? await prisma.lubricantProduct.findUnique({ where: { internalCode: m.itemCode } }) : null;
        const warehouseId = warehouseIdByCode.get(m.warehouseCode);
        if (!warehouseId || (!part && !lubricant)) {
          console.log(`  WARNING: could not resolve movement ${m.sourceRecordId}`);
          continue;
        }
        await ledger.postMovement({
          itemType: part ? 'PART' : 'LUBRICANT',
          partId: part?.id,
          lubricantProductId: lubricant?.id,
          warehouseId,
          quantity: m.quantity,
          direction: MovementDirection.IN,
          movementType: InventoryMovementType.OPENING_BALANCE,
          sourceSystem: 'LEGACY_ERP',
          sourceRecordId: m.sourceRecordId,
          occurredAt: new Date(m.occurredAt),
          unitCost: m.unitCost,
        });
        posted += 1;
      }
      return posted;
    }

    const posted1 = await postOpeningBalances();
    const movementCountBefore = await prisma.inventoryMovement.count();
    const posted2 = await postOpeningBalances(); // replay
    const movementCountAfter = await prisma.inventoryMovement.count();
    console.log(`Opening balances posted (run 1): ${posted1}`);
    console.log(`Opening balances posted (run 2, replay): ${posted2}`);
    console.log(`Movement count unchanged after replay: ${movementCountBefore} -> ${movementCountAfter} (${movementCountBefore === movementCountAfter ? 'OK' : 'MISMATCH'})`);

    // ---------------------------------------------------------------------
    header('STEP 7a: Sync purchase documents — first run');
    // ---------------------------------------------------------------------
    const purchaseHandler = app.get(PurchaseDocumentSyncHandler);
    const purchaseSync1 = await integration.runSync(
      new FileDropAdapter('LEGACY_ERP_PURCHASES', 'PURCHASE_DOCUMENT', path.join(SAMPLE_DIR, 'legacy-purchases')),
      purchaseHandler,
    );
    console.log('Purchase sync (run 1):', purchaseSync1);

    header('STEP 7b: Re-run purchase sync — prove no duplicates');
    const poCountBefore = await prisma.purchaseDocument.count();
    const purchaseSync2 = await integration.runSync(
      new FileDropAdapter('LEGACY_ERP_PURCHASES', 'PURCHASE_DOCUMENT', path.join(SAMPLE_DIR, 'legacy-purchases')),
      purchaseHandler,
    );
    const poCountAfter = await prisma.purchaseDocument.count();
    console.log('Purchase sync (run 2, replay):', purchaseSync2);
    console.log(`Purchase document count unchanged: ${poCountBefore} -> ${poCountAfter} (${poCountBefore === poCountAfter ? 'OK' : 'MISMATCH'})`);

    header('STEP 7c: Record goods receipts against purchase orders');
    const goodsReceipts = app.get(GoodsReceiptsService);
    const po9001 = await prisma.purchaseDocument.findFirst({ where: { documentNumber: 'PO-9001' }, include: { lines: true } });
    const po9002 = await prisma.purchaseDocument.findFirst({ where: { documentNumber: 'PO-9002' }, include: { lines: true } });
    const po9003 = await prisma.purchaseDocument.findFirst({ where: { documentNumber: 'PO-9003' }, include: { lines: true } });

    if (po9001) {
      await goodsReceipts.recordReceipt(po9001.id, {
        receiptNumber: 'GRN-1',
        warehouseId: warehouseIdByCode.get('DSM01-MAIN')!,
        lines: [{ purchaseDocumentLineId: po9001.lines[0].id, quantity: 5, unitCost: 210 }],
      });
      console.log('PO-9001 fully received (5/5)');
    }
    if (po9002) {
      await goodsReceipts.recordReceipt(po9002.id, {
        receiptNumber: 'GRN-2',
        warehouseId: warehouseIdByCode.get('DSM01-MAIN')!,
        lines: [{ purchaseDocumentLineId: po9002.lines[0].id, quantity: 15, unitCost: 45 }],
      });
      console.log('PO-9002 partially received (15/30)');
    }
    if (po9003) {
      await goodsReceipts.recordReceipt(po9003.id, {
        receiptNumber: 'GRN-3',
        warehouseId: warehouseIdByCode.get('DSM01-LUBE')!,
        lines: [{ purchaseDocumentLineId: po9003.lines[0].id, quantity: 40, unitCost: 9500 }],
      });
      console.log('PO-9003 fully received (40/40)');
    }
    console.log('PO-9004 (rare Porsche part, 60d lead time) and PO-9007 (already overdue) left unreceived on purpose.');

    // ---------------------------------------------------------------------
    header('STEP 8a: Sync sales documents — first run');
    // ---------------------------------------------------------------------
    const salesHandler = app.get(SalesDocumentSyncHandler);
    const salesSync1 = await integration.runSync(
      new FileDropAdapter('LEGACY_POS_SALES', 'SALES_DOCUMENT', path.join(SAMPLE_DIR, 'legacy-sales')),
      salesHandler,
    );
    console.log('Sales sync (run 1):', salesSync1);

    header('STEP 8b: Re-run sales sync — prove no duplicates');
    const saleCountBefore = await prisma.salesDocument.count();
    const saleLineCountBefore = await prisma.salesDocumentLine.count();
    const salesSync2 = await integration.runSync(
      new FileDropAdapter('LEGACY_POS_SALES', 'SALES_DOCUMENT', path.join(SAMPLE_DIR, 'legacy-sales')),
      salesHandler,
    );
    const saleCountAfter = await prisma.salesDocument.count();
    const saleLineCountAfter = await prisma.salesDocumentLine.count();
    console.log('Sales sync (run 2, replay):', salesSync2);
    console.log(`Sales document count unchanged: ${saleCountBefore} -> ${saleCountAfter} (${saleCountBefore === saleCountAfter ? 'OK' : 'MISMATCH'})`);
    console.log(`Sales line count unchanged: ${saleLineCountBefore} -> ${saleLineCountAfter} (${saleLineCountBefore === saleLineCountAfter ? 'OK' : 'MISMATCH'})`);

    header('STEP 8c: Introduce a corrected source record — prove it updates safely');
    fs.copyFileSync(
      path.join(SAMPLE_DIR, 'staging', 'sales-correction.ndjson'),
      path.join(SAMPLE_DIR, 'legacy-sales', 'batch-002-correction.ndjson'),
    );
    const invBefore = await ledger.getBalance({ itemType: 'PART', partId: (await prisma.part.findFirst({ where: { oemNumber: '12-13-8-616-153' } }))!.id }, warehouseIdByCode.get('DSM01-MAIN')!);
    const salesSync3 = await integration.runSync(
      new FileDropAdapter('LEGACY_POS_SALES', 'SALES_DOCUMENT', path.join(SAMPLE_DIR, 'legacy-sales')),
      salesHandler,
    );
    console.log('Sales sync (run 3, with correction file present):', salesSync3);
    const correctedLine = await prisma.salesDocumentLine.findFirst({ where: { sourceRecordId: 'sale-0001:1' } });
    console.log(`INV-1001 line quantity after correction: ${correctedLine?.quantity} (expected 5, was 4)`);
    const dqIssues = await prisma.dataQualityIssue.findMany({ where: { checkName: 'sales_line_changed_after_posting' } });
    console.log(`Data-quality issues raised for post-posting line changes: ${dqIssues.length} (ledger intentionally NOT auto-adjusted)`);

    header('STEP 8d: Import invalid records — confirm they land in the right failure path');
    const deadLetters = await integration.listDeadLetters();
    console.log(`Total dead-lettered records across all sources: ${deadLetters.length}`);
    for (const dl of deadLetters) {
      console.log(`  [${dl.entityType}] ${dl.sourceRecordId} — stage=${dl.stage} — ${dl.error}`);
    }
    const unresolvedIssues = await prisma.dataQualityIssue.findMany({ where: { checkName: { in: ['unresolved_customer_reference', 'missing_item_resolution', 'unresolved_supplier_reference'] } } });
    console.log(`Manual-review data-quality issues (unresolved references): ${unresolvedIssues.length}`);

    // ---------------------------------------------------------------------
    header('STEP 9: Ingest app events (search/out-of-stock/quote-abandon/invalid)');
    // ---------------------------------------------------------------------
    const appEvents = app.get(AppEventsService);
    const events = readJson<Array<Record<string, unknown>>>('app-events.json');
    const ingestResult = await appEvents.ingestBatch('LEGACY_POS_WEB', events as never);
    console.log('App event ingest result:', ingestResult);
    const failedEvents = await appEvents.listFailed();
    console.log(`App events dead-lettered: ${failedEvents.length}`);

    // ---------------------------------------------------------------------
    header('STEP 10: Detect lost sales (zero-result / out-of-stock / repeated search)');
    // ---------------------------------------------------------------------
    const lostSalesEngine = app.get(LostSalesEngineService);
    const lostSalesSvc = app.get(LostSalesService);
    const detection = await lostSalesEngine.detect();
    console.log('Lost-sale detection result:', detection);
    const candidates = await lostSalesSvc.list({});
    console.log(`Lost-sale candidates created: ${candidates.length}`);
    for (const c of candidates) {
      console.log(`  [${c.reason}] partId=${c.partId ?? '-'} lubricantId=${c.lubricantProductId ?? '-'} status=${c.status}`);
    }

    header('STEP 10b: Human confirms one candidate, dismisses another');
    if (candidates[0]) {
      await lostSalesSvc.confirm(candidates[0].id, 'user-parts-manager', 'Confirmed — customer walked away, water pump out of stock');
      console.log(`Confirmed candidate ${candidates[0].id}`);
    }
    if (candidates[1]) {
      await lostSalesSvc.dismiss(candidates[1].id, 'user-parts-manager', 'False positive — internal test search');
      console.log(`Dismissed candidate ${candidates[1].id}`);
    }
    const summary = await lostSalesSvc.summary();
    console.log('Lost-sale summary:', summary);

    // ---------------------------------------------------------------------
    header('STEP 11: Recalculate inventory classification and metrics');
    // ---------------------------------------------------------------------
    const analytics = app.get(InventoryAnalyticsService);
    const analyticsResult = await analytics.recalculate();
    console.log('Inventory analytics recalculation:', analyticsResult);
    const metricsSample = await prisma.inventoryItemMetric.findMany({ where: { warehouseId: { not: null } }, include: { part: true, lubricantProduct: true, warehouse: true } });
    for (const m of metricsSample) {
      const name = m.part?.productName ?? m.lubricantProduct?.productName ?? 'unknown';
      console.log(
        `  ${name} @ ${m.warehouse?.code}: available=${m.availableStock} avgDailyDemand=${Number(m.avgDailyDemand).toFixed(3)} movementClass=${m.movementClass} abc=${m.abcClass ?? '-'} xyz=${m.xyzClass ?? '-'} history=${m.historyDays}d sufficient=${m.hasSufficientHistory}`,
      );
    }

    // ---------------------------------------------------------------------
    header('STEP 12: Generate purchase recommendations');
    // ---------------------------------------------------------------------
    const purchaseRecs = app.get(PurchaseRecommendationsService);
    const purchaseGenResult = await purchaseRecs.generate();
    console.log('Purchase recommendation generation:', purchaseGenResult);
    const recs = await purchaseRecs.list({});
    for (const r of recs) {
      const name = r.part?.productName ?? r.lubricantProduct?.productName ?? 'unknown';
      console.log(`  [${r.action}] ${name} @ ${(r as { warehouse?: { code: string } }).warehouse?.code}: qty=${r.suggestedQuantity} confidence=${r.confidence}`);
    }

    // ---------------------------------------------------------------------
    header('STEP 13: Generate transfer recommendations');
    // ---------------------------------------------------------------------
    const transferRecs = app.get(TransferRecommendationsService);
    const transferGenResult = await transferRecs.generate();
    console.log('Transfer recommendation generation:', transferGenResult);
    const transfers = await transferRecs.list({});
    for (const t of transfers) {
      const name = t.part?.productName ?? t.lubricantProduct?.productName ?? 'unknown';
      console.log(`  ${name}: ${(t as { sourceWarehouse?: { code: string } }).sourceWarehouse?.code} -> ${(t as { destinationWarehouse?: { code: string } }).destinationWarehouse?.code} qty=${t.suggestedQuantity}`);
      console.log(`    reason: ${t.reason}`);
    }

    // ---------------------------------------------------------------------
    header('STEP 14-15: Approve one recommendation, reject another');
    // ---------------------------------------------------------------------
    const pendingRecs = recs.filter((r) => r.status === 'PENDING');
    if (pendingRecs[0]) {
      await purchaseRecs.approve(pendingRecs[0].id, 'user-purchasing-manager', 'Approved for next PO batch');
      console.log(`Approved purchase recommendation ${pendingRecs[0].id} (${pendingRecs[0].action})`);
    }
    if (pendingRecs[1]) {
      await purchaseRecs.reject(pendingRecs[1].id, 'user-purchasing-manager', 'Budget constraint this month');
      console.log(`Rejected purchase recommendation ${pendingRecs[1].id} (${pendingRecs[1].action})`);
    }
    if (transfers[0]) {
      await transferRecs.approve(transfers[0].id, 'user-branch-manager', 'Approved inter-branch transfer');
      console.log(`Approved transfer recommendation ${transfers[0].id}`);
    }

    // ---------------------------------------------------------------------
    header('STEP 16: Verify audit records');
    // ---------------------------------------------------------------------
    const auditLogs = await prisma.auditLog.findMany({ orderBy: { occurredAt: 'desc' } });
    console.log(`Total audit log entries: ${auditLogs.length}`);
    for (const a of auditLogs) {
      console.log(`  [${a.action}] entity=${a.entityType}/${a.entityId} actor=${a.actorId ?? '-'}`);
    }

    // ---------------------------------------------------------------------
    header('STEP 17: Supplier analytics');
    // ---------------------------------------------------------------------
    const supplierAnalytics = app.get(SupplierAnalyticsService);
    const supplierResult = await supplierAnalytics.recalculate();
    console.log('Supplier analytics recalculation:', supplierResult);
    const supplierMetrics = await supplierAnalytics.listMetrics();
    for (const m of supplierMetrics) {
      console.log(
        `  ${m.supplier.displayName}: sufficiency=${m.dataSufficiency} avgLeadTime=${m.avgLeadTimeDays ?? '-'} onTime%=${m.onTimeDeliveryPct?.toFixed(1) ?? '-'} fillRate%=${m.fillRatePct?.toFixed(1) ?? '-'} active=${m.activePurchaseOrders} late=${m.latePurchaseOrders}`,
      );
    }
    const late = await supplierAnalytics.listLatePurchaseOrders();
    console.log(`Late purchase orders: ${late.map((l) => l.documentNumber).join(', ')}`);

    header('VERIFICATION WORKFLOW COMPLETE');
    console.log('All steps executed. See output above for evidence of each requirement.');
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error('VERIFICATION SCRIPT FAILED:', err);
  process.exit(1);
});
