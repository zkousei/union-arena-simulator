// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { createInitialGameState } from './domain/initialState';
import { ConnectionStatus } from './types/peer';

const mockUseGame = vi.fn();
vi.mock('./hooks/useGame', () => ({
  useGame: () => mockUseGame(),
}));

beforeEach(() => {
  const store = new Map<string, string>();
  Object.defineProperty(window, 'localStorage', {
    writable: true,
    value: {
      getItem: vi.fn((key: string) => store.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => store.set(key, value)),
      removeItem: vi.fn((key: string) => store.delete(key)),
      clear: vi.fn(() => store.clear()),
    },
  });

  const sessionStorageStore = new Map<string, string>();
  Object.defineProperty(window, 'sessionStorage', {
    writable: true,
    value: {
      getItem: vi.fn((key: string) => sessionStorageStore.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => sessionStorageStore.set(key, value)),
      removeItem: vi.fn((key: string) => sessionStorageStore.delete(key)),
      clear: vi.fn(() => sessionStorageStore.clear()),
    },
  });

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

vi.mock('./utils/audio', () => ({
  sound: {
    toggleSound: vi.fn(() => true),
    playDraw: vi.fn(),
    playPlace: vi.fn(),
    playRest: vi.fn(),
    playTrigger: vi.fn(),
    playDice: vi.fn(),
    playAttack: vi.fn(),
    playChat: vi.fn(),
  },
}));

describe('App room creation from navigation', () => {
  let disconnectMock: ReturnType<typeof vi.fn>;
  let createRoomMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    disconnectMock = vi.fn();
    createRoomMock = vi.fn().mockResolvedValue('mock-room-456');

    mockUseGame.mockReturnValue({
      gameState: createInitialGameState('player-1', 'Player 1', 'player-2', 'Player 2', 'player-1'),
      myPlayerId: 'player-1',
      setMyPlayerId: vi.fn(),
      dispatchAction: vi.fn(),
      undo: vi.fn(),
      canUndo: false,
      isSynchronizing: false,
      isInteractionLocked: false,
      syncError: null,
      retrySynchronization: vi.fn(),
      peer: {
        peerId: null,
        remotePeerId: null,
        status: 'disconnected',
        role: null,
        lastRoomId: null,
        isHost: false,
        error: null,
        createRoom: createRoomMock,
        joinRoom: vi.fn(),
        reconnect: vi.fn(),
        sendMessage: vi.fn(),
        disconnect: disconnectMock,
      },
      createRoom: createRoomMock,
      joinRoom: vi.fn(),
    });
  });

  it('creates a room and does not disconnect peer when starting host game from solo route', async () => {
    let updatePeerState: (() => void) | null = null;
    const currentPeer = {
      peerId: null as string | null,
      remotePeerId: null as string | null,
      status: 'disconnected' as ConnectionStatus,
      role: null as 'host' | 'guest' | null,
      lastRoomId: null as string | null,
      isHost: false,
      error: null as string | null,
      createRoom: createRoomMock as unknown as () => Promise<string>,
      joinRoom: vi.fn(),
      reconnect: vi.fn(),
      sendMessage: vi.fn(),
      disconnect: disconnectMock,
    };

    createRoomMock.mockImplementation(async () => {
      // In real usePeer, createRoom immediately sets role to 'host' and status to 'connecting'
      currentPeer.role = 'host';
      currentPeer.status = 'connecting';
      currentPeer.isHost = true;
      updatePeerState?.();
      return 'mock-room-456';
    });
    currentPeer.createRoom = createRoomMock as unknown as () => Promise<string>;

    mockUseGame.mockImplementation(() => ({
      gameState: createInitialGameState('player-1', 'Player 1', 'player-2', 'Player 2', 'player-1'),
      myPlayerId: 'player-1',
      setMyPlayerId: vi.fn(),
      dispatchAction: vi.fn(),
      undo: vi.fn(),
      canUndo: false,
      isSynchronizing: false,
      isInteractionLocked: false,
      syncError: null,
      retrySynchronization: vi.fn(),
      peer: { ...currentPeer },
      createRoom: createRoomMock,
      joinRoom: vi.fn(),
    }));

    const { rerender } = render(
      <MemoryRouter initialEntries={['/game?mode=solo']}>
        <App />
      </MemoryRouter>
    );
    updatePeerState = () => rerender(
      <MemoryRouter initialEntries={['/game?mode=solo']}>
        <App />
      </MemoryRouter>
    );

    const playMenuBtn = screen.getByRole('button', { name: '対戦メニュー' });
    fireEvent.click(playMenuBtn);

    const hostBtn = screen.getByRole('button', { name: /部屋を作成/ });
    fireEvent.click(hostBtn);

    await waitFor(() => {
      expect(createRoomMock).toHaveBeenCalled();
    });

    expect(disconnectMock).not.toHaveBeenCalled();
  });

  it('reuses existing room if already host with a room ID', async () => {
    mockUseGame.mockImplementation(() => ({
      gameState: createInitialGameState('player-1', 'Player 1', 'player-2', 'Player 2', 'player-1'),
      myPlayerId: 'player-1',
      setMyPlayerId: vi.fn(),
      dispatchAction: vi.fn(),
      undo: vi.fn(),
      canUndo: false,
      isSynchronizing: false,
      isInteractionLocked: false,
      syncError: null,
      retrySynchronization: vi.fn(),
      peer: {
        peerId: 'existing-room-123',
        remotePeerId: null,
        status: 'waiting',
        role: 'host',
        lastRoomId: 'existing-room-123',
        isHost: true,
        error: null,
        createRoom: createRoomMock,
        joinRoom: vi.fn(),
        reconnect: vi.fn(),
        sendMessage: vi.fn(),
        disconnect: disconnectMock,
      },
      createRoom: createRoomMock,
      joinRoom: vi.fn(),
    }));

    render(
      <MemoryRouter initialEntries={['/game?host=true&room=existing-room-123']}>
        <App />
      </MemoryRouter>
    );

    const playMenuBtn = screen.getByRole('button', { name: '対戦メニュー' });
    fireEvent.click(playMenuBtn);

    const hostBtn = screen.getByRole('button', { name: /部屋を作成/ });
    fireEvent.click(hostBtn);

    // Should NOT call createRoom again since room already exists
    expect(createRoomMock).not.toHaveBeenCalled();
    expect(disconnectMock).not.toHaveBeenCalled();
  });

  it('shows creating room indicator in header when isHost is true but roomId is pending', () => {
    mockUseGame.mockImplementation(() => ({
      gameState: createInitialGameState('player-1', 'Player 1', 'player-2', 'Player 2', 'player-1'),
      myPlayerId: 'player-1',
      setMyPlayerId: vi.fn(),
      dispatchAction: vi.fn(),
      undo: vi.fn(),
      canUndo: false,
      isSynchronizing: false,
      isInteractionLocked: false,
      syncError: null,
      retrySynchronization: vi.fn(),
      peer: {
        peerId: null,
        remotePeerId: null,
        status: 'connecting',
        role: 'host',
        lastRoomId: null,
        isHost: true,
        error: null,
        createRoom: createRoomMock,
        joinRoom: vi.fn(),
        reconnect: vi.fn(),
        sendMessage: vi.fn(),
        disconnect: disconnectMock,
      },
      createRoom: createRoomMock,
      joinRoom: vi.fn(),
    }));

    render(
      <MemoryRouter initialEntries={['/game?host=true']}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByText('部屋を作成中...')).toBeTruthy();
  });

  it('prompts host with session restore modal on reload if saved session exists', async () => {
    const restoreHostSessionMock = vi.fn();
    const savedState = createInitialGameState('player-1', 'Player 1', 'player-2', 'Player 2', 'player-1');
    savedState.turn = 3;
    savedState.phase = 'MAIN';

    window.sessionStorage.setItem(
      'ua:host-session:reload-room-99',
      JSON.stringify({
        roomId: 'reload-room-99',
        savedAt: Date.now(),
        snapshot: {
          state: savedState,
          revision: 5,
        },
      })
    );

    mockUseGame.mockImplementation(() => ({
      gameState: createInitialGameState('player-1', 'Player 1', 'player-2', 'Player 2', 'player-1'),
      myPlayerId: 'player-1',
      setMyPlayerId: vi.fn(),
      dispatchAction: vi.fn(),
      undo: vi.fn(),
      canUndo: false,
      isSynchronizing: false,
      isInteractionLocked: false,
      syncError: null,
      retrySynchronization: vi.fn(),
      peer: {
        peerId: null,
        remotePeerId: null,
        status: 'disconnected',
        role: 'host',
        lastRoomId: null,
        isHost: true,
        error: null,
        createRoom: createRoomMock,
        joinRoom: vi.fn(),
        reconnect: vi.fn(),
        sendMessage: vi.fn(),
        disconnect: disconnectMock,
      },
      createRoom: createRoomMock,
      joinRoom: vi.fn(),
      restoreHostSession: restoreHostSessionMock,
    }));

    render(
      <MemoryRouter initialEntries={['/game?host=true&room=reload-room-99']}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByText('対戦セッションの復元')).toBeTruthy();
    expect(screen.getByText(/第 3 ターン/)).toBeTruthy();

    const resumeBtn = screen.getByRole('button', { name: '復元して再開' });
    fireEvent.click(resumeBtn);

    expect(restoreHostSessionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        revision: 5,
        state: expect.objectContaining({ turn: 3, phase: 'MAIN' }),
      })
    );
  });

  it('discards the saved session when host clicks discard', async () => {
    const restoreHostSessionMock = vi.fn();
    const savedState = createInitialGameState('player-1', 'Player 1', 'player-2', 'Player 2', 'player-1');
    savedState.turn = 2;

    window.sessionStorage.setItem(
      'ua:host-session:discard-room',
      JSON.stringify({
        roomId: 'discard-room',
        savedAt: Date.now(),
        snapshot: {
          state: savedState,
          revision: 2,
        },
      })
    );

    mockUseGame.mockImplementation(() => ({
      gameState: createInitialGameState('player-1', 'Player 1', 'player-2', 'Player 2', 'player-1'),
      myPlayerId: 'player-1',
      setMyPlayerId: vi.fn(),
      dispatchAction: vi.fn(),
      undo: vi.fn(),
      canUndo: false,
      isSynchronizing: false,
      isInteractionLocked: false,
      syncError: null,
      retrySynchronization: vi.fn(),
      peer: {
        peerId: null,
        remotePeerId: null,
        status: 'disconnected',
        role: 'host',
        lastRoomId: null,
        isHost: true,
        error: null,
        createRoom: createRoomMock,
        joinRoom: vi.fn(),
        reconnect: vi.fn(),
        sendMessage: vi.fn(),
        disconnect: disconnectMock,
      },
      createRoom: createRoomMock,
      joinRoom: vi.fn(),
      restoreHostSession: restoreHostSessionMock,
    }));

    render(
      <MemoryRouter initialEntries={['/game?host=true&room=discard-room']}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByText('対戦セッションの復元')).toBeTruthy();

    const discardBtn = screen.getByRole('button', { name: '破棄して最初から' });
    fireEvent.click(discardBtn);

    expect(restoreHostSessionMock).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem('ua:host-session:discard-room')).toBeNull();
    expect(screen.queryByText('対戦セッションの復元')).toBeNull();
  });
});
