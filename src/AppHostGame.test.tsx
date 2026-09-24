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

const analyticsMock = vi.hoisted(() => ({
  props: [] as Array<{
    beforeSend?: (event: { url: string }) => { url: string } | null;
    debug?: boolean;
  }>,
}));

vi.mock('@vercel/analytics/react', () => ({
  Analytics: (props: {
    beforeSend?: (event: { url: string }) => { url: string } | null;
    debug?: boolean;
  }) => {
    analyticsMock.props.push(props);
    return <div data-testid="vercel-analytics" />;
  },
}));

beforeEach(() => {
  analyticsMock.props = [];
  vi.unstubAllEnvs();

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
        spectatorCount: 0,
        maxSpectatorConnections: 8,
        spectatingEnabled: true,
        createRoom: createRoomMock,
        joinRoom: vi.fn(),
        spectateRoom: vi.fn(),
        reconnect: vi.fn(),
        sendMessage: vi.fn(),
        broadcastMessage: vi.fn(),
        sendToConnection: vi.fn(),
        setSpectatingEnabled: vi.fn(),
        disconnect: disconnectMock,
      },
      createRoom: createRoomMock,
      joinRoom: vi.fn(),
      spectateRoom: vi.fn(),
    });
  });

  it('does not render Vercel Analytics unless explicitly enabled for production', () => {
    vi.stubEnv('PROD', true);

    render(
      <MemoryRouter initialEntries={['/analytics-test']}>
        <App />
      </MemoryRouter>
    );

    expect(screen.queryByTestId('vercel-analytics')).toBeNull();
    expect(analyticsMock.props).toHaveLength(0);
  });

  it('joins spectator URLs in read-only spectator mode instead of joining as a guest', async () => {
    const spectateRoom = vi.fn().mockResolvedValue(undefined);
    const joinRoom = vi.fn().mockResolvedValue(undefined);
    const current = mockUseGame();
    mockUseGame.mockReturnValue({
      ...current,
      peer: { ...current.peer, role: null, status: 'disconnected' },
      joinRoom,
      spectateRoom,
    });

    render(
      <MemoryRouter initialEntries={['/game?spectator=true&room=watch-room']}>
        <App />
      </MemoryRouter>
    );

    await waitFor(() => expect(spectateRoom).toHaveBeenCalledWith('watch-room'));
    expect(joinRoom).not.toHaveBeenCalled();
    expect(screen.getByText(/観戦中/)).toBeTruthy();
    expect(screen.getByRole('button', { name: '視点を反転' })).toBeTruthy();
  });

  it('shares one room code with guests and spectators from a connected host', () => {
    const clipboardWrite = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: clipboardWrite },
    });
    const current = mockUseGame();
    mockUseGame.mockReturnValue({
      ...current,
      peer: {
        ...current.peer,
        peerId: 'ABC123',
        lastRoomId: 'ABC123',
        role: 'host',
        isHost: true,
        status: 'connected',
        spectatorCount: 2,
      },
    });

    render(
      <MemoryRouter initialEntries={['/game?host=true&room=ABC123']}>
        <App />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'ルームコードをコピー' }));

    expect(clipboardWrite).toHaveBeenCalledOnce();
    expect(clipboardWrite).toHaveBeenCalledWith('ABC123');
    expect(screen.getByText(/ルームID.*ABC123/)).toBeTruthy();
  });

  it('ends the active host session before joining another room from the top menu', async () => {
    const joinRoom = vi.fn().mockResolvedValue(undefined);
    const endSession = vi.fn();
    const current = mockUseGame();
    const peerState = {
      ...current.peer,
      peerId: 'HOST12' as string | null,
      lastRoomId: 'HOST12' as string | null,
      role: 'host' as 'host' | 'guest' | null,
      isHost: true,
      status: 'waiting' as ConnectionStatus,
      endSession,
    };
    let refreshPeerState: (() => void) | null = null;

    endSession.mockImplementation(() => {
      peerState.peerId = null;
      peerState.role = null;
      peerState.isHost = false;
      peerState.status = 'disconnected';
      refreshPeerState?.();
    });
    mockUseGame.mockImplementation(() => ({
      ...current,
      peer: { ...peerState },
      joinRoom,
    }));

    const view = (
      <MemoryRouter initialEntries={['/game?host=true&room=HOST12']}>
        <App />
      </MemoryRouter>
    );
    const { rerender } = render(view);
    refreshPeerState = () => rerender(view);

    fireEvent.click(screen.getByRole('button', { name: '対戦メニュー' }));
    fireEvent.change(screen.getByPlaceholderText('ルームID（例: ABC123）'), {
      target: { value: 'GUEST1' },
    });
    fireEvent.click(screen.getByRole('button', { name: '参加' }));

    await waitFor(() => expect(endSession).toHaveBeenCalledOnce());
    await waitFor(() => expect(joinRoom).toHaveBeenCalledWith('GUEST1'));
  });

  it('uses the guest route while stale host state is being cleared', async () => {
    const joinRoom = vi.fn().mockResolvedValue(undefined);
    const current = mockUseGame();
    mockUseGame.mockReturnValue({
      ...current,
      peer: {
        ...current.peer,
        peerId: null,
        role: 'host',
        isHost: true,
        status: 'disconnected',
      },
      joinRoom,
    });

    render(
      <MemoryRouter initialEntries={['/game?host=false&room=GUEST1']}>
        <App />
      </MemoryRouter>
    );

    await waitFor(() => expect(joinRoom).toHaveBeenCalledWith('GUEST1'));
    expect(createRoomMock).not.toHaveBeenCalled();
  });

  it('shows spectator-specific reconnect copy and retry action', () => {
    const retrySynchronization = vi.fn().mockResolvedValue(undefined);
    const current = mockUseGame();
    mockUseGame.mockReturnValue({
      ...current,
      isInteractionLocked: true,
      retrySynchronization,
      peer: {
        ...current.peer,
        role: 'spectator',
        status: 'error',
        error: '観戦ルームに接続できませんでした。',
      },
    });

    render(
      <MemoryRouter initialEntries={['/game?spectator=true&room=watch-room']}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: '観戦ルームへ再接続しています' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '再試行' }));
    expect(retrySynchronization).toHaveBeenCalledOnce();
  });

  it('renders Vercel Analytics in enabled production builds with game URL redaction', () => {
    vi.stubEnv('PROD', true);
    vi.stubEnv('VITE_ENABLE_VERCEL_ANALYTICS', 'true');

    render(
      <MemoryRouter initialEntries={['/analytics-test']}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByTestId('vercel-analytics')).toBeTruthy();
    expect(analyticsMock.props).toHaveLength(1);
    expect(analyticsMock.props[0]?.debug).toBe(false);
    expect(analyticsMock.props[0]?.beforeSend?.({
      url: 'https://example.com/game?host=true&room=ROOM123',
    })).toEqual({
      url: 'https://example.com/game/p2p-host',
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
