import React from 'react';
import { ShieldAlert, Sun, X } from 'lucide-react';

export interface LifePlacementModalProps {
  isOpen: boolean;
  cardName?: string;
  onConfirm: (isFaceDown: boolean) => void;
  onClose: () => void;
}

export const LifePlacementModal: React.FC<LifePlacementModalProps> = ({
  isOpen,
  cardName,
  onConfirm,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border-2 border-rose-500/80 rounded-2xl max-w-md w-full p-5 shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-150">
        {/* ヘッダー */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-rose-400" />
            <div>
              <h3 className="font-bold text-base text-white">ライフエリアへの配置</h3>
              <p className="text-xs text-slate-400">
                {cardName ? `「${cardName}」の配置方法を選択してください` : 'ライフの配置方法を選択してください'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 選択肢ボタン群 */}
        <div className="flex flex-col gap-2.5">
          <button
            onClick={() => {
              onConfirm(false);
              onClose();
            }}
            className="flex items-start gap-3 p-3 rounded-xl border border-amber-500/70 bg-amber-950/60 hover:bg-amber-900/80 text-white text-left transition-all cursor-pointer shadow-lg shadow-amber-950/40 group"
          >
            <div className="p-2 rounded-lg bg-amber-900/80 text-amber-300 border border-amber-500/40 shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
              <Sun className="w-5 h-5 text-amber-400" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-amber-100">表向きで置く</span>
                <span className="text-[10px] font-black bg-amber-500/30 text-amber-200 px-1.5 py-0.5 rounded border border-amber-400/40">
                  公開情報
                </span>
              </div>
              <p className="text-xs text-amber-300/80 mt-0.5">
                レディ・ブラック等のカード効果で、お互いに表面を公開した状態でライフに置きます。
              </p>
            </div>
          </button>

          <button
            onClick={() => {
              onConfirm(true);
              onClose();
            }}
            className="flex items-start gap-3 p-3 rounded-xl border border-rose-500/60 bg-rose-950/40 hover:bg-rose-900/60 text-white text-left transition-all cursor-pointer shadow group"
          >
            <div className="p-2 rounded-lg bg-rose-900/80 text-rose-300 border border-rose-500/40 shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
              <ShieldAlert className="w-5 h-5 text-rose-400" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-rose-100">裏向きで置く</span>
                <span className="text-[10px] font-black bg-rose-500/30 text-rose-200 px-1.5 py-0.5 rounded border border-rose-400/40">
                  通常（非公開）
                </span>
              </div>
              <p className="text-xs text-rose-300/80 mt-0.5">
                通常のライフ追加やライフ回復として、裏向きでライフに置きます。
              </p>
            </div>
          </button>

          <button
            onClick={onClose}
            className="w-full py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-300 font-bold text-xs transition-colors mt-1"
          >
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
};
