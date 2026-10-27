// Wall-clock times in the organization's time zone, whatever zone the browser is in.

export type WallTime = { year: number; month: number; day: number; hour: number; minute: number };

const partsFormats = new Map<string, Intl.DateTimeFormat>();

function partsFormat(timeZone: string) {
  let format = partsFormats.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat('en-US', {
      timeZone,
      calendar: 'gregory',
      numberingSystem: 'latn',
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    });
    partsFormats.set(timeZone, format);
  }
  return format;
}

/** The Gregorian wall-clock time an instant shows in a time zone. */
export function wallTime(instant: Date, timeZone: string): WallTime & { second: number } {
  const parts: Record<string, number> = {};
  for (const part of partsFormat(timeZone).formatToParts(instant)) {
    if (part.type !== 'literal') parts[part.type] = Number(part.value);
  }
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
  };
}

function offsetMs(utcMs: number, timeZone: string) {
  const w = wallTime(new Date(utcMs), timeZone);
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/** The instant a wall-clock time in a time zone stands for. */
export function fromWallTime(w: WallTime, timeZone: string): Date {
  const wall = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute);
  // Twice, so a guess on the other side of a clock change corrects itself.
  const first = wall - offsetMs(wall, timeZone);
  return new Date(wall - offsetMs(first, timeZone));
}
