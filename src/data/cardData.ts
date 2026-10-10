import { ensureCardCodes } from './cardDatabase';

/** Includes AP cards, revealed cards and nested raid/marker cards without changing them. */
export function collectCardCodes(value: unknown): string[] {
  const pending: unknown[] = [value];
  const visited = new Set<object>();
  const codes = new Set<string>();
  while (pending.length) {
    const item = pending.pop();
    if (!item || typeof item !== 'object' || visited.has(item)) continue;
    visited.add(item);
    if (Array.isArray(item)) { pending.push(...item); continue; }
    const record = item as Record<string, unknown>;
    if (typeof record.code === 'string') codes.add(record.code);
    pending.push(...Object.values(record));
  }
  return [...codes];
}
export async function ensureCardData(value: unknown): Promise<void> {
  await ensureCardCodes(collectCardCodes(value));
}
