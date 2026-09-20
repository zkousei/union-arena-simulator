// @vitest-environment jsdom

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Board } from './Board';
import { createInitialGameState } from '../../domain/initialState';
import { Card } from '../../types/card';
import { GameState } from '../../types/game';

function createDummyCard(id: string, name: string, bp: number = 3000): Card {
  return {
    id,
    code: `UA01BT/CGH-1-${id}`,
    name,
    cardType: 'CHARACTER',
    color: 'PURPLE',
    bp,
    apCost: 1,
    reqEnergy: 2,
    genEnergy: 1,
    traits: ['テスト'],
    triggers: ['DRAW'],
    effectText: 'テスト効果テキスト',
    isRested: false,
    bpModifier: 0,
    underCards: [],
  };
}

function setupTestGameState(
  attackerBp = 4000,
  defenderBp = 3000
): GameState {
  const state = createInitialGameState('player-1', 'Player 1', 'player-2', 'Player 2', 'player-1');
  state.phase = 'ATTACK';
  state.turn = 2; // Turn 2 so P1 can attack
  state.activePlayerId = 'player-1';

  // Attacker on player-1 frontLine slot 0
  state.players['player-1'].frontLine[0] = createDummyCard('att-1', 'アタッカー君', attackerBp);

  // Defender on player-2 frontLine slot 0
  state.players['player-2'].frontLine[0] = createDummyCard('def-1', 'ブロッカー君', defenderBp);

  // Player 2 life
  state.players['player-2'].life = [
    createDummyCard('life-1', 'ライフ1'),
    createDummyCard('life-2', 'ライフ2'),
  ];

  return state;
}

describe('Board Combat Flow and Block Interaction', () => {
  it('displays block selection prompt when attacking opponent player, and life damage prompt when passing block', () => {
    const gameState = setupTestGameState(4000, 3000);
    const dispatchAction = vi.fn();

    render(
      <Board
        gameState={gameState}
        myPlayerId="player-1"
        dispatchAction={dispatchAction}
        isSoloMode={true}
        isFitMode={false}
      />
    );

    // 1. Trigger declare attack from attacker card's context menu
    // Open card menu for attacker
    const attackerCard = screen.getByText('アタッカー君');
    fireEvent.contextMenu(attackerCard);

    const attackBtn = screen.getByRole('button', { name: /アタック宣言（攻撃）/ });
    expect(attackBtn).toBeTruthy();
    fireEvent.click(attackBtn);

    // Attack banner should appear
    expect(screen.getByText('【アタック宣言】')).toBeTruthy();

    // 2. Click opponent player area to attack player (normal attack)
    const opponentSide = screen.getByText(/Player 2 の手札/).closest('div')!;
    fireEvent.click(opponentSide);

    // Check that attacker is rested and block prompt banner appears
    expect(dispatchAction).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'TOGGLE_REST',
        payload: { playerId: 'player-1', zone: 'frontLine', slotIndex: 0 },
      })
    );
    expect(screen.getByText('【ブロック選択】')).toBeTruthy();
    expect(screen.getByText(/「アタッカー君」\(BP4000\)/)).toBeTruthy();

    // 3. Click "通す (ノーブロック)"
    const passBlockBtn = screen.getByRole('button', { name: /通す \(ノーブロック\)/ });
    fireEvent.click(passBlockBtn);

    // Life damage banner should appear
    expect(screen.getByText('【ライフダメージ】')).toBeTruthy();

    // 4. Click "ライフトップをチェック"
    const checkTopLifeBtn = screen.getByRole('button', { name: /ライフトップをチェック/ });
    fireEvent.click(checkTopLifeBtn);

    expect(dispatchAction).toHaveBeenCalledWith({
      type: 'CHECK_LIFE_TRIGGER',
      payload: { playerId: 'player-2', lifeIndex: 0 },
    });
  });

  it('resolves block with defender retirement when attacker BP > defender BP', () => {
    const gameState = setupTestGameState(4000, 3000);
    const dispatchAction = vi.fn();

    render(
      <Board
        gameState={gameState}
        myPlayerId="player-1"
        dispatchAction={dispatchAction}
        isSoloMode={true}
        isFitMode={false}
      />
    );

    // Declare attack
    fireEvent.contextMenu(screen.getByText('アタッカー君'));
    fireEvent.click(screen.getByRole('button', { name: /アタック宣言（攻撃）/ }));

    // Click opponent area to attack player
    const opponentSide = screen.getByText(/Player 2 の手札/).closest('div')!;
    fireEvent.click(opponentSide);

    expect(screen.getByText('【ブロック選択】')).toBeTruthy();

    // Click defender card in Player 2's frontLine to declare block
    const defenderCard = screen.getByText('ブロッカー君');
    fireEvent.click(defenderCard);

    // Blocker should be rested
    expect(dispatchAction).toHaveBeenCalledWith({
      type: 'TOGGLE_REST',
      payload: { playerId: 'player-2', zone: 'frontLine', slotIndex: 0 },
    });

    // Defender (loser) should be moved to graveyard
    expect(dispatchAction).toHaveBeenCalledWith({
      type: 'MOVE_CARD',
      payload: {
        cardId: 'def-1',
        from: { playerId: 'player-2', zone: 'frontLine', slotIndex: 0 },
        to: { playerId: 'player-2', zone: 'graveyard' },
      },
    });

    // Attacker (winner) should NOT be moved to graveyard
    const attackerMovedToGrave = dispatchAction.mock.calls.some(
      (call) =>
        call[0].type === 'MOVE_CARD' &&
        call[0].payload.cardId === 'att-1' &&
        call[0].payload.to.zone === 'graveyard'
    );
    expect(attackerMovedToGrave).toBe(false);

    // Block prompt should close
    expect(screen.queryByText('【ブロック選択】')).toBeNull();
  });

  it('retires defender only upon tie (attacker BP == defender BP)', () => {
    const gameState = setupTestGameState(3000, 3000);
    const dispatchAction = vi.fn();

    render(
      <Board
        gameState={gameState}
        myPlayerId="player-1"
        dispatchAction={dispatchAction}
        isSoloMode={true}
        isFitMode={false}
      />
    );

    // Declare attack
    fireEvent.contextMenu(screen.getByText('アタッカー君'));
    fireEvent.click(screen.getByRole('button', { name: /アタック宣言（攻撃）/ }));

    // Click opponent area
    fireEvent.click(screen.getByText(/Player 2 の手札/).closest('div')!);

    // Block with defender
    fireEvent.click(screen.getByText('ブロッカー君'));

    // Defender should be moved to graveyard
    expect(dispatchAction).toHaveBeenCalledWith({
      type: 'MOVE_CARD',
      payload: {
        cardId: 'def-1',
        from: { playerId: 'player-2', zone: 'frontLine', slotIndex: 0 },
        to: { playerId: 'player-2', zone: 'graveyard' },
      },
    });

    // Attacker should NOT be moved to graveyard
    const attackerMovedToGrave = dispatchAction.mock.calls.some(
      (call) =>
        call[0].type === 'MOVE_CARD' &&
        call[0].payload.cardId === 'att-1' &&
        call[0].payload.to.zone === 'graveyard'
    );
    expect(attackerMovedToGrave).toBe(false);
  });

  it('retires neither character when attacker BP < defender BP (defender blocks and both survive)', () => {
    const gameState = setupTestGameState(2000, 3000);
    const dispatchAction = vi.fn();

    render(
      <Board
        gameState={gameState}
        myPlayerId="player-1"
        dispatchAction={dispatchAction}
        isSoloMode={true}
        isFitMode={false}
      />
    );

    // Declare attack
    fireEvent.contextMenu(screen.getByText('アタッカー君'));
    fireEvent.click(screen.getByRole('button', { name: /アタック宣言（攻撃）/ }));

    // Click opponent area
    fireEvent.click(screen.getByText(/Player 2 の手札/).closest('div')!);

    // Block with defender
    fireEvent.click(screen.getByText('ブロッカー君'));

    // Blocker is rested
    expect(dispatchAction).toHaveBeenCalledWith({
      type: 'TOGGLE_REST',
      payload: { playerId: 'player-2', zone: 'frontLine', slotIndex: 0 },
    });

    // Neither character should be moved to graveyard
    const anyCardMovedToGrave = dispatchAction.mock.calls.some(
      (call) =>
        call[0].type === 'MOVE_CARD' &&
        call[0].payload.to.zone === 'graveyard'
    );
    expect(anyCardMovedToGrave).toBe(false);
  });

  it('supports direct character attack (Snipe) by clicking opponent character directly during attack declaration', () => {
    const gameState = setupTestGameState(4000, 3000);
    const dispatchAction = vi.fn();

    render(
      <Board
        gameState={gameState}
        myPlayerId="player-1"
        dispatchAction={dispatchAction}
        isSoloMode={true}
        isFitMode={false}
      />
    );

    // Declare attack
    fireEvent.contextMenu(screen.getByText('アタッカー君'));
    fireEvent.click(screen.getByRole('button', { name: /アタック宣言（攻撃）/ }));

    // Click opponent character directly (Snipe)
    fireEvent.click(screen.getByText('ブロッカー君'));

    // Should resolve directly without block prompt
    expect(screen.queryByText('【ブロック選択】')).toBeNull();

    // Attacker is rested and defender is retired
    expect(dispatchAction).toHaveBeenCalledWith({
      type: 'TOGGLE_REST',
      payload: { playerId: 'player-1', zone: 'frontLine', slotIndex: 0 },
    });
    expect(dispatchAction).toHaveBeenCalledWith({
      type: 'MOVE_CARD',
      payload: {
        cardId: 'def-1',
        from: { playerId: 'player-2', zone: 'frontLine', slotIndex: 0 },
        to: { playerId: 'player-2', zone: 'graveyard' },
      },
    });
  });
});
