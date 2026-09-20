import React from 'react';
import { ArrowUpToLine, ArrowDownToLine, X } from 'lucide-react';

interface DeckPlacementModalProps {
  isOpen: boolean;
  onSelect: (destination: 'deckTop' | 'deckBottom') => void;
  onCancel: () => void;
}

export const DeckPlacementModal: React.FC<DeckPlacementModalProps> = ({
  isOpen,
  onSelect,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      onClick={onCancel}
    >
      <div
        className="bg-slate-900 border-2 border-indigo-500/80 rounded-2xl max-w-sm w-full p-5 shadow-2xl flex flex-col gap-4 text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">📚</span>
            <h3 className="font-bold text-base text-white">山札へのカード配置</h3>
          </div>
          <button
            onClick={onCancel}
            className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          ドロップしたカードを山札のどちらに配置しますか？
        </p>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onSelect('deckTop')}
            className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 border-indigo-500/60 bg-indigo-950/40 hover:bg-indigo-900/60 hover:border-indigo-400 text-indigo-200 hover:text-white transition group shadow-lg"
          >
            <div className="p-2.5 rounded-full bg-indigo-600/30 text-indigo-300 group-hover:scale-110 transition-transform">
              <ArrowUpToLine className="w-6 h-6" />
            </div>
            <div className="text-center">
              <div className="font-extrabold text-xs">山札の上へ置く</div>
              <div className="text-[10px] text-indigo-400/80 mt-0.5">次ドロー対象</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onSelect('deckBottom')}
            className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 border-slate-700 bg-slate-950/60 hover:bg-slate-800 hover:border-slate-500 text-slate-300 hover:text-white transition group shadow-lg"
          >
            <div className="p-2.5 rounded-full bg-slate-800 text-slate-300 group-hover:scale-110 transition-transform">
              <ArrowDownToLine className="w-6 h-6" />
            </div>
            <div className="text-center">
              <div className="font-extrabold text-xs">山札の下へ送る</div>
              <div className="text-[10px] text-slate-400 mt-0.5">一番底に戻す</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
