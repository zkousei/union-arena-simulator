import { expect, it } from 'vitest';
// Generator runs as plain Node JavaScript; no runtime app or network dependencies.
// @ts-expect-error JavaScript generator is tested directly.
import { splitCardAssets } from './generate-card-assets.js';
import cards from '../src/data/officialCards.json';
import { isActionPointCardNumber } from '../src/data/cardTypeRules.js';
it('preserves official text BP including the explicitly reviewed dash', () => {
  expect(cards.filter(card => card.cardType === 'CHARACTER' && !card.isUnrevealed && card.code !== 'UAPR/HTR-1-026').every(card => typeof card.bp === 'number' && Number.isFinite(card.bp))).toBe(true);
  expect(cards.find(card => card.code === 'UAPB/GIM-2-004')).toMatchObject({ bp: 1000, hasBpPlus: true });
  expect(cards.find(card => card.code === 'UAPR/HTR-1-026')).toMatchObject({ cardType: 'CHARACTER', bp: null });
});
it('keeps genuine AP cards and excludes promo characters from AP classification', () => {
  expect(cards.filter((card) => card.cardType === 'ACTION_POINT').every((card) => isActionPointCardNumber(card.code))).toBe(true);
  expect(cards.find((card) => card.code === 'UAPR/IMS_AP04')?.cardType).toBe('ACTION_POINT');
  expect(cards.find((card) => card.code === 'UAPR/2023-AP01')?.cardType).toBe('ACTION_POINT');
  expect(cards.find((card) => card.code === 'UAPR/BTR-P-001')?.cardType).toBe('CHARACTER');
  expect(cards.find((card) => card.code === 'UAPR/MMM-1-002')?.cardType).toBe('CHARACTER');
});
it('preserves every field and card exactly once across generated shards', () => {
  const { index, groups } = splitCardAssets(cards);
  const byCode = new Map(Array.from(groups.values()).flat().map((card: { code: string }) => [card.code, card]));
  expect(byCode.size).toBe(cards.length);
  for (const card of cards) expect(byCode.get(card.code)).toEqual(card);
  expect(index.shards.find((s: { id: string }) => s.id === 'OTHER').titles).toContain('アイドルマスター シャイニーカラーズ');
  expect(splitCardAssets(cards).index.version).toBe(index.version);
});
it('rejects duplicate codes and unsafe shard names', () => {
  expect(() => splitCardAssets([cards[0], cards[0]])).toThrow();
  expect(() => splitCardAssets([{ ...cards[0], titleCode: '../escape' }])).toThrow();
});
