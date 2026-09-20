// @vitest-environment jsdom

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { OfficialImportModal } from './OfficialImportModal';
import * as bandaiService from '../../services/bandaiTcgPlusService';

describe('OfficialImportModal', () => {
  const mockCardPool = [
    {
      code: 'UA08BT/BLC-2-016',
      baseCode: 'UA08BT/BLC-2-016',
      name: '黒崎 一護',
      title: 'BLEACH',
      titleCode: 'BLC',
      cardType: 'CHARACTER' as const,
      color: 'BLUE' as const,
      bp: 1500,
      apCost: 1,
      reqEnergy: 0,
      genEnergy: 1,
      traits: [],
      triggers: [],
      effectText: '',
    },
  ];

  it('renders BANDAI TCG+ tab by default', () => {
    render(
      <OfficialImportModal
        isOpen={true}
        onClose={vi.fn()}
        cardPool={mockCardPool}
        onAddCardsToPool={vi.fn()}
        onLoadDeckItems={vi.fn()}
      />
    );

    expect(screen.getByText(/BANDAI TCG\+ レシピ/i)).toBeTruthy();
    expect(
      screen.getByPlaceholderText(/https:\/\/www\.bandai-tcg-plus\.com\/deck_code_recipe\//i)
    ).toBeTruthy();
  });

  it('fetches recipe and allows creating deck', async () => {
    const onLoadDeckItems = vi.fn();
    const onClose = vi.fn();

    vi.spyOn(bandaiService, 'fetchBandaiDeckRecipe').mockResolvedValueOnce({
      deckCode: 'lFv8V8TK9AD3EvVn',
      gameTitleId: 9,
      mainDeck: [
        {
          id: 1,
          code: 'HnW',
          card_number: 'BLC-2-016',
          card_name: '黒崎 一護',
          card_count: 4,
          image_url: 'https://example.com/ichigo.png',
          cost: '0',
          color: '青',
          type: 'キャラクター',
        },
      ],
    });

    render(
      <OfficialImportModal
        isOpen={true}
        onClose={onClose}
        cardPool={mockCardPool}
        onAddCardsToPool={vi.fn()}
        onLoadDeckItems={onLoadDeckItems}
      />
    );

    const input = screen.getByPlaceholderText(
      /https:\/\/www\.bandai-tcg-plus\.com\/deck_code_recipe\//i
    );
    fireEvent.change(input, {
      target: { value: 'https://www.bandai-tcg-plus.com/deck_code_recipe/lFv8V8TK9AD3EvVn' },
    });

    const fetchButton = screen.getByRole('button', { name: /レシピを取得/i });
    fireEvent.click(fetchButton);

    await waitFor(() => {
      expect(screen.getByText(/レシピ取得成功/i)).toBeTruthy();
    });

    const createButton = screen.getByRole('button', { name: /このデッキを作成/i });
    fireEvent.click(createButton);

    expect(onLoadDeckItems).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          count: 4,
          card: expect.objectContaining({
            name: '黒崎 一護',
          }),
        }),
      ]),
      expect.stringContaining('TCG+ デッキ'),
      'BLC'
    );
    expect(onClose).toHaveBeenCalled();
  });
});
