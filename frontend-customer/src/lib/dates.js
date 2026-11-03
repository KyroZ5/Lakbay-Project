// Business dates are Philippine calendar days (Asia/Manila, UTC+8, no DST),
// matching the backend's todayInManila(). Avoid `new Date('YYYY-MM-DD')`, which parses as UTC.

/** Today's date in Manila as 'YYYY-MM-DD'. */
export const todayInManila = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date()
  );

const toUtcDays = (dateStr) => {
  const [y, m, d] = String(dateStr).slice(0, 10).split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
};

/** Whole calendar days from today (Manila) until `dateStr`; negative once it has passed. NaN if invalid. */
export const daysUntil = (dateStr) => (dateStr ? toUtcDays(dateStr) - toUtcDays(todayInManila()) : NaN);
