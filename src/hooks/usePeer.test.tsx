// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePeer } from './usePeer';

const peerModuleMock = vi.hoisted(() => {
  type EventHandler = (...args: unknown[]) => void;

  class FakeConnection {
    peer: string;
    open = false;
    sent: unknown[] = [];
    private handlers = new Map<string, EventHandler[]>();

    constructor(peer: string) {
      this.peer = peer;
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
    connections: FakeConnection[] = [];
    private handlers = new Map<string, EventHandler[]>();

    constructor() {
      FakePeer.instances.push(this);
    }

    on(event: string, handler: EventHandler) {
      this.handlers.set(event, [...(this.handlers.get(event) ?? []), handler]);
      return this;
    }

    connect(roomId: string) {
      const connection = new FakeConnection(roomId);
      this.connections.push(connection);
      return connection;
    }

    destroy() {
      this.destroyed = true;
    }

    reconnect() {
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
    act(() => peer.emit('open', 'host-room'));

    await expect(roomPromise).resolves.toBe('host-room');
    expect(result.current.role).toBe('host');
    expect(result.current.status).toBe('waiting');

    const connection = new FakeConnection('guest-peer');
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
    expect(result.current.peerId).toBe('host-room');
  });

  it('automatically reconnects a guest to its previous room', async () => {
    const { result } = renderHook(() => usePeer());

    let joinPromise!: Promise<void>;
    act(() => {
      joinPromise = result.current.joinRoom('host-room', vi.fn());
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
    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('Peerサーバーへの接続がタイムアウトしました。');
  });
});
