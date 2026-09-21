// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HandArea } from './HandArea';
import { Card } from '../../types/card';

const dummyCard: Card = {
  id: 'c-1',
  code: 'UA01BT/CGH-1-001',
  name: 'テストカード',
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
};

describe('HandArea', () => {
  it('does not discard opponent face-down card when confirm modal is cancelled', () => {
    const onDiscardHandIndex = vi.fn();

    render(
      <HandArea
        playerId="player-2"
        cards={[dummyCard]}
        isOpponent={true}
        isOpenHand={false}
        canToggleHide={false}
        onDiscardHandIndex={onDiscardHandIndex}
      />
    );

    const faceDownCard = screen.getByText('UA');
    fireEvent.click(faceDownCard);

    // Confirm modal appears
    expect(screen.getByText('相手手札の破棄確認')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'キャンセル' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'キャンセル' }));
    expect(onDiscardHandIndex).not.toHaveBeenCalled();
    expect(screen.queryByText('相手手札の破棄確認')).toBeNull();
  });

  it('discards opponent face-down card only after confirm modal is accepted', () => {
    const onDiscardHandIndex = vi.fn();

    render(
      <HandArea
        playerId="player-2"
        cards={[dummyCard]}
        isOpponent={true}
        isOpenHand={false}
        canToggleHide={false}
        onDiscardHandIndex={onDiscardHandIndex}
      />
    );

    const faceDownCard = screen.getByText('UA');
    fireEvent.click(faceDownCard);

    expect(screen.getByText('相手手札の破棄確認')).toBeTruthy();
    const discardBtn = screen.getByRole('button', { name: '場外へ捨てる' });
    fireEvent.click(discardBtn);

    expect(onDiscardHandIndex).toHaveBeenCalledWith(0);
    expect(screen.queryByText('相手手札の破棄確認')).toBeNull();
  });
});
