import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CARD_DATABASE } from '../data/cardDatabase';
import { UserDeck } from '../domain/deckValidation';
import {
  deleteDeck,
  exportDeckToJson,
  importDeckFromJson,
  loadSavedDecks,
  saveDeck,
} from './deckStorage';

const STORAGE_KEY = 'union_arena_saved_decks';

function createDeck(overrides: Partial<UserDeck> = {}): UserDeck {
  return {
    id: 'deck-1',
    name: 'テストデッキ',
    titleCode: CARD_DATABASE[0].titleCode,
    items: [{ card: CARD_DATABASE[0], count: 4 }],
    updatedAt: 1,
    ...overrides,
  };
}

describe('deckStorage', () => {
  let store: Map<string, string>;

  beforeEach(() => {
    store = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
      clear: () => store.clear(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('round-trips an exported deck while assigning import metadata', () => {
    vi.spyOn(Date, 'now').mockReturnValue(12345);
    const source = createDeck();

    const imported = importDeckFromJson(exportDeckToJson(source));

    expect(imported).toMatchObject({
      name: source.name,
      titleCode: source.titleCode,
      items: source.items,
      id: 'imported-12345',
      updatedAt: 12345,
    });
  });

  it.each([
    ['null', 'null'],
    ['missing name', JSON.stringify({ titleCode: 'CGH', items: [] })],
    ['missing title code', JSON.stringify({ name: 'deck', items: [] })],
    ['invalid item count', JSON.stringify({ name: 'deck', titleCode: 'CGH', items: [{ card: CARD_DATABASE[0], count: 0 }] })],
    ['missing card data', JSON.stringify({ name: 'deck', titleCode: 'CGH', items: [{ count: 1 }] })],
    ['invalid generated energy plus flag', JSON.stringify({ name: 'deck', titleCode: 'CGH', items: [{ card: { ...CARD_DATABASE[0], hasGenEnergyPlus: 'yes' }, count: 1 }] })],
  ])('rejects structurally invalid imported JSON: %s', (_label, json) => {
    expect(() => importDeckFromJson(json)).toThrow('無効なデッキJSONフォーマットです');
  });

  it('returns a stable Japanese error for malformed JSON syntax', () => {
    expect(() => importDeckFromJson('{broken')).toThrow('JSONの解析に失敗しました。');
  });

  it('creates, updates, and deletes saved decks', () => {
    vi.spyOn(Date, 'now').mockReturnValueOnce(100).mockReturnValueOnce(200);
    saveDeck(createDeck());
    saveDeck(createDeck({ name: '更新後' }));

    expect(loadSavedDecks()).toHaveLength(1);
    expect(loadSavedDecks()[0]).toMatchObject({ id: 'deck-1', name: '更新後', updatedAt: 200 });

    deleteDeck('deck-1');
    expect(loadSavedDecks()).toEqual([]);
    expect(JSON.parse(store.get(STORAGE_KEY) ?? 'null')).toEqual([]);
  });

  it('refreshes stale printed energy in saved and imported official cards', () => {
    const master = CARD_DATABASE.find((card) => card.code === 'UA01BT/CGH-1-001')!;
    const stale = { ...master, genEnergy: 2, hasGenEnergyPlus: false };
    const deck = createDeck({ items: [{ card: stale, count: 4 }] });
    store.set(STORAGE_KEY, JSON.stringify([deck]));

    expect(loadSavedDecks()[0].items[0].card.genEnergy).toBe(1);
    expect(loadSavedDecks()[0].items[0].card.hasGenEnergyPlus).toBe(true);
    expect(importDeckFromJson(JSON.stringify(deck)).items[0].card.genEnergy).toBe(1);
    expect(importDeckFromJson(JSON.stringify(deck)).items[0].card.hasGenEnergyPlus).toBe(true);
  });

  it('returns an empty list when saved data is malformed', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    store.set(STORAGE_KEY, '{broken');

    expect(loadSavedDecks()).toEqual([]);
  });
});
