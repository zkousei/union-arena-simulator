import React, { useState } from 'react';
import { Card } from '../../types/card';
import { CardLocation } from '../../types/game';
import { DND_MIME_TYPE, DragCardPayload } from '../../types/dnd';
import { CardView } from './CardView';
import { Hand as HandIcon, Eye, Dices, Trash2 } from 'lucide-react';

interface HandAreaProps {
  cards: Card[];
  playerId: string;
  isOpponent?: boolean;
  selectedCardId?: string | null;
  onSelectCard?: (card: Card) => void;
  onMoveTo?: (
    cardIndex: number,
    dest: 'graveyard' | 'removed' | 'deckTop' | 'deckBottom' | 'life' | 'lifeFaceUp'
  ) => void;
  onInspect?: (card: Card) => void;
  onDropToHand?: (from: CardLocation) => void;
  onDiscardRandom?: () => void;
  onDiscardHandIndex?: (index: number) => void;
  onDiscardAll?: () => void;
  onOpenOpponentHandModal?: () => void;
}

export const HandArea: React.FC<HandAreaProps> = ({
  cards,
  playerId,
  isOpponent = false,
  selectedCardId,
  onSelectCard,
  onMoveTo,
  onInspect,
  onDropToHand,
  onDiscardRandom,
  onDiscardHandIndex,
  onDiscardAll,
  onOpenOpponentHandModal,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    if (isOpponent) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    if (isOpponent) return;
    e.preventDefault();
    setIsDragOver(false);

    try {
      const raw = e.dataTransfer.getData(DND_MIME_TYPE);
      if (!raw) return;
      const payload = JSON.parse(raw) as DragCardPayload;
      if (onDropToHand && payload.from.zone !== 'hand') {
        onDropToHand(payload.from);
      }
    } catch (err) {
      console.error('Failed to parse dropped card data:', err);
    }
  };

  if (isOpponent) {
    // 相手手札: 枚数と裏向きカード + ハンデス/公開ボタン
    return (
      <div className="flex items-center justify-between gap-2 p-2 bg-slate-900/40 rounded-xl border border-slate-800/60 min-h-[70px]">
        <div className="flex items-center gap-2">
          <div className="text-xs font-bold text-slate-400 flex items-center gap-1">
            <HandIcon className="w-3.5 h-3.5 text-indigo-400" />
            <span>相手手札 ({cards.length}枚)</span>
          </div>

          <div className="flex items-center gap-1">
            {onDiscardRandom && cards.length > 0 && (
              <button
                onClick={onDiscardRandom}
                className="flex items-center gap-1 px-2 py-1 bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-500/40 rounded text-[10px] font-bold shadow transition-colors"
                title="相手の手札からランダムに1枚を場外へ捨てる（ハンデス効果）"
              >
                <Dices className="w-3 h-3" />
                ランダム破棄
              </button>
            )}

            {onOpenOpponentHandModal && cards.length > 0 && (
              <button
                onClick={onOpenOpponentHandModal}
                className="flex items-center gap-1 px-2 py-1 bg-amber-950/80 hover:bg-amber-900 text-amber-300 border border-amber-500/40 rounded text-[10px] font-bold shadow transition-colors"
                title="効果によって相手の手札を公開・確認する"
              >
                <Eye className="w-3 h-3" />
                手札を見る
              </button>
            )}
          </div>
        </div>

        <div className="flex -space-x-10 overflow-hidden py-1">
          {cards.map((_, idx) => (
            <div
              key={idx}
              onClick={() => {
                if (onDiscardHandIndex && window.confirm(`相手の手札 #${idx + 1} を場外へ捨てさせますか？（ハンデス）`)) {
                  onDiscardHandIndex(idx);
                }
              }}
              title="クリックでこの手札を場外へ捨てる（指定ハンデス）"
              className="w-12 h-16 rounded border border-slate-700 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center text-[10px] text-indigo-400/70 font-bold shadow hover:scale-105 hover:border-amber-400 cursor-pointer transition-transform"
            >
              UA
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex flex-col gap-1 w-full p-2.5 rounded-2xl border transition-all ${
        isDragOver
          ? 'bg-indigo-950/90 border-indigo-400 ring-2 ring-indigo-400 shadow-2xl scale-[1.01]'
          : 'bg-slate-900/80 border-indigo-500/20 shadow-xl'
      }`}
    >
      <div className="flex items-center justify-between px-2 text-xs font-semibold text-slate-400">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-indigo-300 font-bold">
            <HandIcon className="w-4 h-4" />
            自分の手札 ({cards.length}枚)
          </span>
          {onDiscardAll && cards.length > 0 && (
            <button
              onClick={() => {
                if (window.confirm('手札すべてを場外へ置きますか？（モダニア、クラウン等の効果）')) {
                  onDiscardAll();
                }
              }}
              className="flex items-center gap-1 px-2 py-0.5 bg-rose-950/60 hover:bg-rose-900 border border-rose-500/30 rounded text-[10px] text-rose-300 font-bold transition-colors"
              title="手札を全て場外に置く（モダニア、クラウン、地鳴らし等）"
            >
              <Trash2 className="w-3 h-3" />
              全て捨てる
            </button>
          )}
        </div>
        {isDragOver ? (
          <span className="text-emerald-400 text-[11px] font-bold animate-pulse">
            ドロップして手札に戻す
          </span>
        ) : selectedCardId ? (
          <span className="text-amber-400 text-[11px] animate-pulse">
            カード選択中: フィールドの枠をクリックして配置
          </span>
        ) : (
          <span className="text-slate-500 text-[10px]">
            ※ カードを直接ドラッグしてフィールドへ配置できます
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 overflow-x-auto py-2 px-1 min-h-[120px] sm:min-h-[150px] scrollbar-thin">
        {cards.length === 0 ? (
          <div className="w-full text-center py-6 text-slate-500 text-xs">
            手札がありません。「山札から引く」または「デッキセットアップ」を行ってください。
          </div>
        ) : (
          cards.map((card, idx) => {
            const isSelected = selectedCardId === card.id;
            return (
              <div
                key={card.id}
                className={`flex-shrink-0 transition-transform ${
                  isSelected ? '-translate-y-3 ring-2 ring-amber-400 rounded-lg' : ''
                }`}
              >
                <CardView
                  card={card}
                  location={{ playerId, zone: 'hand', index: idx }}
                  onClick={() => onSelectCard && onSelectCard(card)}
                  onInspect={onInspect}
                  onMoveTo={(dest) => {
                    if (onMoveTo && (dest === 'graveyard' || dest === 'removed' || dest === 'deckTop' || dest === 'deckBottom' || dest === 'life' || dest === 'lifeFaceUp')) {
                      onMoveTo(idx, dest);
                    }
                  }}
                />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
