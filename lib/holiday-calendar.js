import 'server-only';
import { unstable_cache } from 'next/cache';
import snapshot from './data/korean-holidays.json';
import { normalizeHolidays } from './holidays.mjs';

const HOLIDAY_URL = 'https://holidays.hyunbin.page/basic.json';

const getLatestHolidays = unstable_cache(
  async () => {
    const response = await fetch(HOLIDAY_URL, {
      cache: 'no-store',
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) throw new Error('Holiday source unavailable');
    return normalizeHolidays(await response.json());
  },
  ['korean-holidays-v1'],
  { revalidate: 3600 },
);

export async function getHolidayCalendar() {
  const fallback = normalizeHolidays(snapshot);
  try {
    const latest = await getLatestHolidays();
    return { dates: { ...fallback, ...latest }, fallback: false };
  } catch {
    return { dates: fallback, fallback: true };
  }
}
