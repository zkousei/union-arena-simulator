import { expect, it } from 'vitest';
import { collectCardCodes } from '../cardData';
it('collects cards in AP, life, revealed and nested raid/marker zones without mutating state', () => {
  const state = { players: { one: { deck: [{ code: 'AAA' }], life: [{ code: 'BBB' }], apArea: [{ code: 'AP' }], frontLine: [{ code: 'AAA', underCards: [{ code: 'RAID', underCards: [{ code: 'MARKER' }] }] }] } }, revealedCard: { card: { code: 'REVEALED' } } };
  const original = JSON.stringify(state);
  expect(collectCardCodes(state)).toEqual(expect.arrayContaining(['AAA', 'BBB', 'AP', 'RAID', 'MARKER', 'REVEALED']));
  expect(collectCardCodes(state)).toHaveLength(6);
  expect(JSON.stringify(state)).toBe(original);
});
