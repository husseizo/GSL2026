import { GarageJobStatus } from '@prisma/client';
import { assertValidTransition, canTransition, IllegalJobTransitionError, JOB_STATUS_TRANSITIONS } from './job-workflow';

describe('job workflow state machine', () => {
  it('allows the documented happy path from DRAFT to COMPLETED', () => {
    const happyPath: GarageJobStatus[] = [
      GarageJobStatus.DRAFT,
      GarageJobStatus.CHECKED_IN,
      GarageJobStatus.WAITING_INSPECTION,
      GarageJobStatus.INSPECTION_IN_PROGRESS,
      GarageJobStatus.WAITING_ESTIMATE,
      GarageJobStatus.WAITING_CUSTOMER_APPROVAL,
      GarageJobStatus.APPROVED,
      GarageJobStatus.READY_TO_START,
      GarageJobStatus.IN_PROGRESS,
      GarageJobStatus.QUALITY_CONTROL,
      GarageJobStatus.ROAD_TEST,
      GarageJobStatus.READY_FOR_COLLECTION,
      GarageJobStatus.COMPLETED,
    ];

    for (let i = 0; i < happyPath.length - 1; i += 1) {
      expect(canTransition(happyPath[i], happyPath[i + 1])).toBe(true);
    }
  });

  it('rejects skipping a stage (e.g. DRAFT straight to IN_PROGRESS)', () => {
    expect(canTransition(GarageJobStatus.DRAFT, GarageJobStatus.IN_PROGRESS)).toBe(false);
  });

  it('rejects moving backwards through the happy path (e.g. IN_PROGRESS to CHECKED_IN)', () => {
    expect(canTransition(GarageJobStatus.IN_PROGRESS, GarageJobStatus.CHECKED_IN)).toBe(false);
  });

  it('allows QC failure to loop back to IN_PROGRESS for rework', () => {
    expect(canTransition(GarageJobStatus.QUALITY_CONTROL, GarageJobStatus.IN_PROGRESS)).toBe(true);
  });

  it('allows road-test failure to loop back to IN_PROGRESS for rework', () => {
    expect(canTransition(GarageJobStatus.ROAD_TEST, GarageJobStatus.IN_PROGRESS)).toBe(true);
  });

  it('allows a warranty return to reopen at inspection, not check-in', () => {
    expect(canTransition(GarageJobStatus.WARRANTY_RETURN, GarageJobStatus.WAITING_INSPECTION)).toBe(true);
    expect(canTransition(GarageJobStatus.WARRANTY_RETURN, GarageJobStatus.CHECKED_IN)).toBe(false);
  });

  it('treats CANCELLED as terminal — no transitions out', () => {
    expect(JOB_STATUS_TRANSITIONS.CANCELLED).toEqual([]);
  });

  it('allows CANCELLED from every non-terminal status', () => {
    const nonTerminal = Object.values(GarageJobStatus).filter((s) => s !== GarageJobStatus.CANCELLED);
    for (const status of nonTerminal) {
      if (status === GarageJobStatus.COMPLETED) continue; // COMPLETED only goes to WARRANTY_RETURN
      expect(canTransition(status, GarageJobStatus.CANCELLED)).toBe(true);
    }
  });

  it('assertValidTransition throws IllegalJobTransitionError with from/to on an illegal move', () => {
    expect(() => assertValidTransition(GarageJobStatus.DRAFT, GarageJobStatus.COMPLETED)).toThrow(IllegalJobTransitionError);
    try {
      assertValidTransition(GarageJobStatus.DRAFT, GarageJobStatus.COMPLETED);
    } catch (err) {
      expect((err as IllegalJobTransitionError).from).toBe(GarageJobStatus.DRAFT);
      expect((err as IllegalJobTransitionError).to).toBe(GarageJobStatus.COMPLETED);
    }
  });

  it('assertValidTransition does not throw on a legal move', () => {
    expect(() => assertValidTransition(GarageJobStatus.DRAFT, GarageJobStatus.CHECKED_IN)).not.toThrow();
  });

  it('every status referenced as a transition target is a real GarageJobStatus value', () => {
    const allStatuses = new Set(Object.values(GarageJobStatus));
    for (const targets of Object.values(JOB_STATUS_TRANSITIONS)) {
      for (const target of targets) {
        expect(allStatuses.has(target)).toBe(true);
      }
    }
  });
});
