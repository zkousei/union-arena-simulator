// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PhaseBar } from './PhaseBar';

describe('PhaseBar', () => {
  const defaultProps = {
    currentPhase: 'START' as const,
    turn: 1,
    isActivePlayer: true,
    activePlayerName: 'Player 1',
    canExtraDraw: false,
    isFirstTurnFirstPlayer: false,
    isSoloMode: true,
    activePlayerId: 'player-1',
    isCompact: false,
    onSetPhase: vi.fn(),
    onPassTurn: vi.fn(),
    onAdvancePhase: vi.fn(),
    onExtraDraw: vi.fn(),
  };

  it('renders all 5 official phases and highlights current phase', () => {
    render(<PhaseBar {...defaultProps} currentPhase="MAIN" />);

    expect(screen.getByText('スタート')).toBeTruthy();
    expect(screen.getByText('移動')).toBeTruthy();
    expect(screen.getByText('メイン')).toBeTruthy();
    expect(screen.getByText('アタック')).toBeTruthy();
    expect(screen.getByText('エンド')).toBeTruthy();

    const mainBtn = screen.getByRole('button', { name: /メイン/ });
    expect(mainBtn.className).toContain('bg-indigo-600');
  });

  it('shows next phase advance button and calls onAdvancePhase when clicked', () => {
    const onAdvancePhase = vi.fn();
    render(<PhaseBar {...defaultProps} currentPhase="START" onAdvancePhase={onAdvancePhase} />);

    const advanceBtn = screen.getByRole('button', { name: /移動フェイズへ ▶/ });
    expect(advanceBtn).toBeTruthy();

    fireEvent.click(advanceBtn);
    expect(onAdvancePhase).toHaveBeenCalledTimes(1);
  });

  it('highlights turn pass button when in END phase and shows shortcut hint', () => {
    const onPassTurn = vi.fn();
    render(<PhaseBar {...defaultProps} currentPhase="END" onPassTurn={onPassTurn} />);

    const passBtn = screen.getByRole('button', { name: /ターン終了 \[Space\]/ });
    expect(passBtn).toBeTruthy();
    expect(passBtn.className).toContain('animate-pulse');

    fireEvent.click(passBtn);
    expect(onPassTurn).toHaveBeenCalledTimes(1);
  });

  it('blocks attack phase on turn 1 for first player', () => {
    render(<PhaseBar {...defaultProps} turn={1} isFirstTurnFirstPlayer={true} />);

    const attackBtn = screen.getByRole('button', { name: /アタック \(不可\)/ });
    expect(attackBtn.hasAttribute('disabled')).toBe(true);
  });
});
