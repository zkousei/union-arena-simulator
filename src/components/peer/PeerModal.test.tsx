// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { UsePeerReturn } from '../../hooks/usePeer';
import { PeerModal } from './PeerModal';

describe('PeerModal', () => {
  it('announces a guest connection error and allows an immediate retry', () => {
    const reconnect = vi.fn().mockResolvedValue(undefined);
    const peer: UsePeerReturn = {
      peerId: 'guest-peer',
      remotePeerId: null,
      status: 'error',
      role: 'guest',
      lastRoomId: 'host-room',
      isHost: false,
      error: 'Peerサーバーへ接続できませんでした。',
      spectatorCount: 0,
      maxSpectatorConnections: 8,
      spectatingEnabled: true,
      createRoom: vi.fn(),
      joinRoom: vi.fn(),
      spectateRoom: vi.fn(),
      reconnect,
      sendMessage: vi.fn(),
      broadcastMessage: vi.fn(),
      sendToConnection: vi.fn(),
      setSpectatingEnabled: vi.fn(),
      endSession: vi.fn(),
      disconnect: vi.fn(),
    };

    render(
      <PeerModal
        peer={peer}
        isOpen
        onClose={vi.fn()}
        onCreateRoom={vi.fn()}
        onJoinRoom={vi.fn()}
        onDisconnect={vi.fn()}
      />
    );

    expect(screen.getByRole('dialog', { name: 'P2P 通信対戦 (PeerJS)' })).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain(
      'Peerサーバーへ接続できませんでした。'
    );

    fireEvent.click(screen.getByRole('button', { name: '今すぐ再試行' }));
    expect(reconnect).toHaveBeenCalledOnce();
  });

  it('shares one room code with both guests and spectators', () => {
    const setSpectatingEnabled = vi.fn();
    const clipboardWrite = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: clipboardWrite },
    });
    const peer: UsePeerReturn = {
      peerId: 'ABC123',
      remotePeerId: null,
      status: 'waiting',
      role: 'host',
      lastRoomId: 'ABC123',
      isHost: true,
      error: null,
      spectatorCount: 2,
      maxSpectatorConnections: 8,
      spectatingEnabled: true,
      createRoom: vi.fn(),
      joinRoom: vi.fn(),
      spectateRoom: vi.fn(),
      reconnect: vi.fn(),
      sendMessage: vi.fn(),
      broadcastMessage: vi.fn(),
      sendToConnection: vi.fn(),
      setSpectatingEnabled,
      endSession: vi.fn(),
      disconnect: vi.fn(),
    };

    render(
      <PeerModal
        peer={peer}
        isOpen
        onClose={vi.fn()}
        onCreateRoom={vi.fn()}
        onJoinRoom={vi.fn()}
        onDisconnect={vi.fn()}
      />
    );

    expect(screen.getByText('ABC123')).toBeTruthy();
    expect(screen.queryByDisplayValue(/host=false&room=ABC123/)).toBeNull();
    expect(screen.queryByDisplayValue(/spectator=true&room=ABC123/)).toBeNull();
    expect(screen.getByText('観戦者 2 / 8')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'ルームコードをコピー' }));
    expect(clipboardWrite).toHaveBeenCalledWith('ABC123');

    fireEvent.click(screen.getByRole('checkbox', { name: '観戦受付' }));
    expect(setSpectatingEnabled).toHaveBeenCalledWith(false);
  });
});
