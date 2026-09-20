import React from 'react';
import { Card } from '../../types/card';
import { CardView } from '../board/CardView';
import { Ban, Hand, Skull, ArrowDown, ArrowUpRight, X, ShieldAlert } from 'lucide-react';

interface RemovedModalProps {
  isOpen: boolean;
  cards: Card[];
  playerName: string;
  isOpponent?: boolean;
  hasEmptyFrontSlot?: boolean;
  hasEmptyEnergySlot?: boolean;
  onMoveCard: (
    cardId: string,
    destination: 'hand' | 'graveyard' | 'deckBottom' | 'frontLine' | 'energyLine' | 'life' | 'lifeFaceUp'
  ) => void;
  onInspectCard: (card: Card) => void;
  onClose: () => void;
}

export const RemovedModal: React.FC<RemovedModalProps> = ({
  isOpen,
  cards,
  playerName,
  isOpponent = false,
  hasEmptyFrontSlot = false,
  hasEmptyEnergySlot = false,
  onMoveCard,
  onInspectCard,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border-2 border-purple-500/60 rounded-2xl max-w-4xl w-full max-h-[85vh] flex flex-col p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* ヘッダー */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Ban className="w-5 h-5 text-purple-400" />
            <h3 className="font-bold text-base text-white flex items-center gap-2">
              {playerName} の除外（リムーブエリア）一覧
              <span className="text-xs font-normal text-purple-300 bg-purple-950/80 px-2.5 py-0.5 rounded-full border border-purple-500/40">
                {cards.length} 枚
              </span>
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 説明 */}
        {!isOpponent && (
          <p className="text-xs text-slate-300 mt-2">
            リムーブエリアからカードを回収、場外へ戻す、または山札下に戻すことができます：
          </p>
        )}

        {/* カード一覧 */}
        <div className="flex-1 overflow-y-auto p-2 flex flex-wrap gap-4 justify-center my-3 min-h-[220px]">
          {cards.length === 0 ? (
            <div className="text-slate-500 py-12 text-center text-xs flex flex-col items-center gap-2">
              <Ban className="w-8 h-8 opacity-30" />
              除外（リムーブ）されたカードはありません
            </div>
          ) : (
            cards.map((card, idx) => (
              <div
                key={`${card.id}-${idx}`}
                className="flex flex-col items-center gap-2 bg-slate-950/90 p-2.5 rounded-xl border border-slate-800 shadow-md"
              >
                <CardView card={card} onInspect={onInspectCard} />

                {/* アクションボタングループ (自分のみ) */}
                {!isOpponent && (
                  <div className="flex flex-col gap-1 w-full text-[10px] mt-1">
                    <div className="grid grid-cols-2 gap-1">
                      <button
                        onClick={() => onMoveCard(card.id, 'hand')}
                        className="flex items-center justify-center gap-1 py-1 px-1.5 bg-sky-700 hover:bg-sky-600 rounded text-white font-bold transition-colors"
                        title="手札に加える"
                      >
                        <Hand className="w-3 h-3" />
                        手札へ
                      </button>
                      <button
                        onClick={() => onMoveCard(card.id, 'graveyard')}
                        className="flex items-center justify-center gap-1 py-1 px-1.5 bg-rose-700 hover:bg-rose-600 rounded text-white font-bold transition-colors"
                        title="場外へ戻す"
                      >
                        <Skull className="w-3 h-3" />
                        場外へ
                      </button>
                    </div>

                    <button
                      onClick={() => onMoveCard(card.id, 'deckBottom')}
                      className="flex items-center justify-center gap-1 py-1 px-2 bg-slate-800 hover:bg-slate-700 rounded text-slate-200 font-semibold transition-colors"
                      title="山札の一番下に戻す"
                    >
                      <ArrowDown className="w-3 h-3 text-indigo-400" />
                      山札の一番下へ
                    </button>

                    <div className="grid grid-cols-2 gap-1">
                      <button
                        onClick={() => onMoveCard(card.id, 'lifeFaceUp')}
                        className="flex items-center justify-center gap-0.5 py-1 px-1 bg-amber-950/90 hover:bg-amber-900 border border-amber-500/60 rounded text-amber-300 font-bold transition-colors"
                        title="ライフに表向きで置く"
                      >
                        <ShieldAlert className="w-3 h-3 text-amber-400" />
                        ライフ(表)
                      </button>
                      <button
                        onClick={() => onMoveCard(card.id, 'life')}
                        className="flex items-center justify-center gap-0.5 py-1 px-1 bg-rose-950/80 hover:bg-rose-900 border border-rose-500/40 rounded text-rose-300 font-bold transition-colors"
                        title="ライフに裏向きで置く"
                      >
                        <ShieldAlert className="w-3 h-3 text-rose-400" />
                        ライフ(裏)
                      </button>
                    </div>

                    {hasEmptyFrontSlot && card.cardType === 'CHARACTER' && (
                      <button
                        onClick={() => onMoveCard(card.id, 'frontLine')}
                        className="flex items-center justify-center gap-1 py-1 px-2 bg-indigo-700 hover:bg-indigo-600 rounded text-white font-bold transition-colors"
                        title="フロントLの空き枠に出す"
                      >
                        <ArrowUpRight className="w-3 h-3" />
                        フロントLに出す
                      </button>
                    )}

                    {hasEmptyEnergySlot && card.cardType === 'CHARACTER' && (
                      <button
                        onClick={() => onMoveCard(card.id, 'energyLine')}
                        className="flex items-center justify-center gap-1 py-1 px-2 bg-emerald-700 hover:bg-emerald-600 rounded text-white font-bold transition-colors"
                        title="エナジーLの空き枠に出す"
                      >
                        <ArrowUpRight className="w-3 h-3" />
                        エナジーLに出す
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* フッター */}
        <div className="pt-3 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-bold text-slate-200 transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
