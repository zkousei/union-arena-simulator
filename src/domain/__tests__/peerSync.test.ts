import { afterEach, describe, expect, it, vi } from 'vitest';
import { createInitialGameState } from '../initialState';
import { createAuthoritativeTransition, isActionRequestAllowed, isNewerSnapshot } from '../peerSync';
import { gameReducer } from '../reducer';
import { Card } from '../../types/card';

function createCard(index: number): Card {
  return {
    id: `card-${index}`,
    code: `TEST-${index}`,
    name: `Card ${index}`,
    cardType: 'CHARACTER',
    color: 'PURPLE',
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

describe('authoritative P2P synchronization', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shares the host-resolved shuffle instead of recomputing randomness on the guest', () => {
    const state = createInitialGameState('p1', 'Host', 'p2', 'Guest', 'p1');
    state.players.p1.deck = Array.from({ length: 12 }, (_, index) => createCard(index));

    const random = vi.spyOn(Math, 'random').mockReturnValue(0);
    const action = { type: 'SHUFFLE_DECK', payload: { playerId: 'p1' } } as const;
    const transition = createAuthoritativeTransition(
      state,
      action,
      4
    );

    const hostDeckIds = transition.snapshot.state.players.p1.deck.map((card) => card.id);
    random.mockReturnValue(0.999);
    const independentlyReducedDeckIds = gameReducer(state, action).players.p1.deck.map((card) => card.id);
    const guestDeckIds = transition.snapshot.state.players.p1.deck.map((card) => card.id);

    expect(transition.changed).toBe(true);
    expect(transition.snapshot.revision).toBe(5);
    expect(independentlyReducedDeckIds).not.toEqual(hostDeckIds);
    expect(guestDeckIds).toEqual(hostDeckIds);
  });

  it('rejects duplicate and out-of-order state snapshots', () => {
    const state = createInitialGameState('p1', 'Host', 'p2', 'Guest', 'p1');
    const snapshot = { state, revision: 8 };

    expect(isNewerSnapshot(snapshot, 7)).toBe(true);
    expect(isNewerSnapshot(snapshot, 8)).toBe(false);
    expect(isNewerSnapshot(snapshot, 9)).toBe(false);
  });

  it.each([
    null,
    {},
    { revision: 9 },
    { revision: 9, state: {} },
    {
      revision: 9,
      state: {
        ...createInitialGameState('p1', 'Host', 'p2', 'Guest', 'p1'),
        activePlayerId: 'missing-player',
      },
    },
    { revision: Number.NaN, state: createInitialGameState('p1', 'Host', 'p2', 'Guest', 'p1') },
  ])('rejects malformed state snapshots', (snapshot) => {
    expect(isNewerSnapshot(snapshot, 8)).toBe(false);
  });

  it('shares the host-selected random discard without guest recomputation', () => {
    const state = createInitialGameState('p1', 'Host', 'p2', 'Guest', 'p1');
    state.players.p2.hand = Array.from({ length: 5 }, (_, index) => createCard(index));
    const action = { type: 'DISCARD_HAND_CARD', payload: { playerId: 'p2' } } as const;

    vi.spyOn(Math, 'random').mockReturnValue(0.41);
    const transition = createAuthoritativeTransition(state, action, 10);

    expect(transition.snapshot.revision).toBe(11);
    expect(transition.snapshot.state.players.p2.graveyard.map((card) => card.id)).toEqual(['card-2']);
    expect(transition.snapshot.state.players.p2.hand.map((card) => card.id)).toEqual([
      'card-0',
      'card-1',
      'card-3',
      'card-4',
    ]);
  });

  it('does not increment the authoritative revision for an invalid no-op action', () => {
    const state = createInitialGameState('p1', 'Host', 'p2', 'Guest', 'p1');
    const transition = createAuthoritativeTransition(
      state,
      { type: 'DRAW_CARD', payload: { playerId: 'missing-player' } },
      12
    );

    expect(transition.changed).toBe(false);
    expect(transition.snapshot.revision).toBe(12);
    expect(transition.snapshot.state).toBe(state);
  });

  it('rejects a combat request that claims another player as its actor', () => {
    expect(isActionRequestAllowed('p2', {
      type: 'PASS_BLOCK',
      payload: { actorPlayerId: 'p1' },
    })).toBe(false);
    expect(isActionRequestAllowed('p2', {
      type: 'SELECT_LIFE_FOR_DAMAGE',
      payload: { actorPlayerId: 'p2', lifeIndex: 0 },
    })).toBe(true);
    expect(isActionRequestAllowed('p2', {
      type: 'DISMISS_REVEALED_CARD',
      payload: { destination: 'graveyard', actorPlayerId: 'p1' },
    })).toBe(false);
    expect(isActionRequestAllowed('p2', {
      type: 'DISMISS_REVEALED_CARD',
      payload: { destination: 'graveyard', actorPlayerId: 'p2' },
    })).toBe(true);
    expect(isActionRequestAllowed('p2', {
      type: 'PASS_TURN',
      payload: { playerId: 'p1' },
    })).toBe(false);
    expect(isActionRequestAllowed('p2', {
      type: 'PASS_TURN',
      payload: { playerId: 'p2' },
    })).toBe(true);
  });
});
