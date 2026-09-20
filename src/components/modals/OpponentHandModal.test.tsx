// @vitest-environment jsdom

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OpponentHandModal } from './OpponentHandModal';
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

describe('OpponentHandModal', () => {
  it('renders cards and supports discarding and inspecting cards', () => {
    const onDiscardCard = vi.fn();
    const onInspectCard = vi.fn();
    const dummyCards = [
      createDummyCard('c-1', '相手のカード1'),
      createDummyCard('c-2', '相手のカード2'),
    ];

    render(
      <OpponentHandModal
        isOpen={true}
        cards={dummyCards}
        opponentName="Bob"
        onDiscardCard={onDiscardCard}
        onInspectCard={onInspectCard}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('相手のカード1')).toBeTruthy();
    expect(screen.getByText('相手のカード2')).toBeTruthy();

    // Discard card
    const discardBtns = screen.getAllByRole('button', { name: /場外へ捨てる/ });
    fireEvent.click(discardBtns[0]);
    expect(onDiscardCard).toHaveBeenCalledWith(0);

    // Inspect card
    const zoomBtns = screen.getAllByTitle('カード詳細を確認 (拡大表示)');
    fireEvent.click(zoomBtns[1]);
    expect(onInspectCard).toHaveBeenCalledWith(dummyCards[1]);
  });
});
