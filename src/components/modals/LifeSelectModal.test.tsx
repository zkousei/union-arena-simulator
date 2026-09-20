// @vitest-environment jsdom

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Card } from '../../types/card';
import { LifeSelectModal } from './LifeSelectModal';

const dummyLifeCards: Card[] = [
  {
    id: 'life-1',
    code: 'UA01BT/CGH-1-001',
    name: 'カード1',
    cardType: 'CHARACTER',
    color: 'PURPLE',
    bp: 3000,
    apCost: 1,
    reqEnergy: 2,
    genEnergy: 1,
    traits: ['ギアス'],
    triggers: ['DRAW'],
    effectText: '',
    isRested: false,
    bpModifier: 0,
    underCards: [],
    isFaceDown: true,
  },
  {
    id: 'life-2',
    code: 'UA01BT/CGH-1-002',
    name: 'カード2（表向き）',
    cardType: 'CHARACTER',
    color: 'PURPLE',
    bp: 4000,
    apCost: 1,
    reqEnergy: 3,
    genEnergy: 1,
    traits: ['ギアス'],
    triggers: ['ACTIVE'],
    effectText: '効果テキスト',
    isRested: false,
    bpModifier: 0,
    underCards: [],
    isFaceDown: false,
  },
  {
    id: 'life-3',
    code: 'UA01BT/CGH-1-003',
    name: 'カード3',
    cardType: 'EVENT',
    color: 'PURPLE',
    bp: null,
    apCost: 1,
    reqEnergy: 1,
    genEnergy: 1,
    traits: [],
    triggers: ['SPECIAL'],
    effectText: '',
    isRested: false,
    bpModifier: 0,
    underCards: [],
    isFaceDown: true,
  },
];

describe('LifeSelectModal', () => {
  it('renders all life cards with badges', () => {
    render(
      <LifeSelectModal
        isOpen={true}
        lifeCards={dummyLifeCards}
        playerName="プレイヤー1"
        isOpponent={true}
        onCheckLife={vi.fn()}
        onTakeLife={vi.fn()}
        onFlipLife={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByRole('dialog', { name: '相手ライフの指定・操作' })).toBeTruthy();
    expect(screen.getByText('ライフ #1')).toBeDefined();
    expect(screen.getByText('ライフ #2')).toBeDefined();
    expect(screen.getByText('ライフ #3')).toBeDefined();
    expect(screen.getByText('カード2（表向き）')).toBeDefined();
  });

  it('calls onCheckLife with selected index when trigger check button is clicked', () => {
    const handleCheckLife = vi.fn();
    const handleClose = vi.fn();

    render(
      <LifeSelectModal
        isOpen={true}
        lifeCards={dummyLifeCards}
        playerName="相手プレイヤー"
        isOpponent={true}
        onCheckLife={handleCheckLife}
        onTakeLife={vi.fn()}
        onFlipLife={vi.fn()}
        onClose={handleClose}
      />
    );

    // ライフ #2 のチェックボタンをクリック
    const checkButtons = screen.getAllByRole('button', { name: /トリガーチェック/i });
    // checkButtons[0] is top quick check (#1), checkButtons[1] is card #1, checkButtons[2] is card #2
    fireEvent.click(checkButtons[2]);

    expect(handleCheckLife).toHaveBeenCalledWith(1);
    expect(handleClose).toHaveBeenCalled();
  });

  it('calls onTakeLife with graveyard when discard button is clicked', () => {
    const handleTakeLife = vi.fn();
    const handleClose = vi.fn();

    render(
      <LifeSelectModal
        isOpen={true}
        lifeCards={dummyLifeCards}
        playerName="相手プレイヤー"
        isOpponent={true}
        onCheckLife={vi.fn()}
        onTakeLife={handleTakeLife}
        onFlipLife={vi.fn()}
        onClose={handleClose}
      />
    );

    const discardButtons = screen.getAllByRole('button', { name: /場外へ/i });
    fireEvent.click(discardButtons[0]);

    expect(handleTakeLife).toHaveBeenCalledWith('graveyard', 0);
    expect(handleClose).toHaveBeenCalled();
  });

  it('calls onTakeLife with hand when hand button is clicked for own life', () => {
    const handleTakeLife = vi.fn();
    const handleClose = vi.fn();

    render(
      <LifeSelectModal
        isOpen={true}
        lifeCards={dummyLifeCards}
        playerName="自分"
        isOpponent={false}
        onCheckLife={vi.fn()}
        onTakeLife={handleTakeLife}
        onFlipLife={vi.fn()}
        onClose={handleClose}
      />
    );

    const handButtons = screen.getAllByRole('button', { name: /手札/i });
    fireEvent.click(handButtons[1]); // #2の手札回収

    expect(handleTakeLife).toHaveBeenCalledWith('hand', 1);
    expect(handleClose).toHaveBeenCalled();
  });

  it('calls onFlipLife when flip button is clicked', () => {
    const handleFlipLife = vi.fn();

    render(
      <LifeSelectModal
        isOpen={true}
        lifeCards={dummyLifeCards}
        playerName="相手プレイヤー"
        isOpponent={true}
        onCheckLife={vi.fn()}
        onTakeLife={vi.fn()}
        onFlipLife={handleFlipLife}
        onClose={vi.fn()}
      />
    );

    const flipButtons = screen.getAllByRole('button', { name: /表\/裏/i });
    fireEvent.click(flipButtons[0]);

    expect(handleFlipLife).toHaveBeenCalledWith(0);
  });
});
