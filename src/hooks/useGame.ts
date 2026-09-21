import { useState, useCallback, useEffect, useRef } from 'react';
import { GameAction } from '../types/actions';
import { GameState } from '../types/game';
import { PeerMessage, PeerStateSnapshot } from '../types/peer';
import { createInitialGameState } from '../domain/initialState';
import {
  createAuthoritativeTransition,
  isActionRequestAllowed,
  isNewerSnapshot,
  isValidPeerStateSnapshot,
} from '../domain/peerSync';
import { saveHostSession } from '../domain/hostSessionStorage';
import { usePeer } from './usePeer';
import { sound } from '../utils/audio';

type NetworkRole = 'solo' | 'host' | 'guest';

let requestSessionCounter = 0;

function createRequestSessionId(): string {
  requestSessionCounter += 1;
  return `${Date.now().toString(36)}-${requestSessionCounter.toString(36)}`;
}

export function useGame() {
  const [myPlayerId, setMyPlayerId] = useState<string>('player-1');
  const [gameState, setGameState] = useState<GameState>(() =>
    createInitialGameState('player-1', 'あなた', 'player-2', '対戦相手', 'player-1')
  );

  // 巻き戻し用Undoスタック (最大30件)
  const [history, setHistory] = useState<GameState[]>([]);
  const [isSynchronizing, setIsSynchronizing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // 通信イベントは接続開始時に登録されるため、常に最新値をRefから読む。
  const gameStateRef = useRef<GameState>(gameState);
  const historyRef = useRef<GameState[]>([]);
  const myPlayerIdRef = useRef<string>('player-1');
  const networkRoleRef = useRef<NetworkRole>('solo');
  const hostRevisionRef = useRef(0);
  const lastAppliedRevisionRef = useRef(-1);
  const isSynchronizingRef = useRef(false);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSequenceRef = useRef(0);
  const requestSessionIdRef = useRef(createRequestSessionId());
  const processedRequestIdsRef = useRef(new Set<string>());

  const peer = usePeer();
  const {
    sendMessage,
    status: peerStatus,
    role: peerRole,
    createRoom,
    joinRoom,
    reconnect,
  } = peer;
  const sendMessageRef = useRef(sendMessage);
  const peerStatusRef = useRef(peerStatus);

  useEffect(() => {
    sendMessageRef.current = sendMessage;
    peerStatusRef.current = peerStatus;
  }, [peerStatus, sendMessage]);

  const clearSyncTimeout = useCallback(() => {
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = null;
    }
  }, []);

  const setSynchronizationState = useCallback((synchronizing: boolean) => {
    isSynchronizingRef.current = synchronizing;
    setIsSynchronizing(synchronizing);
  }, []);

  const requestSynchronization = useCallback(() => {
    clearSyncTimeout();
    setSynchronizationState(true);
    setSyncError(null);

    const sent = sendMessageRef.current({
      type: 'SYNC_REQUEST',
      senderId: myPlayerIdRef.current,
      timestamp: Date.now(),
    });
    if (!sent) return;

    syncTimeoutRef.current = setTimeout(() => {
      setSyncError('盤面の再同期がタイムアウトしました。再試行してください。');
    }, 7_000);
  }, [clearSyncTimeout, setSynchronizationState]);

  useEffect(() => {
    if (peerRole === 'host') networkRoleRef.current = 'host';
    if (peerRole === 'guest') networkRoleRef.current = 'guest';

    if (peerRole === null) {
      networkRoleRef.current = 'solo';
      clearSyncTimeout();
      setSynchronizationState(false);
      setSyncError(null);
      return;
    }

    if (peerRole === 'guest') {
      if (peerStatus === 'connected') requestSynchronization();
      else setSynchronizationState(true);
    }
  }, [clearSyncTimeout, peerRole, peerStatus, requestSynchronization, setSynchronizationState]);

  useEffect(() => clearSyncTimeout, [clearSyncTimeout]);

  // サウンド効果の再生
  const triggerActionSound = useCallback((action: GameAction) => {
    switch (action.type) {
      case 'DRAW_CARD':
      case 'EXTRA_DRAW':
      case 'DRAW_INITIAL_HAND':
        sound.playDraw();
        break;
      case 'MOVE_CARD':
        sound.playPlace();
        break;
      case 'TOGGLE_REST':
      case 'SET_ALL_ACTIVE':
        sound.playRest();
        break;
      case 'CHECK_LIFE_TRIGGER':
      case 'SELECT_LIFE_FOR_DAMAGE':
        sound.playTrigger();
        break;
      case 'ROLL_DICE':
        sound.playDice();
        break;
      case 'RAID_CARD':
        sound.playAttack();
        break;
      case 'CHAT_MESSAGE':
        sound.playChat();
        break;
      default:
        break;
    }
  }, []);

  const replaceState = useCallback((nextState: GameState, recordHistory: boolean) => {
    const previousState = gameStateRef.current;
    if (nextState === previousState) return false;

    if (recordHistory) {
      const nextHistory = [...historyRef.current.slice(-29), previousState];
      historyRef.current = nextHistory;
      setHistory(nextHistory);
    }

    gameStateRef.current = nextState;
    setGameState(nextState);
    return true;
  }, []);

  const broadcastSnapshot = useCallback((snapshot: PeerStateSnapshot) => {
    if (peerStatusRef.current !== 'connected') return;

    sendMessageRef.current({
      type: 'STATE_COMMIT',
      senderId: myPlayerIdRef.current,
      timestamp: Date.now(),
      payload: snapshot,
    });
  }, []);

  // 乱数を含むリデューサーはホストで一度だけ実行し、確定済み状態を配信する。
  const applyAuthoritativeAction = useCallback((action: GameAction) => {
    triggerActionSound(action);
    const transition = createAuthoritativeTransition(
      gameStateRef.current,
      action,
      hostRevisionRef.current
    );
    if (!transition.changed || !replaceState(transition.snapshot.state, true)) return;

    if (networkRoleRef.current === 'host') {
      hostRevisionRef.current = transition.snapshot.revision;
      broadcastSnapshot(transition.snapshot);
      const roomId = peer.lastRoomId || peer.peerId;
      if (roomId) {
        saveHostSession(roomId, transition.snapshot);
      }
    }
  }, [broadcastSnapshot, peer.lastRoomId, peer.peerId, replaceState, triggerActionSound]);

  const applyRemoteSnapshot = useCallback((snapshot: PeerStateSnapshot, recordHistory: boolean) => {
    if (!isNewerSnapshot(snapshot, lastAppliedRevisionRef.current)) return;

    lastAppliedRevisionRef.current = snapshot.revision;
    if (snapshot.action) triggerActionSound(snapshot.action);

    if (!recordHistory) {
      historyRef.current = [];
      setHistory([]);
    }
    replaceState(snapshot.state, recordHistory);
  }, [replaceState, triggerActionSound]);

  const performAuthoritativeUndo = useCallback(() => {
    if (historyRef.current.length === 0) return;

    const previousState = historyRef.current[historyRef.current.length - 1];
    const nextHistory = historyRef.current.slice(0, -1);
    historyRef.current = nextHistory;
    setHistory(nextHistory);
    gameStateRef.current = previousState;
    setGameState(previousState);

    if (networkRoleRef.current === 'host') {
      const snapshot: PeerStateSnapshot = {
        state: previousState,
        revision: hostRevisionRef.current + 1,
      };
      hostRevisionRef.current = snapshot.revision;
      broadcastSnapshot(snapshot);
      const roomId = peer.lastRoomId || peer.peerId;
      if (roomId) {
        saveHostSession(roomId, snapshot);
      }
    }
  }, [broadcastSnapshot, peer.lastRoomId, peer.peerId]);

  const restoreHostSession = useCallback(
    (snapshot: PeerStateSnapshot) => {
      gameStateRef.current = snapshot.state;
      setGameState(snapshot.state);
      hostRevisionRef.current = snapshot.revision;
      historyRef.current = [];
      setHistory([]);
      const roomId = peer.lastRoomId || peer.peerId;
      if (roomId) {
        saveHostSession(roomId, snapshot);
      }
      if (peerStatusRef.current === 'connected') {
        broadcastSnapshot(snapshot);
      }
    },
    [broadcastSnapshot, peer.lastRoomId, peer.peerId]
  );

  const hasProcessedRequest = useCallback((msg: PeerMessage) => {
    if (!msg.requestId) return false;
    const requestKey = `${msg.senderId}:${msg.requestId}`;
    if (processedRequestIdsRef.current.has(requestKey)) return true;

    processedRequestIdsRef.current.add(requestKey);
    if (processedRequestIdsRef.current.size > 200) {
      const oldestRequestId = processedRequestIdsRef.current.values().next().value;
      if (oldestRequestId) processedRequestIdsRef.current.delete(oldestRequestId);
    }
    return false;
  }, []);

  // P2Pメッセージ受信ハンドラ。ホストのみがアクションを確定する。
  const handlePeerMessage = useCallback((msg: PeerMessage) => {
    if (msg.type === 'ACTION_REQUEST') {
      if (networkRoleRef.current !== 'host') return;
      if (hasProcessedRequest(msg)) return;
      try {
        const action = msg.payload as GameAction;
        if (!isActionRequestAllowed(msg.senderId, action)) return;
        applyAuthoritativeAction(action);
      } catch {
        return;
      }
    } else if (msg.type === 'UNDO_REQUEST') {
      if (networkRoleRef.current !== 'host') return;
      if (hasProcessedRequest(msg)) return;
      performAuthoritativeUndo();
    } else if (msg.type === 'STATE_COMMIT') {
      if (networkRoleRef.current !== 'guest') return;
      applyRemoteSnapshot(msg.payload as PeerStateSnapshot, true);
    } else if (msg.type === 'SYNC_REQUEST') {
      if (networkRoleRef.current !== 'host') return;
      sendMessageRef.current({
        type: 'SYNC_RESPONSE',
        senderId: myPlayerIdRef.current,
        timestamp: Date.now(),
        payload: {
          state: gameStateRef.current,
          revision: hostRevisionRef.current,
        },
      });
    } else if (msg.type === 'SYNC_RESPONSE') {
      if (networkRoleRef.current !== 'guest') return;
      if (!isValidPeerStateSnapshot(msg.payload)) return;
      const snapshot = msg.payload;
      const previousRevision = lastAppliedRevisionRef.current;
      applyRemoteSnapshot(snapshot, false);
      if (
        snapshot.revision >= previousRevision
      ) {
        clearSyncTimeout();
        setSynchronizationState(false);
        setSyncError(null);
      }
    }
  }, [
    applyAuthoritativeAction,
    applyRemoteSnapshot,
    clearSyncTimeout,
    hasProcessedRequest,
    performAuthoritativeUndo,
    setSynchronizationState,
  ]);

  // ホストとして部屋作成
  const handleCreateRoom = useCallback(
    async (preferredRoomId?: string) => {
      networkRoleRef.current = 'host';
      myPlayerIdRef.current = 'player-1';
      if (!preferredRoomId) {
        hostRevisionRef.current = 0;
      }
      processedRequestIdsRef.current.clear();
      setMyPlayerId('player-1');
      return createRoom(handlePeerMessage, preferredRoomId);
    },
    [createRoom, handlePeerMessage]
  );

  // ゲストとして部屋参加
  const handleJoinRoom = useCallback(async (roomId: string) => {
    networkRoleRef.current = 'guest';
    myPlayerIdRef.current = 'player-2';
    lastAppliedRevisionRef.current = -1;
    requestSequenceRef.current = 0;
    requestSessionIdRef.current = createRequestSessionId();
    setSynchronizationState(true);
    setSyncError(null);
    setMyPlayerId('player-2');
    await joinRoom(roomId, handlePeerMessage);
  }, [handlePeerMessage, joinRoom, setSynchronizationState]);

  const canDispatchNetworkAction = useCallback(() => {
    if (networkRoleRef.current === 'solo') return true;
    if (networkRoleRef.current === 'guest') {
      return peerStatusRef.current === 'connected' && !isSynchronizingRef.current;
    }
    return peerStatusRef.current === 'connected' || peerStatusRef.current === 'waiting';
  }, []);

  // アクション発行関数。接続中のゲストはホストへ実行要求だけを送る。
  const dispatchAction = useCallback((action: GameAction) => {
    if (!canDispatchNetworkAction()) return;

    if (networkRoleRef.current === 'guest') {
      requestSequenceRef.current += 1;
      sendMessageRef.current({
        type: 'ACTION_REQUEST',
        senderId: myPlayerIdRef.current,
        requestId: `${myPlayerIdRef.current}-${requestSessionIdRef.current}-${requestSequenceRef.current}`,
        timestamp: Date.now(),
        payload: action,
      });
      return;
    }

    applyAuthoritativeAction(action);
  }, [applyAuthoritativeAction, canDispatchNetworkAction]);

  // Undo (1手巻き戻し)
  const undo = useCallback(() => {
    if (!canDispatchNetworkAction()) return;

    if (networkRoleRef.current === 'guest') {
      requestSequenceRef.current += 1;
      sendMessageRef.current({
        type: 'UNDO_REQUEST',
        senderId: myPlayerIdRef.current,
        requestId: `${myPlayerIdRef.current}-${requestSessionIdRef.current}-${requestSequenceRef.current}`,
        timestamp: Date.now(),
      });
      return;
    }

    performAuthoritativeUndo();
  }, [canDispatchNetworkAction, performAuthoritativeUndo]);

  const retrySynchronization = useCallback(async () => {
    if (networkRoleRef.current !== 'guest') return;
    if (peerStatusRef.current === 'connected') {
      requestSynchronization();
      return;
    }
    await reconnect();
  }, [reconnect, requestSynchronization]);

  const isInteractionLocked =
    peerRole === 'guest'
      ? peerStatus !== 'connected' || isSynchronizing
      : peerRole === 'host'
        ? peerStatus === 'connecting' || peerStatus === 'reconnecting' || peerStatus === 'error'
        : false;

  return {
    gameState,
    myPlayerId,
    setMyPlayerId,
    dispatchAction,
    undo,
    canUndo: history.length > 0,
    isSynchronizing,
    isInteractionLocked,
    syncError,
    retrySynchronization,
    peer,
    createRoom: handleCreateRoom,
    joinRoom: handleJoinRoom,
    restoreHostSession,
  };
}
