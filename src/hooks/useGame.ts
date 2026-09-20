import { useState, useCallback, useEffect, useRef } from 'react';
import { GameAction } from '../types/actions';
import { GameState } from '../types/game';
import { PeerMessage, PeerStateSnapshot } from '../types/peer';
import { createInitialGameState } from '../domain/initialState';
import { createAuthoritativeTransition, isNewerSnapshot } from '../domain/peerSync';
import { usePeer } from './usePeer';
import { sound } from '../utils/audio';

type NetworkRole = 'solo' | 'host' | 'guest';

export function useGame() {
  const [myPlayerId, setMyPlayerId] = useState<string>('player-1');
  const [gameState, setGameState] = useState<GameState>(() =>
    createInitialGameState('player-1', 'あなた', 'player-2', '対戦相手', 'player-1')
  );

  // 巻き戻し用Undoスタック (最大30件)
  const [history, setHistory] = useState<GameState[]>([]);

  // 通信イベントは接続開始時に登録されるため、常に最新値をRefから読む。
  const gameStateRef = useRef<GameState>(gameState);
  const historyRef = useRef<GameState[]>([]);
  const myPlayerIdRef = useRef<string>('player-1');
  const networkRoleRef = useRef<NetworkRole>('solo');
  const hostRevisionRef = useRef(0);
  const lastAppliedRevisionRef = useRef(-1);

  const peer = usePeer();
  const { sendMessage, status: peerStatus, createRoom, joinRoom } = peer;
  const sendMessageRef = useRef(sendMessage);
  const peerStatusRef = useRef(peerStatus);

  useEffect(() => {
    sendMessageRef.current = sendMessage;
    peerStatusRef.current = peerStatus;
  }, [peerStatus, sendMessage]);

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
    }
  }, [broadcastSnapshot, replaceState, triggerActionSound]);

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
    }
  }, [broadcastSnapshot]);

  // P2Pメッセージ受信ハンドラ。ホストのみがアクションを確定する。
  const handlePeerMessage = useCallback((msg: PeerMessage) => {
    if (msg.type === 'ACTION_REQUEST') {
      if (networkRoleRef.current !== 'host') return;
      applyAuthoritativeAction(msg.payload as GameAction);
    } else if (msg.type === 'UNDO_REQUEST') {
      if (networkRoleRef.current !== 'host') return;
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
      applyRemoteSnapshot(msg.payload as PeerStateSnapshot, false);
    }
  }, [applyAuthoritativeAction, applyRemoteSnapshot, performAuthoritativeUndo]);

  // ホストとして部屋作成
  const handleCreateRoom = useCallback(async () => {
    networkRoleRef.current = 'host';
    myPlayerIdRef.current = 'player-1';
    hostRevisionRef.current = 0;
    setMyPlayerId('player-1');
    return createRoom(handlePeerMessage);
  }, [createRoom, handlePeerMessage]);

  // ゲストとして部屋参加
  const handleJoinRoom = useCallback(async (roomId: string) => {
    networkRoleRef.current = 'guest';
    myPlayerIdRef.current = 'player-2';
    lastAppliedRevisionRef.current = -1;
    setMyPlayerId('player-2');
    await joinRoom(roomId, handlePeerMessage);

    setTimeout(() => {
      sendMessageRef.current({
        type: 'SYNC_REQUEST',
        senderId: 'player-2',
        timestamp: Date.now(),
      });
    }, 500);
  }, [joinRoom, handlePeerMessage]);

  // アクション発行関数。接続中のゲストはホストへ実行要求だけを送る。
  const dispatchAction = useCallback((action: GameAction) => {
    if (peerStatusRef.current === 'connected' && networkRoleRef.current === 'guest') {
      sendMessageRef.current({
        type: 'ACTION_REQUEST',
        senderId: myPlayerIdRef.current,
        timestamp: Date.now(),
        payload: action,
      });
      return;
    }

    applyAuthoritativeAction(action);
  }, [applyAuthoritativeAction]);

  // Undo (1手巻き戻し)
  const undo = useCallback(() => {
    if (peerStatusRef.current === 'connected' && networkRoleRef.current === 'guest') {
      sendMessageRef.current({
        type: 'UNDO_REQUEST',
        senderId: myPlayerIdRef.current,
        timestamp: Date.now(),
      });
      return;
    }

    performAuthoritativeUndo();
  }, [performAuthoritativeUndo]);

  return {
    gameState,
    myPlayerId,
    setMyPlayerId,
    dispatchAction,
    undo,
    canUndo: history.length > 0,
    peer,
    createRoom: handleCreateRoom,
    joinRoom: handleJoinRoom,
  };
}
