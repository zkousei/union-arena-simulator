import { useEffect, useState } from 'react';
import type { GameState } from '../../types/game';
import { collectCardCodes } from '../../data/cardData';
import { ensureCardCodes } from '../../data/cardDatabase';
import { useCardOperation } from '../../hooks/useCardOperation';

/** Background display data only: never delay or modify committed snapshots. */
export function GameCardDataStatus({ state }: { state: GameState }) {
  const codesKey = JSON.stringify(collectCardCodes(state).sort());
  const { run, error } = useCardOperation(codesKey);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    void run(() => ensureCardCodes(JSON.parse(codesKey) as string[]), () => {});
  }, [codesKey, attempt, run]);
  if (!error) return null;
  return <div role="alert" className="shrink-0 p-2 text-xs bg-amber-950 text-amber-100">
    カード表示の補足データを取得できませんでした。
    <button type="button" className="ml-2 underline" onClick={() => setAttempt((n) => n + 1)}>カード表示を再試行</button>
  </div>;
}
