import React from 'react';
import { Card } from '../../types/card';
import { CardView } from '../board/CardView';
import { Swords, Layers, ArrowUpRight, RotateCw, X, AlertCircle } from 'lucide-react';

export interface RaidOrMarkerModalProps {
  isOpen: boolean;
  incomingCard: Card | null;
  existingCard: Card | null;
  targetZone: 'frontLine' | 'energyLine';
  targetSlotIndex: number;
  hasEmptyFrontSlot: boolean;
  onSelectRaid: (moveToFront: boolean) => void;
  onSelectMarker: () => void;
  onClose: () => void;
}

export const RaidOrMarkerModal: React.FC<RaidOrMarkerModalProps> = ({
  isOpen,
  incomingCard,
  existingCard,
  targetZone,
  targetSlotIndex,
  hasEmptyFrontSlot,
  onSelectRaid,
  onSelectMarker,
  onClose,
}) => {
  if (!isOpen || !incomingCard || !existingCard) return null;

  const isRaid = !!(
    incomingCard.cardType === 'CHARACTER' &&
    existingCard.cardType === 'CHARACTER' &&
    (incomingCard.triggers?.includes('RAID') ||
      incomingCard.effectText?.includes('【レイド】') ||
      incomingCard.effectText?.includes('[レイド]'))
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border-2 border-purple-500/80 rounded-2xl max-w-xl w-full p-5 shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-150">
        {/* ヘッダー */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            {isRaid ? (
              <Swords className="w-5 h-5 text-purple-400" />
            ) : (
              <Layers className="w-5 h-5 text-amber-400" />
            )}
            <div>
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                {isRaid ? 'レイド登場またはマーカー配置' : 'マーカー配置の確認'}
              </h3>
              <p className="text-xs text-slate-400">
                {targetZone === 'frontLine' ? 'フロントライン' : 'エナジーライン'}枠{targetSlotIndex + 1}の「{existingCard.name}」に対する操作を選択してください
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

        {/* カード比較ビジュアル */}
        <div className="flex items-center justify-center gap-4 py-2 bg-slate-950/60 rounded-xl border border-slate-800 p-3">
          <div className="flex flex-col items-center gap-1">
            <span className="text-[10px] font-bold text-slate-400">対象キャラ（下）</span>
            <div className="scale-90 origin-top">
              <CardView card={existingCard} />
            </div>
            <span className="text-xs font-bold text-slate-200 truncate max-w-[120px]">{existingCard.name}</span>
          </div>

          <div className="flex flex-col items-center gap-1 text-purple-400">
            <span className="text-xs font-extrabold text-purple-300">重ねる</span>
            <ArrowUpRight className="w-6 h-6 animate-pulse" />
          </div>

          <div className="flex flex-col items-center gap-1">
            <span className="text-[10px] font-bold text-purple-300">新カード（上）</span>
            <div className="scale-90 origin-top">
              <CardView card={incomingCard} />
            </div>
            <span className="text-xs font-bold text-purple-200 truncate max-w-[120px]">{incomingCard.name}</span>
          </div>
        </div>

        {/* 選択肢ボタン群 */}
        <div className="flex flex-col gap-2.5">
          {isRaid && (
            <>
              {targetZone === 'energyLine' ? (
                <>
                  <button
                    onClick={() => {
                      onSelectRaid(true);
                      onClose();
                    }}
                    disabled={!hasEmptyFrontSlot}
                    className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                      hasEmptyFrontSlot
                        ? 'bg-purple-950/70 hover:bg-purple-900 border-purple-500/80 hover:border-purple-400 text-white cursor-pointer shadow-lg shadow-purple-950/50'
                        : 'bg-slate-900 border-slate-800 text-slate-500 cursor-not-allowed opacity-60'
                    }`}
                  >
                    <div className="p-2 rounded-lg bg-purple-900/80 text-purple-300 border border-purple-500/40 shrink-0 mt-0.5">
                      <Swords className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-purple-100">【レイド登場】フロントラインへ移動して登場</span>
                        <span className="text-[10px] font-black bg-purple-500/30 text-purple-200 px-1.5 py-0.5 rounded border border-purple-400/40">
                          即時アタック可
                        </span>
                      </div>
                      <p className="text-xs text-purple-300/80 mt-0.5">
                        エナジーラインのキャラを元にして、フロントラインの空き枠にアクティブでレイド登場します。
                      </p>
                      {!hasEmptyFrontSlot && (
                        <p className="text-[11px] text-rose-400 font-bold mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" />
                          フロントラインに空き枠がありません
                        </p>
                      )}
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      onSelectRaid(false);
                      onClose();
                    }}
                    className="flex items-start gap-3 p-3 rounded-xl border border-indigo-500/50 bg-indigo-950/50 hover:bg-indigo-900/70 text-white text-left transition-all cursor-pointer shadow"
                  >
                    <div className="p-2 rounded-lg bg-indigo-900/80 text-indigo-300 border border-indigo-500/40 shrink-0 mt-0.5">
                      <RotateCw className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-indigo-100">【レイド登場】エナジーラインにとどまる</span>
                        <span className="text-[10px] font-black bg-indigo-500/30 text-indigo-200 px-1.5 py-0.5 rounded border border-indigo-400/40">
                          アクティブ化
                        </span>
                      </div>
                      <p className="text-xs text-indigo-300/80 mt-0.5">
                        フロントラインへ移動せず、エナジーラインにとどまりアクティブ化します（追加エナジー発生などに有効）。
                      </p>
                    </div>
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    onSelectRaid(false);
                    onClose();
                  }}
                  className="flex items-start gap-3 p-3 rounded-xl border border-purple-500/80 bg-purple-950/70 hover:bg-purple-900 text-white text-left transition-all cursor-pointer shadow-lg shadow-purple-950/50"
                >
                  <div className="p-2 rounded-lg bg-purple-900/80 text-purple-300 border border-purple-500/40 shrink-0 mt-0.5">
                    <Swords className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-purple-100">【レイド登場】フロントラインに重ねて登場</span>
                      <span className="text-[10px] font-black bg-purple-500/30 text-purple-200 px-1.5 py-0.5 rounded border border-purple-400/40">
                        アクティブ化
                      </span>
                    </div>
                    <p className="text-xs text-purple-300/80 mt-0.5">
                      フロントラインの対象キャラの上に重ねて登場し、アクティブ状態になります。
                    </p>
                  </div>
                </button>
              )}
            </>
          )}

          {/* マーカー配置オプション */}
          <button
            onClick={() => {
              onSelectMarker();
              onClose();
            }}
            className="flex items-start gap-3 p-3 rounded-xl border border-amber-500/50 bg-amber-950/40 hover:bg-amber-900/60 text-white text-left transition-all cursor-pointer shadow"
          >
            <div className="p-2 rounded-lg bg-amber-900/80 text-amber-300 border border-amber-500/40 shrink-0 mt-0.5">
              <Layers className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-amber-100">【マーカー配置】裏向きで下に置く</span>
                <span className="text-[10px] font-black bg-amber-500/30 text-amber-200 px-1.5 py-0.5 rounded border border-amber-400/40">
                  マーカー
                </span>
              </div>
              <p className="text-xs text-amber-300/80 mt-0.5">
                対象キャラの下に裏向きでマーカーとして重ねて配置します（ファットガム、ホークス、天喰環等のカード効果）。
              </p>
            </div>
          </button>

          {/* キャンセルボタン */}
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
