// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Card } from '../../types/card';
import { UnderCardsModal } from './UnderCardsModal';

function createCard(id: string, name: string, isFaceDown = false): Card {
  return {
    id,
    code: `TEST-${id}`,
    name,
    cardType: 'CHARACTER',
    color: 'PURPLE',
    bp: 3000,
    apCost: 1,
    reqEnergy: 2,
    genEnergy: 1,
    traits: [],
    triggers: [],
    effectText: '',
    isRested: false,
    bpModifier: 0,
    underCards: [],
    isFaceDown,
  };
}

describe('UnderCardsModal privacy', () => {
  it('keeps opponent face-down markers hidden and disables private controls', () => {
    const parent = createCard('parent', '公開中の親カード');
    parent.underCards = [createCard('secret-marker', '秘密のマーカー', true)];

    render(
      <UnderCardsModal
        isOpen={true}
        parentCard={parent}
        isOpponent={true}
        hasEmptyFrontSlot={true}
        hasEmptyEnergySlot={true}
        onSeparateCard={vi.fn()}
        onSeparateParentCard={vi.fn()}
        onInspectCard={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('公開中の親カード')).toBeDefined();
    expect(screen.queryByText('秘密のマーカー')).toBeNull();
    expect(screen.queryByText('マーカー表面を表示中')).toBeNull();
    expect(screen.queryByRole('button', { name: '詳細を確認' })).toBeNull();
    expect(screen.queryByRole('button', { name: '手札へ' })).toBeNull();
  });

  it('keeps face-down marker inspection available to its owner', () => {
    const parent = createCard('parent', '自分の親カード');
    parent.underCards = [createCard('own-marker', '自分のマーカー', true)];

    render(
      <UnderCardsModal
        isOpen={true}
        parentCard={parent}
        isOpponent={false}
        hasEmptyFrontSlot={true}
        hasEmptyEnergySlot={true}
        onSeparateCard={vi.fn()}
        onSeparateParentCard={vi.fn()}
        onInspectCard={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('自分のマーカー')).toBeDefined();
    expect(screen.getByText('マーカー表面を表示中')).toBeDefined();
    expect(screen.getByRole('button', { name: '手札へ' })).toBeDefined();
  });
});
