// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialGameState } from '../domain/initialState';
import { ConnectionStatus, PeerMessage } from '../types/peer';
import { useGame } from './useGame';

const peerMock = vi.hoisted(() => ({
  peerId: null as string | null,
  remotePeerId: null as string | null,
  status: 'disconnected' as ConnectionStatus,
  role: null as null | 'host' | 'guest',
  lastRoomId: null as string | null,
  isHost: false,
  error: null as string | null,
  createRoom: vi.fn(),
  joinRoom: vi.fn(),
  reconnect: vi.fn(),
  sendMessage: vi.fn(() => true),
  disconnect: vi.fn(),
}));

vi.mock('./usePeer', () => ({
  usePeer: () => peerMock,
}));

vi.mock('../utils/audio', () => ({
  sound: {
    playDraw: vi.fn(),
    playPlace: vi.fn(),
    playRest: vi.fn(),
    playTrigger: vi.fn(),
    playDice: vi.fn(),
    playAttack: vi.fn(),
    playChat: vi.fn(),
  },
}));

describe('useGame P2P resynchronization', () => {
  beforeEach(() => {
    peerMock.status = 'disconnected';
    peerMock.role = null;
    peerMock.lastRoomId = null;
    peerMock.isHost = false;
    peerMock.error = null;
    peerMock.createRoom.mockReset();
    peerMock.joinRoom.mockReset();
    peerMock.reconnect.mockReset();
    peerMock.sendMessage.mockReset().mockReturnValue(true);
    peerMock.disconnect.mockReset();
  });

  it('locks guest actions until a reconnect snapshot has been applied', async () => {
    let onMessage: ((message: PeerMessage) => void) | null = null;
    peerMock.joinRoom.mockImplementation(async (_roomId, handler) => {
      onMessage = handler;
    });

    const { result, rerender } = renderHook(() => useGame());

    await act(async () => {
      await result.current.joinRoom('host-room');
    });

    peerMock.role = 'guest';
    peerMock.status = 'connected';
    rerender();

    await waitFor(() => {
      expect(peerMock.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'SYNC_REQUEST' })
      );
    });
    expect(result.current.isSynchronizing).toBe(true);
    expect(result.current.isInteractionLocked).toBe(true);

    const stateBeforeBlockedAction = result.current.gameState;
    act(() => {
      result.current.dispatchAction({ type: 'SET_PHASE', payload: { phase: 'MAIN' } });
    });
    expect(result.current.gameState).toBe(stateBeforeBlockedAction);
    expect(peerMock.sendMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'ACTION_REQUEST' })
    );

    const synchronizedState = createInitialGameState(
      'player-1',
      'Host',
      'player-2',
      'Guest',
      'player-1'
    );
    act(() => {
      onMessage?.({
        type: 'SYNC_RESPONSE',
        senderId: 'player-1',
        timestamp: Date.now(),
        payload: { state: synchronizedState, revision: 4 },
      });
    });

    expect(result.current.isSynchronizing).toBe(false);
    expect(result.current.isInteractionLocked).toBe(false);

    peerMock.sendMessage.mockClear();
    act(() => {
      result.current.dispatchAction({ type: 'SET_PHASE', payload: { phase: 'MAIN' } });
    });
    expect(peerMock.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'ACTION_REQUEST' })
    );

    peerMock.status = 'reconnecting';
    rerender();
    peerMock.sendMessage.mockClear();
    act(() => {
      result.current.dispatchAction({ type: 'SET_PHASE', payload: { phase: 'END' } });
    });

    expect(result.current.isInteractionLocked).toBe(true);
    expect(peerMock.sendMessage).not.toHaveBeenCalled();

    peerMock.status = 'connected';
    rerender();
    await waitFor(() => {
      expect(peerMock.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'SYNC_REQUEST' })
      );
    });

    act(() => {
      onMessage?.({
        type: 'SYNC_RESPONSE',
        senderId: 'player-1',
        timestamp: Date.now(),
        payload: { state: synchronizedState, revision: 4 },
      });
    });
    expect(result.current.isSynchronizing).toBe(false);
    expect(result.current.isInteractionLocked).toBe(false);
  });

  it('replaces a stale guest board with the latest host snapshot after reconnecting', async () => {
    let onMessage: ((message: PeerMessage) => void) | null = null;
    peerMock.joinRoom.mockImplementation(async (_roomId, handler) => {
      onMessage = handler;
    });

    const { result, rerender } = renderHook(() => useGame());
    await act(async () => {
      await result.current.joinRoom('host-room');
    });

    peerMock.role = 'guest';
    peerMock.status = 'connected';
    rerender();

    const initialHostState = createInitialGameState(
      'player-1',
      'Host',
      'player-2',
      'Guest',
      'player-1'
    );
    initialHostState.phase = 'MAIN';
    act(() => {
      onMessage?.({
        type: 'SYNC_RESPONSE',
        senderId: 'player-1',
        timestamp: Date.now(),
        payload: { state: initialHostState, revision: 1 },
      });
    });
    expect(result.current.gameState.phase).toBe('MAIN');

    peerMock.status = 'reconnecting';
    rerender();
    expect(result.current.isInteractionLocked).toBe(true);

    const latestHostState = createInitialGameState(
      'player-1',
      'Host',
      'player-2',
      'Guest',
      'player-1'
    );
    latestHostState.phase = 'END';
    latestHostState.turn = 4;

    peerMock.status = 'connected';
    rerender();
    await waitFor(() => {
      expect(peerMock.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'SYNC_REQUEST' })
      );
    });
    act(() => {
      onMessage?.({
        type: 'SYNC_RESPONSE',
        senderId: 'player-1',
        timestamp: Date.now(),
        payload: { state: latestHostState, revision: 3 },
      });
    });

    expect(result.current.gameState.phase).toBe('END');
    expect(result.current.gameState.turn).toBe(4);
    expect(result.current.isSynchronizing).toBe(false);
    expect(result.current.isInteractionLocked).toBe(false);

    const olderHostState = { ...latestHostState, phase: 'ATTACK' as const, turn: 3 };
    act(() => {
      onMessage?.({
        type: 'STATE_COMMIT',
        senderId: 'player-1',
        timestamp: Date.now(),
        payload: { state: olderHostState, revision: 2 },
      });
    });

    expect(result.current.gameState.phase).toBe('END');
    expect(result.current.gameState.turn).toBe(4);
  });

  it('responds to a reconnect request with the latest host state and revision', async () => {
    let onMessage: ((message: PeerMessage) => void) | null = null;
    peerMock.createRoom.mockImplementation(async (handler) => {
      onMessage = handler;
      return 'host-room';
    });

    const { result, rerender } = renderHook(() => useGame());
    await act(async () => {
      await result.current.createRoom();
    });

    peerMock.role = 'host';
    peerMock.status = 'waiting';
    rerender();
    act(() => {
      result.current.dispatchAction({ type: 'SET_PHASE', payload: { phase: 'MAIN' } });
    });
    expect(result.current.gameState.phase).toBe('MAIN');

    peerMock.status = 'connected';
    rerender();
    peerMock.sendMessage.mockClear();
    act(() => {
      onMessage?.({
        type: 'SYNC_REQUEST',
        senderId: 'player-2',
        timestamp: Date.now(),
      });
    });

    expect(peerMock.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'SYNC_RESPONSE',
        payload: expect.objectContaining({
          revision: 1,
          state: expect.objectContaining({ phase: 'MAIN' }),
        }),
      })
    );
  });

  it('applies duplicate guest action requests only once', async () => {
    let onMessage: ((message: PeerMessage) => void) | null = null;
    peerMock.createRoom.mockImplementation(async (handler) => {
      onMessage = handler;
      return 'host-room';
    });

    const { result, rerender } = renderHook(() => useGame());
    await act(async () => {
      await result.current.createRoom();
    });
    peerMock.role = 'host';
    peerMock.status = 'connected';
    rerender();
    peerMock.sendMessage.mockClear();

    const request: PeerMessage = {
      type: 'ACTION_REQUEST',
      senderId: 'player-2',
      requestId: 'guest-action-1',
      timestamp: Date.now(),
      payload: {
        type: 'ADD_LOG',
        payload: { message: 'one committed action', playerId: 'player-2' },
      },
    };
    act(() => {
      onMessage?.(request);
      onMessage?.(request);
    });

    expect(result.current.gameState.logs.filter((log) => log.message === 'one committed action')).toHaveLength(1);
    expect(peerMock.sendMessage).toHaveBeenCalledTimes(1);
    expect(peerMock.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'STATE_COMMIT',
        payload: expect.objectContaining({ revision: 1 }),
      })
    );
  });

  it('applies duplicate guest undo requests only once', async () => {
    let onMessage: ((message: PeerMessage) => void) | null = null;
    peerMock.createRoom.mockImplementation(async (handler) => {
      onMessage = handler;
      return 'host-room';
    });

    const { result, rerender } = renderHook(() => useGame());
    await act(async () => {
      await result.current.createRoom();
    });
    peerMock.role = 'host';
    peerMock.status = 'connected';
    rerender();
    act(() => {
      result.current.dispatchAction({ type: 'SET_PHASE', payload: { phase: 'MAIN' } });
      result.current.dispatchAction({ type: 'SET_PHASE', payload: { phase: 'END' } });
    });
    expect(result.current.gameState.phase).toBe('END');
    peerMock.sendMessage.mockClear();

    const request: PeerMessage = {
      type: 'UNDO_REQUEST',
      senderId: 'player-2',
      requestId: 'guest-undo-1',
      timestamp: Date.now(),
    };
    act(() => {
      onMessage?.(request);
      onMessage?.(request);
    });

    expect(result.current.gameState.phase).toBe('MAIN');
    expect(peerMock.sendMessage).toHaveBeenCalledTimes(1);
    expect(peerMock.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'STATE_COMMIT',
        payload: expect.objectContaining({ revision: 3 }),
      })
    );
  });

  it('ignores malformed guest action requests without changing or broadcasting state', async () => {
    let onMessage: ((message: PeerMessage) => void) | null = null;
    peerMock.createRoom.mockImplementation(async (handler) => {
      onMessage = handler;
      return 'host-room';
    });

    const { result, rerender } = renderHook(() => useGame());
    await act(async () => {
      await result.current.createRoom();
    });
    peerMock.role = 'host';
    peerMock.status = 'connected';
    rerender();
    peerMock.sendMessage.mockClear();
    const stateBefore = result.current.gameState;

    expect(() => {
      act(() => {
        onMessage?.({
          type: 'ACTION_REQUEST',
          senderId: 'player-2',
          requestId: 'malformed-action',
          timestamp: Date.now(),
          payload: { type: 'MOVE_CARD', payload: {} },
        });
      });
    }).not.toThrow();

    expect(result.current.gameState).toBe(stateBefore);
    expect(peerMock.sendMessage).not.toHaveBeenCalled();
  });

  it('keeps guest interaction locked when a malformed sync response arrives', async () => {
    let onMessage: ((message: PeerMessage) => void) | null = null;
    peerMock.joinRoom.mockImplementation(async (_roomId, handler) => {
      onMessage = handler;
    });

    const { result, rerender } = renderHook(() => useGame());
    await act(async () => {
      await result.current.joinRoom('host-room');
    });
    peerMock.role = 'guest';
    peerMock.status = 'connected';
    rerender();

    act(() => {
      onMessage?.({
        type: 'SYNC_RESPONSE',
        senderId: 'player-1',
        timestamp: Date.now(),
        payload: { state: {}, revision: 2 },
      });
    });

    expect(result.current.isSynchronizing).toBe(true);
    expect(result.current.isInteractionLocked).toBe(true);
    expect(result.current.gameState.players['player-1']).toBeDefined();
  });

  it('uses a new request ID namespace after joining a room again', async () => {
    let onMessage: ((message: PeerMessage) => void) | null = null;
    peerMock.joinRoom.mockImplementation(async (_roomId, handler) => {
      onMessage = handler;
    });
    const synchronizedState = createInitialGameState(
      'player-1',
      'Host',
      'player-2',
      'Guest',
      'player-1'
    );
    const { result, rerender } = renderHook(() => useGame());

    await act(async () => {
      await result.current.joinRoom('host-room');
    });
    peerMock.role = 'guest';
    peerMock.status = 'connected';
    rerender();
    act(() => {
      onMessage?.({
        type: 'SYNC_RESPONSE',
        senderId: 'player-1',
        timestamp: Date.now(),
        payload: { state: synchronizedState, revision: 0 },
      });
    });
    peerMock.sendMessage.mockClear();
    act(() => {
      result.current.dispatchAction({ type: 'ADD_LOG', payload: { message: 'first' } });
    });
    const firstRequest = (peerMock.sendMessage.mock.calls as unknown as Array<[PeerMessage]>)[0][0];

    await act(async () => {
      await result.current.joinRoom('host-room');
    });
    act(() => {
      onMessage?.({
        type: 'SYNC_RESPONSE',
        senderId: 'player-1',
        timestamp: Date.now(),
        payload: { state: synchronizedState, revision: 0 },
      });
    });
    peerMock.sendMessage.mockClear();
    act(() => {
      result.current.dispatchAction({ type: 'ADD_LOG', payload: { message: 'second' } });
    });
    const secondRequest = (peerMock.sendMessage.mock.calls as unknown as Array<[PeerMessage]>)[0][0];

    expect(firstRequest.requestId).toBeDefined();
    expect(secondRequest.requestId).toBeDefined();
    expect(secondRequest.requestId).not.toBe(firstRequest.requestId);
  });
});
