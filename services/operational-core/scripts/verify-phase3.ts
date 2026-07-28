/* eslint-disable no-console */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { TechniciansService } from '../src/technicians/technicians.service';
import { LabourService } from '../src/labour/labour.service';
import { TechnicianTimeLogService } from '../src/labour/technician-time-log.service';
import { ChecklistsService } from '../src/checklists/checklists.service';
import { ReceptionService } from '../src/reception/reception.service';
import { GarageJobsService } from '../src/garage-jobs/garage-jobs.service';
import { InspectionsService } from '../src/inspections/inspections.service';
import { DiagnosticsService } from '../src/diagnostics/diagnostics.service';
import { EstimatesService } from '../src/estimates/estimates.service';
import { GarageInventoryService } from '../src/garage-inventory/garage-inventory.service';
import { QualityControlService } from '../src/quality-control/quality-control.service';
import { RepeatRepairService } from '../src/vehicle-lifecycle/repeat-repair.service';
import { VehicleDigitalTwinService } from '../src/vehicle-lifecycle/digital-twin.service';
import { VehicleTimelineService } from '../src/vehicle-lifecycle/vehicle-timeline.service';
import { WorkshopAnalyticsService } from '../src/workshop-analytics/workshop-analytics.service';
import { NotificationsService } from '../src/notifications/notifications.service';
import { WorkshopInventoryRequestsService } from '../src/workshop-inventory-requests/workshop-inventory-requests.service';
import { IllegalJobTransitionError } from '../src/garage-jobs/job-workflow';
import { InventoryLedgerService } from '../src/inventory/inventory-ledger.service';

function header(title: string) {
  console.log('\n' + '='.repeat(80));
  console.log(title);
  console.log('='.repeat(80));
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const prisma = app.get(PrismaService);

  try {
    header('STEP 0: Load Phase 2 fixtures (vehicle, branch, warehouse, customer, part, lubricant)');
    const vehicle = await prisma.vehicle.findUniqueOrThrow({ where: { vin: 'WBA5A7C50FD123456' } });
    const branch = await prisma.branch.findFirstOrThrow({ where: { code: 'DSM01' } });
    const warehouse = await prisma.warehouse.findFirstOrThrow({ where: { code: 'DSM01-MAIN' } });
    const customer = await prisma.customer.findUniqueOrThrow({ where: { customerCode: 'CUST-1002' } });
    const ignitionCoil = await prisma.part.findFirstOrThrow({ where: { oemNumber: '12-13-8-616-153' } });
    const waterPump = await prisma.part.findFirstOrThrow({ where: { oemNumber: '06H-121-026-CQ' } });
    const engineOil = await prisma.lubricantProduct.findUniqueOrThrow({ where: { internalCode: 'LUB-ENG-5W30-1L' } });
    console.log(`Vehicle: ${vehicle.brand} ${vehicle.model} (${vehicle.vin})`);
    console.log(`Branch: ${branch.code}, Warehouse: ${warehouse.code}, Customer: ${customer.displayName}`);

    header('STEP 1: Seed technicians, skills, labour categories/operations/rates');
    const technicians = app.get(TechniciansService);
    const labour = app.get(LabourService);

    const techAmani = await technicians.create({ employeeCode: 'TECH-001', name: 'Amani Mushi', branchId: branch.id });
    const techJoseph = await technicians.create({ employeeCode: 'TECH-002', name: 'Joseph Kileo', branchId: branch.id });
    await technicians.assignSkill(techAmani.id, { specialization: 'BMW', proficiency: 5 });
    await technicians.assignSkill(techAmani.id, { specialization: 'DIAGNOSTICS', proficiency: 4 });
    await technicians.assignSkill(techJoseph.id, { specialization: 'VAG', proficiency: 4 });
    console.log(`Technicians seeded: ${techAmani.name}, ${techJoseph.name}`);

    const category = await labour.createCategory('Engine & Ignition');
    const ignitionOp = await labour.createOperation({ code: 'LBR-IGN-01', name: 'Replace ignition coil', standardHours: 1.5, categoryId: category.id });
    const diagOp = await labour.createOperation({ code: 'LBR-DIAG-01', name: 'Diagnostic inspection', standardHours: 1, categoryId: category.id });
    await labour.setRate({ labourOperationId: ignitionOp.id, branchId: branch.id, hourlyRate: 25000 });
    await labour.setRate({ labourOperationId: diagOp.id, branchId: branch.id, hourlyRate: 20000 });
    console.log(`Labour operations seeded: ${ignitionOp.name}, ${diagOp.name}`);

    header('STEP 2: Seed checklist + inspection templates');
    const checklists = app.get(ChecklistsService);
    const receptionTemplate = await checklists.createTemplate({
      name: 'Standard Reception Checklist',
      category: 'RECEPTION',
      items: [
        { label: 'Spare wheel present', requiresPhoto: false },
        { label: 'Dashboard warning lights noted', requiresNote: true },
        { label: 'Exterior condition photographed', requiresPhoto: true },
      ],
    });

    const inspections = app.get(InspectionsService);
    const inspectionTemplate = await inspections.createTemplate({
      name: 'General Inspection',
      sections: [
        { name: 'Engine', items: [{ label: 'Ignition system' }, { label: 'Coolant level' }] },
        { name: 'Brakes', items: [{ label: 'Front pads' }, { label: 'Rear pads' }] },
      ],
    });
    console.log('Checklist + inspection templates created');

    header('STEP 3: Vehicle reception (with a deliberately-lower mileage on a 2nd reception to test data-quality)');
    const reception = app.get(ReceptionService);
    const firstReception = await reception.create({
      vehicleId: vehicle.id,
      customerId: customer.id,
      branchId: branch.id,
      mileage: 45000,
      fuelLevel: 'HALF',
      batteryVoltage: 12.6,
      driverName: 'Amina Mrema',
      receptionNotes: 'Customer reports engine noise on startup',
      conditions: [{ area: 'TYRE_FRONT_LEFT', condition: 'Worn', note: 'Replace soon' }],
      complaints: [{ description: 'Engine noise on startup' }],
      accessories: [{ description: 'Phone charger cable' }],
    });
    console.log(`Reception created: ${firstReception.id}, mileage ${firstReception.mileage}`);

    const lowerMileageReception = await reception.create({
      vehicleId: vehicle.id,
      branchId: branch.id,
      mileage: 44000, // lower than 45000 -> impossible_mileage_decrease flag
    });
    console.log(`Second reception created with LOWER mileage (${lowerMileageReception.mileage}) to trigger data-quality flag`);

    await checklists.submitResponse({
      templateId: receptionTemplate.id,
      entityType: 'VehicleReception',
      entityId: firstReception.id,
      completedById: 'user-reception',
      items: receptionTemplate.items.map((item) => ({ templateItemId: item.id, status: 'PASS' as const })),
    });
    console.log('Reception checklist submitted');

    header('STEP 4: Create garage job + duplicate-job-card check + illegal-transition rejection');
    const jobs = app.get(GarageJobsService);
    const job = await jobs.create({
      vehicleId: vehicle.id,
      customerId: customer.id,
      receptionId: firstReception.id,
      branchId: branch.id,
      warehouseId: warehouse.id,
      mileageAtCheckIn: 45000,
    });
    console.log(`Job created: ${job.jobNumber} (status ${job.status})`);

    const duplicateJob = await jobs.create({ vehicleId: vehicle.id, branchId: branch.id }); // triggers duplicate_job_card flag
    console.log(`Duplicate job card created deliberately: ${duplicateJob.jobNumber} (data-quality flag expected)`);

    try {
      await jobs.transition(job.id, { newStatus: 'IN_PROGRESS' }); // illegal: DRAFT -> IN_PROGRESS
      console.log('ERROR: illegal transition was NOT rejected');
    } catch (err) {
      console.log(`Illegal transition correctly rejected: ${(err as IllegalJobTransitionError).message}`);
    }

    await jobs.transition(job.id, { newStatus: 'CHECKED_IN', changedById: 'user-reception', reason: 'Vehicle checked in' });
    await jobs.transition(job.id, { newStatus: 'WAITING_INSPECTION', changedById: 'user-reception' });
    await jobs.transition(job.id, { newStatus: 'INSPECTION_IN_PROGRESS', changedById: techAmani.id });
    console.log(`Job transitioned to ${(await jobs.findById(job.id)).status}`);

    await jobs.assignTechnician(job.id, techAmani.id, 'TECHNICIAN', 'user-supervisor');
    console.log(`Technician ${techAmani.name} assigned to job`);

    header('STEP 5: Record inspection results');
    const templateWithItems = await prisma.inspectionTemplate.findUniqueOrThrow({
      where: { id: inspectionTemplate.id },
      include: { sections: { include: { items: true } } },
    });
    const engineSection = templateWithItems.sections.find((s) => s.name === 'Engine')!;
    const ignitionItem = engineSection.items.find((i) => i.label === 'Ignition system')!;
    const coolantItem = engineSection.items.find((i) => i.label === 'Coolant level')!;

    await inspections.recordResult(job.id, {
      itemId: ignitionItem.id,
      finding: 'FAIL',
      severity: 'HIGH',
      recommendedAction: 'Replace ignition coil',
      estimatedLabourHours: 1.5,
      requiredPartId: ignitionCoil.id,
      inspectedById: techAmani.id,
      note: 'Misfire detected on cylinder 3',
    });
    await inspections.recordResult(job.id, { itemId: coolantItem.id, finding: 'PASS', inspectedById: techAmani.id });
    console.log('Inspection results recorded (1 FAIL requiring ignition coil, 1 PASS)');

    header('STEP 6: Diagnostic session with DTC, symptom, suspected + confirmed cause');
    const diagnostics = app.get(DiagnosticsService);
    const session = await diagnostics.createSession({ jobId: job.id, technicianId: techAmani.id, notes: 'Scan tool connected' });
    await diagnostics.addCode(session.id, { code: 'P0301', source: 'GENERIC_OBD', description: 'Cylinder 3 misfire detected' });
    await diagnostics.addSymptom(session.id, 'Rough idle on cold start', 'TECHNICIAN');
    const cause = await diagnostics.addSuspectedCause(session.id, 'Faulty ignition coil on cylinder 3');
    await diagnostics.confirmCause(cause.id, techAmani.id);
    await diagnostics.recordProcedure(session.id, ['Connected OBD scanner', 'Read DTCs', 'Visual inspection of ignition coils']);
    await diagnostics.completeSession(session.id);
    console.log('Diagnostic session completed: P0301 confirmed -> faulty ignition coil');

    await jobs.transition(job.id, { newStatus: 'WAITING_ESTIMATE', changedById: techAmani.id });

    header('STEP 7: Estimate with partial approval');
    const estimates = app.get(EstimatesService);
    const estimate = await estimates.create({
      jobId: job.id,
      createdById: 'user-service-advisor',
      lines: [
        { lineType: 'LABOUR', description: 'Replace ignition coil (labour)', quantity: 1.5, unitPrice: 25000 },
        { lineType: 'PART', description: 'Ignition Coil BMW N20 N26', partId: ignitionCoil.id, quantity: 1, unitPrice: 85000 },
        { lineType: 'LUBRICANT', description: 'Top-up engine oil', lubricantProductId: engineOil.id, quantity: 1, unitPrice: 14000 },
      ],
    });
    console.log(`Estimate ${estimate.estimateNumber} created — grand total ${estimate.grandTotal}`);

    const approvalRequest = await estimates.sendForApproval(estimate.id);
    await jobs.transition(job.id, { newStatus: 'WAITING_CUSTOMER_APPROVAL', changedById: 'user-service-advisor' });

    const respondedEstimate = await estimates.findById(estimate.id);
    const labourLine = respondedEstimate.lines.find((l) => l.lineType === 'LABOUR')!;
    const partLine = respondedEstimate.lines.find((l) => l.lineType === 'PART')!;
    const lubricantLine = respondedEstimate.lines.find((l) => l.lineType === 'LUBRICANT')!;
    await estimates.respond(approvalRequest.id, {
      respondedByName: customer.displayName,
      actorId: 'customer-portal',
      note: 'Approved labour and part, declined the oil top-up',
      lineDecisions: [
        { estimateLineId: labourLine.id, decision: 'APPROVED' },
        { estimateLineId: partLine.id, decision: 'APPROVED' },
        { estimateLineId: lubricantLine.id, decision: 'REJECTED' },
      ],
    });
    const finalEstimate = await estimates.findById(estimate.id);
    console.log(`Estimate status after partial approval: ${finalEstimate.status}`);

    await jobs.transition(job.id, { newStatus: 'PARTIALLY_APPROVED', changedById: 'user-service-advisor' });
    await jobs.transition(job.id, { newStatus: 'WAITING_PARTS', changedById: 'user-service-advisor' });

    header('STEP 8: Reserve parts through the Inventory Ledger (+ duplicate-reservation check)');
    const garageInventory = app.get(GarageInventoryService);
    const { reservation, line: partLineOnJob } = await garageInventory.reservePart(job.id, {
      itemType: 'PART',
      partId: ignitionCoil.id,
      warehouseId: warehouse.id,
      quantity: 1,
      description: 'Ignition Coil BMW N20 N26',
      unitPrice: 85000,
    });
    console.log(`Reserved 1x ignition coil — reservation ${reservation.id}`);

    await garageInventory.reservePart(job.id, {
      itemType: 'PART',
      partId: ignitionCoil.id,
      warehouseId: warehouse.id,
      quantity: 1,
      description: 'Ignition Coil BMW N20 N26 (duplicate on purpose)',
    });
    console.log('Reserved the SAME item again deliberately (duplicate_reservation flag expected)');

    await jobs.transition(job.id, { newStatus: 'READY_TO_START', changedById: 'user-storekeeper' });
    await jobs.transition(job.id, { newStatus: 'IN_PROGRESS', changedById: techAmani.id });

    header('STEP 9: Technician time logging (+ overlapping-assignment check)');
    const timeLogs = app.get(TechnicianTimeLogService);
    const timeLog = await timeLogs.start({ jobId: job.id, technicianId: techAmani.id, labourOperationId: ignitionOp.id });
    console.log(`Time log started for ${techAmani.name}`);

    const overlappingLog = await timeLogs.start({ jobId: job.id, technicianId: techAmani.id, labourOperationId: diagOp.id });
    console.log('Started a SECOND time log for the same technician while the first is open (overlapping_technician_assignment flag expected)');
    await timeLogs.end(overlappingLog.id);

    await timeLogs.pause(timeLog.id);
    await timeLogs.resume(timeLog.id);
    const endedLog = await timeLogs.end(timeLog.id);
    console.log(`Time log ended — actual minutes logged: ${endedLog.actualMinutes}`);

    // Records the actual labour performed as a GarageJobLine (distinct from
    // the Estimate's labour line, which is the pre-sale quote) — this is what
    // feeds "most common repairs" and "labour revenue" in workshop analytics.
    await jobs.addLine(job.id, {
      lineType: 'LABOUR',
      description: 'Replace ignition coil (labour)',
      labourOperationId: ignitionOp.id,
      quantity: 1.5,
      unitPrice: 25000,
    });
    console.log('Labour line recorded on the job (feeds labour revenue + common-repairs analytics)');

    header('STEP 10: Issue the reserved part, return an unused unit');
    const movement = await garageInventory.issue(partLineOnJob.id);
    console.log(`Part issued via ledger — movement ${movement.id}, type ${movement.movementType}`);

    const ledger = app.get(InventoryLedgerService);
    const balanceAfterIssue = await ledger.getBalance({ itemType: 'PART', partId: ignitionCoil.id }, warehouse.id);
    console.log(`Ignition coil balance at ${warehouse.code} after issue: available=${balanceAfterIssue.available}`);

    header('STEP 11: Quality control, road test, customer-ready approval');
    const qc = app.get(QualityControlService);
    await jobs.transition(job.id, { newStatus: 'QUALITY_CONTROL', changedById: techAmani.id });
    const qcInspection = await qc.createInspection({
      jobId: job.id,
      inspectorId: techJoseph.id,
      result: 'PASS',
      notes: 'No leaks, no warning lights',
    });
    console.log(`QC inspection recorded: ${qcInspection.result}`);

    await jobs.transition(job.id, { newStatus: 'ROAD_TEST', changedById: techJoseph.id });
    await qc.createRoadTest({ jobId: job.id, driverId: techJoseph.id, distanceKm: 8.5, result: 'PASS', notes: 'Smooth idle, no misfire' });
    console.log('Road test recorded: PASS');

    await jobs.transition(job.id, { newStatus: 'READY_FOR_COLLECTION', changedById: 'user-service-advisor' });
    await qc.createApproval(job.id, 'user-service-advisor', 'Vehicle ready for customer collection');

    // Convert the approved estimate lines into a real invoice — reuses the
    // Sales domain (SalesDocument) rather than a parallel invoicing system.
    // This is what makes the Digital Twin's cost-of-ownership figure real.
    const invoice = await estimates.convertToInvoice(estimate.id, { branchId: branch.id, warehouseId: warehouse.id });
    console.log(`Invoice ${invoice.documentNumber} created from approved estimate lines — grand total ${invoice.grandTotal}`);

    await jobs.transition(job.id, { newStatus: 'COMPLETED', changedById: 'user-service-advisor', reason: 'Customer collected vehicle' });
    console.log(`Job ${job.jobNumber} marked COMPLETED`);

    header('STEP 12: Missing-QC / missing-road-test / missing-estimate-approval check on the duplicate job');
    // The duplicate job created in step 4 has no inspection, no QC, no road
    // test, no estimate — pushing it to READY_FOR_COLLECTION should flag all three.
    await jobs.transition(duplicateJob.id, { newStatus: 'CHECKED_IN' });
    await jobs.transition(duplicateJob.id, { newStatus: 'WAITING_INSPECTION' });
    await jobs.transition(duplicateJob.id, { newStatus: 'INSPECTION_IN_PROGRESS' });
    await jobs.transition(duplicateJob.id, { newStatus: 'WAITING_ESTIMATE' });
    await jobs.transition(duplicateJob.id, { newStatus: 'WAITING_CUSTOMER_APPROVAL' });
    await jobs.transition(duplicateJob.id, { newStatus: 'APPROVED' });
    await jobs.transition(duplicateJob.id, { newStatus: 'READY_TO_START' });
    await jobs.transition(duplicateJob.id, { newStatus: 'IN_PROGRESS' });
    await jobs.transition(duplicateJob.id, { newStatus: 'QUALITY_CONTROL' });
    await jobs.transition(duplicateJob.id, { newStatus: 'ROAD_TEST' });
    await jobs.transition(duplicateJob.id, { newStatus: 'READY_FOR_COLLECTION' }); // triggers all 3 missing-* flags
    console.log('Pushed the duplicate job to READY_FOR_COLLECTION with no QC/road-test/estimate — flags expected');

    header('STEP 13: Repeat-repair detection (second job, same vehicle, same DTC + same part)');
    const repeatRepair = app.get(RepeatRepairService);
    const secondJob = await jobs.create({ vehicleId: vehicle.id, branchId: branch.id, customerId: customer.id, mileageAtCheckIn: 45800 });
    const secondSession = await diagnostics.createSession({ jobId: secondJob.id });
    await diagnostics.addCode(secondSession.id, { code: 'P0301', source: 'GENERIC_OBD', description: 'Cylinder 3 misfire again' });
    await jobs.addLine(secondJob.id, {
      lineType: 'PART',
      description: 'Ignition Coil BMW N20 N26 (again)',
      partId: ignitionCoil.id,
      quantity: 1,
      unitPrice: 85000,
    });
    const detection = await repeatRepair.detectForJob(secondJob.id);
    console.log(`Repeat-repair detection on job ${secondJob.jobNumber}: ${detection.flagsCreated} flag(s) created`);
    const flags = await repeatRepair.listForVehicle(vehicle.id);
    for (const flag of flags) {
      console.log(`  [${flag.matchReason}] status=${flag.status} relatedJobId=${flag.relatedJobId}`);
    }
    if (flags[0]) {
      await repeatRepair.resolve(flags[0].id, 'CONFIRMED', 'user-garage-manager', 'Same coil failed again — confirmed repeat repair');
      console.log(`Flag ${flags[0].id} resolved as CONFIRMED`);
    }

    header('STEP 14: Vehicle Digital Twin');
    const digitalTwin = app.get(VehicleDigitalTwinService);
    const twin = await digitalTwin.getDigitalTwin(vehicle.id);
    console.log(`Digital twin for ${twin.identity.brand} ${twin.identity.model} (${twin.identity.vin}):`);
    console.log(`  Repair history: ${twin.repairHistory.length} job(s)`);
    console.log(`  DTC history: ${twin.dtcHistory.length} code(s) — ${twin.dtcHistory.map((c) => c.code).join(', ')}`);
    console.log(`  Parts replaced: ${twin.partsReplaced.length}`);
    console.log(`  Lubricants used: ${twin.lubricantsUsed.length}`);
    console.log(`  Technicians involved: ${twin.techniciansInvolved.map((t) => t.name).join(', ')}`);
    console.log(`  Cost of ownership: ${JSON.stringify(twin.costOfOwnership)}`);
    console.log(`  Repeat-repair flags: ${twin.repeatRepairFlags.length}`);
    console.log(`  Health score / confidence: ${twin.healthScore} / ${twin.aiConfidenceScore} (Phase 4 Digital Twin Intelligence — see verify-phase4.ts for the full breakdown)`);

    header('STEP 15: Vehicle Timeline');
    const timelineSvc = app.get(VehicleTimelineService);
    const timelineEntries = await timelineSvc.getTimeline(vehicle.id);
    console.log(`Timeline has ${timelineEntries.length} entries (chronological):`);
    for (const entry of timelineEntries.slice(0, 15)) {
      console.log(`  [${entry.occurredAt.toISOString()}] ${entry.eventType}: ${entry.description}`);
    }

    header('STEP 16: Workshop analytics dashboard');
    const analytics = app.get(WorkshopAnalyticsService);
    console.log('Dashboard:', await analytics.getDashboard(branch.id));
    console.log('Average repair duration (hours):', await analytics.getAverageRepairDurationHours(branch.id));
    console.log('Labour revenue:', await analytics.getLabourRevenue(branch.id));
    console.log('Most common repairs:', await analytics.getMostCommonRepairs(branch.id));
    console.log('Parts consumed:', await analytics.getPartsConsumed(branch.id));
    console.log('Technician utilization (Amani):', await analytics.getTechnicianUtilization(techAmani.id));
    console.log('Delayed jobs:', (await analytics.getDelayedJobs(branch.id)).length);

    header('STEP 17: Workshop inventory request linked to Phase 2 recommendation engines');
    const workshopRequests = app.get(WorkshopInventoryRequestsService);
    const request = await workshopRequests.create({
      jobId: job.id,
      itemType: 'PART',
      partId: waterPump.id,
      warehouseId: warehouse.id,
      quantity: 2,
      requestType: 'URGENT_PROCUREMENT',
      requestedById: techAmani.id,
    });
    const linked = await workshopRequests.linkToRecommendations(request.id);
    console.log(`Workshop inventory request ${request.id} status after linking: ${linked.status}`);

    header('STEP 18: Notifications');
    const notifications = app.get(NotificationsService);
    const overdueResult = await notifications.flagOverdueJobs();
    console.log('Overdue-job scan:', overdueResult);
    const allNotifications = await notifications.list({});
    console.log(`Total notifications generated: ${allNotifications.length}`);
    for (const n of allNotifications.slice(0, 10)) {
      console.log(`  [${n.eventType}] ${n.message}`);
    }
    if (allNotifications[0]) {
      await notifications.markRead(allNotifications[0].id);
      console.log(`Marked notification ${allNotifications[0].id} as read`);
    }

    header('STEP 19: Data-quality issues raised across this run (proof each check fired)');
    const phase3CheckNames = [
      'impossible_mileage_decrease',
      'duplicate_job_card',
      'duplicate_reservation',
      'overlapping_technician_assignment',
      'missing_quality_control',
      'missing_road_test',
      'missing_estimate_approval',
    ];
    for (const checkName of phase3CheckNames) {
      const count = await prisma.dataQualityIssue.count({ where: { checkName } });
      console.log(`  ${checkName}: ${count} issue(s) recorded`);
    }

    header('PHASE 3 VERIFICATION WORKFLOW COMPLETE');
    console.log('All steps executed. See output above for evidence of each requirement.');
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error('PHASE 3 VERIFICATION SCRIPT FAILED:', err);
  process.exit(1);
});
