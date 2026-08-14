export interface HoursRange {
  open: string;
  close: string;
}

export interface DisplayHours extends HoursRange {
  range: string;
}

const displayTime = (value: string) => value.replace(/^0(?=\d:)/, '');

/** Primary public hours, formatted once for conversion copy and metadata. */
export function getRegularHours(hours: readonly HoursRange[]): DisplayHours | null {
  const primary = hours[0];
  if (!primary) return null;

  const open = displayTime(primary.open);
  const close = displayTime(primary.close);
  return { open, close, range: `${open}–${close}` };
}
