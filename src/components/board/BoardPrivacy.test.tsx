// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createInitialGameState } from '../../domain/initialState';
import { Card } from '../../types/card';
import { Board } from './Board';

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
    triggers: ['DRAW'],
    effectText: '非公開情報テスト',
    isRested: false,
    bpModifier: 0,
    underCards: [],
    isFaceDown,
  };
}

describe('Board hidden information', () => {
  it('keeps the opponent hand hidden without an inspection action in P2P mode', () => {
    const state = createInitialGameState('player-1', '自分', 'player-2', '相手', 'player-1');
    state.players['player-2'].hand = [createCard('secret-hand', '秘密の手札カード')];

    render(
      <Board
        gameState={state}
        myPlayerId="player-1"
        dispatchAction={vi.fn()}
        isSoloMode={false}
      />
    );

    expect(screen.queryByText('秘密の手札カード')).toBeNull();
    expect(screen.getByText('相手手札 (1枚)')).toBeDefined();
    expect(screen.queryByRole('button', { name: '手札を見る' })).toBeNull();

    fireEvent.click(screen.getByTitle('裏向きの相手手札'));
    expect(screen.queryByText('秘密の手札カード')).toBeNull();
    expect(screen.queryByText(/相手の手札公開・確認/)).toBeNull();
  });

  it('does not reveal a face-down opponent life card in the board or selection modal', () => {
    const state = createInitialGameState('player-1', '自分', 'player-2', '相手', 'player-1');
    state.players['player-2'].life = [createCard('secret-life', '秘密のライフカード', true)];

    render(
      <Board
        gameState={state}
        myPlayerId="player-1"
        dispatchAction={vi.fn()}
        isSoloMode={false}
      />
    );

    expect(screen.queryByText('秘密のライフカード')).toBeNull();

    // Open opponent life selection modal and verify face-down life details remain hidden
    fireEvent.click(screen.getByTitle('ライフ一覧から好きなカードを任意指定してトリガーチェックや操作を行う'));
    expect(screen.getByText(/相手ライフの選択/)).toBeDefined();
    expect(screen.queryByText('秘密のライフカード')).toBeNull();
    expect(screen.getByText('非公開カード')).toBeDefined();
  });

  it('does not expose opponent draw or mill controls in P2P mode', () => {
    const state = createInitialGameState('player-1', '自分', 'player-2', '相手', 'player-1');
    state.players['player-2'].deck = [createCard('secret-deck', '秘密の山札カード', true)];

    render(
      <Board
        gameState={state}
        myPlayerId="player-1"
        dispatchAction={vi.fn()}
        isSoloMode={false}
      />
    );

    expect(screen.queryByTitle('相手の山札から1枚引く')).toBeNull();
    expect(screen.queryByRole('button', { name: '1枚削る' })).toBeNull();
  });

  it('shows an explicitly face-up opponent life card', () => {
    const state = createInitialGameState('player-1', '自分', 'player-2', '相手', 'player-1');
    state.players['player-2'].life = [createCard('public-life', '公開ライフカード', false)];

    render(
      <Board
        gameState={state}
        myPlayerId="player-1"
        dispatchAction={vi.fn()}
        isSoloMode={false}
      />
    );

    expect(screen.getByText(/表向き: 公開ライフカード/)).toBeDefined();
  });

  it('does not render another player top-deck inspection in P2P mode', () => {
    const state = createInitialGameState('player-1', '自分', 'player-2', '相手', 'player-1');
    state.revealedDeckCards = {
      playerId: 'player-2',
      cards: [createCard('secret-deck', '秘密の山札カード')],
    };

    render(
      <Board
        gameState={state}
        myPlayerId="player-1"
        dispatchAction={vi.fn()}
        isSoloMode={false}
      />
    );

    expect(screen.queryByRole('heading', { name: /山札の上から確認中/ })).toBeNull();
    expect(screen.queryByText('秘密の山札カード')).toBeNull();
  });

  it('renders the local player top-deck inspection', () => {
    const state = createInitialGameState('player-1', '自分', 'player-2', '相手', 'player-1');
    state.revealedDeckCards = {
      playerId: 'player-1',
      cards: [createCard('own-deck', '自分の確認カード')],
    };

    render(
      <Board
        gameState={state}
        myPlayerId="player-1"
        dispatchAction={vi.fn()}
        isSoloMode={false}
      />
    );

    expect(screen.getByRole('heading', { name: '山札の上から確認中 (1 枚)' })).toBeDefined();
    expect(screen.getByText('自分の確認カード')).toBeDefined();
  });

  it('keeps both players visible in the intentional solo inspection mode', () => {
    const state = createInitialGameState('player-1', '自分', 'player-2', '相手', 'player-1');
    state.players['player-2'].hand = [createCard('solo-hand', 'ソロ用相手手札')];
    state.revealedDeckCards = {
      playerId: 'player-2',
      cards: [createCard('solo-deck', 'ソロ用相手山札')],
    };

    render(
      <Board
        gameState={state}
        myPlayerId="player-1"
        dispatchAction={vi.fn()}
        isSoloMode={true}
      />
    );

    expect(screen.getByText('ソロ用相手手札')).toBeDefined();
    expect(screen.getByText('ソロ用相手山札')).toBeDefined();
  });
});
