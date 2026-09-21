// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import { createInitialGameState } from '../initialState';
import {
  clearHostSession,
  getHostSessionStorageKey,
  hasMeaningfulHostSession,
  loadSavedHostSession,
  saveHostSession,
  SavedHostSession,
} from '../hostSessionStorage';
import { Card } from '../../types/card';

function createDummyCard(id: string): Card {
  return {
    id,
    code: 'TEST-001',
    name: 'Test Character',
    cardType: 'CHARACTER',
    color: 'RED',
    bp: 2000,
    apCost: 1,
    reqEnergy: 1,
    genEnergy: 1,
    traits: [],
    triggers: [],
    effectText: '',
    isRested: false,
    bpModifier: 0,
    underCards: [],
  };
}

describe('hostSessionStorage', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('generates a consistent storage key for a room', () => {
    expect(getHostSessionStorageKey('test-room-123')).toBe('ua:host-session:test-room-123');
  });

  describe('hasMeaningfulHostSession', () => {
    it('returns false for an untouched initial game state', () => {
      const state = createInitialGameState('player-1', 'Host', 'player-2', 'Guest', 'player-1');
      expect(hasMeaningfulHostSession(state)).toBe(false);
    });

    it('returns true if the status is not PREPARING', () => {
      const state = createInitialGameState('player-1', 'Host', 'player-2', 'Guest', 'player-1');
      state.status = 'PLAYING';
      expect(hasMeaningfulHostSession(state)).toBe(true);
    });

    it('returns true if any player has cards in deck', () => {
      const state = createInitialGameState('player-1', 'Host', 'player-2', 'Guest', 'player-1');
      state.players['player-1'].deck = [createDummyCard('c-1')];
      expect(hasMeaningfulHostSession(state)).toBe(true);
    });

    it('returns true if any player has cards in hand or life or field', () => {
      const state = createInitialGameState('player-1', 'Host', 'player-2', 'Guest', 'player-1');
      state.players['player-2'].life = [createDummyCard('c-life')];
      expect(hasMeaningfulHostSession(state)).toBe(true);
    });

    it('returns true if turn count > 1', () => {
      const state = createInitialGameState('player-1', 'Host', 'player-2', 'Guest', 'player-1');
      state.turn = 2;
      expect(hasMeaningfulHostSession(state)).toBe(true);
    });

    it('returns true if logs are recorded', () => {
      const state = createInitialGameState('player-1', 'Host', 'player-2', 'Guest', 'player-1');
      state.logs.push({
        id: 'log-1',
        timestamp: Date.now(),
        message: 'Game started',
        type: 'system',
      });
      expect(hasMeaningfulHostSession(state)).toBe(true);
    });
  });

  describe('saveHostSession and loadSavedHostSession', () => {
    it('saves and loads a valid host session', () => {
      const state = createInitialGameState('player-1', 'Host', 'player-2', 'Guest', 'player-1');
      state.players['player-1'].deck = [createDummyCard('card-1')];
      const snapshot = {
        state,
        revision: 3,
      };

      saveHostSession('room-abc', snapshot);

      const loaded = loadSavedHostSession('room-abc');
      expect(loaded).not.toBeNull();
      expect(loaded?.roomId).toBe('room-abc');
      expect(loaded?.snapshot.revision).toBe(3);
      expect(loaded?.snapshot.state.players['player-1'].deck[0].id).toBe('card-1');
      expect(typeof loaded?.savedAt).toBe('number');
    });

    it('does not save if state is not meaningful', () => {
      const state = createInitialGameState('player-1', 'Host', 'player-2', 'Guest', 'player-1');
      const snapshot = {
        state,
        revision: 0,
      };

      saveHostSession('room-blank', snapshot);
      expect(loadSavedHostSession('room-blank')).toBeNull();
    });

    it('clears invalid or corrupted JSON from storage and returns null', () => {
      const key = getHostSessionStorageKey('corrupt-room');
      sessionStorage.setItem(key, 'not valid json {{{');

      expect(loadSavedHostSession('corrupt-room')).toBeNull();
      expect(sessionStorage.getItem(key)).toBeNull();
    });

    it('clears invalid snapshot data from storage and returns null', () => {
      const key = getHostSessionStorageKey('invalid-room');
      sessionStorage.setItem(
        key,
        JSON.stringify({
          roomId: 'invalid-room',
          savedAt: Date.now(),
          snapshot: { revision: -1, state: {} },
        })
      );

      expect(loadSavedHostSession('invalid-room')).toBeNull();
      expect(sessionStorage.getItem(key)).toBeNull();
    });

    it('clears session when room mismatch occurs', () => {
      const state = createInitialGameState('player-1', 'Host', 'player-2', 'Guest', 'player-1');
      state.players['player-1'].deck = [createDummyCard('c-1')];
      const key = getHostSessionStorageKey('room-actual');
      const payload: SavedHostSession = {
        roomId: 'room-different',
        savedAt: Date.now(),
        snapshot: { state, revision: 1 },
      };
      sessionStorage.setItem(key, JSON.stringify(payload));

      expect(loadSavedHostSession('room-actual')).toBeNull();
      expect(sessionStorage.getItem(key)).toBeNull();
    });
  });

  describe('clearHostSession', () => {
    it('removes the session from sessionStorage', () => {
      const state = createInitialGameState('player-1', 'Host', 'player-2', 'Guest', 'player-1');
      state.players['player-1'].deck = [createDummyCard('card-1')];
      saveHostSession('room-to-clear', { state, revision: 1 });

      expect(loadSavedHostSession('room-to-clear')).not.toBeNull();
      clearHostSession('room-to-clear');
      expect(loadSavedHostSession('room-to-clear')).toBeNull();
    });
  });
});
