import { useEffect, useState, type ComponentType } from 'react';
import { loadCardDatabase } from '../data/cardDatabase';

export function CardDataBootstrap() {
  const [App, setApp] = useState<ComponentType | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setFailed(false);
    // Importing App earlier would initialize storage indexes and preset decks
    // against an empty database. Keep that module graph behind this gate.
    loadCardDatabase()
      .then(() => import('../App'))
      .then((module) => { if (active) setApp(() => module.default); })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [attempt]);

  if (App) return <App />;
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md text-center space-y-4">
        {failed ? (
          <>
            <p role="alert">起動に必要なデータを読み込めませんでした。接続を確認して再試行してください。</p>
            <p className="text-sm text-slate-300">保存済みデッキは変更されていません。</p>
            <button
              type="button"
              className="rounded-lg bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-300"
              onClick={() => setAttempt((value) => value + 1)}
            >再試行</button>
            <button
              type="button"
              className="block mx-auto rounded-lg border border-slate-500 px-6 py-3 hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-300"
              onClick={() => window.location.reload()}
            >再読み込み</button>
          </>
        ) : <p role="status">カードデータを読み込み中…</p>}
      </div>
    </main>
  );
}
