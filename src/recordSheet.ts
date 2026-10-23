export interface RecordSlot<T> {
  number: number;
  item: T | null;
}

const minimumCount = (minimum: number) => Number.isFinite(minimum) ? Math.max(0, Math.floor(minimum)) : 0;

/** Number the existing records without turning the starting quantity into a limit. */
export function recordSlots<T>(items: readonly T[], minimum = 3): RecordSlot<T>[] {
  return Array.from({ length: Math.max(items.length, minimumCount(minimum)) }, (_, index) => ({
    number: index + 1,
    item: index < items.length ? items[index] : null,
  }));
}

/** Blank lines are unfinished positions, rather than disposable separators. */
export function setupEntries(value: string, minimum = 3): string[] {
  const entries = value.split(/\r?\n/);
  while (entries.length < minimumCount(minimum)) entries.push('');
  return entries;
}

export function updateSetupEntry(value: string, index: number, text: string, minimum = 3): string {
  if (!Number.isSafeInteger(index) || index < 0) throw new RangeError('기록 칸의 위치가 올바르지 않습니다.');
  const entries = setupEntries(value, Math.max(minimumCount(minimum), index + 1));
  entries[index] = text;
  return entries.join('\n');
}

/** Keep the original save format while exposing stationarity as a separate control. */
export function parseSetupResource(line: string): { name: string; stationary: boolean } {
  const marker = /^[ \t]*\[정착\] ?/.exec(line);
  return { name: marker ? line.slice(marker[0].length) : line, stationary: !!marker };
}

export function formatSetupResource(name: string, stationary: boolean): string {
  return stationary ? `[정착] ${name}` : name;
}
