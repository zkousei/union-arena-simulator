import { useEffect, useRef, useState, useCallback } from 'react';
import Peer, { DataConnection } from 'peerjs';
import { ConnectionStatus, PeerMessage, PeerRole } from '../types/peer';

const RECONNECT_DELAY_MS = 1_000;
const CONNECTION_TIMEOUT_MS = 10_000;
const MAX_RECONNECT_ATTEMPTS = 5;

function createPeerClient(): Peer {
  const host = import.meta.env.VITE_PEER_HOST;

  if (!host) {
    return new Peer({ debug: 1 });
  }

  return new Peer({
    host,
    port: Number(import.meta.env.VITE_PEER_PORT || 9000),
    path: import.meta.env.VITE_PEER_PATH || '/',
    key: import.meta.env.VITE_PEER_KEY || 'peerjs',
    secure: import.meta.env.VITE_PEER_SECURE === 'true',
    debug: 1,
  });
}

export interface UsePeerReturn {
  peerId: string | null;
  remotePeerId: string | null;
  status: ConnectionStatus;
  role: PeerRole;
  lastRoomId: string | null;
  isHost: boolean;
  error: string | null;
  createRoom: (onMessage: (msg: PeerMessage) => void) => Promise<string>;
  joinRoom: (roomId: string, onMessage: (msg: PeerMessage) => void) => Promise<void>;
  reconnect: () => Promise<void>;
  sendMessage: (msg: PeerMessage) => boolean;
  disconnect: () => void;
}

export function usePeer(): UsePeerReturn {
  const [peerId, setPeerId] = useState<string | null>(null);
  const [remotePeerId, setRemotePeerId] = useState<string | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [role, setRole] = useState<PeerRole>(null);
  const [lastRoomId, setLastRoomId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<DataConnection | null>(null);
  const onMessageRef = useRef<((msg: PeerMessage) => void) | null>(null);
  const roleRef = useRef<PeerRole>(null);
  const roomIdRef = useRef<string | null>(null);
  const manualDisconnectRef = useRef(false);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const startGuestConnectionRef = useRef<
    ((roomId: string, isReconnect: boolean) => Promise<void>) | null
  >(null);
  const pendingOperationRejectRef = useRef<((reason: Error) => void) | null>(null);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const disposeTransport = useCallback(() => {
    const rejectPending = pendingOperationRejectRef.current;
    pendingOperationRejectRef.current = null;
    rejectPending?.(new Error('接続処理が中断されました。'));

    const connection = connRef.current;
    connRef.current = null;
    connection?.close();

    const activePeer = peerRef.current;
    peerRef.current = null;
    activePeer?.destroy();
  }, []);

  const scheduleGuestReconnect = useCallback(() => {
    if (
      manualDisconnectRef.current ||
      roleRef.current !== 'guest' ||
      !roomIdRef.current ||
      reconnectTimerRef.current
    ) {
      return;
    }

    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      setStatus('error');
      setError('再接続できませんでした。再試行するか、対戦を終了してください。');
      return;
    }

    setStatus('reconnecting');
    reconnectTimerRef.current = setTimeout(() => {
      reconnectTimerRef.current = null;
      reconnectAttemptsRef.current += 1;
      const roomId = roomIdRef.current;
      if (!roomId || roleRef.current !== 'guest' || manualDisconnectRef.current) return;
      void startGuestConnectionRef.current?.(roomId, true).catch(() => undefined);
    }, RECONNECT_DELAY_MS);
  }, []);

  const bindConnection = useCallback(
    (
      connection: DataConnection,
      connectionRole: Exclude<PeerRole, null>,
      onOpen?: () => void,
      onInitialFailure?: (reason: Error) => void
    ) => {
      const previousConnection = connRef.current;
      connRef.current = null;
      previousConnection?.close();

      connRef.current = connection;
      setRemotePeerId(connection.peer);
      setStatus(connectionRole === 'guest' && reconnectAttemptsRef.current > 0 ? 'reconnecting' : 'connecting');

      let opened = false;
      const timeoutId = setTimeout(() => {
        if (connRef.current !== connection || opened) return;
        const timeoutError = new Error('接続がタイムアウトしました。');
        setError(timeoutError.message);
        connRef.current = null;
        connection.close();
        onInitialFailure?.(timeoutError);
        if (connectionRole === 'guest') scheduleGuestReconnect();
        else setStatus('reconnecting');
      }, CONNECTION_TIMEOUT_MS);

      connection.on('open', () => {
        if (connRef.current !== connection) return;
        opened = true;
        clearTimeout(timeoutId);
        reconnectAttemptsRef.current = 0;
        setStatus('connected');
        setError(null);
        onOpen?.();
      });

      connection.on('data', (data) => {
        if (connRef.current !== connection) return;
        onMessageRef.current?.(data as PeerMessage);
      });

      connection.on('close', () => {
        clearTimeout(timeoutId);
        if (connRef.current !== connection) return;
        connRef.current = null;
        setRemotePeerId(null);

        if (manualDisconnectRef.current || roleRef.current === null) {
          setStatus('disconnected');
          return;
        }

        if (!opened) {
          onInitialFailure?.(new Error('接続が確立する前に切断されました。'));
        }

        if (connectionRole === 'guest') scheduleGuestReconnect();
        else setStatus('reconnecting');
      });

      connection.on('error', (connectionError) => {
        clearTimeout(timeoutId);
        if (connRef.current !== connection) return;
        setError(`通信エラー: ${connectionError.message}`);
        if (!opened) onInitialFailure?.(connectionError);
        if (connectionRole === 'guest') scheduleGuestReconnect();
        else setStatus('reconnecting');
      });
    },
    [scheduleGuestReconnect]
  );

  const startGuestConnection = useCallback(
    (roomId: string, isReconnect: boolean): Promise<void> => {
      clearReconnectTimer();
      disposeTransport();
      manualDisconnectRef.current = false;
      roleRef.current = 'guest';
      roomIdRef.current = roomId;
      setRole('guest');
      setLastRoomId(roomId);
      setStatus(isReconnect ? 'reconnecting' : 'connecting');
      if (!isReconnect) setError(null);

      return new Promise((resolve, reject) => {
        let settled = false;
        const resolveOnce = () => {
          if (settled) return;
          settled = true;
          clearTimeout(peerOpenTimeout);
          pendingOperationRejectRef.current = null;
          resolve();
        };
        const rejectOnce = (reason: Error) => {
          if (settled) return;
          settled = true;
          clearTimeout(peerOpenTimeout);
          pendingOperationRejectRef.current = null;
          reject(reason);
        };
        pendingOperationRejectRef.current = rejectOnce;

        const peer = createPeerClient();
        peerRef.current = peer;

        const peerOpenTimeout = setTimeout(() => {
          if (peerRef.current !== peer || settled) return;
          const timeoutError = new Error('Peerサーバーへの接続がタイムアウトしました。');
          setError(timeoutError.message);
          rejectOnce(timeoutError);
          if (isReconnect) scheduleGuestReconnect();
          else setStatus('error');
        }, CONNECTION_TIMEOUT_MS);

        peer.on('open', (id) => {
          if (peerRef.current !== peer) return;
          clearTimeout(peerOpenTimeout);
          setPeerId(id);
          const connection = peer.connect(roomId, { reliable: true });
          bindConnection(connection, 'guest', resolveOnce, rejectOnce);
        });

        peer.on('disconnected', () => {
          if (peerRef.current !== peer || manualDisconnectRef.current) return;
          scheduleGuestReconnect();
        });

        peer.on('error', (peerError) => {
          if (peerRef.current !== peer) return;
          clearTimeout(peerOpenTimeout);
          setError(`Peerエラー: ${peerError.type} - ${peerError.message}`);
          rejectOnce(peerError);
          if (isReconnect) scheduleGuestReconnect();
          else setStatus('error');
        });
      });
    },
    [bindConnection, clearReconnectTimer, disposeTransport, scheduleGuestReconnect]
  );

  useEffect(() => {
    startGuestConnectionRef.current = startGuestConnection;
  }, [startGuestConnection]);

  const createRoom = useCallback(
    async (onMessage: (msg: PeerMessage) => void): Promise<string> => {
      clearReconnectTimer();
      disposeTransport();
      manualDisconnectRef.current = false;
      reconnectAttemptsRef.current = 0;
      roleRef.current = 'host';
      roomIdRef.current = null;
      onMessageRef.current = onMessage;
      setRole('host');
      setLastRoomId(null);
      setStatus('connecting');
      setError(null);

      return new Promise((resolve, reject) => {
        let settled = false;
        const resolveOnce = (id: string) => {
          if (settled) return;
          settled = true;
          clearTimeout(peerOpenTimeout);
          pendingOperationRejectRef.current = null;
          resolve(id);
        };
        const rejectOnce = (reason: Error) => {
          if (settled) return;
          settled = true;
          clearTimeout(peerOpenTimeout);
          pendingOperationRejectRef.current = null;
          reject(reason);
        };
        pendingOperationRejectRef.current = rejectOnce;

        const peer = createPeerClient();
        peerRef.current = peer;
        const peerOpenTimeout = setTimeout(() => {
          if (peerRef.current !== peer || settled) return;
          const timeoutError = new Error('ルーム作成がタイムアウトしました。');
          setError(timeoutError.message);
          setStatus('error');
          rejectOnce(timeoutError);
        }, CONNECTION_TIMEOUT_MS);

        peer.on('open', (id) => {
          if (peerRef.current !== peer) return;
          setPeerId(id);
          roomIdRef.current = id;
          setLastRoomId(id);
          setStatus('waiting');
          resolveOnce(id);
        });

        peer.on('connection', (connection) => {
          if (peerRef.current !== peer) return;
          bindConnection(connection, 'host');
        });

        peer.on('disconnected', () => {
          if (peerRef.current !== peer || manualDisconnectRef.current) return;
          setStatus('reconnecting');
          setError('シグナリングサーバーから切断されました。再接続しています。');
          if (!peer.destroyed) peer.reconnect();
        });

        peer.on('error', (peerError) => {
          if (peerRef.current !== peer) return;
          setError(`Peerエラー: ${peerError.type} - ${peerError.message}`);
          setStatus('error');
          rejectOnce(peerError);
        });
      });
    },
    [bindConnection, clearReconnectTimer, disposeTransport]
  );

  const joinRoom = useCallback(
    async (roomId: string, onMessage: (msg: PeerMessage) => void): Promise<void> => {
      reconnectAttemptsRef.current = 0;
      onMessageRef.current = onMessage;
      return startGuestConnection(roomId, false);
    },
    [startGuestConnection]
  );

  const reconnect = useCallback(async (): Promise<void> => {
    if (roleRef.current !== 'guest' || !roomIdRef.current) return;
    reconnectAttemptsRef.current = 0;
    setError(null);
    return startGuestConnection(roomIdRef.current, true);
  }, [startGuestConnection]);

  const sendMessage = useCallback((msg: PeerMessage): boolean => {
    if (connRef.current?.open) {
      connRef.current.send(msg);
      return true;
    }
    return false;
  }, []);

  const disconnect = useCallback(() => {
    manualDisconnectRef.current = true;
    clearReconnectTimer();
    roleRef.current = null;
    roomIdRef.current = null;
    onMessageRef.current = null;
    reconnectAttemptsRef.current = 0;
    disposeTransport();
    setPeerId(null);
    setRemotePeerId(null);
    setRole(null);
    setLastRoomId(null);
    setStatus('disconnected');
    setError(null);
  }, [clearReconnectTimer, disposeTransport]);

  useEffect(() => disconnect, [disconnect]);

  return {
    peerId,
    remotePeerId,
    status,
    role,
    lastRoomId,
    isHost: role === 'host',
    error,
    createRoom,
    joinRoom,
    reconnect,
    sendMessage,
    disconnect,
  };
}
