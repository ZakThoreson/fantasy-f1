export type FreshnessLevel = 'fresh' | 'aging' | 'stale';

/**
 * update-data.yml runs every 6 hours, so "fresh" allows one missed run
 * before dropping to "aging", and "stale" flags data old enough that the
 * scheduled job itself may be broken.
 */
export function freshnessLevel(fetchedAt: string, now: Date = new Date()): FreshnessLevel {
  const ageHours = (now.getTime() - new Date(fetchedAt).getTime()) / 3_600_000;
  if (ageHours < 8) return 'fresh';
  if (ageHours < 24) return 'aging';
  return 'stale';
}

export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const diffMin = Math.round((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;

  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? '' : 's'} ago`;

  const diffDay = Math.round(diffHr / 24);
  return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;
}
