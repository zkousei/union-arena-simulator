// @vitest-environment jsdom

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SideZonesArea } from './SideZonesArea';
import { PlayerState } from '../../types/game';
import { Card } from '../../types/card';

function createDummyCard(id: string, name: string): Card {
  return {
    id,
    code: `UA01BT/TEST-${id}`,
    name,
    cardType: 'CHARACTER',
    color: 'PURPLE',
    bp: 3000,
    apCost: 1,
    reqEnergy: 2,
    genEnergy: 1,
    traits: ['テスト'],
    triggers: [],
    effectText: '',
    isRested: false,
    bpModifier: 0,
    underCards: [],
  };
}

function createDummyPlayer(deckCount: number = 20): PlayerState {
  const deck: Card[] = [];
  for (let i = 1; i <= deckCount; i++) {
    deck.push(createDummyCard(`card-${i}`, `テストカード${i}`));
  }

  return {
    id: 'player-1',
    name: 'Player 1',
    isFirst: true,
    deck,
    hand: [],
    frontLine: [null, null, null, null],
    energyLine: [null, null, null, null],
    graveyard: [],
    removed: [],
    life: [],
    apCurrent: 1,
    apMax: 1,
    hasExtraDrawn: false,
    hasMulliganed: false,
    isReady: true,
    apArea: [],
    revealedTopDeckCard: null,
  };
}

describe('SideZonesArea Top Deck Viewing Options', () => {
  it('displays quick options up to 8 and 10 cards, and calls onLookAtTopDeck when 6 cards clicked', () => {
    const onLookAtTopDeck = vi.fn();
    const player = createDummyPlayer(20);

    render(
      <SideZonesArea
        player={player}
        isOpponent={false}
        onLookAtTopDeck={onLookAtTopDeck}
      />
    );

    // Click "上を見る" button
    const openBtn = screen.getByTitle('山札の上からカードを確認します');
    fireEvent.click(openBtn);

    // Verify 6 cards button exists and triggers onLookAtTopDeck(6)
    const btn6 = screen.getByRole('button', { name: '6枚' });
    expect(btn6).toBeTruthy();
    fireEvent.click(btn6);
    expect(onLookAtTopDeck).toHaveBeenCalledWith(6);
  });

  it('supports custom input to view 6 or more cards (e.g. 12 cards)', () => {
    const onLookAtTopDeck = vi.fn();
    const player = createDummyPlayer(20);

    render(
      <SideZonesArea
        player={player}
        isOpponent={false}
        onLookAtTopDeck={onLookAtTopDeck}
      />
    );

    const openBtn = screen.getByTitle('山札の上からカードを確認します');
    fireEvent.click(openBtn);

    const input = screen.getByPlaceholderText('指定');
    fireEvent.change(input, { target: { value: '12' } });

    const submitBtn = screen.getByRole('button', { name: '見る' });
    fireEvent.click(submitBtn);

    expect(onLookAtTopDeck).toHaveBeenCalledWith(12);
  });

  it('disables buttons exceeding current deck count', () => {
    const onLookAtTopDeck = vi.fn();
    // Only 4 cards in deck
    const player = createDummyPlayer(4);

    render(
      <SideZonesArea
        player={player}
        isOpponent={false}
        onLookAtTopDeck={onLookAtTopDeck}
      />
    );

    const openBtn = screen.getByTitle('山札の上からカードを確認します');
    fireEvent.click(openBtn);

    const btn4 = screen.getByRole('button', { name: '4枚' });
    const btn5 = screen.getByRole('button', { name: '5枚' });
    const btn6 = screen.getByRole('button', { name: '6枚' });

    expect((btn4 as HTMLButtonElement).disabled).toBe(false);
    expect((btn5 as HTMLButtonElement).disabled).toBe(true);
    expect((btn6 as HTMLButtonElement).disabled).toBe(true);
  });

  it('prevents top deck menu from overflowing horizontally and vertically on top/bottom positions', () => {
    const player = createDummyPlayer(20);

    // Render in top position (e.g. Player 2 in solo mode or top player)
    const { unmount } = render(
      <SideZonesArea
        player={player}
        position="top"
        isOpponent={false}
      />
    );

    const openBtnTop = screen.getByTitle('山札の上からカードを確認します');
    fireEvent.click(openBtnTop);

    // The top deck menu container
    const menuTop = screen.getByRole('dialog', { name: '上から確認メニュー' });
    expect(menuTop).toBeTruthy();
    // Must have right-0 to prevent right-edge overflow
    expect(menuTop.className).toContain('right-0');
    // Must open downwards (top-full) when position is top to avoid shooting above the viewport
    expect(menuTop.className).toContain('top-full');
    expect(menuTop.className).toContain('overflow-y-auto');

    unmount();

    // Render in bottom position
    render(
      <SideZonesArea
        player={player}
        position="bottom"
        isOpponent={false}
      />
    );

    const openBtnBottom = screen.getByTitle('山札の上からカードを確認します');
    fireEvent.click(openBtnBottom);

    const menuBottom = screen.getByRole('dialog', { name: '上から確認メニュー' });
    expect(menuBottom).toBeTruthy();
    expect(menuBottom.className).toContain('right-0');
    // Must open upwards (bottom-full) when position is bottom
    expect(menuBottom.className).toContain('bottom-full');
    expect(menuBottom.className).toContain('overflow-y-auto');
  });

  it('prevents bottom deck dropdown and life menu from overflowing and supports backdrop dismiss', () => {
    const player = createDummyPlayer(20);

    render(
      <SideZonesArea
        player={player}
        position="top"
        isOpponent={false}
      />
    );

    // Open bottom deck dropdown
    const bottomDeckBtn = screen.getByTitle('山札の一番下のカードに対する操作');
    fireEvent.click(bottomDeckBtn);

    const bottomDeckMenu = screen.getByRole('menu', { name: '山札の下からメニュー' });
    expect(bottomDeckMenu.className).toContain('right-0');
    expect(bottomDeckMenu.className).toContain('top-full');
    expect(bottomDeckMenu.className).toContain('overflow-y-auto');

    // Clicking outside backdrop dismisses bottom deck menu
    const backdrop = screen.getByTestId('dropdown-backdrop');
    fireEvent.click(backdrop);
    expect(screen.queryByRole('menu', { name: '山札の下からメニュー' })).toBeNull();
  });

  it('prevents life menu and individual life card popup from overflowing and supports backdrop dismiss', () => {
    const player = createDummyPlayer(20);
    // Add 5 dummy life cards
    player.life = [
      createDummyCard('life-1', 'ライフ1'),
      createDummyCard('life-2', 'ライフ2'),
      createDummyCard('life-3', 'ライフ3'),
      createDummyCard('life-4', 'ライフ4'),
      createDummyCard('life-5', 'ライフ5'),
    ];

    render(
      <SideZonesArea
        player={player}
        position="top"
        isOpponent={false}
      />
    );

    // 1. Open life menu via MoreVertical button
    const lifeMoreBtn = screen.getByTitle('自傷・回収・表裏メニュー');
    fireEvent.click(lifeMoreBtn);

    const lifeMenu = screen.getByRole('menu', { name: 'ライフメニュー' });
    expect(lifeMenu).toBeTruthy();
    expect(lifeMenu.className).toContain('right-0');
    expect(lifeMenu.className).toContain('top-full');
    expect(lifeMenu.className).toContain('overflow-y-auto');

    // Dismiss life menu via backdrop
    const backdrop1 = screen.getByTestId('dropdown-backdrop');
    fireEvent.click(backdrop1);
    expect(screen.queryByRole('menu', { name: 'ライフメニュー' })).toBeNull();

    // 2. Click 4th life card (idx = 3 >= 2) to open individual life menu
    const lifeCards = screen.getAllByTitle(/クリックで操作メニュー/);
    expect(lifeCards.length).toBe(5);
    fireEvent.click(lifeCards[3]);

    const cardMenu = screen.getByRole('dialog', { name: 'ライフ #4 操作メニュー' });
    expect(cardMenu).toBeTruthy();
    // For idx >= 2, must use right-0 to avoid overflowing to the right of SideZonesArea
    expect(cardMenu.className).toContain('right-0');
    expect(cardMenu.className).toContain('top-full');
    expect(cardMenu.className).toContain('overflow-y-auto');

    // Dismiss individual life menu via backdrop
    const backdrop2 = screen.getByTestId('dropdown-backdrop');
    fireEvent.click(backdrop2);
    expect(screen.queryByRole('dialog', { name: 'ライフ #4 操作メニュー' })).toBeNull();
  });
});


