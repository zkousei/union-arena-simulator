import { useCallback, useEffect, useRef, useState } from 'react';

/** Suppress duplicate actions and discard completion after a dialog/route is left. */
export function useCardOperation(scope: unknown = true) {
  const generation = useRef(0);
  const active = useRef(false);
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const scopeGeneration = ++generation.current;
    active.current = true;
    setBusy(false); setError(null);
    return () => { active.current = false; pending.current = false; generation.current = scopeGeneration + 1; };
  }, [scope]);
  const run = useCallback(async <T>(load: () => Promise<T>, apply: (value: T) => void) => {
    if (pending.current || !active.current) return;
    pending.current = true;
    const id = generation.current;
    setBusy(true); setError(null);
    try {
      const value = await load();
      if (active.current && id === generation.current) apply(value);
    } catch (error: unknown) {
      if (active.current && id === generation.current) setError(error instanceof Error ? error.message : 'カードデータの読み込みに失敗しました。');
    } finally {
      if (active.current && id === generation.current) { pending.current = false; setBusy(false); }
    }
  }, []);
  const clearError = useCallback(() => setError(null), []);
  return { busy, error, run, clearError };
}
