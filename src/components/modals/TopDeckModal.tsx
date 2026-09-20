import React from 'react';
import { Card } from '../../types/card';
import { CardView } from '../board/CardView';
import { Eye, Hand, Trash2, ArrowUp, ArrowDown, Shuffle, X, ShieldAlert, ArrowUpRight } from 'lucide-react';

interface TopDeckModalProps {
  revealedDeck: {
    playerId: string;
    cards: Card[];
  } | null;
  myPlayerId: string;
  hasEmptyFrontSlot?: boolean;
  hasEmptyEnergySlot?: boolean;
  onResolveCard: (
    cardId: string,
    destination: 'hand' | 'handSecret' | 'graveyard' | 'top' | 'bottom' | 'life' | 'lifeFaceUp' | 'frontLine' | 'energyLine'
  ) => void;
  onInspectCard?: (card: Card) => void;
  onClose: (shuffleRemaining?: boolean) => void;
}

export const TopDeckModal: React.FC<TopDeckModalProps> = ({
  revealedDeck,
  myPlayerId,
  hasEmptyFrontSlot = false,
  hasEmptyEnergySlot = false,
  onResolveCard,
  onInspectCard,
  onClose,
}) => {
  if (!revealedDeck || revealedDeck.playerId !== myPlayerId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`山札の上から確認中 (${revealedDeck.cards.length} 枚)`}
        className="bg-slate-900 border-2 border-indigo-500/80 rounded-2xl max-w-5xl w-full max-h-[calc(100dvh-1rem)] sm:max-h-[92vh] p-3 sm:p-5 shadow-2xl flex flex-col min-h-0 gap-3 sm:gap-4 animate-in fade-in zoom-in-95 duration-200 my-auto"
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-sky-400" />
            <h3 className="font-bold text-base text-white">
              山札の上から確認中 ({revealedDeck.cards.length} 枚)
            </h3>
          </div>
          <button
            onClick={() => onClose(false)}
            className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white"
            title="閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-300">
          各カードの移動先を選択してください。手札（公開/非公開）・場外・山札上下・ライフ・フィールド登場に振り分けることができます：
        </p>

        {/* 公開カード一覧 & 個別アクション */}
        <div className="flex-1 min-h-0 flex items-start justify-center gap-3 sm:gap-4 flex-wrap py-2 sm:py-3 overflow-y-auto overflow-x-hidden scrollbar-thin">
          {revealedDeck.cards.map((card) => (
            <div
              key={card.id}
              className="flex flex-col items-center gap-2 bg-slate-950/80 p-2.5 rounded-xl border border-slate-800 shadow-md w-44 shrink-0"
            >
              <CardView card={card} onInspect={onInspectCard} />

              {/* 移動先ボタングループ */}
              <div className="flex flex-col gap-1 w-full text-[10px]">
                {/* 手札へ（公開 vs 非公開） */}
                <div className="grid grid-cols-2 gap-1">
                  <button
                    onClick={() => onResolveCard(card.id, 'hand')}
                    className="flex items-center justify-center gap-0.5 py-1 px-0.5 bg-sky-700 hover:bg-sky-600 rounded text-white font-bold text-[9px]"
                    title="相手に公開して手札に加える（特徴や名称等の条件指定があるカード用）"
                  >
                    <Eye className="w-2.5 h-2.5 shrink-0" />
                    <span className="truncate">手札(公開)</span>
                  </button>
                  <button
                    onClick={() => onResolveCard(card.id, 'handSecret')}
                    className="flex items-center justify-center gap-0.5 py-1 px-0.5 bg-slate-800 hover:bg-slate-700 border border-sky-500/40 rounded text-sky-200 font-bold text-[9px]"
                    title="相手に公開せず手札に加える（『カードを1枚手札に加える』など条件指定がないカード用）"
                  >
                    <Hand className="w-2.5 h-2.5 text-sky-400 shrink-0" />
                    <span className="truncate">手札(非公開)</span>
                  </button>
                </div>

                {/* 山札へ（上 vs 下） */}
                <div className="grid grid-cols-2 gap-1">
                  <button
                    onClick={() => onResolveCard(card.id, 'top')}
                    className="flex items-center justify-center gap-1 py-1 px-1 bg-slate-800 hover:bg-slate-700 rounded text-amber-300 font-bold text-[9.5px]"
                    title="山札の1番上に戻す"
                  >
                    <ArrowUp className="w-3 h-3 shrink-0" />
                    山札上
                  </button>
                  <button
                    onClick={() => onResolveCard(card.id, 'bottom')}
                    className="flex items-center justify-center gap-1 py-1 px-1 bg-slate-800 hover:bg-slate-700 rounded text-indigo-300 font-bold text-[9.5px]"
                    title="山札の1番下に送る"
                  >
                    <ArrowDown className="w-3 h-3 shrink-0" />
                    山札下
                  </button>
                </div>

                {/* 場外 & ライフ(裏) */}
                <div className="grid grid-cols-2 gap-1">
                  <button
                    onClick={() => onResolveCard(card.id, 'graveyard')}
                    className="flex items-center justify-center gap-1 py-1 px-1 bg-rose-700 hover:bg-rose-600 rounded text-white font-bold text-[9.5px]"
                    title="場外に置く"
                  >
                    <Trash2 className="w-3 h-3 shrink-0" />
                    場外へ
                  </button>
                  <button
                    onClick={() => onResolveCard(card.id, 'life')}
                    className="flex items-center justify-center gap-0.5 py-1 px-1 bg-rose-950/80 hover:bg-rose-900 border border-rose-500/40 rounded text-rose-300 font-bold text-[9.5px]"
                    title="裏向きでライフに置く"
                  >
                    <ShieldAlert className="w-3 h-3 text-rose-400 shrink-0" />
                    ライフ(裏)
                  </button>
                </div>

                {/* ライフ(表) */}
                <button
                  onClick={() => onResolveCard(card.id, 'lifeFaceUp')}
                  className="flex items-center justify-center gap-0.5 py-1 px-1 bg-amber-950/90 hover:bg-amber-900 border border-amber-500/60 rounded text-amber-300 font-bold text-[9.5px]"
                  title="表向きでライフに置く（ランカ・リー、オベリスク等）"
                >
                  <ShieldAlert className="w-3 h-3 text-amber-400 shrink-0" />
                  ライフ(表向き)
                </button>

                {hasEmptyFrontSlot && card.cardType === 'CHARACTER' && (
                  <button
                    onClick={() => onResolveCard(card.id, 'frontLine')}
                    className="flex items-center justify-center gap-1 py-1 px-2 bg-indigo-700 hover:bg-indigo-600 rounded text-white font-bold"
                    title="フロントラインに登場させる（グロースター等）"
                  >
                    <ArrowUpRight className="w-3 h-3" />
                    フロントLに出す
                  </button>
                )}

                {hasEmptyEnergySlot && card.cardType === 'CHARACTER' && (
                  <button
                    onClick={() => onResolveCard(card.id, 'energyLine')}
                    className="flex items-center justify-center gap-1 py-1 px-2 bg-emerald-700 hover:bg-emerald-600 rounded text-white font-bold"
                    title="エナジーラインに登場させる"
                  >
                    <ArrowUpRight className="w-3 h-3" />
                    エナジーLに出す
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* フッターアクション */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-3 border-t border-slate-800 text-xs shrink-0">
          <span className="text-slate-400">
            残りのカードは山札の上に戻されます。
          </span>
          <div className="grid grid-cols-1 sm:flex sm:items-center gap-2">
            <button
              onClick={() => onClose(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-700 hover:bg-indigo-600 text-white rounded-lg font-bold"
            >
              <Shuffle className="w-3.5 h-3.5" />
              残りを戻してシャッフル
            </button>
            <button
              onClick={() => onClose(false)}
              className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-bold"
            >
              完了（そのまま閉じる）
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
