// @vitest-environment jsdom

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Board } from './Board';
import { createInitialGameState } from '../../domain/initialState';
import { Card } from '../../types/card';
import { GameState } from '../../types/game';
import { DND_MIME_TYPE } from '../../types/dnd';

function createDummyCard(id: string, name: string, cardType: Card['cardType'] = 'CHARACTER'): Card {
  return {
    id,
    code: `UA01BT/CGH-1-${id}`,
    name,
    cardType,
    color: 'PURPLE',
    bp: cardType === 'CHARACTER' ? 3000 : null,
    apCost: 1,
    reqEnergy: 2,
    genEnergy: 1,
    traits: ['テスト'],
    triggers: [],
    effectText: 'テスト効果テキスト',
    isRested: false,
    bpModifier: 0,
    underCards: [],
  };
}

describe('Board Event and Field Card Marker Operations', () => {
  it('opens marker modal when dragging an event card onto an existing character', () => {
    const state: GameState = createInitialGameState('player-1', 'Player 1', 'player-2', 'Player 2', 'player-1');
    state.status = 'PLAYING';
    state.phase = 'MAIN';
    state.activePlayerId = 'player-1';

    // 盤面に既存キャラ
    state.players['player-1'].frontLine[0] = createDummyCard('char-1', '盤面キャラ', 'CHARACTER');

    // 手札にイベントカード
    const eventCard = createDummyCard('event-1', 'イベントカード', 'EVENT');
    state.players['player-1'].hand = [eventCard];

    const dispatchAction = vi.fn();

    render(
      <Board
        gameState={state}
        myPlayerId="player-1"
        dispatchAction={dispatchAction}
      />
    );

    // 手札のイベントカードをクリックして選択
    const eventCardEl = screen.getByText('イベントカード');
    fireEvent.click(eventCardEl);

    // 盤面キャラ（フロントライン枠1）をクリック
    const charCardEl = screen.getByText('盤面キャラ');
    fireEvent.click(charCardEl);

    // 修正前は即座に墓地送り（MOVE_CARD to graveyard）され、モーダルが開かない
    // 修正後は「マーカー配置の確認」モーダルが開く
    expect(screen.getByText('マーカー配置の確認')).toBeTruthy();
    expect(screen.getByText('【マーカー配置】裏向きで下に置く')).toBeTruthy();

    // マーカー配置を実行
    fireEvent.click(screen.getByText('【マーカー配置】裏向きで下に置く'));

    expect(dispatchAction).toHaveBeenCalledWith({
      type: 'ADD_MARKER',
      payload: {
        playerId: 'player-1',
        targetZone: 'frontLine',
        targetSlotIndex: 0,
        from: { zone: 'hand', index: 0 },
        isFaceDown: true,
      },
    });
  });

  it('sends event card to graveyard when placed on an empty slot', () => {
    const state: GameState = createInitialGameState('player-1', 'Player 1', 'player-2', 'Player 2', 'player-1');
    state.status = 'PLAYING';
    state.phase = 'MAIN';
    state.activePlayerId = 'player-1';

    // 手札にイベントカード
    const eventCard = createDummyCard('event-1', '空枠イベント', 'EVENT');
    state.players['player-1'].hand = [eventCard];

    const dispatchAction = vi.fn();

    render(
      <Board
        gameState={state}
        myPlayerId="player-1"
        dispatchAction={dispatchAction}
      />
    );

    // 手札のイベントカードをクリックして選択
    const eventCardEl = screen.getByText('空枠イベント');
    fireEvent.click(eventCardEl);

    // 空きスロット（フロントライン枠1）をクリック
    const emptySlot = screen.getByRole('button', { name: /フロントライン 枠 1/ });
    fireEvent.click(emptySlot);

    // 空き枠の場合は墓地送り
    expect(dispatchAction).toHaveBeenCalledWith({
      type: 'MOVE_CARD',
      payload: {
        cardId: 'event-1',
        from: { playerId: 'player-1', zone: 'hand', index: 0 },
        to: { playerId: 'player-1', zone: 'graveyard' },
      },
    });
  });

  it('opens marker modal when dropping an event card onto an existing character', () => {
    const state: GameState = createInitialGameState('player-1', 'Player 1', 'player-2', 'Player 2', 'player-1');
    state.status = 'PLAYING';
    state.phase = 'MAIN';
    state.activePlayerId = 'player-1';

    // 盤面に既存キャラ
    state.players['player-1'].frontLine[0] = createDummyCard('char-1', '盤面キャラ', 'CHARACTER');

    // 手札にイベントカード
    const eventCard = createDummyCard('event-drop', 'ドロップイベント', 'EVENT');
    state.players['player-1'].hand = [eventCard];

    const dispatchAction = vi.fn();

    render(
      <Board
        gameState={state}
        myPlayerId="player-1"
        dispatchAction={dispatchAction}
      />
    );

    // キャラクターがいるスロットに対して、手札のイベントカードをドロップ
    const slotEl = document.getElementById('slot-player-1-frontLine-0')!;
    const payload = JSON.stringify({
      cardId: 'event-drop',
      from: { playerId: 'player-1', zone: 'hand', index: 0 },
    });

    fireEvent.drop(slotEl, {
      dataTransfer: {
        getData: (mime: string) => (mime === DND_MIME_TYPE ? payload : ''),
      },
    });

    // モーダルが開き、マーカー配置ができること
    expect(screen.getByText('マーカー配置の確認')).toBeTruthy();
    fireEvent.click(screen.getByText('【マーカー配置】裏向きで下に置く'));

    expect(dispatchAction).toHaveBeenCalledWith({
      type: 'ADD_MARKER',
      payload: {
        playerId: 'player-1',
        targetZone: 'frontLine',
        targetSlotIndex: 0,
        from: { zone: 'hand', index: 0 },
        isFaceDown: true,
      },
    });
  });
});
