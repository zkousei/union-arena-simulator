import { describe, expect, it } from 'vitest';
import officialCards from '../officialCards.json';
import { CARD_DATABASE, loadCardDatabase } from '../cardDatabase';
import { getBaseCardCode } from '../../types/card';

describe('asset-backed card database', () => {
  it('preserves every official card and the existing normalization', () => {
    const byCode = new Map(CARD_DATABASE.map((card) => [card.code, card]));
    expect(byCode.size).toBe(CARD_DATABASE.length);
    for (const raw of officialCards) {
      expect(byCode.get(raw.code)).toEqual({
        ...raw,
        baseCode: raw.baseCode || getBaseCardCode(raw.code),
        isParallel: raw.isParallel ?? /_p\d+$/i.test(raw.code),
        isUnrevealed: raw.isUnrevealed ?? (
          /comingsoon/i.test(raw.code) || /comingsoon/i.test(raw.name) ||
          Boolean(raw.imageUrl && /comingsoon/i.test(raw.imageUrl))
        ),
      });
    }
  });

  it('keeps the same published array after repeated loads', async () => {
    const published = CARD_DATABASE;
    const first = CARD_DATABASE[0];
    await loadCardDatabase(() => { throw new Error('must not refetch'); });
    expect(CARD_DATABASE).toBe(published);
    expect(CARD_DATABASE[0]).toBe(first);
  });
});
