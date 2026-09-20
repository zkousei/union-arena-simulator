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
  selectedCardId?: string | null;
  onSlotClick?: (slotIndex: FieldSlotIndex) => void;
  onToggleRest?: (slotIndex: FieldSlotIndex) => void;
  onModifyBp?: (slotIndex: FieldSlotIndex, delta: number) => void;
  onToggleFreeze?: (slotIndex: FieldSlotIndex) => void;
  onAddMarker?: (slotIndex: FieldSlotIndex, from: 'deckTop' | 'hand') => void;
  onMoveTo?: (slotIndex: FieldSlotIndex, dest: 'frontLine' | 'energyLine' | 'graveyard' | 'hand' | 'removed' | 'deckTop' | 'deckBottom') => void;
  onInspect?: (card: Card) => void;
  onDropCard?: (from: CardLocation, targetZone: 'frontLine' | 'energyLine', slotIndex: FieldSlotIndex) => void;
  onDeclareAttack?: (slotIndex: FieldSlotIndex) => void;
  onOpenUnderCards?: (slotIndex: FieldSlotIndex, card: Card) => void;
  extraHeaderBadge?: React.ReactNode;
}

export const FieldZone: React.FC<FieldZoneProps> = ({
  title,
  zone,
  slots,
  playerId,
  isOpponent = false,
  selectedCardId,
  onSlotClick,
  onToggleRest,
  onModifyBp,
  onToggleFreeze,
  onAddMarker,
  onMoveTo,
  onInspect,
  onDropCard,
  onDeclareAttack,
  onOpenUnderCards,
  extraHeaderBadge,
}) => {
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);

  const handleDragOver = (e: React.DragEvent, slotIdx: number) => {
    if (isOpponent) return;
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
    if (isOpponent) return;
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
    <div className="flex flex-col gap-1 w-full max-w-4xl mx-auto">
      <div className="flex items-center justify-between px-2">
        <span className="text-xs font-semibold text-slate-400 tracking-wider">
          {title}
        </span>
        {extraHeaderBadge && (
          <div>{extraHeaderBadge}</div>
        )}
      </div>

      <div className="grid grid-cols-4 gap-2 sm:gap-3 p-2 bg-slate-900/60 rounded-xl border border-slate-800/80 shadow-inner">
        {slots.map((card, index) => {
          const slotIdx = index as FieldSlotIndex;
          const isOver = dragOverSlot === index;

          return (
            <div
              key={index}
              id={`slot-${playerId}-${zone}-${index}`}
              onClick={() => onSlotClick && onSlotClick(slotIdx)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={(e) => handleDragLeave(e, index)}
              onDrop={(e) => handleDrop(e, slotIdx)}
              className={`min-h-[116px] sm:min-h-[140px] md:min-h-[164px] rounded-lg border-2 border-dashed flex items-center justify-center relative transition-all ${
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
                  isOpponent={isOpponent}
                  onToggleRest={() => onToggleRest && onToggleRest(slotIdx)}
                  onModifyBp={(delta) => onModifyBp && onModifyBp(slotIdx, delta)}
                  onToggleFreeze={() => onToggleFreeze && onToggleFreeze(slotIdx)}
                  onAddMarker={(from) => onAddMarker && onAddMarker(slotIdx, from)}
                  onMoveTo={(dest) => onMoveTo && onMoveTo(slotIdx, dest)}
                  onInspect={onInspect}
                  onDeclareAttack={() => onDeclareAttack && onDeclareAttack(slotIdx)}
                  onOpenUnderCards={() => onOpenUnderCards && onOpenUnderCards(slotIdx, card)}
                />
              ) : (
                <div className="flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-xs font-bold text-slate-600">枠 {index + 1}</span>
                  {selectedCardId && (
                    <span className="text-[10px] text-indigo-400 mt-1">ここへ配置</span>
                  )}
                  {isOver && (
                    <span className="text-[10px] text-indigo-300 font-bold mt-1">ドロップで配置</span>
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
