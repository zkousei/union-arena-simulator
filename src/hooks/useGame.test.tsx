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
});
