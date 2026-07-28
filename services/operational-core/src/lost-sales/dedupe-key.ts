// Groups repeated log events that describe the *same* latent demand into one
// candidate instead of one row per event — see
// docs/architecture/lost-sales-detection.md §"Deduplication".
export function computeTimeBucket(date: Date, windowMinutes: number): number {
  return Math.floor(date.getTime() / (windowMinutes * 60_000));
}

export function computeLostSaleDedupeKey(params: {
  reason: string;
  itemKey: string;
  sessionOrCustomerKey: string;
  timeBucket: number;
}): string {
  return `${params.reason}:${params.itemKey}:${params.sessionOrCustomerKey}:${params.timeBucket}`;
}
