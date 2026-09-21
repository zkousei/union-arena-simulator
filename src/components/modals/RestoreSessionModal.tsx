import React from 'react';
import { RefreshCw, RotateCcw, Trash2, Clock, Swords } from 'lucide-react';
import { SavedHostSession } from '../../domain/hostSessionStorage';

interface RestoreSessionModalProps {
  session: SavedHostSession;
  onResume: () => void;
  onDiscard: () => void;
}

export const RestoreSessionModal: React.FC<RestoreSessionModalProps> = ({
  session,
  onResume,
  onDiscard,
}) => {
  const { snapshot, savedAt } = session;
  const state = snapshot.state;
  const formattedTime = new Date(savedAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const player1 = state.players?.['player-1'];
  const player2 = state.players?.['player-2'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="restore-session-title"
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
      >
        {/* ヘッダー */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center gap-3 bg-gradient-to-r from-indigo-950/80 to-slate-900">
          <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
            <RotateCcw className="w-5 h-5" />
          </div>
          <div>
            <h2 id="restore-session-title" className="text-base font-bold text-white">
              対戦セッションの復元
            </h2>
            <p className="text-xs text-slate-400">前回の盤面データを復元して再開できます</p>
          </div>
        </div>

        {/* コンテンツ */}
        <div className="p-6 space-y-4">
          <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800/80 space-y-2.5 text-xs text-slate-300">
            <div className="flex items-center justify-between text-slate-400 border-b border-slate-800/60 pb-2">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-400" />
                保存時刻
              </span>
              <span className="font-mono font-medium text-slate-200">{formattedTime}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Swords className="w-3.5 h-3.5 text-amber-400" />
                進行状況
              </span>
              <div className="flex items-center gap-2">
                <span className="bg-indigo-950/80 text-indigo-300 px-2 py-0.5 rounded border border-indigo-800/60 font-bold">
                  第 {state.turn} ターン
                </span>
                <span className="bg-amber-950/80 text-amber-300 px-2 py-0.5 rounded border border-amber-800/60 font-bold">
                  {state.phase}
                </span>
              </div>
            </div>

            {(player1 || player2) && (
              <div className="pt-2 border-t border-slate-800/60 grid grid-cols-2 gap-2 text-[11px]">
                <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                  <div className="font-bold text-indigo-300 truncate">
                    {player1?.name || 'Player 1'}
                  </div>
                  <div className="text-slate-400 mt-1">
                    手札: {player1?.hand?.length ?? 0}枚 / ライフ: {player1?.life?.length ?? 0}枚
                  </div>
                </div>
                <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                  <div className="font-bold text-amber-300 truncate">
                    {player2?.name || 'Player 2'}
                  </div>
                  <div className="text-slate-400 mt-1">
                    手札: {player2?.hand?.length ?? 0}枚 / ライフ: {player2?.life?.length ?? 0}枚
                  </div>
                </div>
              </div>
            )}
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            リロード前の盤面（配置されたカード・手札・ライフ・AP・ログ等）を復元して、相手プレイヤーとの対戦を再開しますか？
          </p>

          {/* アクションボタン */}
          <div className="pt-2 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={onResume}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-600/30 transition active:scale-[0.98]"
            >
              <RefreshCw className="w-4 h-4" />
              <span>復元して再開</span>
            </button>
            <button
              type="button"
              onClick={onDiscard}
              className="flex items-center justify-center gap-1.5 py-2.5 px-4 bg-slate-800 hover:bg-rose-950/60 hover:text-rose-300 hover:border-rose-800 text-slate-300 rounded-xl font-medium text-xs border border-slate-700 transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>破棄して最初から</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
