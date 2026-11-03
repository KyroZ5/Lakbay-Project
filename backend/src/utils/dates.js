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

/** Whole calendar days from `fromStr` to `toStr` (both YYYY-MM-DD); negative if `toStr` is earlier. */
export const daysBetweenDateStrs = (fromStr, toStr) => {
  const toUtc = (s) => {
    const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(toStr) - toUtc(fromStr)) / 86400000);
};

/** Add N days to a YYYY-MM-DD date string (timezone-safe, no Date parsing). */
export const addDaysToDateStr = (dateStr, days) => {
  const [y, m, d] = String(dateStr).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + Number(days || 0));
  return dt.toISOString().split('T')[0];
};
