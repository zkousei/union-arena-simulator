// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RestoreSessionModal } from './RestoreSessionModal';
import { SavedHostSession } from '../../domain/hostSessionStorage';
import { createInitialGameState } from '../../domain/initialState';

describe('RestoreSessionModal', () => {
  const dummyState = createInitialGameState('player-1', 'ホスト', 'player-2', 'ゲスト', 'player-1');
  dummyState.turn = 4;
  dummyState.phase = 'MAIN';

  const dummySession: SavedHostSession = {
    roomId: 'test-room-99',
    savedAt: 1710000000000,
    snapshot: {
      state: dummyState,
      revision: 7,
    },
  };

  it('renders session details and action buttons', () => {
    const onResume = vi.fn();
    const onDiscard = vi.fn();

    render(
      <RestoreSessionModal
        session={dummySession}
        onResume={onResume}
        onDiscard={onDiscard}
      />
    );

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('対戦セッションの復元')).toBeTruthy();
    expect(screen.getByText(/第 4 ターン/)).toBeTruthy();
    expect(screen.getByText(/MAIN/)).toBeTruthy();

    const resumeButton = screen.getByRole('button', { name: '復元して再開' });
    const discardButton = screen.getByRole('button', { name: '破棄して最初から' });

    expect(resumeButton).toBeTruthy();
    expect(discardButton).toBeTruthy();

    fireEvent.click(resumeButton);
    expect(onResume).toHaveBeenCalledTimes(1);

    fireEvent.click(discardButton);
    expect(onDiscard).toHaveBeenCalledTimes(1);
  });
});
