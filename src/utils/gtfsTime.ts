const GTFS_TIME_PATTERN = /^(\d+):([0-5]\d):([0-5]\d)$/;

export function parseGtfsTimeToSeconds(value: string | null): number | null {
  if (value === null) {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed === "") {
    return null;
  }

  const match = GTFS_TIME_PATTERN.exec(trimmed);
  if (!match) {
    throw new Error(`Invalid GTFS time value: ${value}`);
  }

  const [, hoursText, minutesText, secondsText] = match;
  const hours = Number.parseInt(hoursText, 10);
  const minutes = Number.parseInt(minutesText, 10);
  const seconds = Number.parseInt(secondsText, 10);

  return (hours * 60 * 60) + (minutes * 60) + seconds;
}
