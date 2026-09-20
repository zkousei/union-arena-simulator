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
  isOpenHand?: boolean;
  canToggleHide?: boolean;
  title?: string;
  selectedCardId?: string | null;
  onSelectCard?: (card: Card) => void;
  onMoveTo?: (
    cardIndex: number,
    dest: 'graveyard' | 'removed' | 'deckTop' | 'deckBottom' | 'life' | 'lifeFaceUp' | 'frontLine' | 'energyLine'
  ) => void;
  onInspect?: (card: Card) => void;
  onHoverCard?: (card: Card | null) => void;
  onDropToHand?: (from: CardLocation) => void;
  onDiscardRandom?: () => void;
  onDiscardHandIndex?: (index: number) => void;
  onDiscardAll?: () => void;
  onOpenOpponentHandModal?: () => void;
  isCompact?: boolean;
}

export const HandArea: React.FC<HandAreaProps> = ({
  cards,
  playerId,
  isOpponent = false,
  isOpenHand,
  canToggleHide = false,
  title,
  selectedCardId,
  onSelectCard,
  onMoveTo,
  onInspect,
  onHoverCard,
  onDropToHand,
  onDiscardRandom,
  onDiscardHandIndex,
  onDiscardAll,
  onOpenOpponentHandModal,
  isCompact = false,
}) => {
  const [internalIsOpen, setInternalIsOpen] = useState<boolean>(isOpenHand ?? !isOpponent);
  const [isDragOver, setIsDragOver] = useState(false);
  const [confirmDiscardAll, setConfirmDiscardAll] = useState(false);

  React.useEffect(() => {
    if (isOpenHand !== undefined) {
      setInternalIsOpen(isOpenHand);
    }
  }, [isOpenHand]);

  const showOpen = !isOpponent || internalIsOpen;

  const handleDragOver = (e: React.DragEvent) => {
    if (!showOpen) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    if (!showOpen) return;
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

  if (!showOpen) {
    // 相手手札（非公開時）: 枚数と裏向きカード + ハンデス/公開ボタン
    return (
      <div className={`flex items-center justify-between gap-2 p-1.5 bg-slate-900/40 rounded-xl border border-slate-800/60 ${isCompact ? 'min-h-[36px] h-9 shrink-0' : 'min-h-[70px]'}`}>
        <div className="flex items-center gap-2">
          <div className={`${isCompact ? 'text-[11px]' : 'text-xs'} font-bold text-slate-400 flex items-center gap-1`}>
            <HandIcon className="w-3.5 h-3.5 text-indigo-400" />
            <span>{title || '相手手札'} ({cards.length}枚)</span>
          </div>

          <div className="flex items-center gap-1">
            {canToggleHide && (
              <button
                onClick={() => setInternalIsOpen(true)}
                className="flex items-center gap-1 px-2 py-1 bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 border border-indigo-500/40 rounded text-[10px] font-bold shadow transition-colors"
                title="手札を表向き（オープン）で表示します"
              >
                <Eye className="w-3 h-3" />
                手札を開く
              </button>
            )}

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
                if (canToggleHide) {
                  setInternalIsOpen(true);
                } else if (onOpenOpponentHandModal) {
                  onOpenOpponentHandModal();
                } else if (onDiscardHandIndex) {
                  onDiscardHandIndex(idx);
                }
              }}
              title={canToggleHide ? 'クリックで手札を開く' : 'クリックで相手手札の確認・ハンデスモーダルを開く'}
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
      role="region"
      aria-label={title || (isOpponent ? '相手の手札' : '自分の手札')}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex flex-col w-full rounded-xl border transition-all ${
        isCompact ? 'p-1 gap-0.5 shrink-0' : 'p-2.5 gap-1'
      } ${
        isDragOver
          ? 'bg-indigo-950/90 border-indigo-400 ring-2 ring-indigo-400 shadow-2xl scale-[1.01]'
          : 'bg-slate-900/80 border-indigo-500/20 shadow-xl'
      }`}
    >
      <div className={`flex items-center justify-between px-2 ${isCompact ? 'text-[11px] h-5' : 'text-xs'} font-semibold text-slate-400`}>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-indigo-300 font-bold">
            <HandIcon className="w-4 h-4" />
            {title || (isOpponent ? '相手の手札' : '自分の手札')} ({cards.length}枚)
          </span>

          {canToggleHide && (
            <button
              onClick={() => setInternalIsOpen(false)}
              className="flex items-center gap-1 px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 rounded text-[10px] transition-colors"
              title="手札を非表示（裏向き）に戻します"
            >
              🔒 隠す
            </button>
          )}

          {onDiscardRandom && cards.length > 0 && (
            <button
              onClick={onDiscardRandom}
              className="flex items-center gap-1 px-2 py-0.5 bg-rose-950/60 hover:bg-rose-900 border border-rose-500/30 rounded text-[10px] text-rose-300 font-bold transition-colors"
              title="ランダムに1枚を場外へ捨てる"
            >
              <Dices className="w-3 h-3" />
              ランダム破棄
            </button>
          )}

          {onDiscardAll && cards.length > 0 && (
            confirmDiscardAll ? (
              <div className="flex items-center gap-1 bg-rose-950/90 border border-rose-500/50 px-2 py-0.5 rounded animate-in fade-in">
                <span className="text-[10px] text-rose-200 font-bold">全破棄？</span>
                <button
                  onClick={() => {
                    onDiscardAll();
                    setConfirmDiscardAll(false);
                  }}
                  className="px-1.5 py-0.2 bg-rose-600 hover:bg-rose-500 rounded text-[9px] text-white font-extrabold"
                >
                  はい
                </button>
                <button
                  onClick={() => setConfirmDiscardAll(false)}
                  className="px-1.5 py-0.2 bg-slate-700 hover:bg-slate-600 rounded text-[9px] text-slate-300 font-bold"
                >
                  取消
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDiscardAll(true)}
                className="flex items-center gap-1 px-2 py-0.5 bg-rose-950/60 hover:bg-rose-900 border border-rose-500/30 rounded text-[10px] text-rose-300 font-bold transition-colors"
                title="手札を全て場外に置く（モダニア、クラウン、地鳴らし等）"
              >
                <Trash2 className="w-3 h-3" />
                全て捨てる
              </button>
            )
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

      <div className={`flex items-center overflow-x-auto px-1 scrollbar-thin ${
        isCompact
          ? 'h-[84px] min-h-[84px] lg:h-[90px] lg:min-h-[90px] py-0.5 gap-1'
          : 'min-h-[120px] sm:min-h-[150px] py-2 gap-2'
      }`}>
        {cards.length === 0 ? (
          <div className="w-full text-center py-4 text-slate-500 text-xs">
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
                  isCompact={isCompact}
                  accessibleLabel={`手札カード: ${card.name} (${
                    card.cardType === 'CHARACTER'
                      ? 'キャラクター'
                      : card.cardType === 'EVENT'
                        ? 'イベント'
                        : 'フィールド'
                  })`}
                  onClick={() => onSelectCard && onSelectCard(card)}
                  onInspect={onInspect}
                  onHoverCard={onHoverCard}
                  onMoveTo={(dest) => {
                    if (onMoveTo && dest !== 'hand') {
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
