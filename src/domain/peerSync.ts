import { GameAction } from '../types/actions';
import { GameState } from '../types/game';
import { PeerStateSnapshot } from '../types/peer';
import { gameReducer } from './reducer';

export interface AuthoritativeTransition {
  changed: boolean;
  snapshot: PeerStateSnapshot;
}

export function isActionRequestAllowed(senderId: string, action: GameAction): boolean {
  switch (action.type) {
    case 'DECLARE_PLAYER_ATTACK':
    case 'PASS_BLOCK':
    case 'BLOCK_ATTACK':
    case 'CANCEL_PLAYER_ATTACK':
    case 'SELECT_LIFE_FOR_DAMAGE':
      return action.payload.actorPlayerId === senderId;
    default:
      return true;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const GAME_STATUSES = new Set(['PREPARING', 'PLAYING', 'FINISHED']);
const GAME_PHASES = new Set(['START', 'MOVE', 'MAIN', 'ATTACK', 'END']);

export function isValidPeerStateSnapshot(value: unknown): value is PeerStateSnapshot {
  if (!isRecord(value) || !Number.isInteger(value.revision) || (value.revision as number) < 0) {
    return false;
  }
  const state = value.state;
  if (
    !isRecord(state) ||
    !GAME_STATUSES.has(state.status as string) ||
    !GAME_PHASES.has(state.phase as string) ||
    !Number.isInteger(state.turn) ||
    (state.turn as number) < 1 ||
    typeof state.activePlayerId !== 'string' ||
    !isRecord(state.players) ||
    !(state.activePlayerId in state.players) ||
    !Array.isArray(state.logs)
  ) {
    return false;
  }

  const players = Object.values(state.players);
  return (
    players.length > 0 &&
    players.every(
      (player) =>
        isRecord(player) &&
        typeof player.id === 'string' &&
        typeof player.name === 'string' &&
        Array.isArray(player.deck) &&
        Array.isArray(player.hand) &&
        Array.isArray(player.frontLine) &&
        player.frontLine.length === 4 &&
        Array.isArray(player.energyLine) &&
        player.energyLine.length === 4 &&
        Array.isArray(player.life) &&
        Array.isArray(player.graveyard) &&
        Array.isArray(player.removed) &&
        Array.isArray(player.apArea) &&
        Number.isFinite(player.apCurrent) &&
        Number.isFinite(player.apMax) &&
        (player.apCurrent as number) >= 0 &&
        (player.apMax as number) >= 0
    )
  );
}

/**
 * ホストでだけアクションを評価し、ゲストへ送る確定済みスナップショットを生成する。
 */
export function createAuthoritativeTransition(
  state: GameState,
  action: GameAction,
  currentRevision: number
): AuthoritativeTransition {
  const nextState = gameReducer(state, action);
  return {
    changed: nextState !== state,
    snapshot: {
      state: nextState,
      revision: nextState === state ? currentRevision : currentRevision + 1,
      action,
    },
  };
}

export function isNewerSnapshot(snapshot: unknown, lastAppliedRevision: number): snapshot is PeerStateSnapshot {
  return isValidPeerStateSnapshot(snapshot) && snapshot.revision > lastAppliedRevision;
}
