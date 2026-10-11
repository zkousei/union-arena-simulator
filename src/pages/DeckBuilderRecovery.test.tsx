// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { DeckBuilderPage } from './DeckBuilder';
import { loadSavedDeckById, saveDeck } from '../utils/deckStorage';
vi.mock('../utils/deckStorage', async (original) => ({
  ...await original<typeof import('../utils/deckStorage')>(),
  loadSavedDeckSummaries: vi.fn(() => ({ decks: [
    { id: 'blocked', name: '取得失敗のデッキ', titleCode: 'CGH', totalCards: 1, updatedAt: 1 },
    { id: 'ready', name: '別の空デッキ', titleCode: 'JJK', totalCards: 0, updatedAt: 2 },
  ], skippedCount: 0, backupJson: null, unreadable: false })),
  loadSavedDeckById: vi.fn(), saveDeck: vi.fn(() => true),
}));
beforeEach(() => {
  vi.mocked(loadSavedDeckById).mockReset().mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue({ id: 'ready', name: '別の空デッキ', titleCode: 'JJK', items: [], updatedAt: 2 });
  vi.mocked(saveDeck).mockClear();
});
afterEach(cleanup);
const failInitialDeck = async () => {
  render(<DeckBuilderPage onPlayWithDeck={vi.fn()} />);
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('offline'));
};
it('allows choosing a different saved deck after the first deck fails', async () => {
  await failInitialDeck();
  fireEvent.click(screen.getByRole('button', { name: '別の保存デッキを選択' }));
  fireEvent.click(screen.getByText('別の空デッキ'));
  await waitFor(() => expect((screen.getByPlaceholderText('デッキ名を入力...') as HTMLInputElement).value).toBe('別の空デッキ'));
  expect(saveDeck).not.toHaveBeenCalled();
});
it('allows creating a new deck without overwriting the failed deck or retaining its error', async () => {
  await failInitialDeck();
  fireEvent.click(screen.getByRole('button', { name: '新規デッキ作成' }));
  expect((screen.getByPlaceholderText('デッキ名を入力...') as HTMLInputElement).value).toBe('新規デッキ');
  expect(vi.mocked(saveDeck).mock.calls[0][0].id).not.toBe('blocked');
  expect(screen.queryByRole('alert')).toBeNull();
});
it('allows JSON import after the first deck fails', async () => {
  await failInitialDeck();
  fireEvent.click(screen.getByRole('button', { name: 'JSONインポート' }));
  fireEvent.change(screen.getByPlaceholderText('{"name": "...", "items": [...]}'), { target: { value: JSON.stringify({ name: 'インポートした空デッキ', titleCode: 'JJK', items: [] }) } });
  fireEvent.click(screen.getByRole('button', { name: 'インポート' }));
  await waitFor(() => expect((screen.getByPlaceholderText('デッキ名を入力...') as HTMLInputElement).value).toBe('インポートした空デッキ'));
  expect(screen.queryByRole('alert')).toBeNull();
});

it('retries the last selected deck when another selection also fails', async () => {
  vi.mocked(loadSavedDeckById).mockRejectedValueOnce(new Error('ready offline'));
  await failInitialDeck();
  fireEvent.click(screen.getByRole('button', { name: '別の保存デッキを選択' }));
  fireEvent.click(screen.getByText('別の空デッキ'));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('ready offline'));
  fireEvent.click(screen.getByRole('button', { name: 'デッキ読込を再試行' }));
  await waitFor(() => expect(loadSavedDeckById).toHaveBeenLastCalledWith('ready'));
  await waitFor(() => expect(screen.getByPlaceholderText('デッキ名を入力...')).toBeTruthy());
});
