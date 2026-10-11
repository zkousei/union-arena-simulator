import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  extractDeckCode,
  mapBandaiDeckToDeckItems,
  fetchBandaiDeckRecipe,
  BandaiDeckCardRaw,
} from '../bandaiTcgPlusService';
import { CardMaster } from '../../data/cardDatabase';
import officialCards from '../../data/officialCards.json';
import madokaRecipe from './fixtures/tcg-plus-madoka-recipe.json';

describe('bandaiTcgPlusService', () => {
  describe('extractDeckCode', () => {
    it('extracts deck code from full URL', () => {
      const url = 'https://www.bandai-tcg-plus.com/deck_code_recipe/lFv8V8TK9AD3EvVn';
      expect(extractDeckCode(url)).toBe('lFv8V8TK9AD3EvVn');
    });

    it('extracts deck code from URL with trailing slash or query params', () => {
      const url = 'https://www.bandai-tcg-plus.com/deck_code_recipe/lFv8V8TK9AD3EvVn/?player_name=test';
      expect(extractDeckCode(url)).toBe('lFv8V8TK9AD3EvVn');
    });

    it('extracts deck code when user inputs code directly', () => {
      expect(extractDeckCode('lFv8V8TK9AD3EvVn')).toBe('lFv8V8TK9AD3EvVn');
      expect(extractDeckCode('  lFv8V8TK9AD3EvVn  ')).toBe('lFv8V8TK9AD3EvVn');
    });

    it('returns null for empty or invalid strings', () => {
      expect(extractDeckCode('')).toBeNull();
      expect(extractDeckCode('   ')).toBeNull();
      expect(extractDeckCode('https://example.com/other')).toBeNull();
    });
  });

  describe('mapBandaiDeckToDeckItems', () => {
    const raw = (card_number: string): BandaiDeckCardRaw => ({
      id: 1, code: 'fixture', card_number, card_name: '黒崎 一護', card_count: 2,
      image_url: '', cost: '0', color: '青', type: 'キャラクター',
    });
    const mockCardPool: CardMaster[] = [
      {
        code: 'EX07BT/BLC-2-016',
        baseCode: 'EX07BT/BLC-2-016',
        name: '黒崎 一護',
        title: 'BLEACH 千年血戦篇',
        titleCode: 'BLC',
        cardType: 'CHARACTER',
        color: 'BLUE',
        bp: 1500,
        apCost: 1,
        reqEnergy: 0,
        genEnergy: 1,
        traits: ['高校生', '死神代行'],
        triggers: ['GET'],
        effectText: '効果テキスト',
      },
    ];

    it('prefers an exact code over an earlier parallel or substring match', () => {
      const exact = mockCardPool[0];
      const parallel = { ...exact, code: `${exact.code}_p1`, isParallel: true };
      for (const pool of [[parallel, exact], [exact, parallel]]) {
        expect(mapBandaiDeckToDeckItems([raw(exact.code)], pool).items[0].card).toBe(exact);
      }
    });

    it('automatically selects a regular printing independently of pool order', () => {
      const first = mockCardPool[0];
      const second = { ...first, code: 'UA08ST/BLC-2-016' };
      const promo = { ...first, code: 'UAPR/BLC-2-016', cardType: 'ACTION_POINT' as const };
      for (const pool of [[promo, first, second], [second, first, promo]]) {
        expect(mapBandaiDeckToDeckItems([raw('BLC-2-016')], pool).items[0].card).toBe(first);
      }
    });

    it('imports all 50 cards of the live Madoka recipe using regular printings', () => {
      for (const pool of [officialCards, [...officialCards].reverse()]) {
        const result = mapBandaiDeckToDeckItems(madokaRecipe, pool as CardMaster[]);
        expect(result.newCards).toHaveLength(0);
        expect(result.items).toHaveLength(15);
        expect(result.items.reduce((sum, item) => sum + item.count, 0)).toBe(50);
        expect(result.items.map((item) => item.card.code)).toEqual([
          'UA31BT/MMM-1-002', 'UA31BT/MMM-1-006', 'UA31BT/MMM-1-007',
          'UA31BT/MMM-1-008', 'UA31BT/MMM-1-015', 'UA31BT/MMM-1-016',
          'UA31BT/MMM-1-022', 'UA31BT/MMM-1-026', 'UA31BT/MMM-1-028',
          'UA31BT/MMM-1-030', 'UA31ST/MMM-1-111', 'EX16BT/MMM-2-001',
          'EX16BT/MMM-2-003', 'EX16BT/MMM-2-004', 'EX16BT/MMM-2-008',
        ]);
        expect(result.items.some((item) => item.card.cardType === 'ACTION_POINT')).toBe(false);
      }
    });

    it('keeps an explicitly selected promo printing and its corrected character type', () => {
      const result = mapBandaiDeckToDeckItems([raw('UAPR/MMM-1-002')], officialCards as CardMaster[]);
      expect(result.items[0].card.code).toBe('UAPR/MMM-1-002');
      expect(result.items[0].card.cardType).toBe('CHARACTER');
      expect(result.newCards).toHaveLength(0);
    });

    it('matches the whole short number, not a prefix or embedded substring', () => {
      const similar = { ...mockCardPool[0], code: 'EX07BT/BLC-2-0160' };
      expect(() => mapBandaiDeckToDeckItems([raw('BLC-2-016')], [similar])).toThrow(/BLC-2-016/);
    });

    it('does not silently substitute a parallel for a missing normal version', () => {
      const parallel = { ...mockCardPool[0], code: 'EX07BT/BLC-2-016_p1', isParallel: true };
      expect(() => mapBandaiDeckToDeckItems([raw('BLC-2-016')], [parallel])).toThrow(/BLC-2-016/);
      expect(mapBandaiDeckToDeckItems([raw('BLC-2-016_p1')], [parallel]).items[0].card).toBe(parallel);
    });

    it('keeps full product codes distinct and normalizes case and whitespace', () => {
      const first = mockCardPool[0];
      const second = { ...first, code: 'UA08ST/BLC-2-016' };
      const result = mapBandaiDeckToDeckItems([raw(` ${second.code.toLowerCase()} `)], [first, second]);
      expect(result.items[0].card).toBe(second);
      expect(result.items[0].count).toBe(2);
    });

    it('matches cards from pool by card_number suffix', () => {
      const rawCards: BandaiDeckCardRaw[] = [
        {
          id: 72800,
          code: 'HnW',
          card_number: 'BLC-2-016',
          card_name: '黒崎 一護',
          card_count: 4,
          image_url: 'https://files.bandai-tcg-plus.com/dummy.png',
          cost: '0',
          color: '青',
          type: 'キャラクター',
        },
      ];

      const result = mapBandaiDeckToDeckItems(rawCards, mockCardPool);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].card.code).toBe('EX07BT/BLC-2-016');
      expect(result.items[0].count).toBe(4);
      expect(result.newCards).toHaveLength(0);
    });

    it('rejects an incomplete recipe without synthesizing cards or mutating the pool', () => {
      const pool = [...mockCardPool];
      expect(() => mapBandaiDeckToDeckItems([raw('BLC-2-016'), raw('UAPR/NEW-P-001')], pool)).toThrow(/UAPR\/NEW-P-001/);
      expect(pool).toEqual(mockCardPool);
    });
    it.each([0, -1, 1.5, NaN])('rejects invalid card counts instead of substituting one: %s', count => {
      expect(() => mapBandaiDeckToDeckItems([{ ...raw('BLC-2-016'), card_count: count }], mockCardPool)).toThrow(/枚数/);
    });

  });

  describe('fetchBandaiDeckRecipe', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('successfully fetches recipe through 2-step API', async () => {
      const mockFetch = vi.fn();
      global.fetch = mockFetch;

      // 1st call: url_code
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: {
            code: 200,
            game_title_id: 9,
            url_code: 'HnW.HnW!!!',
          },
        }),
      });

      // 2nd call: recipe
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: {
            code: 200,
            main_deck: [
              {
                id: 72800,
                code: 'HnW',
                card_number: 'BLC-2-016',
                card_name: '黒崎 一護',
                card_count: 4,
                image_url: 'https://files.bandai-tcg-plus.com/dummy.png',
                cost: '0',
                color: '青',
                type: 'キャラクター',
              },
            ],
          },
        }),
      });

      const recipe = await fetchBandaiDeckRecipe('lFv8V8TK9AD3EvVn');
      expect(recipe.mainDeck).toHaveLength(1);
      expect(recipe.mainDeck[0].card_name).toBe('黒崎 一護');
      expect(recipe.mainDeck[0].card_count).toBe(4);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('throws error when deck_code is not found or invalid', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      });
      global.fetch = mockFetch;

      await expect(fetchBandaiDeckRecipe('invalid_code')).rejects.toThrow();
    });
  });
});
