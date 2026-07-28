import { InventoryMovementType, MovementDirection } from '@prisma/client';

export type BalanceBucket = 'onHand' | 'reserved' | 'damaged' | 'quarantined';

// The one place that defines what each movement type does to the balance
// projection. DAMAGE/QUARANTINE move stock out of onHand AND into a secondary
// bucket in the same movement — everything else touches exactly one bucket.
// See docs/architecture/inventory-ledger.md.
const PRIMARY_BUCKET: Record<InventoryMovementType, BalanceBucket> = {
  OPENING_BALANCE: 'onHand',
  PURCHASE_RECEIPT: 'onHand',
  SALE_ISSUE: 'onHand',
  GARAGE_ISSUE: 'onHand',
  CUSTOMER_RETURN: 'onHand',
  SUPPLIER_RETURN: 'onHand',
  TRANSFER_OUT: 'onHand',
  TRANSFER_IN: 'onHand',
  RESERVATION: 'reserved',
  RESERVATION_RELEASE: 'reserved',
  ADJUSTMENT_IN: 'onHand',
  ADJUSTMENT_OUT: 'onHand',
  DAMAGE: 'onHand',
  QUARANTINE: 'onHand',
  WARRANTY_ISSUE: 'onHand',
  WARRANTY_RETURN: 'onHand',
  STOCK_COUNT_CORRECTION: 'onHand',
};

const SECONDARY_BUCKET: Partial<Record<InventoryMovementType, BalanceBucket>> = {
  DAMAGE: 'damaged',
  QUARANTINE: 'quarantined',
};

// Movement types whose direction is fixed by definition — postMovement()
// validates the caller passed the expected direction for these rather than
// silently trusting it, since getting DAMAGE backwards would corrupt onHand.
const FIXED_DIRECTION: Partial<Record<InventoryMovementType, MovementDirection>> = {
  OPENING_BALANCE: MovementDirection.IN,
  PURCHASE_RECEIPT: MovementDirection.IN,
  SALE_ISSUE: MovementDirection.OUT,
  GARAGE_ISSUE: MovementDirection.OUT,
  CUSTOMER_RETURN: MovementDirection.IN,
  SUPPLIER_RETURN: MovementDirection.OUT,
  TRANSFER_OUT: MovementDirection.OUT,
  TRANSFER_IN: MovementDirection.IN,
  RESERVATION: MovementDirection.IN,
  RESERVATION_RELEASE: MovementDirection.OUT,
  DAMAGE: MovementDirection.OUT,
  QUARANTINE: MovementDirection.OUT,
  WARRANTY_ISSUE: MovementDirection.OUT,
  WARRANTY_RETURN: MovementDirection.IN,
  // ADJUSTMENT_IN/OUT and STOCK_COUNT_CORRECTION: direction is meaningful and
  // caller-supplied both ways, so intentionally not fixed here.
};

export interface BalanceDelta {
  onHand: number;
  reserved: number;
  damaged: number;
  quarantined: number;
}

export function expectedDirection(movementType: InventoryMovementType): MovementDirection | undefined {
  return FIXED_DIRECTION[movementType];
}

export function computeBalanceDelta(
  movementType: InventoryMovementType,
  direction: MovementDirection,
  quantity: number,
): BalanceDelta {
  const signedQty = direction === MovementDirection.IN ? quantity : -quantity;
  const delta: BalanceDelta = { onHand: 0, reserved: 0, damaged: 0, quarantined: 0 };

  const primary = PRIMARY_BUCKET[movementType];
  delta[primary] += signedQty;

  const secondary = SECONDARY_BUCKET[movementType];
  if (secondary) {
    // DAMAGE/QUARANTINE: stock leaves onHand (already applied above via
    // primary bucket with a negative signedQty) and lands in the secondary
    // bucket as a positive quantity, regardless of the movement's own sign.
    delta[secondary] += quantity;
  }

  return delta;
}

export function computeAvailable(balance: {
  onHand: number;
  reserved: number;
  damaged: number;
  quarantined: number;
}): number {
  // incoming/inTransit are deliberately excluded — see
  // docs/architecture/inventory-ledger.md §"Available stock invariant".
  return balance.onHand - balance.reserved - balance.quarantined - balance.damaged;
}
