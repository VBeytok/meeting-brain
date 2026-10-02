// Meeting dates, formatted on the server, so in the server's timezone.

export const dayFormat = new Intl.DateTimeFormat('en', { day: 'numeric' });
export const monthFormat = new Intl.DateTimeFormat('en', { month: 'short' });
export const dateTimeFormat = new Intl.DateTimeFormat('en', {
  weekday: 'short',
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

// `now` is passed in so a page that lists several meetings reads the clock once.
export function isUpcoming(date: string, now: number = Date.now()): boolean {
  return Date.parse(date) > now;
}
