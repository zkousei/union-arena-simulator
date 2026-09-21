import { describe, expect, it } from 'vitest';
import { GameAction } from '../../types/actions';
import { Card } from '../../types/card';
import { GameState } from '../../types/game';
import { createInitialGameState } from '../initialState';
import { gameReducer } from '../reducer';

function createCard(id: string): Card {
  return {
    id,
    code: `TEST-${id}`,
    name: id,
    cardType: 'CHARACTER',
    color: 'BLUE',
    bp: 1000,
    apCost: 1,
    reqEnergy: 0,
    genEnergy: 1,
    traits: [],
    triggers: [],
    effectText: '',
    isRested: false,
    bpModifier: 0,
    underCards: [],
  };
}

function collectOwnedCards(state: GameState): Card[] {
  const cards: Card[] = [];
  const addCard = (card: Card | null) => {
    if (!card) return;
    cards.push(card);
    card.underCards?.forEach(addCard);
  };

  Object.values(state.players).forEach((player) => {
    player.deck.forEach(addCard);
    player.hand.forEach(addCard);
    player.frontLine.forEach(addCard);
    player.energyLine.forEach(addCard);
    player.life.forEach(addCard);
    player.graveyard.forEach(addCard);
    player.removed.forEach(addCard);
    player.apArea.forEach(addCard);
  });
  state.revealedDeckCards?.cards.forEach(addCard);
  if (state.revealedCard?.card && state.revealedCard.isTrigger !== false) {
    addCard(state.revealedCard.card);
  }

  return cards;
}

function expectGameStateIntegrity(state: GameState, expectedCardIds: Set<string>) {
  const cards = collectOwnedCards(state);
  const actualIds = cards.map((card) => card.id);

  expect(new Set(actualIds)).toEqual(expectedCardIds);
  expect(actualIds).toHaveLength(expectedCardIds.size);
  Object.values(state.players).forEach((player) => {
    expect(player.frontLine).toHaveLength(4);
    expect(player.energyLine).toHaveLength(4);
    expect(player.apCurrent).toBeGreaterThanOrEqual(0);
  });
}

function createPreparedState() {
  let state = createInitialGameState('p1', 'Alice', 'p2', 'Bob', 'p1');
  for (const playerId of ['p1', 'p2']) {
    state = gameReducer(state, {
      type: 'SETUP_GAME',
      payload: {
        playerId,
        deckCards: Array.from({ length: 50 }, (_, index) => createCard(`${playerId}-${index}`)),
        apCards: [],
      },
    });
    state = gameReducer(state, { type: 'KEEP_HAND', payload: { playerId } });
    state = gameReducer(state, { type: 'PLACE_INITIAL_LIFE', payload: { playerId } });
  }
  return state;
}

describe('game state integrity', () => {
  it('preserves every owned card exactly once across a representative action sequence', () => {
    let state = createPreparedState();
    const expectedCardIds = new Set(collectOwnedCards(state).map((card) => card.id));

    const apply = (action: GameAction) => {
      state = gameReducer(state, action);
      expectGameStateIntegrity(state, expectedCardIds);
    };

    expectGameStateIntegrity(state, expectedCardIds);
    apply({ type: 'START_GAME' });

    const handCardId = state.players.p1.hand[0].id;
    apply({
      type: 'MOVE_CARD',
      payload: {
        cardId: handCardId,
        from: { playerId: 'p1', zone: 'hand', index: 0 },
        to: { playerId: 'p1', zone: 'energyLine', slotIndex: 0 },
      },
    });
    apply({ type: 'DRAW_CARD', payload: { playerId: 'p1', count: 2 } });
    apply({ type: 'DISCARD_HAND_CARD', payload: { playerId: 'p1', index: 0 } });
    apply({ type: 'TAKE_LIFE', payload: { playerId: 'p1', destination: 'hand', lifeIndex: 0 } });
    apply({ type: 'LOOK_AT_TOP_DECK', payload: { playerId: 'p1', count: 3 } });
    apply({ type: 'CLOSE_TOP_DECK', payload: { playerId: 'p1', shuffleRemaining: false } });
  });

  it.each<GameAction>([
    { type: 'DRAW_CARD', payload: { playerId: 'missing-player' } },
    {
      type: 'MOVE_CARD',
      payload: {
        cardId: 'missing-card',
        from: { playerId: 'p1', zone: 'hand', index: 0 },
        to: { playerId: 'p1', zone: 'frontLine', slotIndex: 0 },
      },
    },
    { type: 'TOGGLE_REST', payload: { playerId: 'p1', zone: 'frontLine', slotIndex: 0 } },
    {
      type: 'SEARCH_DECK_CARD',
      payload: { playerId: 'p1', cardId: 'missing-card', destination: 'hand' },
    },
  ])('keeps invalid action $type as a safe no-op', (action) => {
    const state = createPreparedState();
    const expectedCardIds = new Set(collectOwnedCards(state).map((card) => card.id));
    const nextState = gameReducer(state, action);

    expect(nextState).toBe(state);
    expectGameStateIntegrity(nextState, expectedCardIds);
  });

  it('does not overwrite an occupied field slot with a card from hand', () => {
    let state = createPreparedState();
    const expectedCardIds = new Set(collectOwnedCards(state).map((card) => card.id));
    const firstCardId = state.players.p1.hand[0].id;
    state = gameReducer(state, {
      type: 'MOVE_CARD',
      payload: {
        cardId: firstCardId,
        from: { playerId: 'p1', zone: 'hand', index: 0 },
        to: { playerId: 'p1', zone: 'frontLine', slotIndex: 0 },
      },
    });
    const beforeInvalidMove = state;

    const nextState = gameReducer(state, {
      type: 'MOVE_CARD',
      payload: {
        cardId: state.players.p1.hand[0].id,
        from: { playerId: 'p1', zone: 'hand', index: 0 },
        to: { playerId: 'p1', zone: 'frontLine', slotIndex: 0 },
      },
    });

    expect(nextState).toBe(beforeInvalidMove);
    expect(nextState.players.p1.frontLine[0]?.id).toBe(firstCardId);
    expectGameStateIntegrity(nextState, expectedCardIds);
  });

  it('does not move a field card when the card ID does not match the slot', () => {
    let state = createPreparedState();
    const cardId = state.players.p1.hand[0].id;
    state = gameReducer(state, {
      type: 'MOVE_CARD',
      payload: {
        cardId,
        from: { playerId: 'p1', zone: 'hand', index: 0 },
        to: { playerId: 'p1', zone: 'frontLine', slotIndex: 0 },
      },
    });

    const nextState = gameReducer(state, {
      type: 'MOVE_CARD',
      payload: {
        cardId: 'missing-card',
        from: { playerId: 'p1', zone: 'frontLine', slotIndex: 0 },
        to: { playerId: 'p1', zone: 'energyLine', slotIndex: 0 },
      },
    });

    expect(nextState).toBe(state);
    expect(nextState.players.p1.frontLine[0]?.id).toBe(cardId);
  });

  it('does not replace an unresolved top-deck inspection with another inspection', () => {
    let state = createPreparedState();
    const expectedCardIds = new Set(collectOwnedCards(state).map((card) => card.id));
    state = gameReducer(state, { type: 'LOOK_AT_TOP_DECK', payload: { playerId: 'p1', count: 3 } });

    const nextState = gameReducer(state, {
      type: 'LOOK_AT_TOP_DECK',
      payload: { playerId: 'p1', count: 2 },
    });

    expect(nextState).toBe(state);
    expectGameStateIntegrity(nextState, expectedCardIds);
  });

  it('does not let another player resolve or close a top-deck inspection', () => {
    let state = createPreparedState();
    const expectedCardIds = new Set(collectOwnedCards(state).map((card) => card.id));
    state = gameReducer(state, { type: 'LOOK_AT_TOP_DECK', payload: { playerId: 'p1', count: 3 } });
    const revealedCardId = state.revealedDeckCards?.cards[0].id;
    expect(revealedCardId).toBeDefined();

    const resolvedByOpponent = gameReducer(state, {
      type: 'RESOLVE_TOP_DECK_CARD',
      payload: { playerId: 'p2', cardId: revealedCardId!, destination: 'hand' },
    });
    const closedByOpponent = gameReducer(state, {
      type: 'CLOSE_TOP_DECK',
      payload: { playerId: 'p2', shuffleRemaining: false },
    });

    expect(resolvedByOpponent).toBe(state);
    expect(closedByOpponent).toBe(state);
    expectGameStateIntegrity(state, expectedCardIds);
  });
});
