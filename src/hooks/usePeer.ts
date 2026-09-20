import { useEffect, useRef, useState, useCallback } from 'react';
import Peer, { DataConnection } from 'peerjs';
import { ConnectionStatus, PeerMessage } from '../types/peer';

export interface UsePeerReturn {
  peerId: string | null;
  remotePeerId: string | null;
  status: ConnectionStatus;
  isHost: boolean;
  error: string | null;
  createRoom: (onMessage: (msg: PeerMessage) => void) => Promise<string>;
  joinRoom: (roomId: string, onMessage: (msg: PeerMessage) => void) => Promise<void>;
  sendMessage: (msg: PeerMessage) => boolean;
  disconnect: () => void;
}

export function usePeer(): UsePeerReturn {
  const [peerId, setPeerId] = useState<string | null>(null);
  const [remotePeerId, setRemotePeerId] = useState<string | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [isHost, setIsHost] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<DataConnection | null>(null);
  const onMessageRef = useRef<((msg: PeerMessage) => void) | null>(null);

  // メッセージハンドラ登録
  const setupConnection = useCallback((conn: DataConnection) => {
    connRef.current = conn;
    setRemotePeerId(conn.peer);
    setStatus('connecting');

    conn.on('open', () => {
      setStatus('connected');
      setError(null);
    });

    conn.on('data', (data) => {
      try {
        const msg = data as PeerMessage;
        if (onMessageRef.current) {
          onMessageRef.current(msg);
        }
      } catch (err) {
        console.error('Failed to parse incoming peer message:', err);
      }
    });

    conn.on('close', () => {
      setStatus('disconnected');
      setRemotePeerId(null);
      connRef.current = null;
    });

    conn.on('error', (err) => {
      setError(`通信エラー: ${err.message}`);
      setStatus('error');
    });
  }, []);

  // ホストとしてルーム作成
  const createRoom = useCallback(async (onMessage: (msg: PeerMessage) => void): Promise<string> => {
    return new Promise((resolve, reject) => {
      onMessageRef.current = onMessage;
      setStatus('connecting');
      setError(null);

      // 既存のPeerを破棄
      if (peerRef.current) {
        peerRef.current.destroy();
      }

      const peer = new Peer({
        debug: 1,
      });

      peerRef.current = peer;

      peer.on('open', (id) => {
        setPeerId(id);
        setIsHost(true);
        setStatus('disconnected'); // 相手待ち状態
        resolve(id);
      });

      // ゲストからの接続受領
      peer.on('connection', (conn) => {
        setupConnection(conn);
      });

      peer.on('error', (err) => {
        setError(`Peerエラー: ${err.type} - ${err.message}`);
        setStatus('error');
        reject(err);
      });
    });
  }, [setupConnection]);

  // ゲストとして既存ルームへ参加
  const joinRoom = useCallback(async (roomId: string, onMessage: (msg: PeerMessage) => void): Promise<void> => {
    return new Promise((resolve, reject) => {
      onMessageRef.current = onMessage;
      setStatus('connecting');
      setError(null);
      setIsHost(false);

      if (peerRef.current) {
        peerRef.current.destroy();
      }

      const peer = new Peer({
        debug: 1,
      });

      peerRef.current = peer;

      peer.on('open', (id) => {
        setPeerId(id);
        const conn = peer.connect(roomId, {
          reliable: true,
        });

        setupConnection(conn);

        conn.on('open', () => {
          resolve();
        });
      });

      peer.on('error', (err) => {
        setError(`Peerエラー: ${err.type} - ${err.message}`);
        setStatus('error');
        reject(err);
      });
    });
  }, [setupConnection]);

  // メッセージ送信
  const sendMessage = useCallback((msg: PeerMessage): boolean => {
    if (connRef.current && connRef.current.open) {
      connRef.current.send(msg);
      return true;
    }
    return false;
  }, []);

  // 切断処理
  const disconnect = useCallback(() => {
    if (connRef.current) {
      connRef.current.close();
      connRef.current = null;
    }
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
    setPeerId(null);
    setRemotePeerId(null);
    setStatus('disconnected');
    setIsHost(false);
  }, []);

  // アンマウント時クリーンアップ
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    peerId,
    remotePeerId,
    status,
    isHost,
    error,
    createRoom,
    joinRoom,
    sendMessage,
    disconnect,
  };
}
