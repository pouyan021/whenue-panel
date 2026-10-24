const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const date = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

export function formatDateTime(iso: string) {
  return dateTime.format(new Date(iso));
}

export function formatDate(iso: string) {
  return date.format(new Date(iso));
}

/** Value for an <input type="datetime-local"> in the browser's time zone. */
export function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** An <input type="datetime-local"> value as an ISO instant, or null when empty. */
export function fromLocalInput(value: string) {
  return value ? new Date(value).toISOString() : null;
}

export function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return 'Something went wrong';
}
