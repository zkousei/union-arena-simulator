import { useState, useCallback, useEffect, useRef } from 'react';
import { GameAction } from '../types/actions';
import { GameState } from '../types/game';
import { PeerMessage } from '../types/peer';
import { createInitialGameState } from '../domain/initialState';
import { gameReducer } from '../domain/reducer';
import { usePeer } from './usePeer';
import { sound } from '../utils/audio';

export function useGame() {
  const [myPlayerId, setMyPlayerId] = useState<string>('player-1');
  const [gameState, setGameState] = useState<GameState>(() =>
    createInitialGameState('player-1', 'あなた', 'player-2', '対戦相手', 'player-1')
  );

  // 巻き戻し用Undoスタック (最大30件)
  const [history, setHistory] = useState<GameState[]>([]);

  const gameStateRef = useRef<GameState>(gameState);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const peer = usePeer();

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

  // P2Pメッセージ受信ハンドラ
  const handlePeerMessage = useCallback((msg: PeerMessage) => {
    if (msg.type === 'ACTION') {
      const action = msg.payload as GameAction;
      triggerActionSound(action);
      setGameState((prev) => {
        setHistory((h) => [...h.slice(-29), prev]);
        return gameReducer(prev, action);
      });
    } else if (msg.type === 'SYNC_REQUEST') {
      peer.sendMessage({
        type: 'SYNC_RESPONSE',
        senderId: myPlayerId,
        timestamp: Date.now(),
        payload: gameStateRef.current,
      });
    } else if (msg.type === 'SYNC_RESPONSE') {
      const syncedState = msg.payload as GameState;
      setGameState(syncedState);
    }
  }, [myPlayerId, peer, triggerActionSound]);

  // ホストとして部屋作成
  const handleCreateRoom = useCallback(async () => {
    setMyPlayerId('player-1');
    const roomId = await peer.createRoom(handlePeerMessage);
    return roomId;
  }, [peer, handlePeerMessage]);

  // ゲストとして部屋参加
  const handleJoinRoom = useCallback(async (roomId: string) => {
    setMyPlayerId('player-2');
    await peer.joinRoom(roomId, handlePeerMessage);

    setTimeout(() => {
      peer.sendMessage({
        type: 'SYNC_REQUEST',
        senderId: 'player-2',
        timestamp: Date.now(),
      });
    }, 500);
  }, [peer, handlePeerMessage]);

  // アクション発行関数
  const dispatchAction = useCallback((action: GameAction) => {
    triggerActionSound(action);

    setGameState((prev) => {
      // 履歴に保存
      setHistory((h) => [...h.slice(-29), prev]);
      return gameReducer(prev, action);
    });

    if (peer.status === 'connected') {
      peer.sendMessage({
        type: 'ACTION',
        senderId: myPlayerId,
        timestamp: Date.now(),
        payload: action,
      });
    }
  }, [peer, myPlayerId, triggerActionSound]);

  // Undo (1手巻き戻し)
  const undo = useCallback(() => {
    if (history.length === 0) return;
    const previousState = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setGameState(previousState);

    // P2P対戦相手にも最新状態として同期
    if (peer.status === 'connected') {
      peer.sendMessage({
        type: 'SYNC_RESPONSE',
        senderId: myPlayerId,
        timestamp: Date.now(),
        payload: previousState,
      });
    }
  }, [history, peer, myPlayerId]);

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
