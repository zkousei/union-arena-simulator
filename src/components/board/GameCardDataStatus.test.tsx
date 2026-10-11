// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { GameCardDataStatus } from './GameCardDataStatus';
import type { GameState } from '../../types/game';
const mocks = vi.hoisted(() => ({ ensure: vi.fn() }));
vi.mock('../../data/cardDatabase', () => ({ ensureCardCodes: mocks.ensure }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it('keeps the committed state untouched when supplemental data fails and retries', async () => {
  const state = { turn: 5, players: { one: { life: [{ code: 'LIFE', isFaceDown: true }], apArea: [{ code: 'AP' }], frontLine: [{ code: 'RAID', bpModifier: 1000, underCards: [{ code: 'UNDER' }] }] } } } as unknown as GameState;
  const committed = JSON.stringify(state);
  mocks.ensure.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined);
  render(<GameCardDataStatus state={state} />);
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(mocks.ensure).toHaveBeenCalledWith(['AP', 'LIFE', 'RAID', 'UNDER']);
  fireEvent.click(screen.getByRole('button', { name: 'カード表示を再試行' }));
  await vi.waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  expect(JSON.stringify(state)).toBe(committed);
});
