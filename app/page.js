import MeetingEntry from './meeting-entry';
import { koreaToday } from '../lib/meeting.mjs';
import { getHolidayCalendar } from '../lib/holiday-calendar';
export const dynamic = 'force-dynamic';
export default async function Page() {
  const configured = !!(
    process.env.SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  const holidayCalendar = await getHolidayCalendar();
  return (
    <MeetingEntry
      configured={configured}
      initialDate={koreaToday()}
      holidayCalendar={holidayCalendar}
    />
  );
}
