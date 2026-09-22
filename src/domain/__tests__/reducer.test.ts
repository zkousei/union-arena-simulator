import { describe, it, expect } from 'vitest';
import { gameReducer } from '../reducer';
import { createInitialGameState } from '../initialState';
import { Card } from '../../types/card';

// テスト用ダミーカード生成
function createDummyCard(id: string, name: string, bp: number = 3000): Card {
  return {
    id,
    code: `TEST-${id}`,
    name,
    cardType: 'CHARACTER',
    color: 'PURPLE',
    bp,
    apCost: 1,
    reqEnergy: 2,
    genEnergy: 1,
    traits: ['テスト'],
    triggers: ['DRAW'],
    effectText: 'テストカード効果',
    isRested: false,
    bpModifier: 0,
    underCards: [],
  };
}

describe('gameReducer Official Rules Unit Tests', () => {
  it('redacts card names from logs when moving a hidden hand card to a hidden zone', () => {
    let state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
    const secret = createDummyCard('secret-hand', '秘密の手札');
    state.players['p1'].hand = [secret];

    state = gameReducer(state, {
      type: 'MOVE_CARD',
      payload: {
        cardId: secret.id,
        from: { playerId: 'p1', zone: 'hand', index: 0 },
        to: { playerId: 'p1', zone: 'life', isFaceDown: true },
      },
    });

    const message = state.logs[state.logs.length - 1].message;
    expect(message).not.toContain(secret.name);
    expect(message).toContain('非公開カード');

    let publicState = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
    publicState.players['p1'].hand = [secret];
    publicState = gameReducer(publicState, {
      type: 'MOVE_CARD',
      payload: {
        cardId: secret.id,
        from: { playerId: 'p1', zone: 'hand', index: 0 },
        to: { playerId: 'p1', zone: 'life', isFaceDown: false },
      },
    });
    expect(publicState.logs[publicState.logs.length - 1].message).toContain(secret.name);
  });

  it('redacts a face-down marker name when it moves to another hidden zone', () => {
    let state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
    const secret = { ...createDummyCard('secret-marker', '秘密のマーカー'), isFaceDown: true };
    state.players['p1'].frontLine[0] = {
      ...createDummyCard('host', '親カード'),
      underCards: [secret],
    };

    state = gameReducer(state, {
      type: 'SEPARATE_UNDER_CARD',
      payload: {
        playerId: 'p1',
        zone: 'frontLine',
        slotIndex: 0,
        underCardId: secret.id,
        destination: 'hand',
      },
    });

    const message = state.logs[state.logs.length - 1].message;
    expect(message).not.toContain(secret.name);
    expect(message).toContain('非公開カード');
  });

  it('redacts hidden life, deck-check, and deck-search results that move to hidden zones', () => {
    let state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
    const secretLife = { ...createDummyCard('secret-life', '秘密のライフ'), isFaceDown: true };
    state.players['p1'].life = [secretLife];

    state = gameReducer(state, {
      type: 'TAKE_LIFE',
      payload: { playerId: 'p1', destination: 'hand', lifeIndex: 0 },
    });
    expect(state.logs[state.logs.length - 1].message).not.toContain(secretLife.name);

    const checkedCard = createDummyCard('checked', '秘密の確認カード');
    let checkedState = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
    checkedState.revealedDeckCards = { playerId: 'p1', cards: [checkedCard] };
    checkedState = gameReducer(checkedState, {
      type: 'RESOLVE_TOP_DECK_CARD',
      payload: { playerId: 'p1', cardId: checkedCard.id, destination: 'bottom' },
    });
    expect(checkedState.logs[checkedState.logs.length - 1].message).not.toContain(checkedCard.name);

    const searchedCard = createDummyCard('searched', '秘密の検索カード');
    let searchedState = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
    searchedState.players['p1'].deck = [searchedCard];
    searchedState = gameReducer(searchedState, {
      type: 'SEARCH_DECK_CARD',
      payload: { playerId: 'p1', cardId: searchedCard.id, destination: 'life' },
    });
    expect(searchedState.logs[searchedState.logs.length - 1].message).not.toContain(searchedCard.name);
  });

  it('should initialize game state with PREPARING status', () => {
    const state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
    expect(state.status).toBe('PREPARING');
    expect(state.turn).toBe(1);
    expect(state.activePlayerId).toBe('p1');
    expect(state.players['p1'].isFirst).toBe(true);
    expect(state.players['p2'].isFirst).toBe(false);
  });

  it('should setup deck with hand 7, deck 43, and life 0 before mulligan (Official Rule Ver 1.1)', () => {
    const state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
    const dummyCards = Array.from({ length: 50 }, (_, i) => createDummyCard(`c-${i}`, `Card ${i}`));

    const nextState = gameReducer(state, {
      type: 'SETUP_GAME',
      payload: {
        playerId: 'p1',
        deckCards: dummyCards,
        apCards: [],
      },
    });

    const p1 = nextState.players['p1'];
    expect(p1.hand.length).toBe(7); // 公式ルール: 初手7枚
    expect(p1.deck.length).toBe(43); // 50 - 7 = 43枚 (ライフはマリガン後に配置)
    expect(p1.life.length).toBe(0);
    expect(p1.hasMulliganed).toBe(false);
    expect(p1.isHandKept).toBe(false);
  });

  it('should mulligan from 43 deck cards, shuffle previous hand, and allow placing life after (Official Rule Ver 1.1)', () => {
    let state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
    const dummyCards = Array.from({ length: 50 }, (_, i) => createDummyCard(`c-${i}`, `Card ${i}`));

    state = gameReducer(state, {
      type: 'SETUP_GAME',
      payload: { playerId: 'p1', deckCards: dummyCards, apCards: [] },
    });

    const initialHandIds = state.players['p1'].hand.map((c) => c.id);

    // マリガン実行: 山札43枚から引き直し、元手札を山札に戻してシャッフル
    state = gameReducer(state, {
      type: 'MULLIGAN',
      payload: { playerId: 'p1' },
    });

    const p1 = state.players['p1'];
    expect(p1.hasMulliganed).toBe(true);
    expect(p1.isHandKept).toBe(true);
    expect(p1.hand.length).toBe(7);
    expect(p1.deck.length).toBe(43); // 山札43枚を維持
    expect(p1.hand.map((c) => c.id)).not.toEqual(initialHandIds);

    // 2回目のマリガンは無視される
    const handBefore = p1.hand;
    state = gameReducer(state, {
      type: 'MULLIGAN',
      payload: { playerId: 'p1' },
    });
    expect(state.players['p1'].hand).toBe(handBefore);

    // マリガン終了後、ライフ7枚を配置 (43 - 7 = 36枚)
    state = gameReducer(state, {
      type: 'PLACE_INITIAL_LIFE',
      payload: { playerId: 'p1' },
    });
    expect(state.players['p1'].life.length).toBe(7);
    expect(state.players['p1'].deck.length).toBe(36);
    expect(state.players['p1'].life.every((c) => c.isFaceDown)).toBe(true);
  });

  it('should support KEEP_HAND and start after both players place life', () => {
    let state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
    const p1Cards = Array.from({ length: 50 }, (_, i) => createDummyCard(`p1-${i}`, `P1 Card ${i}`));
    const p2Cards = Array.from({ length: 50 }, (_, i) => createDummyCard(`p2-${i}`, `P2 Card ${i}`));

    state = gameReducer(state, {
      type: 'SETUP_GAME',
      payload: { playerId: 'p1', deckCards: p1Cards, apCards: [] },
    });
    state = gameReducer(state, {
      type: 'SETUP_GAME',
      payload: { playerId: 'p2', deckCards: p2Cards, apCards: [] },
    });

    // キープ
    state = gameReducer(state, {
      type: 'KEEP_HAND',
      payload: { playerId: 'p1' },
    });
    expect(state.players['p1'].isHandKept).toBe(true);

    // キープ後はマリガン不可
    const handBefore = state.players['p1'].hand;
    state = gameReducer(state, {
      type: 'MULLIGAN',
      payload: { playerId: 'p1' },
    });
    expect(state.players['p1'].hand).toBe(handBefore);

    state = gameReducer(state, { type: 'PLACE_INITIAL_LIFE', payload: { playerId: 'p1' } });
    state = gameReducer(state, { type: 'KEEP_HAND', payload: { playerId: 'p2' } });
    state = gameReducer(state, { type: 'PLACE_INITIAL_LIFE', payload: { playerId: 'p2' } });
    state = gameReducer(state, { type: 'START_GAME' });
    expect(state.status).toBe('PLAYING');
    expect(state.players['p1'].life.length).toBe(7);
    expect(state.players['p1'].deck.length).toBe(36);
  });

  it('should not start the game until both players have set a deck', () => {
    let state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
    const p1Cards = Array.from({ length: 50 }, (_, i) => createDummyCard(`p1-${i}`, `P1 Card ${i}`));

    state = gameReducer(state, {
      type: 'SETUP_GAME',
      payload: { playerId: 'p1', deckCards: p1Cards, apCards: [] },
    });
    state = gameReducer(state, { type: 'START_GAME' });

    expect(state.status).toBe('PREPARING');
    expect(state.turn).toBe(1);
    expect(state.players['p1'].life).toHaveLength(0);
    expect(state.logs.some((log) => log.message.includes('ゲームが開始されました'))).toBe(false);
  });

  it('should reject life placement before keep or mulligan', () => {
    let state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
    const cards = Array.from({ length: 50 }, (_, i) => createDummyCard(`p1-${i}`, `P1 Card ${i}`));
    state = gameReducer(state, {
      type: 'SETUP_GAME',
      payload: { playerId: 'p1', deckCards: cards, apCards: [] },
    });

    const before = state;
    state = gameReducer(state, { type: 'PLACE_INITIAL_LIFE', payload: { playerId: 'p1' } });

    expect(state).toBe(before);
    expect(state.players['p1'].life).toHaveLength(0);
    expect(state.players['p1'].deck).toHaveLength(43);
  });

  it('should reject game start until both players determine their hands and place life', () => {
    let state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
    for (const playerId of ['p1', 'p2']) {
      const cards = Array.from({ length: 50 }, (_, i) =>
        createDummyCard(`${playerId}-${i}`, `${playerId} Card ${i}`)
      );
      state = gameReducer(state, {
        type: 'SETUP_GAME',
        payload: { playerId, deckCards: cards, apCards: [] },
      });
    }

    state = gameReducer(state, { type: 'START_GAME' });
    expect(state.status).toBe('PREPARING');

    for (const playerId of ['p1', 'p2']) {
      state = gameReducer(state, { type: 'KEEP_HAND', payload: { playerId } });
    }
    state = gameReducer(state, { type: 'START_GAME' });
    expect(state.status).toBe('PREPARING');
  });

  it('should place card into field with RESTED state (Ver 1.1 official rule)', () => {
    let state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
    const card = createDummyCard('card-1', 'Lelouch');
    state.players['p1'].hand = [card];

    // 手札 -> フロントライン
    state = gameReducer(state, {
      type: 'MOVE_CARD',
      payload: {
        cardId: 'card-1',
        from: { playerId: 'p1', zone: 'hand', index: 0 },
        to: { playerId: 'p1', zone: 'frontLine', slotIndex: 0 },
      },
    });

    const placedCard = state.players['p1'].frontLine[0];
    expect(placedCard).not.toBeNull();
    expect(placedCard?.name).toBe('Lelouch');
    // 公式ルール: 登場時はレスト！
    expect(placedCard?.isRested).toBe(true);
  });

  it('should set raid card to ACTIVE state even if base card was rested (Ver 1.1 official rule)', () => {
    let state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
    const baseCard = { ...createDummyCard('base-1', 'Suzaku Kururugi'), isRested: true };
    const raidCard = createDummyCard('raid-1', 'Lancelot (Raid)', 4500);

    state.players['p1'].frontLine[0] = baseCard;
    state.players['p1'].hand = [raidCard];

    state = gameReducer(state, {
      type: 'RAID_CARD',
      payload: {
        playerId: 'p1',
        targetZone: 'frontLine',
        targetSlotIndex: 0,
        raidCard,
        fromLocation: { playerId: 'p1', zone: 'hand', index: 0 },
      },
    });

    const activeSlotCard = state.players['p1'].frontLine[0];
    expect(activeSlotCard?.name).toBe('Lancelot (Raid)');
    // 公式ルール: レストの場合アクティブにする！
    expect(activeSlotCard?.isRested).toBe(false);
    expect(activeSlotCard?.underCards.length).toBe(1);
    expect(activeSlotCard?.underCards[0].name).toBe('Suzaku Kururugi');
    expect(activeSlotCard?.underCards[0].isMarker).toBe(false);
  });

  it('should send triggered card to graveyard by default on dismiss (Ver 1.1 official rule)', () => {
    let state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
    const lifeCard = createDummyCard('life-1', 'Trigger Card');
    lifeCard.triggers = ['SPECIAL'];
    state.players['p1'].life = [lifeCard];

    // ライフをチェック
    state = gameReducer(state, {
      type: 'CHECK_LIFE_TRIGGER',
      payload: { playerId: 'p1' },
    });

    expect(state.revealedCard?.card.name).toBe('Trigger Card');

    // トリガー処理後、場外へ送る
    state = gameReducer(state, {
      type: 'DISMISS_REVEALED_CARD',
      payload: { destination: 'graveyard' },
    });

    expect(state.revealedCard).toBeNull();
    expect(state.players['p1'].graveyard.length).toBe(1);
    expect(state.players['p1'].graveyard[0].name).toBe('Trigger Card');
  });

  it('allows non-owner to cancel trigger check and return card to owner life, but rejects non-owner sending to graveyard or hand', () => {
    let state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
    const lifeCard = createDummyCard('trig-1', 'Trigger Card');
    state.players['p2'].life = [lifeCard];

    // p1 triggers p2's life
    state = gameReducer(state, {
      type: 'CHECK_LIFE_TRIGGER',
      payload: { playerId: 'p2' },
    });
    expect(state.revealedCard?.fromPlayerId).toBe('p2');
    expect(state.players['p2'].life.length).toBe(0);

    // p1 attempts to send to graveyard -> rejected
    const stateAfterGraveyard = gameReducer(state, {
      type: 'DISMISS_REVEALED_CARD',
      payload: { destination: 'graveyard', actorPlayerId: 'p1' },
    });
    expect(stateAfterGraveyard.revealedCard).not.toBeNull();
    expect(stateAfterGraveyard.players['p2'].graveyard.length).toBe(0);

    // p1 attempts to cancel and return to p2's life -> allowed
    const stateAfterCancel = gameReducer(state, {
      type: 'DISMISS_REVEALED_CARD',
      payload: { destination: 'life', actorPlayerId: 'p1' },
    });
    expect(stateAfterCancel.revealedCard).toBeNull();
    expect(stateAfterCancel.players['p2'].life.length).toBe(1);
    expect(stateAfterCancel.players['p2'].life[0].name).toBe('Trigger Card');
    expect(stateAfterCancel.players['p2'].life[0].isFaceDown).toBe(true);
  });

  it('should handle extra draw in start phase for 1 AP', () => {
    let state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
    state.players['p1'].apCurrent = 2;
    state.players['p1'].deck = [createDummyCard('top-1', 'Top Card')];
    state.players['p1'].hand = [];

    state = gameReducer(state, {
      type: 'EXTRA_DRAW',
      payload: { playerId: 'p1' },
    });

    expect(state.players['p1'].apCurrent).toBe(1);
    expect(state.players['p1'].hasExtraDrawn).toBe(true);
    expect(state.players['p1'].hand.length).toBe(1);
    expect(state.players['p1'].hand[0].name).toBe('Top Card');

    // 2回目は不可
    state = gameReducer(state, {
      type: 'EXTRA_DRAW',
      payload: { playerId: 'p1' },
    });
    expect(state.players['p1'].apCurrent).toBe(1);
    expect(state.players['p1'].hand.length).toBe(1);
  });

  it('should reject invalid AP consumption and recovery amounts', () => {
    let state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
    state.players['p1'].apCurrent = 1;
    state.players['p1'].apMax = 3;

    const beforeInsufficientUse = state;
    state = gameReducer(state, { type: 'USE_AP', payload: { playerId: 'p1', amount: 2 } });
    expect(state).toBe(beforeInsufficientUse);

    const beforeZeroUse = state;
    state = gameReducer(state, { type: 'USE_AP', payload: { playerId: 'p1', amount: 0 } });
    expect(state).toBe(beforeZeroUse);

    const beforeNegativeRecovery = state;
    state = gameReducer(state, { type: 'RECOVER_AP', payload: { playerId: 'p1', amount: -1 } });
    expect(state).toBe(beforeNegativeRecovery);

    state = gameReducer(state, { type: 'USE_AP', payload: { playerId: 'p1', amount: 1 } });
    expect(state.players['p1'].apCurrent).toBe(0);
    state = gameReducer(state, { type: 'RECOVER_AP', payload: { playerId: 'p1', amount: 2 } });
    expect(state.players['p1'].apCurrent).toBe(2);
  });

  it('should notify defeat condition when drawing from an empty deck without affecting hand or crashing', () => {
    const state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');

    const nextState = gameReducer(state, { type: 'DRAW_CARD', payload: { playerId: 'p1', count: 1 } });

    expect(nextState.players.p1.hand).toHaveLength(0);
    expect(nextState.players.p1.deck).toHaveLength(0);
    expect(nextState.status).toBe('PREPARING');
    expect(nextState.logs.some((l) => l.message.includes('【山札0枚】'))).toBe(true);
  });

  it('should reject passing a turn for a player who is not active', () => {
    const state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');

    const nextState = gameReducer(state, { type: 'PASS_TURN', payload: { playerId: 'p2' } });

    expect(nextState).toBe(state);
    expect(nextState.turn).toBe(1);
    expect(nextState.activePlayerId).toBe('p1');
  });

  it('should reject an out-of-range life index instead of taking another card', () => {
    const state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
    state.players['p1'].life = [createDummyCard('life-1', 'Life 1')];

    const negativeResult = gameReducer(state, {
      type: 'TAKE_LIFE',
      payload: { playerId: 'p1', destination: 'hand', lifeIndex: -1 },
    });
    const overflowResult = gameReducer(state, {
      type: 'TAKE_LIFE',
      payload: { playerId: 'p1', destination: 'hand', lifeIndex: 2 },
    });

    expect(negativeResult).toBe(state);
    expect(overflowResult).toBe(state);
  });

  it('should reroll all rested field cards when entering END phase (Ver 1.1 official rule)', () => {
    let state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
    state.players['p1'].frontLine[0] = { ...createDummyCard('c1', 'C1'), isRested: true };
    state.players['p1'].energyLine[0] = { ...createDummyCard('c2', 'C2'), isRested: true };

    state = gameReducer(state, {
      type: 'SET_PHASE',
      payload: { phase: 'END' },
    });

    // エンドフェイズ突入時、相手ターンのブロックのため全アクティブ化
    expect(state.players['p1'].frontLine[0]?.isRested).toBe(false);
    expect(state.players['p1'].energyLine[0]?.isRested).toBe(false);
  });

  it('should scale AP across rounds: Round 1 (1/2), Round 2 (2/2), Round 3+ (3/3)', () => {
    let state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
    state.status = 'PLAYING';
    state.players['p1'].isFirst = true;
    state.players['p2'].isFirst = false;

    // 先攻 p1 の Turn 1 -> AP 1
    state = gameReducer(state, { type: 'START_GAME' });
    expect(state.players['p1'].apMax).toBe(1);
    expect(state.players['p1'].apCurrent).toBe(1);

    // 後攻 p2 の Turn 2 (Round 1) -> AP 2
    state = gameReducer(state, { type: 'PASS_TURN', payload: { playerId: 'p1' } });
    expect(state.turn).toBe(2);
    expect(state.activePlayerId).toBe('p2');
    expect(state.players['p2'].apMax).toBe(2);

    // 先攻 p1 の Turn 3 (Round 2) -> AP 2
    state = gameReducer(state, { type: 'PASS_TURN', payload: { playerId: 'p2' } });
    expect(state.turn).toBe(3);
    expect(state.activePlayerId).toBe('p1');
    expect(state.players['p1'].apMax).toBe(2);

    // 後攻 p2 の Turn 4 (Round 2) -> AP 2
    state = gameReducer(state, { type: 'PASS_TURN', payload: { playerId: 'p1' } });
    expect(state.turn).toBe(4);
    expect(state.players['p2'].apMax).toBe(2);

    // 先攻 p1 の Turn 5 (Round 3) -> AP 3
    state = gameReducer(state, { type: 'PASS_TURN', payload: { playerId: 'p2' } });
    expect(state.turn).toBe(5);
    expect(state.players['p1'].apMax).toBe(3);
  });

  it('should automatically active all rested cards of the player finishing their turn on PASS_TURN even if END phase was not clicked', () => {
    let state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
    const card1 = createDummyCard('f-1', 'Front Attacker');
    const card2 = createDummyCard('e-1', 'Energy Gen');
    state.players['p1'].hand = [card1, card2];

    // 手札からフロントラインとエナジーラインへ配置（Ver 1.1ルールにより自動的に isRested = true）
    state = gameReducer(state, {
      type: 'MOVE_CARD',
      payload: {
        cardId: 'f-1',
        from: { playerId: 'p1', zone: 'hand', index: 0 },
        to: { playerId: 'p1', zone: 'frontLine', slotIndex: 0 },
      },
    });
    state = gameReducer(state, {
      type: 'MOVE_CARD',
      payload: {
        cardId: 'e-1',
        from: { playerId: 'p1', zone: 'hand', index: 0 },
        to: { playerId: 'p1', zone: 'energyLine', slotIndex: 0 },
      },
    });

    expect(state.players['p1'].frontLine[0]?.isRested).toBe(true);
    expect(state.players['p1'].energyLine[0]?.isRested).toBe(true);

    // フェイズは ATTACK のまま、ENDフェイズボタンを押さずに PASS_TURN を実行
    state = gameReducer(state, { type: 'SET_PHASE', payload: { phase: 'ATTACK' } });
    state = gameReducer(state, { type: 'PASS_TURN', payload: { playerId: 'p1' } });

    // ターン終了した p1 のカードがすべてアクティブ（リロール）になっていること
    expect(state.players['p1'].frontLine[0]?.isRested).toBe(false);
    expect(state.players['p1'].energyLine[0]?.isRested).toBe(false);
    // 新ターン p2 の状態
    expect(state.turn).toBe(2);
    expect(state.activePlayerId).toBe('p2');
    expect(state.phase).toBe('START');
  });

  it('should reset temporary bpModifier on all field cards to 0 upon PASS_TURN', () => {
    let state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
    const card1 = createDummyCard('f-1', 'Buffed Attacker');
    state.players['p1'].frontLine[0] = card1;

    // +1000 BPバフを付与
    state = gameReducer(state, {
      type: 'MODIFY_BP',
      payload: { playerId: 'p1', zone: 'frontLine', slotIndex: 0, delta: 1000 },
    });
    expect(state.players['p1'].frontLine[0]?.bpModifier).toBe(1000);

    // ターン終了
    state = gameReducer(state, { type: 'PASS_TURN', payload: { playerId: 'p1' } });

    // 一時的BP補正が0にリセットされていること
    expect(state.players['p1'].frontLine[0]?.bpModifier).toBe(0);
  });

  it('adjusts energy on an energy-line card and clears it when the card leaves the field', () => {
    let state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
    state.players.p1.energyLine[0] = { ...createDummyCard('e-1', 'Energy'), isRested: true };
    state = gameReducer(state, { type: 'MODIFY_ENERGY', payload: { playerId: 'p1', zone: 'energyLine', slotIndex: 0, delta: 1 } });
    expect(state.players.p1.energyLine[0]?.genEnergyModifier).toBe(1);
    state = gameReducer(state, { type: 'MODIFY_ENERGY', payload: { playerId: 'p1', zone: 'energyLine', slotIndex: 0, delta: -1 } });
    expect(state.players.p1.energyLine[0]?.genEnergyModifier).toBe(0);
    state = gameReducer(state, { type: 'MODIFY_ENERGY', payload: { playerId: 'p1', zone: 'energyLine', slotIndex: 0, delta: 1 } });
    state = gameReducer(state, { type: 'MOVE_CARD', payload: { cardId: 'e-1', from: { playerId: 'p1', zone: 'energyLine', slotIndex: 0 }, to: { playerId: 'p1', zone: 'hand' } } });
    expect(state.players.p1.hand[0]?.genEnergyModifier).toBe(0);
  });

  it('ignores invalid energy adjustments without changing game state', () => {
    const state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
    state.players.p1.energyLine[0] = createDummyCard('e-1', 'Energy');
    expect(gameReducer(state, { type: 'MODIFY_ENERGY', payload: { playerId: 'p1', zone: 'energyLine', slotIndex: 0, delta: -2 } })).toBe(state);
    expect(gameReducer(state, { type: 'MODIFY_ENERGY', payload: { playerId: 'p1', zone: 'energyLine', slotIndex: 1, delta: 1 } })).toBe(state);
    expect(gameReducer(state, { type: 'MODIFY_ENERGY', payload: { playerId: 'p1', zone: 'energyLine', slotIndex: 0, delta: 0.5 } })).toBe(state);
  });

  it('should look at top N cards of deck and route them to hand, graveyard, top or bottom', () => {
    let state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
    state.players['p1'].deck = [
      createDummyCard('top-1', 'Card 1'),
      createDummyCard('top-2', 'Card 2'),
      createDummyCard('top-3', 'Card 3'),
    ];

    // 上から2枚確認
    state = gameReducer(state, {
      type: 'LOOK_AT_TOP_DECK',
      payload: { playerId: 'p1', count: 2 },
    });

    expect(state.revealedDeckCards).not.toBeNull();
    expect(state.revealedDeckCards?.cards.length).toBe(2);
    expect(state.players['p1'].deck.length).toBe(1);

    // 1枚目を手札へ
    state = gameReducer(state, {
      type: 'RESOLVE_TOP_DECK_CARD',
      payload: { playerId: 'p1', cardId: 'top-1', destination: 'hand' },
    });
    expect(state.players['p1'].hand.length).toBe(1);
    expect(state.players['p1'].hand[0].name).toBe('Card 1');
    expect(state.revealedDeckCards?.cards.length).toBe(1);

    // 2枚目を山札の下へ
    state = gameReducer(state, {
      type: 'RESOLVE_TOP_DECK_CARD',
      payload: { playerId: 'p1', cardId: 'top-2', destination: 'bottom' },
    });
    // 全て処理完了で自動クローズ
    expect(state.revealedDeckCards).toBeNull();
    expect(state.players['p1'].deck.length).toBe(2);
    expect(state.players['p1'].deck[1].name).toBe('Card 2'); // bottom
  });

  it('should preserve card order when closing the top-deck viewer without resolving cards', () => {
    let state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
    state.players['p1'].deck = [
      createDummyCard('top-1', 'Card 1'),
      createDummyCard('top-2', 'Card 2'),
      createDummyCard('top-3', 'Card 3'),
      createDummyCard('top-4', 'Card 4'),
    ];

    state = gameReducer(state, {
      type: 'LOOK_AT_TOP_DECK',
      payload: { playerId: 'p1', count: 3 },
    });
    state = gameReducer(state, {
      type: 'CLOSE_TOP_DECK',
      payload: { playerId: 'p1', shuffleRemaining: false },
    });

    expect(state.players['p1'].deck.map((card) => card.id)).toEqual([
      'top-1',
      'top-2',
      'top-3',
      'top-4',
    ]);
  });

  it('should search card from deck and add to hand or graveyard', () => {
    let state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
    state.players['p1'].deck = [
      createDummyCard('c-1', 'Zero'),
      createDummyCard('c-2', 'Lelouch'),
    ];

    // デッキからLelouchを手札へ
    state = gameReducer(state, {
      type: 'SEARCH_DECK_CARD',
      payload: { playerId: 'p1', cardId: 'c-2', destination: 'hand' },
    });

    expect(state.players['p1'].hand.length).toBe(1);
    expect(state.players['p1'].hand[0].name).toBe('Lelouch');
    expect(state.players['p1'].deck.length).toBe(1);
    expect(state.players['p1'].deck[0].name).toBe('Zero');
  });

  it('should support searching deck card directly to removed, life, and frontLine', () => {
    let state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
    state.players['p1'].deck = [
      createDummyCard('c-1', 'Card 1'),
      createDummyCard('c-2', 'Card 2'),
      createDummyCard('c-3', 'Card 3'),
    ];

    // c-1をリムーブへ
    state = gameReducer(state, {
      type: 'SEARCH_DECK_CARD',
      payload: { playerId: 'p1', cardId: 'c-1', destination: 'removed' },
    });
    expect(state.players['p1'].removed).toHaveLength(1);
    expect(state.players['p1'].removed[0].id).toBe('c-1');

    // c-2をライフ(表向き)へ
    state = gameReducer(state, {
      type: 'SEARCH_DECK_CARD',
      payload: { playerId: 'p1', cardId: 'c-2', destination: 'lifeFaceUp' },
    });
    expect(state.players['p1'].life).toHaveLength(1);
    expect(state.players['p1'].life[0].isFaceDown).toBe(false);

    // c-3をフロントラインへ（slotIndex未指定で空き枠自動配置）
    state = gameReducer(state, {
      type: 'SEARCH_DECK_CARD',
      payload: { playerId: 'p1', cardId: 'c-3', destination: 'frontLine' },
    });
    expect(state.players['p1'].frontLine[0]?.id).toBe('c-3');
    expect(state.players['p1'].frontLine[0]?.isRested).toBe(true);
    expect(state.players['p1'].deck).toHaveLength(0);
  });

  it('should move all underCards to graveyard when a raid card is retired to graveyard', () => {
    let state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
    const baseCard = createDummyCard('base-1', 'Suzaku');
    const raidCard = {
      ...createDummyCard('raid-1', 'Lancelot', 4000),
      underCards: [baseCard],
    };

    // p1のフロントライン枠0にレイドカードを配置
    state.players['p1'].frontLine[0] = raidCard;

    // レイドカードを場外へ送る
    state = gameReducer(state, {
      type: 'MOVE_CARD',
      payload: {
        cardId: 'raid-1',
        from: { playerId: 'p1', zone: 'frontLine', slotIndex: 0 },
        to: { playerId: 'p1', zone: 'graveyard' },
      },
    });

    const p1 = state.players['p1'];
    expect(p1.frontLine[0]).toBeNull();
    // 親カードと下敷きカードの両方が場外にあること（消滅バグ解消の検証）
    expect(p1.graveyard.length).toBe(2);
    expect(p1.graveyard.map((c) => c.name)).toContain('Lancelot');
    expect(p1.graveyard.map((c) => c.name)).toContain('Suzaku');
  });

  it('should bounce parent raid card to hand and send underCards to graveyard (Official Rule Ver 1.1)', () => {
    let state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
    const baseCard1 = createDummyCard('base-1', 'Suzaku 1');
    const baseCard2 = createDummyCard('base-2', 'Suzaku 2');
    const raidCard = {
      ...createDummyCard('raid-1', 'Lancelot Albion', 5000),
      underCards: [baseCard1, baseCard2],
    };

    state.players['p1'].frontLine[1] = raidCard;

    // レイドカードを手札に戻す（バウンス）
    state = gameReducer(state, {
      type: 'MOVE_CARD',
      payload: {
        cardId: 'raid-1',
        from: { playerId: 'p1', zone: 'frontLine', slotIndex: 1 },
        to: { playerId: 'p1', zone: 'hand' },
      },
    });

    const p1 = state.players['p1'];
    expect(p1.frontLine[1]).toBeNull();
    // 親カードは手札に戻り、underCardsはクリアされている
    expect(p1.hand.length).toBe(1);
    expect(p1.hand[0].name).toBe('Lancelot Albion');
    expect(p1.hand[0].underCards.length).toBe(0);

    // 下敷きカードはすべて場外へ送られる
    expect(p1.graveyard.length).toBe(2);
    expect(p1.graveyard.map((c) => c.name)).toEqual(['Suzaku 1', 'Suzaku 2']);
  });

  it('should swap cards between field slots without overwriting or deleting either card', () => {
    let state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
    const cardA = createDummyCard('card-a', 'Card A');
    const cardB = createDummyCard('card-b', 'Card B');

    state.players['p1'].frontLine[0] = cardA;
    state.players['p1'].frontLine[1] = cardB;

    // 枠0のカードAを枠1へ移動（スワップ発生）
    state = gameReducer(state, {
      type: 'MOVE_CARD',
      payload: {
        cardId: 'card-a',
        from: { playerId: 'p1', zone: 'frontLine', slotIndex: 0 },
        to: { playerId: 'p1', zone: 'frontLine', slotIndex: 1 },
      },
    });

    const p1 = state.players['p1'];
    expect(p1.frontLine[0]?.name).toBe('Card B');
    expect(p1.frontLine[1]?.name).toBe('Card A');
  });

  it('should correctly separate under card to hand, graveyard, or empty field slot', () => {
    let state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
    const under1 = createDummyCard('u-1', 'Under 1');
    const under2 = createDummyCard('u-2', 'Under 2');
    const raidCard = {
      ...createDummyCard('raid-host', 'Host Card'),
      underCards: [under1, under2],
    };

    state.players['p1'].frontLine[0] = raidCard;

    // 1枚目 (u-1) を手札に分離
    state = gameReducer(state, {
      type: 'SEPARATE_UNDER_CARD',
      payload: {
        playerId: 'p1',
        zone: 'frontLine',
        slotIndex: 0,
        underCardId: 'u-1',
        destination: 'hand',
      },
    });

    expect(state.players['p1'].hand.length).toBe(1);
    expect(state.players['p1'].hand[0].name).toBe('Under 1');
    expect(state.players['p1'].frontLine[0]?.underCards.length).toBe(1);

    // 2枚目 (u-2) を空き枠のフロントラインに出す
    state = gameReducer(state, {
      type: 'SEPARATE_UNDER_CARD',
      payload: {
        playerId: 'p1',
        zone: 'frontLine',
        slotIndex: 0,
        underCardId: 'u-2',
        destination: 'frontLine',
      },
    });

    expect(state.players['p1'].frontLine[0]?.underCards.length).toBe(0);
    // 空き枠（スロット1）に登場し、レスト状態になっていること
    expect(state.players['p1'].frontLine[1]?.name).toBe('Under 2');
    expect(state.players['p1'].frontLine[1]?.isRested).toBe(true);
  });

  it('should add marker from top of deck or hand under a field character', () => {
    let state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
    const hostCard = createDummyCard('host-1', 'Bakugo');
    const topDeckCard = createDummyCard('deck-1', 'Marker from Deck');
    const handCard = createDummyCard('hand-1', 'Marker from Hand');

    state.players['p1'].frontLine[0] = hostCard;
    state.players['p1'].deck = [topDeckCard];
    state.players['p1'].hand = [handCard];

    // 山札上からマーカー追加
    state = gameReducer(state, {
      type: 'ADD_MARKER',
      payload: {
        playerId: 'p1',
        targetZone: 'frontLine',
        targetSlotIndex: 0,
        from: 'topDeck',
      },
    });

    expect(state.players['p1'].deck.length).toBe(0);
    expect(state.players['p1'].frontLine[0]?.underCards.length).toBe(1);
    expect(state.players['p1'].frontLine[0]?.underCards[0].name).toBe('Marker from Deck');
    expect(state.players['p1'].frontLine[0]?.underCards[0].isFaceDown).toBe(true);
    expect(state.players['p1'].frontLine[0]?.underCards[0].isMarker).toBe(true);

    // 手札からマーカー追加
    state = gameReducer(state, {
      type: 'ADD_MARKER',
      payload: {
        playerId: 'p1',
        targetZone: 'frontLine',
        targetSlotIndex: 0,
        from: { zone: 'hand', index: 0 },
      },
    });

    expect(state.players['p1'].hand.length).toBe(0);
    expect(state.players['p1'].frontLine[0]?.underCards.length).toBe(2);
    expect(state.players['p1'].frontLine[0]?.underCards[1].name).toBe('Marker from Hand');
    expect(state.players['p1'].frontLine[0]?.underCards[1].isMarker).toBe(true);
  });

  it('should toggle freeze and skip activation during SET_ALL_ACTIVE while unfreezing', () => {
    let state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
    const frozenCard = {
      ...createDummyCard('f-1', 'Frozen Character'),
      isRested: true,
    };
    const normalRestedCard = {
      ...createDummyCard('n-1', 'Normal Character'),
      isRested: true,
    };

    state.players['p1'].frontLine[0] = frozenCard;
    state.players['p1'].frontLine[1] = normalRestedCard;

    // フリーズ状態付与
    state = gameReducer(state, {
      type: 'TOGGLE_FREEZE',
      payload: {
        playerId: 'p1',
        zone: 'frontLine',
        slotIndex: 0,
      },
    });

    expect(state.players['p1'].frontLine[0]?.isFrozen).toBe(true);

    // ターン開始等の全アクティブ化 (SET_ALL_ACTIVE)
    state = gameReducer(state, {
      type: 'SET_ALL_ACTIVE',
      payload: {
        playerId: 'p1',
      },
    });

    // フリーズされたカード: アクティブ化されず（レストのまま）、フリーズ状態のみ解除される
    expect(state.players['p1'].frontLine[0]?.isRested).toBe(true);
    expect(state.players['p1'].frontLine[0]?.isFrozen).toBe(false);

    // 通常のカード: アクティブ化される
    expect(state.players['p1'].frontLine[1]?.isRested).toBe(false);
  });

  it('should recover life from deck top and take life to hand or graveyard', () => {
    let state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
    const deckCard = createDummyCard('top-1', 'Life Card 1');
    state.players['p1'].deck = [deckCard];
    state.players['p1'].life = [];

    // ライフ回復
    state = gameReducer(state, {
      type: 'RECOVER_LIFE',
      payload: { playerId: 'p1' },
    });

    expect(state.players['p1'].deck.length).toBe(0);
    expect(state.players['p1'].life.length).toBe(1);
    expect(state.players['p1'].life[0].name).toBe('Life Card 1');
    expect(state.players['p1'].life[0].isFaceDown).toBe(true);

    // ライフを手札に回収
    state = gameReducer(state, {
      type: 'TAKE_LIFE',
      payload: { playerId: 'p1', destination: 'hand' },
    });

    expect(state.players['p1'].life.length).toBe(0);
    expect(state.players['p1'].hand.length).toBe(1);
    expect(state.players['p1'].hand[0].name).toBe('Life Card 1');

    // ライフ自傷で場外へ送るテスト
    let state2 = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
    state2.players['p1'].deck = [createDummyCard('top-2', 'Life Card 2')];
    state2.players['p1'].life = [];
    state2 = gameReducer(state2, {
      type: 'RECOVER_LIFE',
      payload: { playerId: 'p1' },
    });
    expect(state2.players['p1'].life.length).toBe(1);

    state2 = gameReducer(state2, {
      type: 'TAKE_LIFE',
      payload: { playerId: 'p1', destination: 'graveyard' },
    });

    expect(state2.players['p1'].life.length).toBe(0);
    expect(state2.players['p1'].graveyard.length).toBe(1);
    expect(state2.players['p1'].graveyard[0].name).toBe('Life Card 2');
  });

  it('should move card to removed zone and bounce to top/bottom of deck correctly', () => {
    let state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
    const cardA = createDummyCard('card-a', 'Card A');
    const cardB = createDummyCard('card-b', 'Card B');
    const cardC = createDummyCard('card-c', 'Card C');

    state.players['p1'].frontLine[0] = cardA;
    state.players['p1'].frontLine[1] = cardB;
    state.players['p1'].frontLine[2] = cardC;
    state.players['p1'].deck = [createDummyCard('existing-deck', 'Existing Deck')];

    // cardA を除外（removed）へ
    state = gameReducer(state, {
      type: 'MOVE_CARD',
      payload: {
        cardId: 'card-a',
        from: { playerId: 'p1', zone: 'frontLine', slotIndex: 0 },
        to: { playerId: 'p1', zone: 'removed' },
      },
    });

    expect(state.players['p1'].frontLine[0]).toBeNull();
    expect(state.players['p1'].removed.length).toBe(1);
    expect(state.players['p1'].removed[0].name).toBe('Card A');

    // cardB を山札の上へバウンス
    state = gameReducer(state, {
      type: 'MOVE_CARD',
      payload: {
        cardId: 'card-b',
        from: { playerId: 'p1', zone: 'frontLine', slotIndex: 1 },
        to: { playerId: 'p1', zone: 'deck', index: 0 },
      },
    });

    expect(state.players['p1'].frontLine[1]).toBeNull();
    expect(state.players['p1'].deck[0].name).toBe('Card B');
    expect(state.players['p1'].deck[1].name).toBe('Existing Deck');

    // cardC を山札の下へバウンス
    state = gameReducer(state, {
      type: 'MOVE_CARD',
      payload: {
        cardId: 'card-c',
        from: { playerId: 'p1', zone: 'frontLine', slotIndex: 2 },
        to: { playerId: 'p1', zone: 'deck' },
      },
    });

    expect(state.players['p1'].frontLine[2]).toBeNull();
    expect(state.players['p1'].deck[state.players['p1'].deck.length - 1].name).toBe('Card C');
  });

  it('should toggle life face-up/down with FLIP_LIFE', () => {
    let state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
    state.players['p1'].life = [
      { ...createDummyCard('life-0', 'Life 0'), isFaceDown: true },
      { ...createDummyCard('life-1', 'Life 1'), isFaceDown: true },
    ];

    // index 0 を表向きに
    state = gameReducer(state, {
      type: 'FLIP_LIFE',
      payload: { playerId: 'p1', lifeIndex: 0 },
    });
    expect(state.players['p1'].life[0].isFaceDown).toBe(false);
    expect(state.players['p1'].life[1].isFaceDown).toBe(true);

    // もう一度実行して裏向きに戻す
    state = gameReducer(state, {
      type: 'FLIP_LIFE',
      payload: { playerId: 'p1', lifeIndex: 0 },
    });
    expect(state.players['p1'].life[0].isFaceDown).toBe(true);
  });

  it('should discard all cards from hand with DISCARD_ALL_HAND', () => {
    let state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
    state.players['p1'].hand = [
      createDummyCard('h1', 'Hand 1'),
      createDummyCard('h2', 'Hand 2'),
      createDummyCard('h3', 'Hand 3'),
    ];

    state = gameReducer(state, {
      type: 'DISCARD_ALL_HAND',
      payload: { playerId: 'p1' },
    });

    expect(state.players['p1'].hand.length).toBe(0);
    expect(state.players['p1'].graveyard.length).toBe(3);
    expect(state.players['p1'].graveyard.map((c) => c.name)).toEqual(['Hand 1', 'Hand 2', 'Hand 3']);
  });

  it('should discard specific or random hand card with DISCARD_HAND_CARD', () => {
    let state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
    state.players['p1'].hand = [
      createDummyCard('h1', 'Hand 1'),
      createDummyCard('h2', 'Hand 2'),
      createDummyCard('h3', 'Hand 3'),
    ];

    // 指定インデックス (index: 1 -> Hand 2)
    state = gameReducer(state, {
      type: 'DISCARD_HAND_CARD',
      payload: { playerId: 'p1', index: 1 },
    });

    expect(state.players['p1'].hand.length).toBe(2);
    expect(state.players['p1'].graveyard.length).toBe(1);
    expect(state.players['p1'].graveyard[0].name).toBe('Hand 2');

    // ランダムディスカード
    state = gameReducer(state, {
      type: 'DISCARD_HAND_CARD',
      payload: { playerId: 'p1' },
    });

    expect(state.players['p1'].hand.length).toBe(1);
    expect(state.players['p1'].graveyard.length).toBe(2);
  });

  it('should manage revealedTopDeckCard and reset on draw or shuffle', () => {
    let state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
    state.players['p1'].deck = [
      createDummyCard('deck-top', 'Top Card'),
      createDummyCard('deck-2', 'Second Card'),
    ];

    // 山札トップを表向きに公開
    state = gameReducer(state, {
      type: 'REVEAL_TOP_DECK_CARD',
      payload: { playerId: 'p1', reveal: true },
    });
    expect(state.players['p1'].revealedTopDeckCard).not.toBeNull();
    expect(state.players['p1'].revealedTopDeckCard?.name).toBe('Top Card');

    // ドロー時にリセットされる
    state = gameReducer(state, {
      type: 'DRAW_CARD',
      payload: { playerId: 'p1' },
    });
    expect(state.players['p1'].revealedTopDeckCard).toBeNull();
    expect(state.players['p1'].hand[0].name).toBe('Top Card');

    // 再度公開後、シャッフルでもリセットされる
    state = gameReducer(state, {
      type: 'REVEAL_TOP_DECK_CARD',
      payload: { playerId: 'p1', reveal: true },
    });
    expect(state.players['p1'].revealedTopDeckCard).not.toBeNull();

    state = gameReducer(state, {
      type: 'SHUFFLE_DECK',
      payload: { playerId: 'p1' },
    });
    expect(state.players['p1'].revealedTopDeckCard).toBeNull();
  });

  it('should execute BOTTOM_DECK_ACTION for view, mill, and toHand', () => {
    let state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
    state.players['p1'].deck = [
      createDummyCard('d1', 'Deck 1'),
      createDummyCard('d2', 'Deck 2'),
      createDummyCard('d-bottom', 'Bottom Card'),
    ];

    // view (公開モーダルにセット) - トリガー扱いにならず、閉じた後もカード複製されないこと
    state = gameReducer(state, {
      type: 'BOTTOM_DECK_ACTION',
      payload: { playerId: 'p1', action: 'view' },
    });
    expect(state.revealedCard?.card.name).toBe('Bottom Card');
    expect(state.revealedCard?.isTrigger).toBe(false);
    expect(state.players['p1'].deck.length).toBe(3);

    // モーダルを閉じる
    state = gameReducer(state, {
      type: 'DISMISS_REVEALED_CARD',
      payload: { destination: 'graveyard' },
    });
    // isTrigger: false なので場外へ送られず、山札も場外もカードが増減しないこと
    expect(state.revealedCard).toBeNull();
    expect(state.players['p1'].deck.length).toBe(3);
    expect(state.players['p1'].graveyard.length).toBe(0);

    // toHand (手札へ)
    state = gameReducer(state, {
      type: 'BOTTOM_DECK_ACTION',
      payload: { playerId: 'p1', action: 'toHand' },
    });
    expect(state.players['p1'].hand.length).toBe(1);
    expect(state.players['p1'].hand[0].name).toBe('Bottom Card');
    expect(state.players['p1'].deck.length).toBe(2);

    // mill (場外へ)
    state = gameReducer(state, {
      type: 'BOTTOM_DECK_ACTION',
      payload: { playerId: 'p1', action: 'mill' },
    });
    expect(state.players['p1'].graveyard.length).toBe(1);
    expect(state.players['p1'].graveyard[0].name).toBe('Deck 2');
    expect(state.players['p1'].deck.length).toBe(1);
  });

  it('allows returned mulligan cards to end up in life zone after shuffle (Official Rule integrity)', () => {
    // 50枚のデッキを用意
    let state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
    const dummyCards = Array.from({ length: 50 }, (_, i) => createDummyCard(`c-${i}`, `Card ${i}`));

    state = gameReducer(state, {
      type: 'SETUP_GAME',
      payload: { playerId: 'p1', deckCards: dummyCards, apCards: [] },
    });

    const returnedHandIds = new Set(state.players['p1'].hand.map((c) => c.id));

    // マリガン実行
    state = gameReducer(state, {
      type: 'MULLIGAN',
      payload: { playerId: 'p1' },
    });

    // ライフ7枚を配置
    state = gameReducer(state, {
      type: 'PLACE_INITIAL_LIFE',
      payload: { playerId: 'p1' },
    });

    // 元の手札7枚のうち、全山札43枚（ライフ7枚+山札36枚）の中に全て存在することを確認
    const totalRemainingIds = [
      ...state.players['p1'].life.map((c) => c.id),
      ...state.players['p1'].deck.map((c) => c.id),
    ];
    returnedHandIds.forEach((id) => {
      expect(totalRemainingIds).toContain(id);
    });

    // ライフは7枚、山札は36枚、手札は7枚
    expect(state.players['p1'].life.length).toBe(7);
    expect(state.players['p1'].deck.length).toBe(36);
    expect(state.players['p1'].hand.length).toBe(7);
  });

  it('should separate parent card and promote top underCard to field (SEPARATE_PARENT_CARD)', () => {
    let state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
    const baseCard1 = createDummyCard('base-1', 'Suzaku Base');
    const baseCard2 = createDummyCard('base-2', 'Suzaku Middle');
    const raidParent = {
      ...createDummyCard('raid-top', 'Lancelot Albion (Raid)'),
      underCards: [baseCard1, baseCard2],
      isRested: true,
    };

    state.players['p1'].frontLine[0] = raidParent;

    // 親カードを手札へ分離
    state = gameReducer(state, {
      type: 'SEPARATE_PARENT_CARD',
      payload: {
        playerId: 'p1',
        zone: 'frontLine',
        slotIndex: 0,
        destination: 'hand',
      },
    });

    // 1. 親カードは手札に戻り、underCards は空
    expect(state.players['p1'].hand.length).toBe(1);
    expect(state.players['p1'].hand[0].name).toBe('Lancelot Albion (Raid)');
    expect(state.players['p1'].hand[0].underCards.length).toBe(0);

    // 2. 直下にあった baseCard2 が昇格してフロント0番枠に残る
    const promoted = state.players['p1'].frontLine[0];
    expect(promoted).not.toBeNull();
    expect(promoted?.name).toBe('Suzaku Middle');
    // 親カードの状態（レスト）を引き継いでいること
    expect(promoted?.isRested).toBe(true);

    // 3. 残りの baseCard1 は昇格したカードの underCards に保持される
    expect(promoted?.underCards.length).toBe(1);
    expect(promoted?.underCards[0].name).toBe('Suzaku Base');
  });

  it('should trigger check a specific life card chosen by attacker (CHECK_LIFE_TRIGGER with lifeIndex)', () => {
    let state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
    const life0 = createDummyCard('l-0', 'Life First');
    const life1 = createDummyCard('l-1', 'Life Second');
    const life2 = {
      ...createDummyCard('l-2', 'Special Trigger Card'),
      triggers: ['COLOR', 'SPECIAL'] as Card['triggers'],
    };
    const life3 = createDummyCard('l-3', 'Life Fourth');

    state.players['p2'].life = [life0, life1, life2, life3];

    // 攻撃側が相手ライフの3枚目 (index: 2) を指定してトリガーチェック
    state = gameReducer(state, {
      type: 'CHECK_LIFE_TRIGGER',
      payload: {
        playerId: 'p2',
        lifeIndex: 2,
      },
    });

    // ライフから指定カードが取り出され、残り3枚
    expect(state.players['p2'].life.length).toBe(3);
    expect(state.players['p2'].life.map((c) => c.name)).toEqual(['Life First', 'Life Second', 'Life Fourth']);

    // 公開カードに指定したカードがセットされていること
    expect(state.revealedCard).not.toBeNull();
    expect(state.revealedCard?.card.name).toBe('Special Trigger Card');
    expect(state.revealedCard?.fromPlayerId).toBe('p2');
    expect(state.revealedCard?.source).toContain('3枚目');
  });

  it('should take a specific life card directly to graveyard (TAKE_LIFE with lifeIndex)', () => {
    let state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
    const life0 = createDummyCard('l-0', 'Life First');
    const life1 = createDummyCard('l-1', 'Life Target');
    const life2 = createDummyCard('l-2', 'Life Third');

    state.players['p2'].life = [life0, life1, life2];

    // 相手ライフの2枚目 (index: 1) を直接場外へ
    state = gameReducer(state, {
      type: 'TAKE_LIFE',
      payload: {
        playerId: 'p2',
        destination: 'graveyard',
        lifeIndex: 1,
      },
    });

    expect(state.players['p2'].life.length).toBe(2);
    expect(state.players['p2'].life.map((c) => c.name)).toEqual(['Life First', 'Life Third']);
    expect(state.players['p2'].graveyard.length).toBe(1);
    expect(state.players['p2'].graveyard[0].name).toBe('Life Target');
  });

  it('should support placing a card from hand face-up into life (Lady Black behavior)', () => {
    let state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
    const heroCard = createDummyCard('shy-hero-1', 'レディ・ブラック');
    state.players['p1'].hand = [heroCard];
    state.players['p1'].life = [createDummyCard('l-1', 'Existing Life')];

    // 手札からライフに表向きで置く (isFaceDown: false)
    state = gameReducer(state, {
      type: 'MOVE_CARD',
      payload: {
        cardId: 'shy-hero-1',
        from: { playerId: 'p1', zone: 'hand', index: 0 },
        to: { playerId: 'p1', zone: 'life', isFaceDown: false },
      },
    });

    const p1 = state.players['p1'];
    expect(p1.hand.length).toBe(0);
    expect(p1.life.length).toBe(2);
    // 新規配置されたカードは先頭に表向きで配置される
    expect(p1.life[0].name).toBe('レディ・ブラック');
    expect(p1.life[0].isFaceDown).toBe(false);

    // ログに表向きで追加された記録が残る
    const latestLog = state.logs[state.logs.length - 1];
    expect(latestLog.message).toContain('表向き');
    expect(latestLog.message).toContain('レディ・ブラック');

    // FLIP_LIFE で裏向きにトグル可能
    state = gameReducer(state, {
      type: 'FLIP_LIFE',
      payload: { playerId: 'p1', lifeIndex: 0 },
    });
    expect(state.players['p1'].life[0].isFaceDown).toBe(true);
  });

  it('should support TAKE_LIFE to deckTop and deckBottom (Kamen Rider OOO Putotyra)', () => {
    let state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
    const life1 = createDummyCard('l-1', 'Life Card 1');
    const life2 = createDummyCard('l-2', 'Life Card 2');
    const deck1 = createDummyCard('d-1', 'Deck Card 1');
    state.players['p1'].life = [life1, life2];
    state.players['p1'].deck = [deck1];

    // ライフ1枚目を山札の上に置く
    state = gameReducer(state, {
      type: 'TAKE_LIFE',
      payload: { playerId: 'p1', destination: 'deckTop', lifeIndex: 0 },
    });
    expect(state.players['p1'].life.length).toBe(1);
    expect(state.players['p1'].life[0].name).toBe('Life Card 2');
    expect(state.players['p1'].deck.length).toBe(2);
    expect(state.players['p1'].deck[0].name).toBe('Life Card 1'); // トップに置かれた

    // 残りのライフを山札の下に置く
    state = gameReducer(state, {
      type: 'TAKE_LIFE',
      payload: { playerId: 'p1', destination: 'deckBottom', lifeIndex: 0 },
    });
    expect(state.players['p1'].life.length).toBe(0);
    expect(state.players['p1'].deck.length).toBe(3);
    expect(state.players['p1'].deck[2].name).toBe('Life Card 2'); // ボトムに置かれた
  });

  it('should support RECOVER_LIFE face-up (Ranka Lee, Obelisk, Utsuki)', () => {
    let state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
    const topDeckCard = createDummyCard('top-1', 'ランカ・リー');
    state.players['p1'].deck = [topDeckCard];
    state.players['p1'].life = [];

    // 山札の上から表向きでライフへ回復
    state = gameReducer(state, {
      type: 'RECOVER_LIFE',
      payload: { playerId: 'p1', isFaceDown: false },
    });

    expect(state.players['p1'].deck.length).toBe(0);
    expect(state.players['p1'].life.length).toBe(1);
    expect(state.players['p1'].life[0].name).toBe('ランカ・リー');
    expect(state.players['p1'].life[0].isFaceDown).toBe(false);
  });

  it('should support REORDER_LIFE (Sir Nighteye)', () => {
    let state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
    const lifeA = createDummyCard('l-a', 'Card A');
    const lifeB = createDummyCard('l-b', 'Card B');
    const lifeC = createDummyCard('l-c', 'Card C');
    state.players['p1'].life = [lifeA, lifeB, lifeC];

    // 順序を C, A, B に変更
    state = gameReducer(state, {
      type: 'REORDER_LIFE',
      payload: {
        playerId: 'p1',
        newLifeCards: [lifeC, lifeA, lifeB],
      },
    });

    expect(state.players['p1'].life.map((c) => c.name)).toEqual(['Card C', 'Card A', 'Card B']);
  });

  it('should support SEPARATE_UNDER_CARD to life and deck (Leafa Earth Goddess Terraria)', () => {
    let state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
    const under1 = createDummyCard('u-1', 'UnderCard 1');
    const under2 = createDummyCard('u-2', 'UnderCard 2');
    const parentCard = {
      ...createDummyCard('p-1', 'Raid Host'),
      underCards: [under1, under2],
    };
    state.players['p1'].frontLine[0] = parentCard;
    state.players['p1'].life = [];
    state.players['p1'].deck = [createDummyCard('d-0', 'Initial Deck')];

    // 下敷き1をライフに表向きで分離
    state = gameReducer(state, {
      type: 'SEPARATE_UNDER_CARD',
      payload: {
        playerId: 'p1',
        zone: 'frontLine',
        slotIndex: 0,
        underCardId: 'u-1',
        destination: 'lifeFaceUp',
      },
    });

    expect(state.players['p1'].frontLine[0]?.underCards?.length).toBe(1);
    expect(state.players['p1'].life.length).toBe(1);
    expect(state.players['p1'].life[0].name).toBe('UnderCard 1');
    expect(state.players['p1'].life[0].isFaceDown).toBe(false);

    // 下敷き2を山札の上に分離
    state = gameReducer(state, {
      type: 'SEPARATE_UNDER_CARD',
      payload: {
        playerId: 'p1',
        zone: 'frontLine',
        slotIndex: 0,
        underCardId: 'u-2',
        destination: 'deckTop',
      },
    });

    expect(state.players['p1'].frontLine[0]?.underCards?.length).toBe(0);
    expect(state.players['p1'].deck[0].name).toBe('UnderCard 2');
  });

  it('should support RESOLVE_TOP_DECK_CARD to lifeFaceUp and frontLine (Gloucester)', () => {
    let state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
    const cardA = createDummyCard('top-a', 'Top Card A');
    const cardB = createDummyCard('top-b', 'Top Card B');
    state.revealedDeckCards = {
      playerId: 'p1',
      cards: [cardA, cardB],
    };
    state.players['p1'].frontLine = [null, null, null, null];
    state.players['p1'].life = [];

    // cardA をライフ(表向き)に送る
    state = gameReducer(state, {
      type: 'RESOLVE_TOP_DECK_CARD',
      payload: {
        playerId: 'p1',
        cardId: 'top-a',
        destination: 'lifeFaceUp',
      },
    });

    expect(state.revealedDeckCards?.cards.map((c) => c.name)).toEqual(['Top Card B']);
    expect(state.players['p1'].life.length).toBe(1);
    expect(state.players['p1'].life[0].name).toBe('Top Card A');
    expect(state.players['p1'].life[0].isFaceDown).toBe(false);

    // cardB をフロントラインに出す
    state = gameReducer(state, {
      type: 'RESOLVE_TOP_DECK_CARD',
      payload: {
        playerId: 'p1',
        cardId: 'top-b',
        destination: 'frontLine',
      },
    });

    expect(state.revealedDeckCards).toBeNull();
    expect(state.players['p1'].frontLine[0]?.name).toBe('Top Card B');
    expect(state.players['p1'].frontLine[0]?.isRested).toBe(true); // 登場時レスト
  });

  it('should send EVENT card directly to graveyard when played/moved towards field', () => {
    let state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
    const eventCard: Card = {
      ...createDummyCard('event-1', 'Special Move'),
      cardType: 'EVENT',
    };
    state.players['p1'].hand = [eventCard];
    state.players['p1'].frontLine = [null, null, null, null];

    // イベントカードをフロントライン0番に配置しようとする
    state = gameReducer(state, {
      type: 'MOVE_CARD',
      payload: {
        cardId: 'event-1',
        from: { playerId: 'p1', zone: 'hand', index: 0 },
        to: { playerId: 'p1', zone: 'frontLine', slotIndex: 0 },
      },
    });

    // フィールドには置かれず、手札から場外へ送られること
    expect(state.players['p1'].hand.length).toBe(0);
    expect(state.players['p1'].frontLine[0]).toBeNull();
    expect(state.players['p1'].graveyard.length).toBe(1);
    expect(state.players['p1'].graveyard[0].name).toBe('Special Move');
    expect(state.logs.some((log) => log.message.includes('イベントカード「Special Move」を使用しました'))).toBe(true);
  });

  it('should support RESOLVE_TOP_DECK_CARD to handSecret without revealing card name in log', () => {
    let state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
    state.players['p1'].deck = [
      createDummyCard('top-secret-1', '秘密のカード'),
    ];

    state = gameReducer(state, {
      type: 'LOOK_AT_TOP_DECK',
      payload: { playerId: 'p1', count: 1 },
    });

    state = gameReducer(state, {
      type: 'RESOLVE_TOP_DECK_CARD',
      payload: { playerId: 'p1', cardId: 'top-secret-1', destination: 'handSecret' },
    });

    expect(state.players['p1'].hand.length).toBe(1);
    expect(state.players['p1'].hand[0].name).toBe('秘密のカード');
    expect(state.revealedDeckCards).toBeNull();
    const lastLog = state.logs[state.logs.length - 1];
    expect(lastLog.message).toContain('手札に加えました（非公開）');
    expect(lastLog.message).not.toContain('秘密のカード');
  });

  it('should support SEARCH_DECK_CARD to handSecret without revealing card name in log', () => {
    let state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
    state.players['p1'].deck = [
      createDummyCard('search-secret-1', '秘密のサーチ先'),
    ];

    state = gameReducer(state, {
      type: 'SEARCH_DECK_CARD',
      payload: { playerId: 'p1', cardId: 'search-secret-1', destination: 'handSecret' },
    });

    expect(state.players['p1'].hand.length).toBe(1);
    expect(state.players['p1'].hand[0].name).toBe('秘密のサーチ先');
    expect(state.players['p1'].deck.length).toBe(0);
    const lastLog = state.logs[state.logs.length - 1];
    expect(lastLog.message).toContain('手札に加えました（非公開）');
    expect(lastLog.message).not.toContain('秘密のサーチ先');
  });

  it('transitions from MAIN phase to ATTACK phase when declaring player attack', () => {
    let state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
    state.status = 'PLAYING';
    state.phase = 'MAIN';
    state.turn = 2;
    state.players.p1.frontLine[0] = createDummyCard('attacker', 'アタッカー', 4000);

    state = gameReducer(state, {
      type: 'DECLARE_PLAYER_ATTACK',
      payload: {
        actorPlayerId: 'p1',
        attackerZone: 'frontLine',
        attackerSlotIndex: 0,
        defenderPlayerId: 'p2',
      },
    });

    expect(state.phase).toBe('ATTACK');
    expect(state.players.p1.frontLine[0]?.isRested).toBe(true);
    expect(state.pendingCombat).toMatchObject({
      stage: 'BLOCK_DECISION',
      attackerPlayerId: 'p1',
      defenderPlayerId: 'p2',
      attackerCardName: 'アタッカー',
    });
  });

  it('transitions to ATTACK phase when declaring player attack during START or MOVE phase', () => {
    let state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
    state.status = 'PLAYING';
    state.phase = 'MOVE';
    state.turn = 2;
    state.players.p1.frontLine[0] = createDummyCard('attacker', 'アタッカー', 4000);

    state = gameReducer(state, {
      type: 'DECLARE_PLAYER_ATTACK',
      payload: {
        actorPlayerId: 'p1',
        attackerZone: 'frontLine',
        attackerSlotIndex: 0,
        defenderPlayerId: 'p2',
      },
    });

    expect(state.phase).toBe('ATTACK');
    expect(state.players.p1.frontLine[0]?.isRested).toBe(true);
    expect(state.pendingCombat).toMatchObject({
      stage: 'BLOCK_DECISION',
      attackerPlayerId: 'p1',
      defenderPlayerId: 'p2',
      attackerCardName: 'アタッカー',
    });
  });

  it('synchronizes a player attack and only lets the defender pass', () => {
    let state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
    state.status = 'PLAYING';
    state.phase = 'ATTACK';
    state.turn = 2;
    state.players.p1.frontLine[0] = createDummyCard('attacker', 'アタッカー', 4000);
    state.players.p2.life = [createDummyCard('life-1', 'ライフ1')];

    state = gameReducer(state, {
      type: 'DECLARE_PLAYER_ATTACK',
      payload: {
        actorPlayerId: 'p1',
        attackerZone: 'frontLine',
        attackerSlotIndex: 0,
        defenderPlayerId: 'p2',
      },
    });

    expect(state.players.p1.frontLine[0]?.isRested).toBe(true);
    expect(state.pendingCombat).toMatchObject({
      stage: 'BLOCK_DECISION',
      attackerPlayerId: 'p1',
      defenderPlayerId: 'p2',
      attackerCardName: 'アタッカー',
    });

    const invalidPass = gameReducer(state, {
      type: 'PASS_BLOCK',
      payload: { actorPlayerId: 'p1' },
    });
    expect(invalidPass).toBe(state);

    state = gameReducer(state, {
      type: 'PASS_BLOCK',
      payload: { actorPlayerId: 'p2' },
    });
    expect(state.pendingCombat?.stage).toBe('LIFE_SELECTION');
  });

  it('lets only the attacker select life and immediately enters trigger check', () => {
    let state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
    state.status = 'PLAYING';
    state.phase = 'ATTACK';
    state.turn = 2;
    state.players.p1.frontLine[0] = createDummyCard('attacker', 'アタッカー', 4000);
    state.players.p2.life = [
      { ...createDummyCard('life-1', 'ライフ1'), isFaceDown: true },
      { ...createDummyCard('life-2', 'ライフ2'), isFaceDown: true },
    ];
    state = gameReducer(state, {
      type: 'DECLARE_PLAYER_ATTACK',
      payload: {
        actorPlayerId: 'p1',
        attackerZone: 'frontLine',
        attackerSlotIndex: 0,
        defenderPlayerId: 'p2',
      },
    });
    state = gameReducer(state, {
      type: 'PASS_BLOCK',
      payload: { actorPlayerId: 'p2' },
    });

    const invalidSelection = gameReducer(state, {
      type: 'SELECT_LIFE_FOR_DAMAGE',
      payload: { actorPlayerId: 'p2', lifeIndex: 1 },
    });
    expect(invalidSelection).toBe(state);

    state = gameReducer(state, {
      type: 'SELECT_LIFE_FOR_DAMAGE',
      payload: { actorPlayerId: 'p1', lifeIndex: 1 },
    });

    expect(state.pendingCombat).toBeNull();
    expect(state.players.p2.life.map((card) => card.id)).toEqual(['life-1']);
    expect(state.revealedCard?.card.id).toBe('life-2');
    expect(state.revealedCard?.card.isFaceDown).toBe(false);
    expect(state.revealedCard?.isTrigger).toBe(true);
  });

  it('resolves a synchronized block and retires the losing blocker', () => {
    let state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
    state.status = 'PLAYING';
    state.phase = 'ATTACK';
    state.turn = 2;
    state.players.p1.frontLine[0] = createDummyCard('attacker', 'アタッカー', 4000);
    state.players.p2.frontLine[0] = createDummyCard('blocker', 'ブロッカー', 3000);
    state = gameReducer(state, {
      type: 'DECLARE_PLAYER_ATTACK',
      payload: {
        actorPlayerId: 'p1',
        attackerZone: 'frontLine',
        attackerSlotIndex: 0,
        defenderPlayerId: 'p2',
      },
    });

    state = gameReducer(state, {
      type: 'BLOCK_ATTACK',
      payload: { actorPlayerId: 'p2', blockerSlotIndex: 0 },
    });

    expect(state.pendingCombat).toBeNull();
    expect(state.players.p2.frontLine[0]).toBeNull();
    expect(state.players.p2.graveyard.map((card) => card.id)).toEqual(['blocker']);
  });

  it('does not advance the phase while synchronized combat is unresolved', () => {
    let state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
    state.status = 'PLAYING';
    state.phase = 'ATTACK';
    state.turn = 2;
    state.players.p1.frontLine[0] = createDummyCard('attacker', 'アタッカー', 4000);
    state = gameReducer(state, {
      type: 'DECLARE_PLAYER_ATTACK',
      payload: {
        actorPlayerId: 'p1', attackerZone: 'frontLine', attackerSlotIndex: 0, defenderPlayerId: 'p2',
      },
    });

    const afterPhaseRequest = gameReducer(state, { type: 'SET_PHASE', payload: { phase: 'END' } });
    expect(afterPhaseRequest).toBe(state);
    expect(afterPhaseRequest.phase).toBe('ATTACK');
  });

  it('keeps frozen cards rested and clears isFrozen on SET_PHASE (END) and PASS_TURN', () => {
    let state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
    state.status = 'PLAYING';
    state.phase = 'MAIN';
    state.activePlayerId = 'p1';

    const frozenCard = { ...createDummyCard('f-1', 'Frozen Card'), isRested: true, isFrozen: true };
    const normalRestedCard = { ...createDummyCard('n-1', 'Normal Card'), isRested: true, isFrozen: false };
    state.players.p1.frontLine[0] = frozenCard;
    state.players.p1.frontLine[1] = normalRestedCard;

    const p2FrozenCard = { ...createDummyCard('p2-f', 'P2 Frozen Card'), isRested: true, isFrozen: true };
    const p2NormalCard = { ...createDummyCard('p2-n', 'P2 Normal Card'), isRested: true, isFrozen: false };
    state.players.p2.frontLine[0] = p2FrozenCard;
    state.players.p2.frontLine[1] = p2NormalCard;

    // 1. SET_PHASE ('END')
    state = gameReducer(state, {
      type: 'SET_PHASE',
      payload: { phase: 'END' },
    });

    // フリーズカードは起き上がらず、isFrozen のみ false になる
    expect(state.players.p1.frontLine[0]?.isRested).toBe(true);
    expect(state.players.p1.frontLine[0]?.isFrozen).toBe(false);
    // 通常カードは起き上がる
    expect(state.players.p1.frontLine[1]?.isRested).toBe(false);

    // 2. PASS_TURN: 次プレイヤーにターンが渡る際、次プレイヤーのフリーズカードも同様に起き上がらない
    state = gameReducer(state, {
      type: 'PASS_TURN',
      payload: { playerId: 'p1' },
    });

    expect(state.activePlayerId).toBe('p2');
    expect(state.players.p2.frontLine[0]?.isRested).toBe(true);
    expect(state.players.p2.frontLine[0]?.isFrozen).toBe(false);
    expect(state.players.p2.frontLine[1]?.isRested).toBe(false);
  });

  it('sends all underCards to graveyard when a raid card is retired during BLOCK_ATTACK', () => {
    let state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
    state.status = 'PLAYING';
    state.phase = 'ATTACK';
    state.turn = 2;

    const attackerCard = createDummyCard('att-1', 'Attacker', 5000);
    const blockerUnder1 = createDummyCard('under-1', 'Under Card 1');
    const blockerUnder2 = createDummyCard('under-2', 'Under Card 2');
    const blockerRaidCard: Card = {
      ...createDummyCard('raid-blocker', 'Raid Blocker', 3000),
      underCards: [blockerUnder1, blockerUnder2],
    };

    state.players.p1.frontLine[0] = attackerCard;
    state.players.p2.frontLine[0] = blockerRaidCard;

    state = gameReducer(state, {
      type: 'DECLARE_PLAYER_ATTACK',
      payload: {
        actorPlayerId: 'p1',
        attackerZone: 'frontLine',
        attackerSlotIndex: 0,
        defenderPlayerId: 'p2',
      },
    });

    state = gameReducer(state, {
      type: 'BLOCK_ATTACK',
      payload: { actorPlayerId: 'p2', blockerSlotIndex: 0 },
    });

    expect(state.players.p2.frontLine[0]).toBeNull();
    // 親カードおよび下敷き2枚の合計3枚が墓地に送られる
    expect(state.players.p2.graveyard.map((c) => c.id)).toEqual(['raid-blocker', 'under-1', 'under-2']);
  });

  it('keeps both attacker and blocker on field when blocker has higher BP, and does not retire underCards', () => {
    let state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
    state.status = 'PLAYING';
    state.phase = 'ATTACK';
    state.turn = 2;

    const attackerUnder = createDummyCard('att-under', 'Attacker Under');
    const attackerRaid: Card = {
      ...createDummyCard('att-raid', 'Attacker Raid', 2000),
      underCards: [attackerUnder],
    };
    const strongBlocker = createDummyCard('strong-blocker', 'Strong Blocker', 4000);

    state.players.p1.frontLine[0] = attackerRaid;
    state.players.p2.frontLine[0] = strongBlocker;

    state = gameReducer(state, {
      type: 'DECLARE_PLAYER_ATTACK',
      payload: {
        actorPlayerId: 'p1',
        attackerZone: 'frontLine',
        attackerSlotIndex: 0,
        defenderPlayerId: 'p2',
      },
    });

    state = gameReducer(state, {
      type: 'BLOCK_ATTACK',
      payload: { actorPlayerId: 'p2', blockerSlotIndex: 0 },
    });

    // 公式ルール: アタッカーBP < ディフェンダーBP の場合、両者生存
    expect(state.players.p1.frontLine[0]?.id).toBe('att-raid');
    expect(state.players.p1.frontLine[0]?.underCards.length).toBe(1);
    expect(state.players.p2.frontLine[0]?.id).toBe('strong-blocker');
    expect(state.players.p1.graveyard).toHaveLength(0);
    expect(state.players.p2.graveyard).toHaveLength(0);
  });

  it('sends underCards to fromPlayer graveyard when card leaves field in MOVE_CARD', () => {
    let state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
    const under = createDummyCard('under-card', 'Under Card');
    const raidCard: Card = {
      ...createDummyCard('raid-card', 'Raid Card'),
      underCards: [under],
    };

    state.players.p1.frontLine[0] = raidCard;

    // p1 のフロントラインから p2 の手札（または相手の領域）等に移動させた場合でも、underCards は p1 の墓地に行く
    state = gameReducer(state, {
      type: 'MOVE_CARD',
      payload: {
        cardId: 'raid-card',
        from: { playerId: 'p1', zone: 'frontLine', slotIndex: 0 },
        to: { playerId: 'p2', zone: 'hand' },
      },
    });

    expect(state.players.p1.frontLine[0]).toBeNull();
    expect(state.players.p1.graveyard.map((c) => c.id)).toContain('under-card');
    expect(state.players.p2.graveyard).toHaveLength(0);
  });

  it('flattens underCards when performing consecutive raids on the same character', () => {
    let state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
    const base = createDummyCard('base', 'Base Card');
    const raid1: Card = { ...createDummyCard('raid-1', 'Raid 1'), underCards: [] };
    const raid2: Card = { ...createDummyCard('raid-2', 'Raid 2'), underCards: [] };

    state.players.p1.frontLine[0] = base;
    state.players.p1.hand = [raid1, raid2];

    // 1回目のレイド
    state = gameReducer(state, {
      type: 'RAID_CARD',
      payload: {
        playerId: 'p1',
        fromLocation: { playerId: 'p1', zone: 'hand', index: 0 },
        raidCard: raid1,
        targetZone: 'frontLine',
        targetSlotIndex: 0,
      },
    });

    // 2回目のレイド (raid-1 の上に raid-2)
    state = gameReducer(state, {
      type: 'RAID_CARD',
      payload: {
        playerId: 'p1',
        fromLocation: { playerId: 'p1', zone: 'hand', index: 0 },
        raidCard: raid2,
        targetZone: 'frontLine',
        targetSlotIndex: 0,
      },
    });

    const top = state.players.p1.frontLine[0];
    expect(top?.id).toBe('raid-2');
    expect(top?.underCards.length).toBe(2);
    expect(top?.underCards[0].id).toBe('base');
    expect(top?.underCards[1].id).toBe('raid-1');
    // underCardsの要素自体がネストしたunderCardsを持っていないこと
    expect(top?.underCards[1].underCards).toEqual([]);
  });

  it('does not lose card if SEPARATE_UNDER_CARD destination field has no empty slot', () => {
    let state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
    const under = createDummyCard('under-c', 'Under Card');
    const host: Card = {
      ...createDummyCard('host', 'Host Card'),
      underCards: [under],
    };

    // フロントラインの枠をすべて埋める
    state.players.p1.frontLine = [
      host,
      createDummyCard('f-1', 'Card 1'),
      createDummyCard('f-2', 'Card 2'),
      createDummyCard('f-3', 'Card 3'),
    ];

    state = gameReducer(state, {
      type: 'SEPARATE_UNDER_CARD',
      payload: {
        playerId: 'p1',
        zone: 'frontLine',
        slotIndex: 0,
        underCardId: 'under-c',
        destination: 'frontLine',
      },
    });

    // 空き枠がないため、underCardsから取り出されずに保持される
    expect(state.players.p1.frontLine[0]?.underCards.length).toBe(1);
    expect(state.players.p1.frontLine[0]?.underCards[0].id).toBe('under-c');
  });

  describe('ATTACK_CHARACTER (Snipe / Battle Resolution)', () => {
    it('resolves character attack atomically, resting attacker and retiring losing defender with its underCards', () => {
      let state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
      state.status = 'PLAYING';
      state.phase = 'MAIN';
      state.turn = 2;

      const attackerCard = createDummyCard('sniper-1', 'Sniper', 4000);
      const defenderUnder = createDummyCard('def-under', 'Defender Under');
      const defenderCard: Card = {
        ...createDummyCard('defender-1', 'Defender', 2500),
        underCards: [defenderUnder],
      };

      state.players.p1.frontLine[0] = attackerCard;
      state.players.p2.frontLine[1] = defenderCard;

      state = gameReducer(state, {
        type: 'ATTACK_CHARACTER',
        payload: {
          actorPlayerId: 'p1',
          attackerZone: 'frontLine',
          attackerSlotIndex: 0,
          targetPlayerId: 'p2',
          targetSlotIndex: 1,
        },
      });

      // アタッカーはレストになる
      expect(state.players.p1.frontLine[0]?.isRested).toBe(true);
      // ディフェンダーは退場し枠が空く
      expect(state.players.p2.frontLine[1]).toBeNull();
      // ディフェンダーとその下敷きがすべて墓地へ送られる
      expect(state.players.p2.graveyard.map((c) => c.id)).toEqual(['defender-1', 'def-under']);
    });

    it('allows character attack from energyLine for special character abilities', () => {
      let state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
      state.status = 'PLAYING';
      state.phase = 'MAIN';
      state.turn = 2;

      const energyAttacker = createDummyCard('energy-sniper', 'Energy Sniper', 5000);
      const defenderCard = createDummyCard('def-target', 'Target', 3000);

      state.players.p1.energyLine[2] = energyAttacker;
      state.players.p2.frontLine[0] = defenderCard;

      state = gameReducer(state, {
        type: 'ATTACK_CHARACTER',
        payload: {
          actorPlayerId: 'p1',
          attackerZone: 'energyLine',
          attackerSlotIndex: 2,
          targetPlayerId: 'p2',
          targetSlotIndex: 0,
        },
      });

      expect(state.players.p1.energyLine[2]?.isRested).toBe(true);
      expect(state.players.p2.frontLine[0]).toBeNull();
      expect(state.players.p2.graveyard.map((c) => c.id)).toEqual(['def-target']);
    });

    it('rejects attack when attacker is already rested or on turn 1 for first player', () => {
      const state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
      state.status = 'PLAYING';
      state.phase = 'MAIN';
      state.turn = 1; // 先攻1ターン目
      state.players.p1.isFirst = true;

      const attackerCard = createDummyCard('attacker', 'Attacker', 4000);
      const defenderCard = createDummyCard('defender', 'Defender', 3000);
      state.players.p1.frontLine[0] = attackerCard;
      state.players.p2.frontLine[0] = defenderCard;

      const stateTurn1 = gameReducer(state, {
        type: 'ATTACK_CHARACTER',
        payload: {
          actorPlayerId: 'p1',
          attackerZone: 'frontLine',
          attackerSlotIndex: 0,
          targetPlayerId: 'p2',
          targetSlotIndex: 0,
        },
      });

      // 先攻1ターン目はアタック不可
      expect(stateTurn1).toBe(state);
      expect(state.players.p1.frontLine[0]?.isRested).toBe(false);

      // ターン2でアタッカーがレスト済みの場合
      const restedState = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
      restedState.status = 'PLAYING';
      restedState.phase = 'MAIN';
      restedState.turn = 2;
      restedState.players.p1.frontLine[0] = { ...attackerCard, isRested: true };
      restedState.players.p2.frontLine[0] = defenderCard;

      const stateRested = gameReducer(restedState, {
        type: 'ATTACK_CHARACTER',
        payload: {
          actorPlayerId: 'p1',
          attackerZone: 'frontLine',
          attackerSlotIndex: 0,
          targetPlayerId: 'p2',
          targetSlotIndex: 0,
        },
      });
      expect(stateRested).toBe(restedState);
    });
  });

  describe('Card Preservation in Deck Operations', () => {
    it('redirects card to hand instead of dropping it when RESOLVE_TOP_DECK_CARD field slot is full', () => {
      let state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
      const topCard = createDummyCard('top-card', 'Top Deck Card');
      state.revealedDeckCards = {
        playerId: 'p1',
        cards: [topCard],
      };

      // フロントライン枠をすべて埋める
      state.players.p1.frontLine = [
        createDummyCard('f1', 'F1'),
        createDummyCard('f2', 'F2'),
        createDummyCard('f3', 'F3'),
        createDummyCard('f4', 'F4'),
      ];

      state = gameReducer(state, {
        type: 'RESOLVE_TOP_DECK_CARD',
        payload: {
          playerId: 'p1',
          cardId: 'top-card',
          destination: 'frontLine',
        },
      });

      // カードが消滅せず手札に退避される
      expect(state.players.p1.hand.map((c) => c.id)).toContain('top-card');
      expect(state.revealedDeckCards?.cards ?? []).toHaveLength(0);
    });

    it('does not overwrite existing card when SEARCH_DECK_CARD targets an occupied slot, and sends to hand', () => {
      let state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
      const searchCard = createDummyCard('search-c', 'Search Card');
      const existingCard = createDummyCard('existing-c', 'Existing Card');
      state.players.p1.deck = [searchCard];
      state.players.p1.frontLine[1] = existingCard;

      state = gameReducer(state, {
        type: 'SEARCH_DECK_CARD',
        payload: {
          playerId: 'p1',
          cardId: 'search-c',
          destination: 'frontLine',
          slotIndex: 1, // すでに existingCard があるスロットを指定
        },
      });

      // 既存のカードが上書きされずに残る
      expect(state.players.p1.frontLine[1]?.id).toBe('existing-c');
      // サーチしたカードは消滅せず手札に退避される
      expect(state.players.p1.hand.map((c) => c.id)).toContain('search-c');
    });
  });

  describe('End Phase Hand Limit Notification (Graveyard)', () => {
    it('notifies player to send excess hand cards to graveyard when hand > 8 on END phase', () => {
      let state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
      state.status = 'PLAYING';
      state.phase = 'MAIN';
      state.activePlayerId = 'p1';

      // 手札を10枚にする（上限8枚に対して2枚超過）
      state.players.p1.hand = Array.from({ length: 10 }, (_, i) => createDummyCard(`h-${i}`, `Hand ${i}`));

      state = gameReducer(state, {
        type: 'SET_PHASE',
        payload: { phase: 'END' },
      });

      const lastLog = state.logs[state.logs.length - 1];
      expect(lastLog.message).toContain('手札上限');
      expect(lastLog.message).toContain('場外');
      expect(lastLog.message).not.toContain('リムーブエリア');
      expect(lastLog.message).toContain('2 枚');
    });
  });

  describe('Card Conservation and Overwrite Prevention Hardening', () => {
    it('prevents field-to-field MOVE_CARD from overwriting existing card when swap conditions are not met', () => {
      let state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
      const cardA = createDummyCard('card-a', 'Card A');
      const cardB = createDummyCard('card-b', 'Card B');
      state.players.p1.frontLine[0] = cardA;
      state.players.p1.frontLine[1] = cardB;

      // 不正なカードID（card-a のスロットなのに card-unknown を指定）
      state = gameReducer(state, {
        type: 'MOVE_CARD',
        payload: {
          cardId: 'card-unknown',
          from: { playerId: 'p1', zone: 'frontLine', slotIndex: 0 },
          to: { playerId: 'p1', zone: 'frontLine', slotIndex: 1 },
        },
      });

      // どちらのカードも上書きされず元の位置に残る
      expect(state.players.p1.frontLine[0]?.id).toBe('card-a');
      expect(state.players.p1.frontLine[1]?.id).toBe('card-b');
    });

    it('prevents RAID_CARD from consuming wrong hand card or duplicating if card is not in hand', () => {
      let state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
      const baseCard = createDummyCard('base-1', 'Base Card');
      const handCard = createDummyCard('hand-1', 'Hand Card');
      const nonExistentRaidCard = createDummyCard('raid-ghost', 'Ghost Raid Card');

      state.players.p1.frontLine[0] = baseCard;
      state.players.p1.hand = [handCard];

      // 手札の index 0 を指定しているが、渡された raidCard.id は手札に存在しない 'raid-ghost'
      state = gameReducer(state, {
        type: 'RAID_CARD',
        payload: {
          playerId: 'p1',
          targetZone: 'frontLine',
          targetSlotIndex: 0,
          raidCard: nonExistentRaidCard,
          fromLocation: { playerId: 'p1', zone: 'hand', index: 0 },
        },
      });

      // 手札のカードは削除されず残る
      expect(state.players.p1.hand).toHaveLength(1);
      expect(state.players.p1.hand[0].id).toBe('hand-1');
      // フィールドのカードもレイドされず元のまま
      expect(state.players.p1.frontLine[0]?.id).toBe('base-1');
      expect(state.players.p1.frontLine[0]?.underCards ?? []).toHaveLength(0);
    });

    it('prevents CHECK_LIFE_TRIGGER and SELECT_LIFE_FOR_DAMAGE from overwriting pending revealedCard', () => {
      let state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
      const life1 = createDummyCard('life-1', 'Life 1');
      const life2 = createDummyCard('life-2', 'Life 2');
      state.players.p1.life = [life1, life2];

      // 1回目のトリガーチェック
      state = gameReducer(state, {
        type: 'CHECK_LIFE_TRIGGER',
        payload: { playerId: 'p1', lifeIndex: 0 },
      });
      expect(state.revealedCard?.card.id).toBe('life-1');
      expect(state.players.p1.life).toHaveLength(1);

      // 解決前に2回目のトリガーチェックを実行しようとする
      state = gameReducer(state, {
        type: 'CHECK_LIFE_TRIGGER',
        payload: { playerId: 'p1', lifeIndex: 0 },
      });

      // 前の revealedCard が上書きされず残る
      expect(state.revealedCard?.card.id).toBe('life-1');
      // 残りのライフも勝手に削られない
      expect(state.players.p1.life).toHaveLength(1);
    });

    it('rejects REORDER_LIFE when card count or IDs do not match existing life cards', () => {
      let state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
      const life1 = createDummyCard('life-1', 'Life 1');
      const life2 = createDummyCard('life-2', 'Life 2');
      state.players.p1.life = [life1, life2];

      // 枚数が不足している不正な配列
      state = gameReducer(state, {
        type: 'REORDER_LIFE',
        payload: {
          playerId: 'p1',
          newLifeCards: [life1],
        },
      });
      // ライフは変更されず2枚のまま
      expect(state.players.p1.life).toHaveLength(2);

      // 存在しないカードIDが含まれる不正な配列
      state = gameReducer(state, {
        type: 'REORDER_LIFE',
        payload: {
          playerId: 'p1',
          newLifeCards: [life1, createDummyCard('fake', 'Fake')],
        },
      });
      // ライフは変更されず元のまま
      expect(state.players.p1.life.map((c) => c.id)).toEqual(['life-1', 'life-2']);

      // 正当な順列での並び替えは成功する
      state = gameReducer(state, {
        type: 'REORDER_LIFE',
        payload: {
          playerId: 'p1',
          newLifeCards: [life2, life1],
        },
      });
      expect(state.players.p1.life.map((c) => c.id)).toEqual(['life-2', 'life-1']);
    });

    it('rejects SEPARATE_UNDER_CARD and SEPARATE_PARENT_CARD with invalid destination without losing cards', () => {
      let state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
      const parent = createDummyCard('p-1', 'Parent Card');
      const under = createDummyCard('u-1', 'Under Card');
      parent.underCards = [under];
      state.players.p1.frontLine[0] = parent;

      // 無効な destination での下敷き分離試行
      state = gameReducer(state, {
        type: 'SEPARATE_UNDER_CARD',
        payload: {
          playerId: 'p1',
          zone: 'frontLine',
          slotIndex: 0,
          underCardId: 'u-1',
          destination: 'invalid_destination' as unknown as 'hand',
        },
      });

      // カードが抜き出されず残る
      expect(state.players.p1.frontLine[0]?.underCards).toHaveLength(1);
      expect(state.players.p1.frontLine[0]?.underCards?.[0].id).toBe('u-1');

      // 無効な destination での親分離試行
      state = gameReducer(state, {
        type: 'SEPARATE_PARENT_CARD',
        payload: {
          playerId: 'p1',
          zone: 'frontLine',
          slotIndex: 0,
          destination: 'invalid_destination' as unknown as 'hand',
        },
      });

      // 親カードもそのまま残り消滅しない
      expect(state.players.p1.frontLine[0]?.id).toBe('p-1');
      expect(state.players.p1.frontLine[0]?.underCards).toHaveLength(1);
    });

    it('preserves complete card count across valid operations and would roll back any conservation corruptions', () => {
      let state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
      state = gameReducer(state, {
        type: 'SETUP_GAME',
        payload: {
          playerId: 'p1',
          deckCards: Array.from({ length: 50 }, (_, i) => createDummyCard(`p1-c-${i}`, `Card ${i}`)),
          apCards: [],
        },
      });

      const totalBefore = state.players.p1.hand.length + state.players.p1.deck.length;
      expect(totalBefore).toBe(50);

      // 通常アクションの正常実行
      const handCardId = state.players.p1.hand[0].id;
      state = gameReducer(state, {
        type: 'MOVE_CARD',
        payload: {
          cardId: handCardId,
          from: { playerId: 'p1', zone: 'hand', index: 0 },
          to: { playerId: 'p1', zone: 'energyLine', slotIndex: 0 },
        },
      });

      expect(state.players.p1.hand.length + state.players.p1.deck.length + 1).toBe(50);
      expect(state.players.p1.energyLine[0]?.id).toBe(handCardId);
    });

    it('clears pendingCombat and notifies defeat without forcing FINISHED status when attacked at 0 life', () => {
      let state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
      state.status = 'PLAYING';
      state.phase = 'ATTACK';
      state.turn = 2;
      state.activePlayerId = 'p1';
      state.players.p1.frontLine[0] = createDummyCard('c-1', 'Attacker');
      state.players.p2.life = []; // 相手ライフが0枚

      // アタック宣言
      state = gameReducer(state, {
        type: 'DECLARE_PLAYER_ATTACK',
        payload: {
          actorPlayerId: 'p1',
          attackerZone: 'frontLine',
          attackerSlotIndex: 0,
          defenderPlayerId: 'p2',
        },
      });
      expect(state.pendingCombat?.stage).toBe('BLOCK_DECISION');

      // ノーブロック（PASS_BLOCK）
      state = gameReducer(state, {
        type: 'PASS_BLOCK',
        payload: { actorPlayerId: 'p2' },
      });

      // pendingCombat が解消されスタックしない
      expect(state.pendingCombat).toBeNull();
      // ゲームは勝手に FINISHED にならず手動継続可能
      expect(state.status).toBe('PLAYING');
      // ログにライフ0被弾のアナウンスが出力される
      const lastLog = state.logs[state.logs.length - 1];
      expect(lastLog.message).toContain('ライフ');
      expect(lastLog.message).toContain('0');
    });

    it('notifies defeat when life becomes 0 after trigger resolution without forcing FINISHED status', () => {
      let state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
      state.status = 'PLAYING';
      const lastLife = createDummyCard('last-life', 'Last Life');
      state.players.p1.life = [lastLife];

      // トリガーチェック
      state = gameReducer(state, {
        type: 'CHECK_LIFE_TRIGGER',
        payload: { playerId: 'p1', lifeIndex: 0 },
      });
      expect(state.revealedCard?.card.id).toBe('last-life');

      // 場外へ送ってライフが0枚になる
      state = gameReducer(state, {
        type: 'DISMISS_REVEALED_CARD',
        payload: { destination: 'graveyard' },
      });

      expect(state.players.p1.life).toHaveLength(0);
      expect(state.status).toBe('PLAYING'); // 勝手にFINISHEDにならない
      const lastLog = state.logs[state.logs.length - 1];
      expect(lastLog.message).toContain('ライフが 0 枚');
      expect(lastLog.message).toContain('敗北');
    });

    it('does not notify defeat if life is recovered back from trigger check (final trigger)', () => {
      let state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
      state.status = 'PLAYING';
      const lastLife = createDummyCard('last-life', 'Final Trigger Card');
      state.players.p1.life = [lastLife];

      state = gameReducer(state, {
        type: 'CHECK_LIFE_TRIGGER',
        payload: { playerId: 'p1', lifeIndex: 0 },
      });

      // ライフへ戻す（ファイナルトリガー等）
      state = gameReducer(state, {
        type: 'DISMISS_REVEALED_CARD',
        payload: { destination: 'life' },
      });

      expect(state.players.p1.life).toHaveLength(1);
      const lastLog = state.logs[state.logs.length - 1];
      expect(lastLog.message).not.toContain('敗北');
    });

    it('notifies defeat when life becomes 0 from TAKE_LIFE', () => {
      let state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
      state.status = 'PLAYING';
      const lastLife = createDummyCard('last-life', 'Last Life Card');
      state.players.p1.life = [lastLife];

      state = gameReducer(state, {
        type: 'TAKE_LIFE',
        payload: { playerId: 'p1', destination: 'hand', lifeIndex: 0 },
      });

      expect(state.players.p1.life).toHaveLength(0);
      expect(state.status).toBe('PLAYING');
      const lastLog = state.logs[state.logs.length - 1];
      expect(lastLog.message).toContain('ライフが 0 枚');
      expect(lastLog.message).toContain('敗北');
    });

    it('rejects FIELD card attacks and blocks', () => {
      const state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
      state.status = 'PLAYING';
      state.phase = 'ATTACK';
      state.turn = 2; // 先攻1T制約を回避
      state.activePlayerId = 'p1';

      const fieldCard: Card = {
        ...createDummyCard('field-1', 'Training Ground'),
        cardType: 'FIELD',
        bp: null,
      };
      const defenderChar = createDummyCard('char-def', 'Defender Char', 3000);
      state.players.p1.frontLine[0] = fieldCard;
      state.players.p2.frontLine[0] = defenderChar;
      state.players.p2.life = [createDummyCard('life-1', 'Life 1')];

      // フィールドカードでプレイヤーアタック宣言 -> no-op
      const stateAfterPlayerAttack = gameReducer(state, {
        type: 'DECLARE_PLAYER_ATTACK',
        payload: {
          actorPlayerId: 'p1',
          attackerZone: 'frontLine',
          attackerSlotIndex: 0,
          defenderPlayerId: 'p2',
        },
      });
      expect(stateAfterPlayerAttack.pendingCombat).toBeNull();
      expect(stateAfterPlayerAttack.players.p1.frontLine[0]?.isRested).toBe(false);

      // フィールドカードでキャラアタック（狙い撃ち）宣言 -> no-op
      const stateAfterSnipe = gameReducer(state, {
        type: 'ATTACK_CHARACTER',
        payload: {
          actorPlayerId: 'p1',
          attackerZone: 'frontLine',
          attackerSlotIndex: 0,
          targetPlayerId: 'p2',
          targetSlotIndex: 0,
        },
      });
      expect(stateAfterSnipe.players.p1.frontLine[0]?.isRested).toBe(false);

      // 正当なキャラアタックに対してフィールドカードがブロック宣言 -> no-op
      const blockState = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
      blockState.status = 'PLAYING';
      blockState.phase = 'ATTACK';
      blockState.turn = 2;
      blockState.activePlayerId = 'p1';
      const attackerChar = createDummyCard('char-atk', 'Attacker Char', 4000);
      blockState.players.p1.frontLine[0] = attackerChar;
      blockState.players.p2.frontLine[0] = fieldCard;
      blockState.players.p2.life = [createDummyCard('life-1', 'Life 1')];

      const attackingState = gameReducer(blockState, {
        type: 'DECLARE_PLAYER_ATTACK',
        payload: {
          actorPlayerId: 'p1',
          attackerZone: 'frontLine',
          attackerSlotIndex: 0,
          defenderPlayerId: 'p2',
        },
      });
      expect(attackingState.pendingCombat?.stage).toBe('BLOCK_DECISION');

      const blockedState = gameReducer(attackingState, {
        type: 'BLOCK_ATTACK',
        payload: {
          actorPlayerId: 'p2',
          blockerSlotIndex: 0,
        },
      });
      // ブロックが成立せず、依然として BLOCK_DECISION のまま
      expect(blockedState.pendingCombat?.stage).toBe('BLOCK_DECISION');
      expect(blockedState.players.p2.frontLine[0]?.isRested).toBe(false);
    });

    it('prevents FIELD cards from entering or moving to frontLine', () => {
      const state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
      state.status = 'PLAYING';
      const fieldCard: Card = {
        ...createDummyCard('field-1', 'Training Ground'),
        cardType: 'FIELD',
        bp: null,
      };
      state.players.p1.hand = [fieldCard];

      // 手札からフロントラインへの移動 -> 拒否 (no-op)
      const stateAfterHandToFront = gameReducer(state, {
        type: 'MOVE_CARD',
        payload: {
          cardId: 'field-1',
          from: { playerId: 'p1', zone: 'hand', index: 0 },
          to: { playerId: 'p1', zone: 'frontLine', slotIndex: 0 },
        },
      });
      expect(stateAfterHandToFront.players.p1.frontLine[0]).toBeNull();
      expect(stateAfterHandToFront.players.p1.hand).toHaveLength(1);

      // 手札からエナジーラインへの移動 -> 許可
      const stateAfterHandToEnergy = gameReducer(state, {
        type: 'MOVE_CARD',
        payload: {
          cardId: 'field-1',
          from: { playerId: 'p1', zone: 'hand', index: 0 },
          to: { playerId: 'p1', zone: 'energyLine', slotIndex: 0 },
        },
      });
      expect(stateAfterHandToEnergy.players.p1.energyLine[0]?.id).toBe('field-1');
      expect(stateAfterHandToEnergy.players.p1.hand).toHaveLength(0);

      // エナジーラインからフロントラインへの移動 -> 拒否 (no-op)
      const stateAfterEnergyToFront = gameReducer(stateAfterHandToEnergy, {
        type: 'MOVE_CARD',
        payload: {
          cardId: 'field-1',
          from: { playerId: 'p1', zone: 'energyLine', slotIndex: 0 },
          to: { playerId: 'p1', zone: 'frontLine', slotIndex: 0 },
        },
      });
      expect(stateAfterEnergyToFront.players.p1.frontLine[0]).toBeNull();
      expect(stateAfterEnergyToFront.players.p1.energyLine[0]?.id).toBe('field-1');

      // SEARCH_DECK_CARD で FIELD カードを frontLine に登場させようとした場合は手札に退避
      const searchDeckState = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
      searchDeckState.status = 'PLAYING';
      searchDeckState.players.p1.deck = [{ ...fieldCard, id: 'field-in-deck' }];
      const stateAfterSearchToFront = gameReducer(searchDeckState, {
        type: 'SEARCH_DECK_CARD',
        payload: {
          playerId: 'p1',
          cardId: 'field-in-deck',
          destination: 'frontLine',
        },
      });
      expect(stateAfterSearchToFront.players.p1.frontLine[0]).toBeNull();
      expect(stateAfterSearchToFront.players.p1.hand.some((c) => c.id === 'field-in-deck')).toBe(true);
    });

    it('rejects RAID_CARD when target is a FIELD card or raidCard is not a CHARACTER', () => {
      const state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
      state.status = 'PLAYING';
      const fieldCard = { ...createDummyCard('field-target', 'フィールド'), cardType: 'FIELD' as const };
      const raidCharacter = { ...createDummyCard('raid-char', 'レイドキャラ'), cardType: 'CHARACTER' as const, triggers: ['RAID' as const] };
      const nonCharCard = { ...createDummyCard('field-raid', 'レイドフィールド'), cardType: 'FIELD' as const };

      state.players.p1.energyLine[0] = fieldCard;
      state.players.p1.hand = [raidCharacter, nonCharCard];

      // フィールドカードの上にレイドしようとする -> 拒否 (no-op)
      const stateAfterRaidOnField = gameReducer(state, {
        type: 'RAID_CARD',
        payload: {
          playerId: 'p1',
          targetZone: 'energyLine',
          targetSlotIndex: 0,
          raidCard: raidCharacter,
          fromLocation: { playerId: 'p1', zone: 'hand', index: 0 },
          moveToFront: false,
        },
      });
      expect(stateAfterRaidOnField).toBe(state);
      expect(stateAfterRaidOnField.players.p1.energyLine[0]?.id).toBe('field-target');
      expect(stateAfterRaidOnField.players.p1.hand).toHaveLength(2);

      // キャラの上に非CHARACTERカード（FIELD）をレイドしようとする -> 拒否 (no-op)
      const state2 = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
      state2.status = 'PLAYING';
      const normalChar = createDummyCard('char-target', '対象キャラ');
      state2.players.p1.energyLine[1] = normalChar;
      state2.players.p1.hand = [nonCharCard];
      const stateAfterNonCharRaid = gameReducer(state2, {
        type: 'RAID_CARD',
        payload: {
          playerId: 'p1',
          targetZone: 'energyLine',
          targetSlotIndex: 1,
          raidCard: nonCharCard,
          fromLocation: { playerId: 'p1', zone: 'hand', index: 0 },
          moveToFront: false,
        },
      });
      expect(stateAfterNonCharRaid).toBe(state2);
      expect(stateAfterNonCharRaid.players.p1.energyLine[1]?.id).toBe('char-target');
      expect(stateAfterNonCharRaid.players.p1.hand).toHaveLength(1);
    });

    it('places searched card on top of life (unshift) instead of bottom in SEARCH_DECK_CARD', () => {
      let state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
      state.status = 'PLAYING';
      const existingLife = createDummyCard('existing-life', 'Existing Life');
      const searchedCard = createDummyCard('searched-card', 'Searched Card');
      state.players.p1.life = [existingLife];
      state.players.p1.deck = [searchedCard];

      state = gameReducer(state, {
        type: 'SEARCH_DECK_CARD',
        payload: {
          playerId: 'p1',
          cardId: 'searched-card',
          destination: 'life',
        },
      });

      expect(state.players.p1.life).toHaveLength(2);
      // ライフトップ (インデックス 0) に置かれていること
      expect(state.players.p1.life[0].id).toBe('searched-card');
      expect(state.players.p1.life[1].id).toBe('existing-life');
    });

    describe('empty deck draw defeat notifications', () => {
      it('logs defeat condition when DRAW_CARD is executed with 0 cards in deck without setting status to FINISHED', () => {
        let state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
        state.status = 'PLAYING';
        state.players.p1.deck = [];

        state = gameReducer(state, {
          type: 'DRAW_CARD',
          payload: { playerId: 'p1', count: 1 },
        });

        expect(state.status).toBe('PLAYING');
        expect(state.logs.some((l) => l.message.includes('【山札0枚】') && l.message.includes('カードを引けませんでした'))).toBe(true);
      });

      it('logs defeat condition when DRAW_CARD runs out of cards midway without setting status to FINISHED', () => {
        let state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
        state.status = 'PLAYING';
        state.players.p1.deck = [createDummyCard('card-1', 'カード1')];

        state = gameReducer(state, {
          type: 'DRAW_CARD',
          payload: { playerId: 'p1', count: 2 },
        });

        expect(state.status).toBe('PLAYING');
        expect(state.players.p1.hand).toHaveLength(1);
        expect(state.logs.some((l) => l.message.includes('【山札0枚】') && l.message.includes('指定された枚数を引ききれませんでした'))).toBe(true);
      });

      it('logs defeat condition when EXTRA_DRAW is executed with 0 cards in deck and does not consume AP', () => {
        let state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
        state.status = 'PLAYING';
        state.players.p1.apCurrent = 1;
        state.players.p1.deck = [];

        state = gameReducer(state, {
          type: 'EXTRA_DRAW',
          payload: { playerId: 'p1' },
        });

        expect(state.status).toBe('PLAYING');
        expect(state.players.p1.apCurrent).toBe(1);
        expect(state.players.p1.hasExtraDrawn).toBe(false);
        expect(state.logs.some((l) => l.message.includes('【山札0枚】') && l.message.includes('エクストラドローを行えませんでした'))).toBe(true);
      });

      it('logs defeat condition on PASS_TURN start phase draw when next player has 0 cards in deck', () => {
        let state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
        state.status = 'PLAYING';
        state.turn = 1; // p1 turn 1 (先攻)
        state.activePlayerId = 'p1';
        state.players.p2.deck = []; // p2 (後攻) の山札が0枚

        state = gameReducer(state, {
          type: 'PASS_TURN',
          payload: { playerId: 'p1' },
        });

        // ターンがp2に移り (turn 2)、p2は後攻1ターン目なのでドローしようとして山札0枚通知が出る
        expect(state.turn).toBe(2);
        expect(state.activePlayerId).toBe('p2');
        expect(state.status).toBe('PLAYING');
        expect(state.logs.some((l) => l.message.includes('【山札0枚】') && l.message.includes('スタートフェイズのドローができませんでした'))).toBe(true);
      });

      it('does not log defeat condition on PASS_TURN for first player on turn 1 even if deck is 0', () => {
        let state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
        state.status = 'PLAYING';
        state.turn = 0;
        state.activePlayerId = 'p2';
        state.players.p1.deck = []; // p1 (先攻) の山札が0枚

        // 仮想的に turn 0 から p1 にターンを渡す場合（通常はターン1から始まるが先攻1ターン目ドローなしの検証）
        state = gameReducer(state, {
          type: 'PASS_TURN',
          payload: { playerId: 'p2' },
        });

        // turn 1、p1 (先攻) はルール上ドローなしなので通知は出ない
        expect(state.turn).toBe(1);
        expect(state.activePlayerId).toBe('p1');
        expect(state.logs.some((l) => l.message.includes('【山札0枚】'))).toBe(false);
      });
    });
  });
});
