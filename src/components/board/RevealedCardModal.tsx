import React from 'react';
import { Card } from '../../types/card';
import { Sparkles, Hand, Trash2, ArrowLeft } from 'lucide-react';

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
  const card = revealed ? revealed.card : inspectCard;
  const isTriggerModal = !!revealed;

  if (!card) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border-2 border-indigo-500/60 rounded-2xl max-w-md w-full p-5 shadow-2xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200">
        {/* ヘッダー */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-base text-slate-100">
              {isTriggerModal ? `⚡ ${revealed.source}` : 'カード情報詳細'}
            </h3>
          </div>
          {!isTriggerModal && (
            <button
              onClick={onCloseInspect}
              className="text-slate-400 hover:text-white text-sm px-2 py-1 bg-slate-800 rounded"
            >
              閉じる
            </button>
          )}
        </div>

        {/* カード基本情報 */}
        <div className="flex gap-4">
          <div className="w-28 sm:w-32 flex-shrink-0 bg-slate-950 border border-slate-700 rounded-xl p-3 flex flex-col justify-between items-center text-center">
            <div className="text-xs font-bold text-indigo-300">{card.code}</div>
            <div className="my-2">
              <div className="text-sm font-bold text-white">{card.name}</div>
              <div className="text-xs text-slate-400">[{card.cardType}]</div>
            </div>
            {card.bp !== null && (
              <div className="bg-slate-800 px-2 py-1 rounded text-xs font-bold text-amber-300">
                BP {card.bp}
              </div>
            )}
          </div>

          <div className="flex-1 flex flex-col gap-2 text-xs">
            <div className="grid grid-cols-2 gap-1.5 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
              <div>
                <span className="text-slate-400">APコスト: </span>
                <span className="font-bold text-sky-400">{card.apCost}</span>
              </div>
              <div>
                <span className="text-slate-400">必要エナジー: </span>
                <span className="font-bold text-amber-400">{card.reqEnergy}</span>
              </div>
              <div>
                <span className="text-slate-400">発生エナジー: </span>
                <span className="font-bold text-emerald-400">+{card.genEnergy}</span>
              </div>
              <div>
                <span className="text-slate-400">色: </span>
                <span className="font-bold text-purple-400">{card.color}</span>
              </div>
            </div>

            {card.traits.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-slate-400">特徴:</span>
                {card.traits.map((trait, i) => (
                  <span key={i} className="bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded text-[10px]">
                    {trait}
                  </span>
                ))}
              </div>
            )}

            {card.triggers.length > 0 && (
              <div className="flex items-center gap-1">
                <span className="text-slate-400">トリガー:</span>
                {card.triggers.map((trig, i) => (
                  <span key={i} className="bg-amber-600/80 text-white font-bold px-2 py-0.5 rounded text-[11px]">
                    {trig}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* テキスト効果 */}
        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs leading-relaxed text-slate-300 whitespace-pre-line">
          {card.effectText || '（通常効果なし）'}
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
                className="flex items-center justify-center gap-1 bg-rose-600 hover:bg-rose-500 text-white py-2 rounded-lg text-xs font-bold shadow-lg shadow-rose-600/30 ring-1 ring-rose-400"
              >
                <Trash2 className="w-4 h-4" />
                場外へ送る (基本)
              </button>
              <button
                onClick={() => onDismissRevealed('hand')}
                className="flex items-center justify-center gap-1 bg-sky-700 hover:bg-sky-600 text-white py-2 rounded-lg text-xs font-bold"
              >
                <Hand className="w-4 h-4" />
                手札に加える
              </button>
              <button
                onClick={() => onDismissRevealed('life')}
                className="flex items-center justify-center gap-1 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg text-xs font-bold"
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
