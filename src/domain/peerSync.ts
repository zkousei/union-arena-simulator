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
    // ホスト専権アクション（ゲストからの要求は受け付けない）
    case 'INIT_GAME':
    case 'SET_FIRST_PLAYER':
    case 'START_GAME':
    case 'SYNC_STATE':
      return false;

    // 送信者自身のアクションである必要がある操作（playerId による検証）
    case 'SETUP_GAME':
    case 'DRAW_INITIAL_HAND':
    case 'MULLIGAN':
    case 'KEEP_HAND':
    case 'PLACE_INITIAL_LIFE':
    case 'SET_READY':
    case 'TOGGLE_REST':
    case 'SET_ALL_ACTIVE':
    case 'MODIFY_BP':
    case 'RAID_CARD':
    case 'SEPARATE_UNDER_CARD':
    case 'SEPARATE_PARENT_CARD':
    case 'ADD_MARKER':
    case 'TOGGLE_FREEZE':
    case 'RECOVER_LIFE':
    case 'TAKE_LIFE':
    case 'REORDER_LIFE':
    case 'DRAW_CARD':
    case 'FLIP_LIFE':
    case 'DISCARD_ALL_HAND':
    case 'DISCARD_HAND_CARD':
    case 'REVEAL_TOP_DECK_CARD':
    case 'BOTTOM_DECK_ACTION':
    case 'EXTRA_DRAW':
    case 'CHECK_LIFE_TRIGGER':
    case 'USE_AP':
    case 'RECOVER_AP':
    case 'SHUFFLE_DECK':
    case 'PASS_TURN':
    case 'LOOK_AT_TOP_DECK':
    case 'RESOLVE_TOP_DECK_CARD':
    case 'CLOSE_TOP_DECK':
    case 'SEARCH_DECK_CARD':
    case 'ROLL_DICE':
    case 'ADD_LOG':
      return action.payload.playerId === senderId;

    case 'CHAT_MESSAGE':
      return action.payload.senderId === senderId;

    // 移動操作: 自分のカードのみ移動を要求可能
    case 'MOVE_CARD':
      return action.payload.from.playerId === senderId;

    // 戦闘・アタック系操作（actorPlayerId による検証）
    case 'DECLARE_PLAYER_ATTACK':
    case 'ATTACK_CHARACTER':
    case 'PASS_BLOCK':
    case 'BLOCK_ATTACK':
    case 'CANCEL_PLAYER_ATTACK':
    case 'SELECT_LIFE_FOR_DAMAGE':
      return action.payload.actorPlayerId === senderId;

    // 公開カードの処理・フェイズ切り替え（actorPlayerId があれば一致を検証）
    case 'DISMISS_REVEALED_CARD':
      return !action.payload.actorPlayerId || action.payload.actorPlayerId === senderId;
    case 'SET_PHASE':
      return !action.payload.actorPlayerId || action.payload.actorPlayerId === senderId;

    default:
      return false;
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
