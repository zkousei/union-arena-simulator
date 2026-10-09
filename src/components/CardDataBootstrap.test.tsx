// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CardDataBootstrap } from './CardDataBootstrap';

const mocks = vi.hoisted(() => ({ load: vi.fn(), app: vi.fn() }));
vi.mock('../data/cardDatabase', () => ({ loadCardDatabase: mocks.load }));
vi.mock('../App', () => ({ default: () => { mocks.app(); return <div>アプリ起動済み</div>; } }));
beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
  });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

describe('CardDataBootstrap', () => {
  it('waits for the database before rendering the app', async () => {
    let resolve!: () => void;
    mocks.load.mockImplementationOnce(() => new Promise<void>((done) => { resolve = done; }));
    render(<CardDataBootstrap />);
    expect(screen.getByRole('status').textContent).toContain('カードデータを読み込み中');
    expect(mocks.app).not.toHaveBeenCalled();
    resolve();
    expect(await screen.findByText('アプリ起動済み')).toBeTruthy();
  });

  it('preserves saved decks on failure and starts the app after retry', async () => {
    const backup = '[{"id":"saved-deck","name":"大切なデッキ"}]';
    localStorage.setItem('union_arena_saved_decks', backup);
    mocks.load.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined);
    render(<CardDataBootstrap />);
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('button', { name: '再読み込み' })).toBeTruthy();
    expect(mocks.app).not.toHaveBeenCalled();
    expect(localStorage.getItem('union_arena_saved_decks')).toBe(backup);
    fireEvent.click(screen.getByRole('button', { name: '再試行' }));
    expect(await screen.findByText('アプリ起動済み')).toBeTruthy();
    expect(localStorage.getItem('union_arena_saved_decks')).toBe(backup);
  });
});
