import { GarageJobStatus } from '@prisma/client';

// The one place the job state machine is defined — pure, DB-free, unit
// tested exhaustively. See docs/architecture/job-workflow.md.
export const JOB_STATUS_TRANSITIONS: Record<GarageJobStatus, GarageJobStatus[]> = {
  DRAFT: [GarageJobStatus.CHECKED_IN, GarageJobStatus.CANCELLED],
  CHECKED_IN: [GarageJobStatus.WAITING_INSPECTION, GarageJobStatus.CANCELLED],
  WAITING_INSPECTION: [GarageJobStatus.INSPECTION_IN_PROGRESS, GarageJobStatus.CANCELLED],
  INSPECTION_IN_PROGRESS: [GarageJobStatus.WAITING_ESTIMATE, GarageJobStatus.CANCELLED],
  WAITING_ESTIMATE: [GarageJobStatus.WAITING_CUSTOMER_APPROVAL, GarageJobStatus.CANCELLED],
  WAITING_CUSTOMER_APPROVAL: [
    GarageJobStatus.PARTIALLY_APPROVED,
    GarageJobStatus.APPROVED,
    GarageJobStatus.CANCELLED,
  ],
  PARTIALLY_APPROVED: [GarageJobStatus.WAITING_PARTS, GarageJobStatus.READY_TO_START, GarageJobStatus.CANCELLED],
  APPROVED: [GarageJobStatus.WAITING_PARTS, GarageJobStatus.READY_TO_START, GarageJobStatus.CANCELLED],
  WAITING_PARTS: [GarageJobStatus.READY_TO_START, GarageJobStatus.CANCELLED],
  READY_TO_START: [GarageJobStatus.IN_PROGRESS, GarageJobStatus.CANCELLED],
  IN_PROGRESS: [
    GarageJobStatus.PAUSED,
    GarageJobStatus.WAITING_ADDITIONAL_APPROVAL,
    GarageJobStatus.QUALITY_CONTROL,
    GarageJobStatus.CANCELLED,
  ],
  PAUSED: [GarageJobStatus.IN_PROGRESS, GarageJobStatus.CANCELLED],
  WAITING_ADDITIONAL_APPROVAL: [
    GarageJobStatus.IN_PROGRESS,
    GarageJobStatus.PARTIALLY_APPROVED,
    GarageJobStatus.CANCELLED,
  ],
  // QC/road-test failures loop back to IN_PROGRESS rather than being a dead
  // end — rework is a normal outcome, not an error state.
  QUALITY_CONTROL: [GarageJobStatus.ROAD_TEST, GarageJobStatus.IN_PROGRESS, GarageJobStatus.CANCELLED],
  ROAD_TEST: [GarageJobStatus.READY_FOR_COLLECTION, GarageJobStatus.IN_PROGRESS, GarageJobStatus.CANCELLED],
  READY_FOR_COLLECTION: [GarageJobStatus.COMPLETED, GarageJobStatus.CANCELLED],
  COMPLETED: [GarageJobStatus.WARRANTY_RETURN],
  // A warranty return reopens the workflow at inspection, not check-in — the
  // vehicle is already known and received, it needs re-diagnosis.
  WARRANTY_RETURN: [GarageJobStatus.WAITING_INSPECTION, GarageJobStatus.CANCELLED],
  CANCELLED: [],
};

export function canTransition(from: GarageJobStatus, to: GarageJobStatus): boolean {
  return JOB_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

export class IllegalJobTransitionError extends Error {
  constructor(
    public readonly from: GarageJobStatus,
    public readonly to: GarageJobStatus,
  ) {
    super(`Illegal job status transition: ${from} -> ${to}`);
    this.name = 'IllegalJobTransitionError';
  }
}

export function assertValidTransition(from: GarageJobStatus, to: GarageJobStatus): void {
  if (!canTransition(from, to)) {
    throw new IllegalJobTransitionError(from, to);
  }
}
