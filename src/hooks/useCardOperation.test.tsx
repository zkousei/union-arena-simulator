// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { useCardOperation } from './useCardOperation';
it('ignores duplicate operations and never applies data after leaving the scope', async () => {
  let resolve!: () => void;
  const load = vi.fn(() => new Promise<void>((done) => { resolve = done; }));
  const apply = vi.fn();
  const { result, rerender } = renderHook(({ scope }) => useCardOperation(scope), { initialProps: { scope: true } });
  let task!: Promise<void>;
  act(() => { task = result.current.run(load, apply); void result.current.run(load, apply); });
  expect(load).toHaveBeenCalledTimes(1);
  rerender({ scope: false });
  await act(async () => { resolve(); await task; });
  expect(apply).not.toHaveBeenCalled();
  expect(result.current.busy).toBe(false);
});
it('reports failure and allows the next attempt', async () => {
  const { result } = renderHook(() => useCardOperation());
  await act(async () => { await result.current.run(() => Promise.reject(new Error('offline')), vi.fn()); });
  expect(result.current.error).toBe('offline');
  const apply = vi.fn();
  await act(async () => { await result.current.run(() => Promise.resolve('ready'), apply); });
  expect(apply).toHaveBeenCalledWith('ready');
  expect(result.current.error).toBeNull();
});
