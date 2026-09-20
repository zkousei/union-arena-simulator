import React, { useState } from 'react';
import { Card } from '../../types/card';
import { FieldSlotIndex, CardLocation } from '../../types/game';
import { DND_MIME_TYPE, DragCardPayload } from '../../types/dnd';
import { CardView } from './CardView';

interface FieldZoneProps {
  title: string;
  zone: 'frontLine' | 'energyLine';
  slots: (Card | null)[];
  playerId: string;
  isOpponent?: boolean;
  isControllable?: boolean;
  selectedCardId?: string | null;
  onSlotClick?: (slotIndex: FieldSlotIndex) => void;
  onToggleRest?: (slotIndex: FieldSlotIndex) => void;
  onModifyBp?: (slotIndex: FieldSlotIndex, delta: number) => void;
  onToggleFreeze?: (slotIndex: FieldSlotIndex) => void;
  onAddMarker?: (slotIndex: FieldSlotIndex, from: 'deckTop' | 'hand') => void;
  onMoveTo?: (
    slotIndex: FieldSlotIndex,
    dest:
      | 'frontLine'
      | 'energyLine'
      | 'graveyard'
      | 'hand'
      | 'removed'
      | 'deckTop'
      | 'deckBottom'
      | 'life'
      | 'lifeFaceUp'
  ) => void;
  onInspect?: (card: Card) => void;
  onHoverCard?: (card: Card | null) => void;
  onDropCard?: (from: CardLocation, targetZone: 'frontLine' | 'energyLine', slotIndex: FieldSlotIndex) => void;
  onDeclareAttack?: (slotIndex: FieldSlotIndex) => void;
  onDirectAttack?: (slotIndex: FieldSlotIndex) => void;
  onOpenUnderCards?: (slotIndex: FieldSlotIndex, card: Card) => void;
  extraHeaderBadge?: React.ReactNode;
  isCompact?: boolean;
}

export const FieldZone: React.FC<FieldZoneProps> = ({
  title,
  zone,
  slots,
  playerId,
  isOpponent = false,
  isControllable = false,
  selectedCardId,
  onSlotClick,
  onToggleRest,
  onModifyBp,
  onToggleFreeze,
  onAddMarker,
  onMoveTo,
  onInspect,
  onHoverCard,
  onDropCard,
  onDeclareAttack,
  onDirectAttack,
  onOpenUnderCards,
  extraHeaderBadge,
  isCompact = false,
}) => {
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);
  const canControl = isControllable || !isOpponent;

  const handleDragOver = (e: React.DragEvent, slotIdx: number) => {
    if (!canControl) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverSlot !== slotIdx) {
      setDragOverSlot(slotIdx);
    }
  };

  const handleDragLeave = (_e: React.DragEvent, slotIdx: number) => {
    if (dragOverSlot === slotIdx) {
      setDragOverSlot(null);
    }
  };

  const handleDrop = (e: React.DragEvent, slotIdx: FieldSlotIndex) => {
    if (!canControl) return;
    e.preventDefault();
    setDragOverSlot(null);

    try {
      const raw = e.dataTransfer.getData(DND_MIME_TYPE);
      if (!raw) return;
      const payload = JSON.parse(raw) as DragCardPayload;
      if (onDropCard) {
        onDropCard(payload.from, zone, slotIdx);
      }
    } catch (err) {
      console.error('Failed to parse dropped card data:', err);
    }
  };

  return (
    <div className={`flex flex-col w-full max-w-4xl mx-auto ${isCompact ? 'gap-0.5 shrink-0' : 'gap-1'}`}>
      <div className={`flex items-center justify-between px-2 ${isCompact ? 'h-5 py-0' : 'py-0.5'}`}>
        <span className={`${isCompact ? 'text-[11px]' : 'text-xs'} font-semibold text-slate-400 tracking-wider`}>
          {title}
        </span>
        {extraHeaderBadge && (
          <div>{extraHeaderBadge}</div>
        )}
      </div>

      <div className={`grid grid-cols-4 p-1 bg-slate-900/60 rounded-xl border border-slate-800/80 shadow-inner ${
        isCompact ? 'gap-1 sm:gap-1.5' : 'gap-2 sm:gap-3 p-2'
      }`}>
        {slots.map((card, index) => {
          const slotIdx = index as FieldSlotIndex;
          const isOver = dragOverSlot === index;

          return (
            <div
              key={index}
              id={`slot-${playerId}-${zone}-${index}`}
              onClick={(e) => {
                e.stopPropagation();
                onSlotClick?.(slotIdx);
              }}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={(e) => handleDragLeave(e, index)}
              onDrop={(e) => handleDrop(e, slotIdx)}
              className={`rounded-lg border-2 border-dashed flex items-center justify-center relative transition-all ${
                isCompact
                  ? 'h-[82px] min-h-[82px] lg:h-[88px] lg:min-h-[88px]'
                  : 'min-h-[116px] sm:min-h-[140px] md:min-h-[164px]'
              } ${
                isOver
                  ? 'border-indigo-400 bg-indigo-900/40 ring-2 ring-indigo-400 scale-105 shadow-xl'
                  : card
                  ? 'border-transparent'
                  : selectedCardId
                  ? 'border-indigo-400/60 bg-indigo-950/20 hover:border-indigo-300 hover:bg-indigo-900/30 cursor-pointer animate-pulse'
                  : 'border-slate-700/60 bg-slate-950/30 text-slate-500'
              }`}
            >
              {card ? (
                <CardView
                  card={card}
                  location={{ playerId, zone, slotIndex: slotIdx }}
                  isOpponent={!canControl}
                  isCompact={isCompact}
                  onToggleRest={() => onToggleRest && onToggleRest(slotIdx)}
                  onModifyBp={(delta) => onModifyBp && onModifyBp(slotIdx, delta)}
                  onToggleFreeze={() => onToggleFreeze && onToggleFreeze(slotIdx)}
                  onAddMarker={(from) => onAddMarker && onAddMarker(slotIdx, from)}
                  onMoveTo={(dest) => onMoveTo && onMoveTo(slotIdx, dest)}
                  onInspect={onInspect}
                  onHoverCard={onHoverCard}
                  onDeclareAttack={() => onDeclareAttack && onDeclareAttack(slotIdx)}
                  onDirectAttack={() => onDirectAttack && onDirectAttack(slotIdx)}
                  onOpenUnderCards={() => onOpenUnderCards && onOpenUnderCards(slotIdx, card)}
                />
              ) : (
                <div className="flex flex-col items-center justify-center pointer-events-none">
                  <span className={`${isCompact ? 'text-[10px]' : 'text-xs'} font-bold text-slate-600`}>枠 {index + 1}</span>
                  {selectedCardId && (
                    <span className="text-[9px] text-indigo-400 mt-0.5">ここへ配置</span>
                  )}
                  {isOver && (
                    <span className="text-[9px] text-indigo-300 font-bold mt-0.5">ドロップ</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
