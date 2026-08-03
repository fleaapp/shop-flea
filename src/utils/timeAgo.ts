/** Human-friendly relative time helpers shared across listing surfaces. */

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

/** e.g. "2 hours ago", "4 days ago", "1 week ago" */
export const formatTimeAgo = (value?: string | null): string | null => {
  if (!value) return null;
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return null;

  const diff = Math.max(0, Date.now() - then);

  if (diff < MINUTE) return 'Just now';
  if (diff < HOUR) {
    const m = Math.floor(diff / MINUTE);
    return `${m} ${m === 1 ? 'minute' : 'minutes'} ago`;
  }
  if (diff < DAY) {
    const h = Math.floor(diff / HOUR);
    return `${h} ${h === 1 ? 'hour' : 'hours'} ago`;
  }
  if (diff < WEEK) {
    const d = Math.floor(diff / DAY);
    return `${d} ${d === 1 ? 'day' : 'days'} ago`;
  }
  if (diff < 30 * DAY) {
    const w = Math.floor(diff / WEEK);
    return `${w} ${w === 1 ? 'week' : 'weeks'} ago`;
  }
  if (diff < 365 * DAY) {
    const mo = Math.floor(diff / (30 * DAY));
    return `${mo} ${mo === 1 ? 'month' : 'months'} ago`;
  }
  const y = Math.floor(diff / (365 * DAY));
  return `${y} ${y === 1 ? 'year' : 'years'} ago`;
};

/** e.g. "Active today", "Active 3 days ago" */
export const formatLastActive = (value?: string | null): string | null => {
  if (!value) return null;
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return null;

  const diff = Math.max(0, Date.now() - then);
  if (diff < DAY) return 'Active today';
  const ago = formatTimeAgo(value);
  return ago ? `Active ${ago}` : null;
};
