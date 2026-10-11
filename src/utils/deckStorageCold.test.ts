import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCardCatalog } from '../data/cardCatalog';
const code = 'UA/AAA-1-001';
const card = { code, title: 'AAA', titleCode: 'AAA', name: '公式', cardType: 'CHARACTER', color: 'PURPLE', bp: 1000, apCost: 1, reqEnergy: 0, genEnergy: 1, traits: [], triggers: [], effectText: '' };
const raw = { id: 'old', name: '旧デッキ', titleCode: 'WRONG', items: [{ card: { code }, count: 1 }], updatedAt: 1 };
const key = 'union_arena_saved_decks';

describe('saved decks before their title is downloaded', () => {
  let store: Map<string, string>;
  beforeEach(() => {
    store = new Map([[key, JSON.stringify([raw])]]);
    vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) });
    vi.resetModules();
  });
  afterEach(() => { vi.doUnmock('../data/cardDatabase'); vi.unstubAllGlobals(); });
  const setup = async () => {
    const fetcher = vi.fn<typeof fetch>(async (url) => new Response(JSON.stringify(String(url) === '/index' ?
      { version: 'test', shards: [{ id: 'AAA', titles: ['AAA'], codes: [code] }] } : [card])));
    const catalog = createCardCatalog('/index', { AAA: '/AAA' }, []);
    await catalog.loadIndex(fetcher);
    vi.doMock('../data/cardDatabase', () => ({
      CARD_DATABASE: [], getCardMaster: catalog.getCard, requireCardMaster: catalog.requireCard,
      isOfficialCardCode: catalog.isOfficialCode, ensureCardCodes: (codes: string[]) => catalog.ensureCodes(codes, fetcher),
    }));
    return { storage: await import('./deckStorage'), fetcher };
  };
  it('lists a legacy deck without fetching cards or classifying it as corrupt', async () => {
    const { storage, fetcher } = await setup();
    const result = storage.loadSavedDeckSummaries();
    expect(result.decks).toEqual([{ id: 'old', name: '旧デッキ', titleCode: 'WRONG', totalCards: 1, updatedAt: 1 }]);
    expect(result.skippedCount).toBe(0);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(store.get(key)).toBe(JSON.stringify([raw]));
  });
  it('loads a selected legacy deck by card codes rather than its stale titleCode', async () => {
    const { storage, fetcher } = await setup();
    const deck = await storage.loadSavedDeckById('old');
    expect(deck?.items[0].card.name).toBe('公式');
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(store.get(key)).toBe(JSON.stringify([raw]));
  });
  it('does not duplicate or prevent deleting a valid unloaded deck', async () => {
    const { storage } = await setup();
    expect(storage.saveDeck({ ...raw, items: [{ card: card as never, count: 1 }] })).toBe(true);
    expect(JSON.parse(store.get(key)!)).toHaveLength(1);
    store.set(key, JSON.stringify([raw]));
    storage.deleteDeck('old');
    expect(JSON.parse(store.get(key)!)).toEqual([]);
  });
  it('keeps the original storage and rejects selection when the shard fails', async () => {
    const { storage, fetcher } = await setup();
    fetcher.mockRejectedValueOnce(new Error('offline'));
    await expect(storage.loadSavedDeckById('old')).rejects.toThrow();
    expect(store.get(key)).toBe(JSON.stringify([raw]));
    expect((await storage.loadSavedDeckById('old'))?.items[0].card.code).toBe(code);
  });
});
