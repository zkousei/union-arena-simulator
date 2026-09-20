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
      createRoom: vi.fn(),
      joinRoom: vi.fn(),
      reconnect,
      sendMessage: vi.fn(),
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
});
