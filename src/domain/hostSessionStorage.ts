import { GameState } from '../types/game';
import { PeerStateSnapshot } from '../types/peer';
import { isValidPeerStateSnapshot } from './peerSync';

export interface SavedHostSession {
  roomId: string;
  savedAt: number;
  snapshot: PeerStateSnapshot;
}

const STORAGE_PREFIX = 'ua:host-session:';

export function getHostSessionStorageKey(roomId: string): string {
  return `${STORAGE_PREFIX}${roomId}`;
}

/**
 * 空の初期状態ではなく、対戦進行またはデッキ配置などの有意なデータが存在するか判定する。
 */
export function hasMeaningfulHostSession(state: GameState): boolean {
  if (state.status !== 'PREPARING') return true;
  if (state.turn > 1) return true;
  if (state.logs.some((log) => log.id !== 'log-init')) return true;
  if (state.revealedCard !== null || state.revealedDeckCards !== null || state.pendingCombat !== null) {
    return true;
  }

  const players = Object.values(state.players);
  for (const player of players) {
    if (player.deck.length > 0) return true;
    if (player.hand.length > 0) return true;
    if (player.life.length > 0) return true;
    if (player.graveyard.length > 0) return true;
    if (player.removed.length > 0) return true;
    if (player.apArea.length > 0) return true;
    if (player.frontLine.some((slot) => slot !== null)) return true;
    if (player.energyLine.some((slot) => slot !== null)) return true;
    if (player.hasMulliganed || player.isHandKept || player.isReady) return true;
  }

  return false;
}

/**
 * ホストの確定済み状態スナップショットを sessionStorage に保存する。
 */
export function saveHostSession(roomId: string, snapshot: PeerStateSnapshot): void {
  if (typeof window === 'undefined' || !window.sessionStorage || !roomId) return;
  if (!hasMeaningfulHostSession(snapshot.state)) return;

  const payload: SavedHostSession = {
    roomId,
    savedAt: Date.now(),
    snapshot,
  };

  try {
    const key = getHostSessionStorageKey(roomId);
    window.sessionStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // quota exceeded or private mode
  }
}

/**
 * sessionStorage から保存されたホストセッションを読み込み、検証する。
 * 不正なデータの場合は storage から削除して null を返す。
 */
export function loadSavedHostSession(roomId: string): SavedHostSession | null {
  if (typeof window === 'undefined' || !window.sessionStorage || !roomId) return null;

  const key = getHostSessionStorageKey(roomId);
  let raw: string | null;
  try {
    raw = window.sessionStorage.getItem(key);
  } catch {
    return null;
  }

  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<SavedHostSession>;
    if (!parsed || parsed.roomId !== roomId || typeof parsed.savedAt !== 'number') {
      window.sessionStorage.removeItem(key);
      return null;
    }

    if (!isValidPeerStateSnapshot(parsed.snapshot)) {
      window.sessionStorage.removeItem(key);
      return null;
    }

    return {
      roomId: parsed.roomId,
      savedAt: parsed.savedAt,
      snapshot: parsed.snapshot,
    };
  } catch {
    window.sessionStorage.removeItem(key);
    return null;
  }
}

/**
 * 指定したルームのセッションを sessionStorage から削除する。
 */
export function clearHostSession(roomId: string): void {
  if (typeof window === 'undefined' || !window.sessionStorage || !roomId) return;
  const key = getHostSessionStorageKey(roomId);
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
}
