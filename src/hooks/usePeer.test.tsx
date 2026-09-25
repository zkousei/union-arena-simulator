// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePeer } from './usePeer';

const peerModuleMock = vi.hoisted(() => {
  type EventHandler = (...args: unknown[]) => void;

  class FakeConnection {
    peer: string;
    metadata?: { connectionRole?: 'guest' | 'spectator'; protocolVersion?: number; clientSessionId?: string };
    open = false;
    sent: unknown[] = [];
    private handlers = new Map<string, EventHandler[]>();

    constructor(peer: string, metadata?: { connectionRole?: 'guest' | 'spectator'; protocolVersion?: number; clientSessionId?: string }) {
      this.peer = peer;
      this.metadata = metadata;
    }

    on(event: string, handler: EventHandler) {
      this.handlers.set(event, [...(this.handlers.get(event) ?? []), handler]);
      return this;
    }

    send(message: unknown) {
      this.sent.push(message);
    }

    close() {
      this.open = false;
      this.emit('close');
    }

    emit(event: string, ...args: unknown[]) {
      this.handlers.get(event)?.forEach((handler) => handler(...args));
    }
  }

  class FakePeer {
    static instances: FakePeer[] = [];

    destroyed = false;
    disconnected = false;
    reconnectCalls = 0;
    connections: FakeConnection[] = [];
    id?: string;
    private handlers = new Map<string, EventHandler[]>();

    constructor(...args: unknown[]) {
      if (typeof args[0] === 'string') {
        this.id = args[0];
      }
      FakePeer.instances.push(this);
    }

    on(event: string, handler: EventHandler) {
      this.handlers.set(event, [...(this.handlers.get(event) ?? []), handler]);
      return this;
    }

    connect(roomId: string, options?: { metadata?: { connectionRole?: 'guest' | 'spectator'; protocolVersion?: number; clientSessionId?: string } }) {
      const connection = new FakeConnection(roomId, options?.metadata);
      this.connections.push(connection);
      return connection;
    }

    destroy() {
      this.destroyed = true;
    }

    reconnect() {
      this.reconnectCalls += 1;
      this.disconnected = false;
    }

    emit(event: string, ...args: unknown[]) {
      this.handlers.get(event)?.forEach((handler) => handler(...args));
    }
  }

  return { FakeConnection, FakePeer };
});

vi.mock('peerjs', () => ({ default: peerModuleMock.FakePeer }));

const { FakeConnection, FakePeer } = peerModuleMock;

describe('usePeer connection lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakePeer.instances = [];
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('keeps a host session waiting so a disconnected guest can return', async () => {
    const { result } = renderHook(() => usePeer());

    let roomPromise!: Promise<string>;
    act(() => {
      roomPromise = result.current.createRoom(vi.fn());
    });

    const peer = FakePeer.instances[0];
    expect(peer.id).toMatch(/^[A-Z2-9]{6}$/);
    act(() => peer.emit('open', peer.id));

    await expect(roomPromise).resolves.toBe(peer.id);
    expect(result.current.role).toBe('host');
    expect(result.current.status).toBe('waiting');

    const connection = new FakeConnection('guest-peer', {
      connectionRole: 'guest',
      protocolVersion: 1,
      clientSessionId: 'guest-session',
    });
    act(() => peer.emit('connection', connection));
    expect(result.current.status).toBe('connecting');

    act(() => {
      connection.open = true;
      connection.emit('open');
    });
    expect(result.current.status).toBe('connected');

    act(() => connection.close());
    expect(result.current.status).toBe('reconnecting');
    expect(result.current.role).toBe('host');
    expect(result.current.peerId).toBe(peer.id);
  });

  it('automatically reconnects a guest to its previous room', async () => {
    const onMessage = vi.fn();
    const { result } = renderHook(() => usePeer());

    let joinPromise!: Promise<void>;
    act(() => {
      joinPromise = result.current.joinRoom('host-room', onMessage);
    });

    const firstPeer = FakePeer.instances[0];
    act(() => firstPeer.emit('open', 'guest-one'));
    const firstConnection = firstPeer.connections[0];
    act(() => {
      firstConnection.open = true;
      firstConnection.emit('open');
    });
    await joinPromise;

    expect(result.current.status).toBe('connected');
    expect(result.current.role).toBe('guest');
    expect(result.current.lastRoomId).toBe('host-room');

    act(() => firstConnection.close());
    expect(result.current.status).toBe('reconnecting');

    act(() => vi.advanceTimersByTime(1_000));
    expect(FakePeer.instances).toHaveLength(2);

    const secondPeer = FakePeer.instances[1];
    act(() => secondPeer.emit('open', 'guest-two'));
    const secondConnection = secondPeer.connections[0];
    expect(secondConnection.peer).toBe('host-room');

    act(() => {
      secondConnection.open = true;
      secondConnection.emit('open');
    });
    expect(result.current.status).toBe('connected');

    const snapshot = { type: 'SYNC_RESPONSE', timestamp: 1 };
    act(() => secondConnection.emit('data', snapshot));
    expect(onMessage).toHaveBeenCalledWith(snapshot, expect.objectContaining({ role: 'host' }));
  });

  it('reconnects when an open guest connection stops answering health probes', async () => {
    const { result } = renderHook(() => usePeer());
    let joinPromise!: Promise<void>;
    act(() => { joinPromise = result.current.joinRoom('host-room', vi.fn()); });
    const peer = FakePeer.instances[0];
    act(() => peer.emit('open', 'guest-one'));
    const connection = peer.connections[0];
    act(() => {
      connection.open = true;
      connection.emit('open');
    });
    await joinPromise;

    act(() => vi.advanceTimersByTime(8_000));
    expect(result.current.status).toBe('reconnecting');
    act(() => vi.advanceTimersByTime(1_000));
    expect(FakePeer.instances).toHaveLength(2);
  });

  it('keeps a guest connected when the host answers health probes', async () => {
    const { result } = renderHook(() => usePeer());
    let joinPromise!: Promise<void>;
    act(() => { joinPromise = result.current.joinRoom('host-room', vi.fn()); });
    const peer = FakePeer.instances[0];
    act(() => peer.emit('open', 'guest-one'));
    const connection = peer.connections[0];
    act(() => {
      connection.open = true;
      connection.emit('open');
    });
    await joinPromise;

    act(() => vi.advanceTimersByTime(5_000));
    expect(connection.sent).toContainEqual(expect.objectContaining({ type: 'PING' }));
    act(() => connection.emit('data', { type: 'PONG', senderId: 'player-1', timestamp: Date.now() }));
    act(() => vi.advanceTimersByTime(3_000));
    expect(result.current.status).toBe('connected');
    expect(FakePeer.instances).toHaveLength(1);
  });

  it('cancels automatic reconnection after an explicit disconnect', async () => {
    const { result } = renderHook(() => usePeer());

    let joinPromise!: Promise<void>;
    act(() => {
      joinPromise = result.current.joinRoom('host-room', vi.fn());
    });
    const peer = FakePeer.instances[0];
    act(() => peer.emit('open', 'guest'));
    const connection = peer.connections[0];
    act(() => {
      connection.open = true;
      connection.emit('open');
    });
    await joinPromise;

    act(() => connection.close());
    expect(result.current.status).toBe('reconnecting');

    act(() => result.current.disconnect());
    act(() => vi.advanceTimersByTime(5_000));

    expect(FakePeer.instances).toHaveLength(1);
    expect(result.current.status).toBe('disconnected');
    expect(result.current.role).toBeNull();
  });

  it('reports a connection timeout instead of waiting forever', async () => {
    const { result } = renderHook(() => usePeer());

    let joinPromise!: Promise<void>;
    act(() => {
      joinPromise = result.current.joinRoom('missing-room', vi.fn());
    });
    const rejection = expect(joinPromise).rejects.toThrow(
      'Peerサーバーへの接続がタイムアウトしました。'
    );

    act(() => vi.advanceTimersByTime(10_000));

    await rejection;
    expect(result.current.status).toBe('reconnecting');
    expect(result.current.error).toBe('Peerサーバーへの接続がタイムアウトしました。');

    act(() => vi.advanceTimersByTime(1_000));
    expect(FakePeer.instances).toHaveLength(2);
  });

  it('automatically retries an initial guest network failure and clears the error after connecting', async () => {
    const { result } = renderHook(() => usePeer());

    let joinPromise!: Promise<void>;
    act(() => {
      joinPromise = result.current.joinRoom('host-room', vi.fn());
    });

    const firstPeer = FakePeer.instances[0];
    const connectionError = Object.assign(new Error('signaling failed'), {
      type: 'network',
    });
    act(() => firstPeer.emit('error', connectionError));
    await expect(joinPromise).rejects.toThrow('signaling failed');
    expect(result.current.status).toBe('reconnecting');
    expect(result.current.error).toContain('signaling failed');

    act(() => vi.advanceTimersByTime(1_000));
    expect(FakePeer.instances).toHaveLength(2);

    const secondPeer = FakePeer.instances[1];
    act(() => secondPeer.emit('open', 'guest-retry'));
    const secondConnection = secondPeer.connections[0];
    act(() => {
      secondConnection.open = true;
      secondConnection.emit('open');
    });
    expect(result.current.status).toBe('connected');
    expect(result.current.error).toBeNull();
  });

  it('keeps an open data connection when only signaling disconnects', async () => {
    const { result } = renderHook(() => usePeer());
    let joinPromise!: Promise<void>;
    act(() => { joinPromise = result.current.joinRoom('ABC123', vi.fn()); });

    const peer = FakePeer.instances[0];
    act(() => peer.emit('open', 'guest-peer'));
    const connection = peer.connections[0];
    act(() => {
      connection.open = true;
      connection.emit('open');
    });
    await joinPromise;

    act(() => {
      peer.disconnected = true;
      peer.emit('disconnected');
      peer.emit('open', 'guest-peer');
    });
    act(() => vi.advanceTimersByTime(5_000));

    expect(peer.reconnectCalls).toBe(1);
    expect(connection.open).toBe(true);
    expect(peer.connections).toHaveLength(1);
    expect(FakePeer.instances).toHaveLength(1);
    expect(result.current.status).toBe('connected');
  });

  it('automatically retries when the host is not yet available on the first guest attempt', async () => {
    const { result } = renderHook(() => usePeer());

    let joinPromise!: Promise<void>;
    act(() => {
      joinPromise = result.current.joinRoom('host-room', vi.fn());
    });

    const firstPeer = FakePeer.instances[0];
    const unavailableError = Object.assign(new Error('Could not connect to peer host-room'), {
      type: 'peer-unavailable',
    });
    act(() => firstPeer.emit('error', unavailableError));

    await expect(joinPromise).rejects.toThrow('Could not connect to peer host-room');
    expect(result.current.status).toBe('reconnecting');

    act(() => vi.advanceTimersByTime(1_000));
    expect(FakePeer.instances).toHaveLength(2);

    const secondPeer = FakePeer.instances[1];
    act(() => secondPeer.emit('open', 'guest-retry'));
    const secondConnection = secondPeer.connections[0];
    expect(secondConnection.metadata?.connectionRole).toBe('guest');

    act(() => {
      secondConnection.open = true;
      secondConnection.emit('open');
    });

    expect(result.current.status).toBe('connected');
    expect(result.current.error).toBeNull();
  });

  it('rejects room creation if disconnected before the room opens', async () => {
    const { result } = renderHook(() => usePeer());

    let roomPromise!: Promise<string>;
    act(() => {
      roomPromise = result.current.createRoom(vi.fn());
    });

    act(() => {
      result.current.disconnect();
    });

    await expect(roomPromise).rejects.toThrow();
  });

  it('allows a host to create a room with a preferred room id upon session resumption', async () => {
    const { result } = renderHook(() => usePeer());

    let roomPromise!: Promise<string>;
    act(() => {
      roomPromise = result.current.createRoom(vi.fn(), 'ABC123');
    });

    const peer = FakePeer.instances[0];
    expect(peer.id).toBe('ABC123');

    act(() => peer.emit('open', 'ABC123'));

    await expect(roomPromise).resolves.toBe('ABC123');
    expect(result.current.peerId).toBe('ABC123');
    expect(result.current.lastRoomId).toBe('ABC123');
  });

  it('recreates a disconnected host peer with the same room id when signaling does not recover', async () => {
    const { result } = renderHook(() => usePeer());
    let roomPromise!: Promise<string>;
    act(() => { roomPromise = result.current.createRoom(vi.fn(), 'ABC123'); });
    const firstPeer = FakePeer.instances[0];
    act(() => firstPeer.emit('open', 'ABC123'));
    await roomPromise;

    act(() => {
      firstPeer.disconnected = true;
      firstPeer.emit('disconnected');
      vi.advanceTimersByTime(3_000);
    });

    expect(FakePeer.instances).toHaveLength(2);
    expect(FakePeer.instances[1].id).toBe('ABC123');
    expect(result.current.status).toBe('reconnecting');
  });

  it('does not postpone host recovery when disconnected repeats', async () => {
    const { result } = renderHook(() => usePeer());
    let roomPromise!: Promise<string>;
    act(() => { roomPromise = result.current.createRoom(vi.fn(), 'ABC123'); });
    const firstPeer = FakePeer.instances[0];
    act(() => firstPeer.emit('open', 'ABC123'));
    await roomPromise;

    act(() => {
      firstPeer.disconnected = true;
      firstPeer.emit('disconnected');
      vi.advanceTimersByTime(2_000);
      firstPeer.disconnected = true;
      firstPeer.emit('disconnected');
      vi.advanceTimersByTime(1_000);
    });

    expect(FakePeer.instances).toHaveLength(2);
    expect(FakePeer.instances[1].id).toBe('ABC123');
    expect(result.current.status).toBe('reconnecting');
  });

  it('retries the same host room id when it is temporarily unavailable after reload', async () => {
    const { result } = renderHook(() => usePeer());
    let roomPromise!: Promise<string>;
    act(() => { roomPromise = result.current.createRoom(vi.fn(), 'ABC123'); });
    const firstPeer = FakePeer.instances[0];
    const unavailableError = Object.assign(new Error('ID ABC123 is taken'), { type: 'unavailable-id' });
    act(() => firstPeer.emit('error', unavailableError));

    await expect(roomPromise).rejects.toThrow('ID ABC123 is taken');
    expect(result.current.status).toBe('reconnecting');
    act(() => vi.advanceTimersByTime(1_000));

    expect(FakePeer.instances).toHaveLength(2);
    expect(FakePeer.instances[1].id).toBe('ABC123');
    act(() => FakePeer.instances[1].emit('open', 'ABC123'));
    expect(result.current.status).toBe('waiting');
    expect(result.current.error).toBeNull();
  });

  it('retries host room creation when the signaling server never opens it', async () => {
    const { result } = renderHook(() => usePeer());
    let roomPromise!: Promise<string>;
    act(() => { roomPromise = result.current.createRoom(vi.fn(), 'ABC123'); });
    const rejection = expect(roomPromise).rejects.toThrow('ルーム作成がタイムアウトしました。');

    act(() => vi.advanceTimersByTime(10_000));
    await rejection;
    expect(result.current.status).toBe('reconnecting');

    act(() => vi.advanceTimersByTime(3_000));
    expect(FakePeer.instances).toHaveLength(2);
    expect(FakePeer.instances[1].id).toBe('ABC123');
  });

  it('returns false instead of throwing when a data connection send fails', async () => {
    const { result } = renderHook(() => usePeer());
    let joinPromise!: Promise<void>;
    act(() => { joinPromise = result.current.joinRoom('host-room', vi.fn()); });
    const peer = FakePeer.instances[0];
    act(() => peer.emit('open', 'guest'));
    const connection = peer.connections[0];
    act(() => {
      connection.open = true;
      connection.emit('open');
    });
    await joinPromise;
    vi.spyOn(connection, 'send').mockImplementation(() => { throw new Error('closed'); });

    expect(result.current.sendMessage({ type: 'PING', senderId: 'guest', timestamp: 1 })).toBe(false);
  });

  it('keeps the guest connected while broadcasting to multiple spectators', async () => {
    const onMessage = vi.fn();
    const { result } = renderHook(() => usePeer());

    let roomPromise!: Promise<string>;
    act(() => { roomPromise = result.current.createRoom(onMessage); });
    const peer = FakePeer.instances[0];
    act(() => peer.emit('open', 'host-room'));
    await roomPromise;

    const guest = new FakeConnection('guest-peer', {
      connectionRole: 'guest',
      protocolVersion: 1,
      clientSessionId: 'guest-session',
    });
    const spectatorOne = new FakeConnection('spectator-one', { connectionRole: 'spectator', protocolVersion: 1, clientSessionId: 'spectator-one' });
    const spectatorTwo = new FakeConnection('spectator-two', { connectionRole: 'spectator', protocolVersion: 1, clientSessionId: 'spectator-two' });
    act(() => {
      peer.emit('connection', guest);
      guest.open = true;
      guest.emit('open');
      peer.emit('connection', spectatorOne);
      spectatorOne.open = true;
      spectatorOne.emit('open');
      peer.emit('connection', spectatorTwo);
      spectatorTwo.open = true;
      spectatorTwo.emit('open');
    });

    expect(result.current.status).toBe('connected');
    expect(result.current.spectatorCount).toBe(2);
    expect(guest.open).toBe(true);

    const message = { type: 'PING', senderId: 'player-1', timestamp: 1 } as const;
    act(() => { result.current.broadcastMessage(message); });
    expect(guest.sent).toContainEqual(message);
    expect(spectatorOne.sent).toContainEqual(message);
    expect(spectatorTwo.sent).toContainEqual(message);
  });

  it('connects as a spectator with role metadata and reconnects as a spectator', async () => {
    const { result } = renderHook(() => usePeer());
    let connectPromise!: Promise<void>;
    act(() => { connectPromise = result.current.spectateRoom('host-room', vi.fn()); });
    const firstPeer = FakePeer.instances[0];
    act(() => firstPeer.emit('open', 'spectator-peer'));
    const firstConnection = firstPeer.connections[0];
    expect(firstConnection.metadata?.connectionRole).toBe('spectator');
    act(() => {
      firstConnection.open = true;
      firstConnection.emit('open');
    });
    await connectPromise;
    expect(result.current.role).toBe('spectator');

    act(() => firstConnection.close());
    act(() => vi.advanceTimersByTime(1_000));
    const secondPeer = FakePeer.instances[1];
    act(() => secondPeer.emit('open', 'spectator-peer-2'));
    expect(secondPeer.connections[0].metadata?.connectionRole).toBe('spectator');
  });

  it('answers spectator health probes without forwarding them to the game handler', async () => {
    const onMessage = vi.fn();
    const { result } = renderHook(() => usePeer());
    let roomPromise!: Promise<string>;
    act(() => { roomPromise = result.current.createRoom(onMessage); });
    const peer = FakePeer.instances[0];
    act(() => peer.emit('open', 'host-room'));
    await roomPromise;

    const spectator = new FakeConnection('spectator-peer', {
      connectionRole: 'spectator', protocolVersion: 1, clientSessionId: 'spectator-session',
    });
    act(() => {
      peer.emit('connection', spectator);
      spectator.open = true;
      spectator.emit('open');
      spectator.emit('data', { type: 'PING', senderId: 'spectator', timestamp: 1 });
    });

    expect(spectator.sent).toContainEqual(expect.objectContaining({ type: 'PONG' }));
    expect(onMessage).not.toHaveBeenCalled();
  });

  it('rejects spectators over the configured connection limit', async () => {
    const { result } = renderHook(() => usePeer());
    let roomPromise!: Promise<string>;
    act(() => { roomPromise = result.current.createRoom(vi.fn()); });
    const peer = FakePeer.instances[0];
    act(() => peer.emit('open', 'host-room'));
    await roomPromise;

    const spectators = Array.from({ length: 9 }, (_, index) =>
      new FakeConnection(`spectator-${index}`, { connectionRole: 'spectator', protocolVersion: 1, clientSessionId: `spectator-${index}` })
    );
    act(() => spectators.forEach((connection) => peer.emit('connection', connection)));

    expect(result.current.spectatorCount).toBe(8);
    expect(spectators[8].open).toBe(false);
  });

  it('accepts a guest using only the shared room id', async () => {
    const { result } = renderHook(() => usePeer());
    let roomPromise!: Promise<string>;
    act(() => { roomPromise = result.current.createRoom(vi.fn()); });
    const peer = FakePeer.instances[0];
    act(() => peer.emit('open', 'host-room'));
    await roomPromise;

    const guest = new FakeConnection('guest-peer', {
      connectionRole: 'guest',
      protocolVersion: 1,
      clientSessionId: 'guest-session',
    });
    act(() => {
      peer.emit('connection', guest);
      guest.open = true;
      guest.emit('open');
    });

    expect(guest.sent).not.toContainEqual(expect.objectContaining({ type: 'CONNECTION_REJECTED' }));
    expect(result.current.status).toBe('connected');
  });
});
