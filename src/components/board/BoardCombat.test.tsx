// @vitest-environment jsdom

import { render, screen, fireEvent, within } from '@testing-library/react';
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
  state.status = 'PLAYING';
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

    const { rerender } = render(
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

    const attackBtn = screen.getByRole('button', { name: /アタック対象を選択/ });
    expect(attackBtn).toBeTruthy();
    fireEvent.click(attackBtn);

    // Attack banner should appear
    expect(screen.getByText('【アタック宣言】')).toBeTruthy();

    // 2. Click opponent player area to attack player (normal attack)
    const opponentSide = screen.getByText(/Player 2 の手札/).closest('div')!;
    fireEvent.click(opponentSide);

    expect(dispatchAction).toHaveBeenCalledWith({
      type: 'DECLARE_PLAYER_ATTACK',
      payload: {
        actorPlayerId: 'player-1',
        attackerZone: 'frontLine',
        attackerSlotIndex: 0,
        defenderPlayerId: 'player-2',
      },
    });

    gameState.pendingCombat = {
      stage: 'BLOCK_DECISION',
      attackerPlayerId: 'player-1',
      attackerZone: 'frontLine',
      attackerSlotIndex: 0,
      defenderPlayerId: 'player-2',
      attackerCardName: 'アタッカー君',
      attackerBp: 4000,
    };
    rerender(<Board gameState={{ ...gameState }} myPlayerId="player-1" dispatchAction={dispatchAction} isSoloMode={true} isFitMode={false} />);
    expect(screen.getByText('【ブロック選択】')).toBeTruthy();
    expect(screen.getByText(/「アタッカー君」\(BP4000\)/)).toBeTruthy();

    // 3. Click "通す (ノーブロック)"
    const passBlockBtn = screen.getByRole('button', { name: /通す \(ノーブロック\)/ });
    fireEvent.click(passBlockBtn);
    expect(dispatchAction).toHaveBeenCalledWith({
      type: 'PASS_BLOCK',
      payload: { actorPlayerId: 'player-2' },
    });

    gameState.pendingCombat.stage = 'LIFE_SELECTION';
    rerender(<Board gameState={{ ...gameState }} myPlayerId="player-1" dispatchAction={dispatchAction} isSoloMode={true} isFitMode={false} />);
    expect(screen.getByText('【ライフダメージ】')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'ライフを選択' }));
    fireEvent.click(screen.getAllByRole('button', { name: /このライフでトリガーチェック/ })[1]);

    expect(dispatchAction).toHaveBeenCalledWith({
      type: 'SELECT_LIFE_FOR_DAMAGE',
      payload: { actorPlayerId: 'player-1', lifeIndex: 1 },
    });
  });

  it('resolves block with defender retirement when attacker BP > defender BP', () => {
    const gameState = setupTestGameState(4000, 3000);
    const dispatchAction = vi.fn();

    gameState.pendingCombat = {
      stage: 'BLOCK_DECISION',
      attackerPlayerId: 'player-1',
      attackerZone: 'frontLine',
      attackerSlotIndex: 0,
      defenderPlayerId: 'player-2',
      attackerCardName: 'アタッカー君',
      attackerBp: 4000,
    };
    render(
      <Board
        gameState={gameState}
        myPlayerId="player-1"
        dispatchAction={dispatchAction}
        isSoloMode={true}
        isFitMode={false}
      />
    );

    expect(screen.getByText('【ブロック選択】')).toBeTruthy();

    // Click defender card in Player 2's frontLine to declare block
    const defenderCard = screen.getByText('ブロッカー君');
    fireEvent.click(defenderCard);

    expect(dispatchAction).toHaveBeenCalledWith({
      type: 'BLOCK_ATTACK',
      payload: { actorPlayerId: 'player-2', blockerSlotIndex: 0 },
    });
  });

  it('retires defender only upon tie (attacker BP == defender BP)', () => {
    const gameState = setupTestGameState(3000, 3000);
    const dispatchAction = vi.fn();

    gameState.pendingCombat = {
      stage: 'BLOCK_DECISION', attackerPlayerId: 'player-1', attackerZone: 'frontLine',
      attackerSlotIndex: 0, defenderPlayerId: 'player-2', attackerCardName: 'アタッカー君', attackerBp: 3000,
    };
    render(<Board gameState={gameState} myPlayerId="player-1" dispatchAction={dispatchAction} isSoloMode={true} isFitMode={false} />);
    fireEvent.click(screen.getByText('ブロッカー君'));
    expect(dispatchAction).toHaveBeenCalledWith({
      type: 'BLOCK_ATTACK', payload: { actorPlayerId: 'player-2', blockerSlotIndex: 0 },
    });
  });

  it('retires neither character when attacker BP < defender BP (defender blocks and both survive)', () => {
    const gameState = setupTestGameState(2000, 3000);
    const dispatchAction = vi.fn();
    gameState.pendingCombat = {
      stage: 'BLOCK_DECISION', attackerPlayerId: 'player-1', attackerZone: 'frontLine',
      attackerSlotIndex: 0, defenderPlayerId: 'player-2', attackerCardName: 'アタッカー君', attackerBp: 2000,
    };

    render(
      <Board
        gameState={gameState}
        myPlayerId="player-1"
        dispatchAction={dispatchAction}
        isSoloMode={true}
        isFitMode={false}
      />
    );

    fireEvent.click(screen.getByText('ブロッカー君'));
    expect(dispatchAction).toHaveBeenCalledWith({
      type: 'BLOCK_ATTACK', payload: { actorPlayerId: 'player-2', blockerSlotIndex: 0 },
    });
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
    fireEvent.click(screen.getByRole('button', { name: /アタック対象を選択/ }));

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

  it('supports one-click quick attack button on active frontLine card to attack opponent player', () => {
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

    // Click quick attack button on attacker card directly
    const attackerCard = screen.getByText('アタッカー君').closest('div[draggable="true"]') as HTMLElement;
    const quickAttackBtn = within(attackerCard).getByTitle('アタック（1クリックで相手プレイヤーへ攻撃宣言）');
    expect(quickAttackBtn).toBeTruthy();
    fireEvent.click(quickAttackBtn);

    expect(dispatchAction).toHaveBeenCalledWith({
      type: 'DECLARE_PLAYER_ATTACK',
      payload: {
        actorPlayerId: 'player-1', attackerZone: 'frontLine', attackerSlotIndex: 0, defenderPlayerId: 'player-2',
      },
    });
  });

  it('triggers DECLARE_PLAYER_ATTACK from quick attack button even during MAIN phase', () => {
    const gameState = setupTestGameState(4000, 3000);
    gameState.phase = 'MAIN';
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

    const attackerCard = screen.getByText('アタッカー君').closest('div[draggable="true"]') as HTMLElement;
    const quickAttackBtn = within(attackerCard).getByTitle('アタック（1クリックで相手プレイヤーへ攻撃宣言）');
    expect(quickAttackBtn).toBeTruthy();
    fireEvent.click(quickAttackBtn);

    expect(dispatchAction).toHaveBeenCalledWith({
      type: 'DECLARE_PLAYER_ATTACK',
      payload: {
        actorPlayerId: 'player-1',
        attackerZone: 'frontLine',
        attackerSlotIndex: 0,
        defenderPlayerId: 'player-2',
      },
    });
  });

  it('asks confirmation via modal when attacking from non-MAIN/ATTACK phase and executes when confirmed', () => {
    const gameState = setupTestGameState(4000, 3000);
    gameState.phase = 'MOVE';
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

    const attackerCard = screen.getByText('アタッカー君').closest('div[draggable="true"]') as HTMLElement;
    const quickAttackBtn = within(attackerCard).getByTitle('アタック（1クリックで相手プレイヤーへ攻撃宣言）');
    fireEvent.click(quickAttackBtn);

    // Modal appears
    expect(screen.getByText('アタックフェイズへ移行')).toBeTruthy();
    expect(screen.getByText(/現在は【移動フェイズ】です/)).toBeTruthy();

    const confirmBtn = screen.getByRole('button', { name: 'アタックへ進む' });
    fireEvent.click(confirmBtn);

    expect(dispatchAction).toHaveBeenCalledWith({
      type: 'DECLARE_PLAYER_ATTACK',
      payload: {
        actorPlayerId: 'player-1',
        attackerZone: 'frontLine',
        attackerSlotIndex: 0,
        defenderPlayerId: 'player-2',
      },
    });
  });

  it('cancels attack when confirmation modal is cancelled during non-MAIN/ATTACK phase', () => {
    const gameState = setupTestGameState(4000, 3000);
    gameState.phase = 'MOVE';
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

    const attackerCard = screen.getByText('アタッカー君').closest('div[draggable="true"]') as HTMLElement;
    const quickAttackBtn = within(attackerCard).getByTitle('アタック（1クリックで相手プレイヤーへ攻撃宣言）');
    fireEvent.click(quickAttackBtn);

    expect(screen.getByText('アタックフェイズへ移行')).toBeTruthy();
    const cancelBtn = screen.getByRole('button', { name: 'キャンセル' });
    fireEvent.click(cancelBtn);

    expect(dispatchAction).not.toHaveBeenCalled();
    expect(screen.queryByText('アタックフェイズへ移行')).toBeNull();
  });

  it('shows synchronized combat controls only to the player whose decision is pending in P2P', () => {
    const gameState = setupTestGameState(4000, 3000);
    gameState.pendingCombat = {
      stage: 'BLOCK_DECISION', attackerPlayerId: 'player-1', attackerZone: 'frontLine',
      attackerSlotIndex: 0, defenderPlayerId: 'player-2', attackerCardName: 'アタッカー君', attackerBp: 4000,
    };
    const dispatchAction = vi.fn();
    const { rerender } = render(
      <Board gameState={gameState} myPlayerId="player-1" dispatchAction={dispatchAction} isSoloMode={false} />
    );

    expect(screen.queryByRole('button', { name: /通す/ })).toBeNull();
    expect(screen.getByRole('button', { name: '取消' })).toBeDefined();

    rerender(<Board gameState={gameState} myPlayerId="player-2" dispatchAction={dispatchAction} isSoloMode={false} />);
    expect(screen.getByRole('button', { name: /通す/ })).toBeDefined();
    expect(screen.queryByRole('button', { name: '取消' })).toBeNull();

    gameState.pendingCombat.stage = 'LIFE_SELECTION';
    rerender(<Board gameState={{ ...gameState }} myPlayerId="player-2" dispatchAction={dispatchAction} isSoloMode={false} />);
    expect(screen.queryByRole('button', { name: 'ライフを選択' })).toBeNull();
    expect(screen.getByText(/ライフを選択するのを待っています/)).toBeDefined();

    rerender(<Board gameState={{ ...gameState }} myPlayerId="player-1" dispatchAction={dispatchAction} isSoloMode={false} />);
    expect(screen.getByRole('button', { name: 'ライフを選択' })).toBeDefined();
  });

  it('allows manual trigger check on opponent life in P2P mode outside of combat', () => {
    const gameState = setupTestGameState(4000, 3000);
    gameState.pendingCombat = null;
    const dispatchAction = vi.fn();

    render(
      <Board
        gameState={gameState}
        myPlayerId="player-1"
        dispatchAction={dispatchAction}
        isSoloMode={false}
      />
    );

    // Opponent's SideZonesArea has check button and life cards
    const checkButtons = screen.getAllByRole('button', { name: /チェック/ });
    // First check button should be topPlayer's (opponent)
    fireEvent.click(checkButtons[0]);
    expect(dispatchAction).toHaveBeenCalledWith({
      type: 'CHECK_LIFE_TRIGGER',
      payload: { playerId: 'player-2', lifeIndex: 0 },
    });

    // Clicking opponent's second life card directly
    const opponentLife2 = screen.getByTitle('ライフ #2 - クリックでトリガーチェック');
    fireEvent.click(opponentLife2);
    expect(dispatchAction).toHaveBeenCalledWith({
      type: 'CHECK_LIFE_TRIGGER',
      payload: { playerId: 'player-2', lifeIndex: 1 },
    });
  });

  it('prompts confirmation modal before sending opponent life directly to graveyard (-1ダメ) in P2P mode', () => {
    const gameState = setupTestGameState(4000, 3000);
    gameState.pendingCombat = null;
    const dispatchAction = vi.fn();

    render(
      <Board
        gameState={gameState}
        myPlayerId="player-1"
        dispatchAction={dispatchAction}
        isSoloMode={false}
      />
    );

    const minusDamageBtn = screen.getByRole('button', { name: '-1ダメ' });
    fireEvent.click(minusDamageBtn);

    // Modal should appear
    expect(screen.getByText('相手ライフの直接場外送り')).toBeTruthy();

    // Cancel first
    fireEvent.click(screen.getByRole('button', { name: 'キャンセル' }));
    expect(dispatchAction).not.toHaveBeenCalled();
    expect(screen.queryByText('相手ライフの直接場外送り')).toBeNull();

    // Click again and confirm
    fireEvent.click(screen.getByRole('button', { name: '-1ダメ' }));
    fireEvent.click(screen.getByRole('button', { name: '場外へ送る' }));

    expect(dispatchAction).toHaveBeenCalledWith({
      type: 'TAKE_LIFE',
      payload: { playerId: 'player-2', destination: 'graveyard', lifeIndex: 0 },
    });
  });
});
