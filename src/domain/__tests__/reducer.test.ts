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

  it('should support KEEP_HAND and auto-place life on START_GAME if not placed', () => {
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

    // ライフ未配置のまま START_GAME した場合のセーフティネット
    state = gameReducer(state, { type: 'START_GAME' });
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
});
