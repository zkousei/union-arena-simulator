// @vitest-environment jsdom

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TopDeckModal } from './TopDeckModal';
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

describe('TopDeckModal', () => {
  it('allows resolving cards with both public and secret hand options', () => {
    const onResolveCard = vi.fn();
    const onClose = vi.fn();
    const dummyCards = [
      createDummyCard('c-1', '公開テストカード'),
      createDummyCard('c-2', '非公開テストカード'),
    ];

    render(
      <TopDeckModal
        revealedDeck={{
          playerId: 'p1',
          cards: dummyCards,
        }}
        myPlayerId="p1"
        onResolveCard={onResolveCard}
        onClose={onClose}
      />
    );

    // Verify both "手札(公開)" and "手札(非公開)" buttons exist
    const publicBtns = screen.getAllByRole('button', { name: /手札\(公開\)/ });
    const secretBtns = screen.getAllByRole('button', { name: /手札\(非公開\)/ });
    expect(publicBtns).toHaveLength(2);
    expect(secretBtns).toHaveLength(2);

    // Resolve first card with public hand
    fireEvent.click(publicBtns[0]);
    expect(onResolveCard).toHaveBeenCalledWith('c-1', 'hand');

    // Resolve second card with secret hand
    fireEvent.click(secretBtns[1]);
    expect(onResolveCard).toHaveBeenCalledWith('c-2', 'handSecret');
  });
});
