// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SavedDeckPickerModal } from './SavedDeckPickerModal';
import { loadPresetDeck } from '../../data/sampleDeck';
import { loadSavedDeckById } from '../../utils/deckStorage';
import type { UserDeck } from '../../domain/deckValidation';
const deck: UserDeck = { id: 'saved', name: '保存デッキ', titleCode: 'JJK', items: [], updatedAt: 1 };
vi.mock('../../data/sampleDeck', async (original) => ({ ...await original<typeof import('../../data/sampleDeck')>(), loadPresetDeck: vi.fn() }));
vi.mock('../../utils/deckStorage', async (original) => ({
  ...await original<typeof import('../../utils/deckStorage')>(),
  loadSavedDeckSummaries: vi.fn(() => ({ decks: [{ id: 'saved', name: '保存デッキ', titleCode: 'JJK', totalCards: 0, updatedAt: 1 }], skippedCount: 0, backupJson: null, unreadable: false })),
  loadSavedDeckById: vi.fn(),
}));
beforeEach(() => { vi.mocked(loadPresetDeck).mockReset(); vi.mocked(loadSavedDeckById).mockReset().mockResolvedValue(deck); });
afterEach(cleanup);
const deferred = () => {
  let resolve!: (value: UserDeck) => void;
  const promise = new Promise<UserDeck>((done) => { resolve = done; });
  return { promise, resolve };
};
const setup = () => {
  const props = { isOpen: true, onClose: vi.fn(), onSelectDeck: vi.fn(), myPlayerId: 'player-2', isSoloMode: false };
  return { props, ...render(<SavedDeckPickerModal {...props} />) };
};
const choosePreset = () => {
  fireEvent.click(screen.getByRole('button', { name: /公式プリセット/ }));
  fireEvent.click(screen.getAllByRole('button', { name: '自分のデッキにセット' })[0]);
};
it('disables all P2P preset buttons while loading and commits the selected deck once', async () => {
  const task = deferred(); vi.mocked(loadPresetDeck).mockReturnValueOnce(task.promise);
  const { props } = setup(); choosePreset();
  const buttons = screen.getAllByRole('button', { name: '自分のデッキにセット' });
  expect(buttons.every((button) => (button as HTMLButtonElement).disabled)).toBe(true);
  fireEvent.click(buttons[1]); expect(loadPresetDeck).toHaveBeenCalledTimes(1);
  await act(async () => { task.resolve(deck); });
  expect(props.onSelectDeck).toHaveBeenCalledExactlyOnceWith(deck, 'player-2');
  expect(props.onClose).toHaveBeenCalledTimes(1);
});
it('ignores an old preset completion after switching tabs and returning', async () => {
  const task = deferred(); vi.mocked(loadPresetDeck).mockReturnValueOnce(task.promise);
  const { props } = setup(); choosePreset();
  fireEvent.click(screen.getByRole('button', { name: /保存済みマイデッキ/ }));
  fireEvent.click(screen.getByRole('button', { name: /公式プリセット/ }));
  await act(async () => { task.resolve(deck); });
  expect(props.onSelectDeck).not.toHaveBeenCalled(); expect(props.onClose).not.toHaveBeenCalled();
});
it('allows selecting a saved deck while the cancelled preset is still loading', async () => {
  const task = deferred(); vi.mocked(loadPresetDeck).mockReturnValueOnce(task.promise);
  const { props } = setup(); choosePreset();
  fireEvent.click(screen.getByRole('button', { name: /保存済みマイデッキ/ }));
  fireEvent.click(screen.getByRole('button', { name: '自分のデッキにセット' }));
  await waitFor(() => expect(props.onSelectDeck).toHaveBeenCalledExactlyOnceWith(deck, 'player-2'));
  await act(async () => { task.resolve({ ...deck, id: 'old-preset' }); });
  expect(props.onSelectDeck).toHaveBeenCalledTimes(1); expect(props.onClose).toHaveBeenCalledTimes(1);
});
it('reenables preset buttons on failure and allows retry', async () => {
  vi.mocked(loadPresetDeck).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(deck);
  const { props } = setup(); choosePreset();
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('offline'));
  const button = screen.getAllByRole('button', { name: '自分のデッキにセット' })[0];
  expect((button as HTMLButtonElement).disabled).toBe(false);
  fireEvent.click(button);
  await waitFor(() => expect(props.onSelectDeck).toHaveBeenCalledTimes(1));
});
it('ignores an old completion after closing and reopening', async () => {
  const task = deferred(); vi.mocked(loadPresetDeck).mockReturnValueOnce(task.promise);
  const { props, rerender } = setup(); choosePreset();
  rerender(<SavedDeckPickerModal {...props} isOpen={false} />);
  rerender(<SavedDeckPickerModal {...props} />);
  await act(async () => { task.resolve(deck); });
  expect(props.onSelectDeck).not.toHaveBeenCalled(); expect(props.onClose).not.toHaveBeenCalled();
});
