// All timestamps are stored and computed in UTC internally (Prisma DateTime
// columns, JS Date). This is the one place a UTC instant is formatted for
// business display in the operating timezone — see
// docs/architecture/phase-2-commercial-foundation.md §1.
export const BUSINESS_TIMEZONE = 'Africa/Dar_es_Salaam';

export function toBusinessTime(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: BUSINESS_TIMEZONE,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}
