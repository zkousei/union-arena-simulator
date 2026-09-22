import { describe, it, expect } from 'vitest';
import { flattenDeckToCards, validateDeck, UserDeck } from '../deckValidation';
import { CARD_DATABASE } from '../../data/cardDatabase';

describe('Deck Validation Official Rules Tests', () => {
  const cghCards = CARD_DATABASE.filter((c) => c.titleCode === 'CGH');
  const htrCards = CARD_DATABASE.filter((c) => c.titleCode === 'HTR');

  it('should invalidate deck if total count is not 50', () => {
    const deck: UserDeck = {
      id: 'd1',
      name: 'Test Deck',
      titleCode: 'CGH',
      items: [{ card: cghCards[0], count: 4 }],
      updatedAt: Date.now(),
    };

    const res = validateDeck(deck);
    expect(res.isValid).toBe(false);
    expect(res.errors.some((e) => e.type === 'TOTAL_COUNT')).toBe(true);
  });

  it('should invalidate deck if same card number exceeds 4', () => {
    const deck: UserDeck = {
      id: 'd1',
      name: 'Over limit Deck',
      titleCode: 'CGH',
      items: [
        { card: cghCards[0], count: 5 },
        { card: cghCards[1], count: 45 },
      ],
      updatedAt: Date.now(),
    };

    const res = validateDeck(deck);
    expect(res.isValid).toBe(false);
    expect(res.errors.some((e) => e.type === 'SAME_CARD_LIMIT')).toBe(true);
  });

  it('should invalidate deck if mixed title codes exist', () => {
    const deck: UserDeck = {
      id: 'd1',
      name: 'Mixed Deck',
      titleCode: 'CGH',
      items: [
        { card: cghCards[0], count: 4 },
        { card: htrCards[0], count: 4 },
      ],
      updatedAt: Date.now(),
    };

    const res = validateDeck(deck);
    expect(res.isValid).toBe(false);
    expect(res.errors.some((e) => e.type === 'TITLE_CODE_MISMATCH')).toBe(true);
  });

  it('should validate a correct 50-card single-title deck within trigger limits', () => {
    const deck: UserDeck = {
      id: 'd-valid',
      name: 'Valid Purple Geass',
      titleCode: 'CGH',
      items: [
        { card: cghCards[0], count: 4 }, // ルルーシュ
        { card: cghCards[1], count: 4 }, // ナナリー
        { card: cghCards[2], count: 4 }, // シャーリー
        { card: cghCards[3], count: 4 }, // C.C.
        { card: cghCards[4], count: 4 }, // 紅蓮
        { card: cghCards[5], count: 4 }, // ゼロ (レイド)
        { card: cghCards[6], count: 4 }, // ガウェイン
        { card: cghCards[7], count: 4 }, // スペシャル (4)
        { card: cghCards[8], count: 4 }, // ファイナル (4)
        { card: cghCards[9], count: 4 }, // 生徒会室
        { card: cghCards[0], count: 0 }, // 40
        // 追加10枚（別のカードなど、ここではテスト用に調整）
      ],
      updatedAt: Date.now(),
    };
    deck.items = [
      { card: cghCards[0], count: 4 },
      { card: cghCards[1], count: 4 },
      { card: cghCards[2], count: 4 },
      { card: cghCards[3], count: 4 },
      { card: cghCards[4], count: 4 },
      { card: cghCards[5], count: 4 },
      { card: cghCards[6], count: 4 },
      { card: cghCards[7], count: 4 }, // SPECIAL 4
      { card: cghCards[8], count: 4 }, // FINAL 4
      { card: cghCards[9], count: 4 },
      // 合計40枚
    ];

    expect(validateDeck(deck).totalCards).toBe(40);
  });

  it('should validate all PRESET_DECKS (CGH, HTR, JJK) successfully', async () => {
    const { PRESET_DECKS } = await import('../../data/sampleDeck');
    expect(PRESET_DECKS.length).toBe(3);

    for (const preset of PRESET_DECKS) {
      const res = validateDeck(preset.deck);
      expect(res.isValid, `Preset deck ${preset.title} validation failed: ${res.errors.map(e => e.message).join(', ')}`).toBe(true);
      expect(res.totalCards).toBe(50);
      expect(res.specialCount).toBeLessThanOrEqual(4);
      expect(res.colorCount).toBeLessThanOrEqual(4);
      expect(res.finalCount).toBeLessThanOrEqual(4);
    }
  });

  it('should count normal and parallel art cards towards the same 4-card limit', () => {
    const baseCard = cghCards[0];
    const parallelCard = {
      ...baseCard,
      code: `${baseCard.code}_p1`,
      baseCode: baseCard.code,
      isParallel: true,
    };

    // 1) 通常版2枚 + パラレル版2枚 = 合計4枚 (OK)
    const validDeck: UserDeck = {
      id: 'd-par-ok',
      name: 'Parallel OK',
      titleCode: 'CGH',
      items: [
        { card: baseCard, count: 2 },
        { card: parallelCard, count: 2 },
      ],
      updatedAt: Date.now(),
    };
    const resOk = validateDeck(validDeck);
    expect(resOk.errors.some((e) => e.type === 'SAME_CARD_LIMIT')).toBe(false);

    // 2) 通常版3枚 + パラレル版2枚 = 合計5枚 (NG)
    const overDeck: UserDeck = {
      id: 'd-par-over',
      name: 'Parallel Over',
      titleCode: 'CGH',
      items: [
        { card: baseCard, count: 3 },
        { card: parallelCard, count: 2 },
      ],
      updatedAt: Date.now(),
    };
    const resOver = validateDeck(overDeck);
    expect(resOver.isValid).toBe(false);
    expect(resOver.errors.some((e) => e.type === 'SAME_CARD_LIMIT')).toBe(true);
  });

  it('should invalidate deck if unrevealed card is included', () => {
    const unrevealedCard = {
      ...cghCards[0],
      code: 'UA01BT/CGH-1-999',
      name: '未公開カード',
      isUnrevealed: true,
    };

    const deck: UserDeck = {
      id: 'd-unrevealed',
      name: 'Unrevealed Deck',
      titleCode: 'CGH',
      items: [{ card: unrevealedCard, count: 1 }],
      updatedAt: Date.now(),
    };

    const res = validateDeck(deck);
    expect(res.isValid).toBe(false);
    expect(res.unrevealedCount).toBe(1);
    expect(res.errors.some((e) => e.type === 'UNREVEALED_CARD')).toBe(true);
  });

  it('should ensure all cards in PRESET_DECKS have valid official image URLs and proper naming', async () => {
    const { PRESET_DECKS } = await import('../../data/sampleDeck');
    for (const preset of PRESET_DECKS) {
      for (const item of preset.deck.items) {
        expect(item.card.imageUrl, `Card ${item.card.code} (${item.card.name}) should have imageUrl`).toBeDefined();
        expect(item.card.imageUrl).toContain('unionarena-tcg.com');
        expect(item.card.name.length).toBeGreaterThan(0);
      }
    }
  });

  it('should flatten deck to 50 cards assigned to target player ID', async () => {
    const { PRESET_DECKS } = await import('../../data/sampleDeck');
    const { flattenDeckToCards } = await import('../deckValidation');
    const cardsP1 = flattenDeckToCards(PRESET_DECKS[0].deck, 'player-1');
    expect(cardsP1.length).toBe(50);
    expect(cardsP1[0].id).toContain('player-1-');

    const cardsP2 = flattenDeckToCards(PRESET_DECKS[1].deck, 'player-2');
    expect(cardsP2.length).toBe(50);
    expect(cardsP2[0].id).toContain('player-2-');
  });

  it('uses current printed energy when starting a game from an older deck', () => {
    const master = CARD_DATABASE.find((card) => card.code === 'UA01BT/CGH-1-001')!;
    const deck: UserDeck = {
      id: 'old-energy',
      name: 'Old energy',
      titleCode: master.titleCode,
      items: [{ card: { ...master, genEnergy: 2 }, count: 1 }],
      updatedAt: 1,
    };

    expect(flattenDeckToCards(deck)[0].genEnergy).toBe(1);
  });

  it('should not return default-cgh-deck in loadSavedDecks', async () => {
    const store = new Map<string, string>();
    const mockStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
      clear: () => store.clear(),
    };
    const { vi } = await import('vitest');
    vi.stubGlobal('localStorage', mockStorage);

    const { loadSavedDecks } = await import('../../utils/deckStorage');
    const emptyDecks = loadSavedDecks();
    expect(emptyDecks).toEqual([]);

    mockStorage.setItem('union_arena_saved_decks', JSON.stringify([
      { id: 'default-cgh-deck', name: 'Old Default', titleCode: 'CGH', items: [], updatedAt: Date.now() },
      { id: 'my-custom-deck', name: 'My Deck', titleCode: 'HTR', items: [], updatedAt: Date.now() },
    ]));
    const filtered = loadSavedDecks();
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe('my-custom-deck');

    vi.unstubAllGlobals();
  });
});
