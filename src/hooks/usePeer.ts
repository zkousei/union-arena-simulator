import { useEffect, useRef, useState, useCallback } from 'react';
import Peer, { DataConnection } from 'peerjs';
import { ConnectionStatus, PeerMessage, PeerMessageContext, PeerRole } from '../types/peer';
import { generateRoomId } from '../domain/roomId';

const RECONNECT_DELAY_MS = 1_000;
const CONNECTION_TIMEOUT_MS = 10_000;
const MAX_RECONNECT_ATTEMPTS = 5;
export const MAX_SPECTATOR_CONNECTIONS = 8;

const RETRYABLE_GUEST_PEER_ERRORS = new Set([
  'network',
  'peer-unavailable',
  'server-error',
  'socket-closed',
  'socket-error',
  'webrtc',
]);

type MessageHandler = (msg: PeerMessage, context?: PeerMessageContext) => void;
type ConnectionWithMetadata = DataConnection & {
  metadata?: { connectionRole?: 'guest' | 'spectator'; protocolVersion?: number; clientSessionId?: string };
};

const REJECTION_MESSAGES: Record<string, string> = {
  'protocol-version-mismatch': 'アプリのバージョンが一致しません。',
  'player-slot-occupied': '対戦相手はすでに接続しています。',
  'spectating-disabled': 'このルームは観戦を許可していません。',
  'spectator-limit': '観戦人数が上限に達しています。',
  'invalid-metadata': '接続情報が不正です。',
};

function createJoinToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${crypto.randomUUID()}${crypto.randomUUID()}`;
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

function createPeerClient(id?: string): Peer {
  const host = import.meta.env.VITE_PEER_HOST;

  if (!host) {
    return id ? new Peer(id, { debug: 1 }) : new Peer({ debug: 1 });
  }

  const options = {
    host,
    port: Number(import.meta.env.VITE_PEER_PORT || 9000),
    path: import.meta.env.VITE_PEER_PATH || '/',
    key: import.meta.env.VITE_PEER_KEY || 'peerjs',
    secure: import.meta.env.VITE_PEER_SECURE === 'true',
    debug: 1,
  };

  return id ? new Peer(id, options) : new Peer(options);
}

export interface UsePeerReturn {
  peerId: string | null;
  remotePeerId: string | null;
  status: ConnectionStatus;
  role: PeerRole;
  lastRoomId: string | null;
  isHost: boolean;
  error: string | null;
  spectatorCount: number;
  maxSpectatorConnections: number;
  spectatingEnabled: boolean;
  createRoom: (onMessage: MessageHandler, preferredRoomId?: string) => Promise<string>;
  joinRoom: (roomId: string, onMessage: MessageHandler) => Promise<void>;
  spectateRoom: (roomId: string, onMessage: MessageHandler) => Promise<void>;
  reconnect: () => Promise<void>;
  sendMessage: (msg: PeerMessage) => boolean;
  broadcastMessage: (msg: PeerMessage) => number;
  sendToConnection: (connectionId: string, msg: PeerMessage) => boolean;
  setSpectatingEnabled: (enabled: boolean) => void;
  endSession: () => void;
  disconnect: () => void;
}

export function usePeer(): UsePeerReturn {
  const [peerId, setPeerId] = useState<string | null>(null);
  const [remotePeerId, setRemotePeerId] = useState<string | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [role, setRole] = useState<PeerRole>(null);
  const [lastRoomId, setLastRoomId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [spectatorCount, setSpectatorCount] = useState(0);
  const [spectatingEnabled, setSpectatingEnabledState] = useState(true);

  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<DataConnection | null>(null);
  const spectatorConnectionsRef = useRef(new Map<string, DataConnection>());
  const connectionSequenceRef = useRef(0);
  const spectatingEnabledRef = useRef(true);
  const onMessageRef = useRef<MessageHandler | null>(null);
  const roleRef = useRef<PeerRole>(null);
  const roomIdRef = useRef<string | null>(null);
  const clientSessionIdRef = useRef(createJoinToken());
  const guestClientSessionIdRef = useRef<string | null>(null);
  const manualDisconnectRef = useRef(false);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const startGuestConnectionRef = useRef<
    ((roomId: string, isReconnect: boolean, connectionRole?: 'guest' | 'spectator') => Promise<void>) | null
  >(null);
  const pendingOperationRejectRef = useRef<((reason: Error) => void) | null>(null);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const closeSpectatorConnections = useCallback((notify = false) => {
    spectatorConnectionsRef.current.forEach((connection) => {
      try {
        if (notify && connection.open) {
          connection.send({
            type: 'SESSION_ENDED',
            senderId: 'player-1',
            timestamp: Date.now(),
          } satisfies PeerMessage);
        }
        connection.close();
      } catch {
        // One failed spectator connection must not affect the game or other viewers.
      }
    });
    spectatorConnectionsRef.current.clear();
    setSpectatorCount(0);
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
    closeSpectatorConnections();
  }, [closeSpectatorConnections]);

  const scheduleGuestReconnect = useCallback(() => {
    if (
      manualDisconnectRef.current ||
      (roleRef.current !== 'guest' && roleRef.current !== 'spectator') ||
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
      const connectionRole = roleRef.current;
      if (!roomId || (connectionRole !== 'guest' && connectionRole !== 'spectator') || manualDisconnectRef.current) return;
      void startGuestConnectionRef.current?.(roomId, true, connectionRole).catch(() => undefined);
    }, RECONNECT_DELAY_MS);
  }, []);

  const bindConnection = useCallback(
    (
      connection: DataConnection,
      connectionRole: Exclude<PeerRole, null>,
      onOpen?: () => void,
      onInitialFailure?: (reason: Error) => void
    ) => {
      connectionSequenceRef.current += 1;
      const connectionId = `active-${connectionSequenceRef.current}`;
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
        if (connectionRole === 'guest' || connectionRole === 'spectator') scheduleGuestReconnect();
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
        const message = data as PeerMessage;
        if (message.type === 'CONNECTION_REJECTED') {
          manualDisconnectRef.current = true;
          setStatus('error');
          setError(REJECTION_MESSAGES[String(message.payload)] || 'ホストに接続を拒否されました。');
          return;
        }
        if (message.type === 'SESSION_ENDED') {
          manualDisconnectRef.current = true;
          setStatus('disconnected');
          setError('ホストが対戦部屋を終了しました。');
          return;
        }
        onMessageRef.current?.(message, {
          connectionId,
          role: connectionRole === 'host' ? 'guest' : 'host',
        });
      });

      connection.on('close', () => {
        clearTimeout(timeoutId);
        if (connRef.current !== connection) return;
        connRef.current = null;
        setRemotePeerId(null);
        if (connectionRole === 'host') guestClientSessionIdRef.current = null;

        if (manualDisconnectRef.current || roleRef.current === null) {
          setStatus('disconnected');
          return;
        }

        if (!opened) {
          onInitialFailure?.(new Error('接続が確立する前に切断されました。'));
        }

        if (connectionRole === 'guest' || connectionRole === 'spectator') scheduleGuestReconnect();
        else setStatus('reconnecting');
      });

      connection.on('error', (connectionError) => {
        clearTimeout(timeoutId);
        if (connRef.current !== connection) return;
        setError(`通信エラー: ${connectionError.message}`);
        if (!opened) onInitialFailure?.(connectionError);
        if (connectionRole === 'guest' || connectionRole === 'spectator') scheduleGuestReconnect();
        else setStatus('reconnecting');
      });
    },
    [scheduleGuestReconnect]
  );

  const startGuestConnection = useCallback(
    (roomId: string, isReconnect: boolean, connectionRole: 'guest' | 'spectator' = 'guest'): Promise<void> => {
      clearReconnectTimer();
      disposeTransport();
      manualDisconnectRef.current = false;
      roleRef.current = connectionRole;
      roomIdRef.current = roomId;
      setRole(connectionRole);
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
          if (connRef.current?.open) {
            setStatus('connected');
            setError(null);
            resolveOnce();
            return;
          }
          const connection = peer.connect(roomId, {
            reliable: true,
            metadata: {
              connectionRole,
              protocolVersion: 1,
              clientSessionId: clientSessionIdRef.current,
            },
          });
          bindConnection(connection, connectionRole, resolveOnce, rejectOnce);
        });

        peer.on('disconnected', () => {
          if (peerRef.current !== peer || manualDisconnectRef.current) return;
          if (connRef.current?.open) {
            if (!peer.destroyed && peer.disconnected) peer.reconnect();
            return;
          }
          scheduleGuestReconnect();
        });

        peer.on('error', (peerError) => {
          if (peerRef.current !== peer) return;
          clearTimeout(peerOpenTimeout);
          const isRetryable = RETRYABLE_GUEST_PEER_ERRORS.has(peerError.type);
          if (connRef.current?.open && isRetryable) {
            if (!peer.destroyed && peer.disconnected) peer.reconnect();
            return;
          }
          setError(`Peerエラー: ${peerError.type} - ${peerError.message}`);
          rejectOnce(peerError);
          if (isReconnect || isRetryable) {
            scheduleGuestReconnect();
          } else {
            setStatus('error');
          }
        });
      });
    },
    [bindConnection, clearReconnectTimer, disposeTransport, scheduleGuestReconnect]
  );

  useEffect(() => {
    startGuestConnectionRef.current = startGuestConnection;
  }, [startGuestConnection]);

  const bindSpectatorConnection = useCallback((connection: DataConnection) => {
    connectionSequenceRef.current += 1;
    const connectionId = `spectator-${connectionSequenceRef.current}`;
    spectatorConnectionsRef.current.set(connectionId, connection);
    setSpectatorCount(spectatorConnectionsRef.current.size);

    let opened = connection.open;
    const openTimeout = setTimeout(() => {
      if (opened || spectatorConnectionsRef.current.get(connectionId) !== connection) return;
      spectatorConnectionsRef.current.delete(connectionId);
      setSpectatorCount(spectatorConnectionsRef.current.size);
      connection.close();
    }, CONNECTION_TIMEOUT_MS);

    connection.on('open', () => {
      opened = true;
      clearTimeout(openTimeout);
    });

    connection.on('data', (data) => {
      if (spectatorConnectionsRef.current.get(connectionId) !== connection) return;
      const message = data as PeerMessage;
      if (message.type === 'SPECTATOR_LEAVE') {
        spectatorConnectionsRef.current.delete(connectionId);
        setSpectatorCount(spectatorConnectionsRef.current.size);
        connection.close();
        return;
      }
      onMessageRef.current?.(message, { connectionId, role: 'spectator' });
    });

    const remove = () => {
      clearTimeout(openTimeout);
      if (spectatorConnectionsRef.current.get(connectionId) !== connection) return;
      spectatorConnectionsRef.current.delete(connectionId);
      setSpectatorCount(spectatorConnectionsRef.current.size);
    };
    connection.on('close', remove);
    connection.on('error', remove);
  }, []);

  const rejectIncomingConnection = useCallback((connection: DataConnection, reason: string) => {
    const reject = () => {
      connection.send({
        type: 'CONNECTION_REJECTED',
        senderId: 'player-1',
        timestamp: Date.now(),
        payload: reason,
      } satisfies PeerMessage);
      connection.close();
    };
    if (connection.open) reject();
    else connection.on('open', reject);
  }, []);

  const createRoom = useCallback(
    async (onMessage: MessageHandler, preferredRoomId?: string): Promise<string> => {
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

        const requestedRoomId = preferredRoomId?.trim().toUpperCase() || generateRoomId();
        const peer = createPeerClient(requestedRoomId);
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
          setStatus(connRef.current?.open ? 'connected' : 'waiting');
          setError(null);
          resolveOnce(id);
        });

        peer.on('connection', (connection) => {
          if (peerRef.current !== peer) return;
          const metadata = (connection as ConnectionWithMetadata).metadata;
          if (!metadata?.connectionRole || typeof metadata.clientSessionId !== 'string') {
            rejectIncomingConnection(connection, 'invalid-metadata');
            return;
          }
          if (metadata.protocolVersion !== 1) {
            rejectIncomingConnection(connection, 'protocol-version-mismatch');
            return;
          }
          const connectionRole = metadata.connectionRole;
          if (connectionRole === 'spectator') {
            if (!spectatingEnabledRef.current) {
              rejectIncomingConnection(connection, 'spectating-disabled');
              return;
            }
            if (spectatorConnectionsRef.current.size >= MAX_SPECTATOR_CONNECTIONS) {
              rejectIncomingConnection(connection, 'spectator-limit');
              return;
            }
            bindSpectatorConnection(connection);
            return;
          }
          if (connRef.current?.open) {
            if (guestClientSessionIdRef.current !== metadata.clientSessionId) {
              rejectIncomingConnection(connection, 'player-slot-occupied');
              return;
            }
          }
          guestClientSessionIdRef.current = metadata.clientSessionId;
          bindConnection(connection, 'host');
        });

        peer.on('disconnected', () => {
          if (peerRef.current !== peer || manualDisconnectRef.current || roleRef.current !== 'host') return;
          setStatus('reconnecting');
          setError('シグナリングサーバーから切断されました。再接続しています。');
          if (!peer.destroyed) peer.reconnect();
        });

        peer.on('error', (peerError) => {
          if (peerRef.current !== peer || roleRef.current !== 'host') return;
          setError(`Peerエラー: ${peerError.type} - ${peerError.message}`);
          setStatus('error');
          rejectOnce(peerError);
        });
      });
    },
    [bindConnection, bindSpectatorConnection, clearReconnectTimer, disposeTransport, rejectIncomingConnection]
  );

  const joinRoom = useCallback(
    async (roomId: string, onMessage: MessageHandler): Promise<void> => {
      reconnectAttemptsRef.current = 0;
      onMessageRef.current = onMessage;
      return startGuestConnection(roomId, false, 'guest');
    },
    [startGuestConnection]
  );

  const spectateRoom = useCallback(
    async (roomId: string, onMessage: MessageHandler): Promise<void> => {
      reconnectAttemptsRef.current = 0;
      onMessageRef.current = onMessage;
      return startGuestConnection(roomId, false, 'spectator');
    },
    [startGuestConnection]
  );

  const reconnect = useCallback(async (): Promise<void> => {
    if ((roleRef.current !== 'guest' && roleRef.current !== 'spectator') || !roomIdRef.current) return;
    reconnectAttemptsRef.current = 0;
    setError(null);
    return startGuestConnection(roomIdRef.current, true, roleRef.current);
  }, [startGuestConnection]);

  const sendMessage = useCallback((msg: PeerMessage): boolean => {
    if (connRef.current?.open) {
      connRef.current.send(msg);
      return true;
    }
    return false;
  }, []);

  const sendToConnection = useCallback((connectionId: string, msg: PeerMessage): boolean => {
    const connection = connectionId.startsWith('spectator-')
      ? spectatorConnectionsRef.current.get(connectionId)
      : connRef.current;
    if (!connection?.open) return false;
    connection.send(msg);
    return true;
  }, []);

  const broadcastMessage = useCallback((msg: PeerMessage): number => {
    let sent = 0;
    if (connRef.current?.open) {
      connRef.current.send(msg);
      sent += 1;
    }
    spectatorConnectionsRef.current.forEach((connection) => {
      if (!connection.open) return;
      try {
        connection.send(msg);
        sent += 1;
      } catch {
        // Keep broadcasting to the remaining spectators.
      }
    });
    return sent;
  }, []);

  const setSpectatingEnabled = useCallback((enabled: boolean) => {
    spectatingEnabledRef.current = enabled;
    setSpectatingEnabledState(enabled);
    if (!enabled) closeSpectatorConnections(true);
  }, [closeSpectatorConnections]);

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

  const endSession = useCallback(() => {
    if (roleRef.current === 'host') {
      broadcastMessage({
        type: 'SESSION_ENDED',
        senderId: 'player-1',
        timestamp: Date.now(),
      });
    } else if (roleRef.current === 'spectator' && connRef.current?.open) {
      connRef.current.send({
        type: 'SPECTATOR_LEAVE',
        senderId: peerId || 'spectator',
        timestamp: Date.now(),
      } satisfies PeerMessage);
    }
    disconnect();
  }, [broadcastMessage, disconnect, peerId]);

  useEffect(() => {
    const handlePageHide = () => {
      if (roleRef.current !== 'spectator' || !connRef.current?.open) return;
      connRef.current.send({
        type: 'SPECTATOR_LEAVE',
        senderId: peerId || 'spectator',
        timestamp: Date.now(),
      } satisfies PeerMessage);
    };
    window.addEventListener('pagehide', handlePageHide);
    return () => window.removeEventListener('pagehide', handlePageHide);
  }, [peerId]);

  useEffect(() => disconnect, [disconnect]);

  return {
    peerId,
    remotePeerId,
    status,
    role,
    lastRoomId,
    isHost: role === 'host',
    error,
    spectatorCount,
    maxSpectatorConnections: MAX_SPECTATOR_CONNECTIONS,
    spectatingEnabled,
    createRoom,
    joinRoom,
    spectateRoom,
    reconnect,
    sendMessage,
    broadcastMessage,
    sendToConnection,
    setSpectatingEnabled,
    endSession,
    disconnect,
  };
}
