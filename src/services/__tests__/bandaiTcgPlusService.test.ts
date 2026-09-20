import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  extractDeckCode,
  mapBandaiDeckToDeckItems,
  fetchBandaiDeckRecipe,
  BandaiDeckCardRaw,
} from '../bandaiTcgPlusService';
import { CardMaster } from '../../data/cardDatabase';

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

    it('creates fallback CardMaster when card is not found in pool', () => {
      const rawCards: BandaiDeckCardRaw[] = [
        {
          id: 99999,
          code: 'XYZ',
          card_number: 'NEW-1-999',
          card_name: '未知のキャラクター',
          card_count: 3,
          image_url: 'https://files.bandai-tcg-plus.com/new.png',
          cost: '2',
          color: '赤',
          type: 'キャラクター',
        },
      ];

      const result = mapBandaiDeckToDeckItems(rawCards, mockCardPool);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].card.code).toBe('NEW-1-999');
      expect(result.items[0].card.name).toBe('未知のキャラクター');
      expect(result.items[0].card.color).toBe('RED');
      expect(result.items[0].card.reqEnergy).toBe(2);
      expect(result.items[0].card.cardType).toBe('CHARACTER');
      expect(result.items[0].count).toBe(3);
      expect(result.newCards).toHaveLength(1);
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
