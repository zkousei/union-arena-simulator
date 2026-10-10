import { expect, it } from 'vitest';
// Generator runs as plain Node JavaScript; no runtime app or network dependencies.
// @ts-expect-error JavaScript generator is tested directly.
import { splitCardAssets } from './generate-card-assets.js';
import cards from '../src/data/officialCards.json';
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
