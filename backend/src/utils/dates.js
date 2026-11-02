/**
 * Date helpers — business timezone is Asia/Manila (UTC+08:00, no DST).
 * Using an explicit timezone keeps deadlines and "today" comparisons stable
 * regardless of the server's TZ environment.
 */
export const BUSINESS_TZ = 'Asia/Manila';

/** Today's date (YYYY-MM-DD) in the business timezone. */
export const todayInManila = () => {
  // en-CA locale yields YYYY-MM-DD
  return new Date().toLocaleDateString('en-CA', { timeZone: BUSINESS_TZ });
};

/** Add N days to a YYYY-MM-DD date string (timezone-safe, no Date parsing). */
export const addDaysToDateStr = (dateStr, days) => {
  const [y, m, d] = String(dateStr).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + Number(days || 0));
  return dt.toISOString().split('T')[0];
};
