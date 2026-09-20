import { GameAction } from '../types/actions';
import { GameState } from '../types/game';
import { PeerStateSnapshot } from '../types/peer';
import { gameReducer } from './reducer';

export interface AuthoritativeTransition {
  changed: boolean;
  snapshot: PeerStateSnapshot;
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

export function isNewerSnapshot(snapshot: PeerStateSnapshot, lastAppliedRevision: number): boolean {
  return Boolean(
    snapshot &&
    snapshot.state &&
    typeof snapshot.revision === 'number' &&
    snapshot.revision > lastAppliedRevision
  );
}
