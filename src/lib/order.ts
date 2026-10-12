/**
 * Fractional indexing helpers for drag-and-drop ordering.
 * Base step is 1000; inserts use (prev + next) / 2.
 */

export const ORDER_STEP = 1000;
const MIN_GAP = 1e-6;

export function orderForEnd(maxOrder: number | null | undefined): number {
  if (maxOrder == null) return ORDER_STEP;
  return maxOrder + ORDER_STEP;
}

/** Compute the order value for inserting between prev and next. */
export function orderBetween(
  prev: number | null | undefined,
  next: number | null | undefined
): number {
  if (prev == null && next == null) return ORDER_STEP;
  if (prev == null) return (next as number) - ORDER_STEP;
  if (next == null) return prev + ORDER_STEP;
  return (prev + next) / 2;
}

/** True when neighbours are too close and the column needs renormalization. */
export function needsRenormalize(prev: number | null, next: number | null): boolean {
  if (prev == null || next == null) return false;
  return next - prev < MIN_GAP;
}

/** Reassign 1000, 2000, ... preserving the given document order. */
export function renormalizedOrders(count: number): number[] {
  return Array.from({ length: count }, (_, i) => (i + 1) * ORDER_STEP);
}
