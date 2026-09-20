import React, { useState } from 'react';
import { Card } from '../../types/card';
import { Sparkles, Hand, Trash2, ArrowLeft, X, ShieldAlert } from 'lucide-react';

interface RevealedCardModalProps {
  revealed: {
    card: Card;
    source: string;
    fromPlayerId: string;
  } | null;
  inspectCard: Card | null;
  onDismissRevealed?: (destination: 'hand' | 'graveyard' | 'life' | 'cancel') => void;
  onCloseInspect?: () => void;
}

export const RevealedCardModal: React.FC<RevealedCardModalProps> = ({
  revealed,
  inspectCard,
  onDismissRevealed,
  onCloseInspect,
}) => {
  const [imgError, setImgError] = useState(false);
  const card = revealed ? revealed.card : inspectCard;
  const isTriggerModal = !!revealed;

  if (!card) return null;

  const hasValidImage = !!card.imageUrl && !imgError;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto"
      onClick={() => {
        if (!isTriggerModal && onCloseInspect) onCloseInspect();
      }}
    >
      <div
        className="bg-slate-900 border-2 border-indigo-500/70 rounded-2xl max-w-2xl w-full p-4 sm:p-5 shadow-2xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200 text-slate-100 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <h3 className="font-extrabold text-base text-white flex items-center gap-2">
              <span>{isTriggerModal ? `⚡ ${revealed.source}` : 'カード情報詳細'}</span>
              <span className="text-xs font-normal text-indigo-300 bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-700/50">
                {card.code}
              </span>
            </h3>
          </div>
          {!isTriggerModal && (
            <button
              onClick={onCloseInspect}
              className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition"
              title="閉じる (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* メインコンテンツ: 左側カード画像、右側詳細情報 */}
        <div className="flex flex-col sm:flex-row gap-4 items-center sm:items-start">
          {/* カード画像またはフォールバック */}
          <div className="w-48 sm:w-56 shrink-0 flex flex-col items-center">
            {hasValidImage ? (
              <div className="relative rounded-xl overflow-hidden border-2 border-slate-700 shadow-2xl bg-black">
                <img
                  src={card.imageUrl}
                  alt={card.name}
                  onError={() => setImgError(true)}
                  className="w-full h-auto object-contain max-h-[320px] rounded-xl"
                />
              </div>
            ) : (
              <div className="w-48 h-64 bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 border-2 border-slate-700 rounded-xl p-3 flex flex-col justify-between items-center text-center shadow-lg">
                <div className="text-xs font-bold text-indigo-300">{card.code}</div>
                <div className="my-auto">
                  <div className="text-sm font-bold text-white mb-1">{card.name}</div>
                  <div className="text-xs text-slate-400">[{card.cardType}]</div>
                </div>
                {card.bp !== null && (
                  <div className="bg-slate-800 px-3 py-1 rounded text-xs font-bold text-amber-300 border border-amber-500/40">
                    BP {card.bp}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 右側詳細スペック＆効果テキスト */}
          <div className="flex-1 flex flex-col gap-2.5 w-full text-xs">
            {/* カード名・タイプ・BP */}
            <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-extrabold text-sm sm:text-base text-white">{card.name}</span>
                {card.bp !== null && (
                  <span className="px-2 py-0.5 rounded bg-amber-950 border border-amber-500/60 font-black text-amber-300 text-xs shadow">
                    BP {card.bp}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                <span>種別: <strong className="text-slate-200">{card.cardType}</strong></span>
                <span>•</span>
                <span>色: <strong className="text-purple-300">{card.color}</strong></span>
              </div>
            </div>

            {/* コスト / エナジー グリッド */}
            <div className="grid grid-cols-3 gap-1.5 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 text-center">
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400">APコスト</span>
                <span className="font-black text-sky-400 text-sm">{card.apCost}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400">必要エナジー</span>
                <span className="font-black text-amber-400 text-sm">{card.reqEnergy}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400">発生エナジー</span>
                <span className="font-black text-emerald-400 text-sm">+{card.genEnergy}</span>
              </div>
            </div>

            {/* 特徴 & トリガー */}
            {(card.traits.length > 0 || card.triggers.length > 0) && (
              <div className="flex flex-col gap-1.5 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                {card.traits.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] text-slate-400 font-semibold">特徴:</span>
                    {card.traits.map((trait, i) => (
                      <span
                        key={i}
                        className="bg-slate-800/90 text-slate-300 border border-slate-700 px-2 py-0.5 rounded-md text-[10px] font-medium"
                      >
                        {trait}
                      </span>
                    ))}
                  </div>
                )}
                {card.triggers.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-amber-400 font-semibold flex items-center gap-0.5">
                      <ShieldAlert className="w-3.5 h-3.5" />
                      トリガー:
                    </span>
                    {card.triggers.map((trig, i) => (
                      <span
                        key={i}
                        className="bg-gradient-to-r from-amber-600 to-amber-500 text-white font-black px-2.5 py-0.5 rounded-md text-[11px] shadow"
                      >
                        {trig}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* テキスト効果 */}
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs leading-relaxed text-slate-200 whitespace-pre-line shadow-inner max-h-40 overflow-y-auto scrollbar-thin">
              {card.effectText ? (
                <div>{card.effectText}</div>
              ) : (
                <div className="text-slate-500 italic">（通常効果テキストなし）</div>
              )}
            </div>
          </div>
        </div>

        {/* トリガーモーダル用アクションボタン */}
        {isTriggerModal && onDismissRevealed && (
          <div className="flex flex-col gap-2 pt-2 border-t border-slate-800">
            <span className="text-xs text-slate-400">
              公式ルール: トリガー処理後、カードは原則<strong>場外</strong>に置かれます（ゲットトリガー時のみ手札）：
            </span>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => onDismissRevealed('graveyard')}
                className="flex items-center justify-center gap-1.5 bg-rose-600 hover:bg-rose-500 text-white py-2 rounded-lg text-xs font-bold shadow-lg shadow-rose-600/30 ring-1 ring-rose-400 transition"
              >
                <Trash2 className="w-4 h-4" />
                場外へ送る (基本)
              </button>
              <button
                onClick={() => onDismissRevealed('hand')}
                className="flex items-center justify-center gap-1.5 bg-sky-700 hover:bg-sky-600 text-white py-2 rounded-lg text-xs font-bold transition"
              >
                <Hand className="w-4 h-4" />
                手札に加える
              </button>
              <button
                onClick={() => onDismissRevealed('life')}
                className="flex items-center justify-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg text-xs font-bold transition"
              >
                <ArrowLeft className="w-4 h-4" />
                ライフに戻す
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
