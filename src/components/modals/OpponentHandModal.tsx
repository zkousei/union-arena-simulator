import React from 'react';
import { Card } from '../../types/card';
import { CardView } from '../board/CardView';
import { Hand, Trash2, X, Eye, ArrowUp, ArrowDown } from 'lucide-react';

interface OpponentHandModalProps {
  isOpen: boolean;
  cards: Card[];
  opponentName: string;
  onDiscardCard: (cardIndex: number) => void;
  onMoveOpponentHandCard?: (
    cardIndex: number,
    destination: 'deckTopFaceUp' | 'deckTop' | 'deckBottom' | 'graveyard'
  ) => void;
  onInspectCard?: (card: Card) => void;
  onClose: () => void;
}

export const OpponentHandModal: React.FC<OpponentHandModalProps> = ({
  isOpen,
  cards,
  opponentName,
  onDiscardCard,
  onMoveOpponentHandCard,
  onInspectCard,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border-2 border-amber-500/80 rounded-2xl max-w-4xl w-full p-5 shadow-2xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200">
        {/* ヘッダー */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                相手の手札公開・確認 ({opponentName})
                <span className="text-xs font-normal text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded-full border border-amber-500/40">
                  {cards.length}枚
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                カード効果（超能力、精神侵入、朝倉シン等）による手札公開、および指定ハンデスを行えます。
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

        {/* 手札カードグリッド */}
        <div className="flex items-center justify-center gap-3 flex-wrap py-3 overflow-y-auto max-h-[60vh]">
          {cards.length === 0 ? (
            <div className="text-sm text-slate-500 py-12 flex flex-col items-center gap-2">
              <Hand className="w-8 h-8 opacity-40" />
              <span>相手の手札はありません</span>
            </div>
          ) : (
            cards.map((card, index) => (
              <div
                key={`${card.id}-${index}`}
                className="flex flex-col items-center gap-2 bg-slate-950/90 p-2.5 rounded-xl border border-slate-800 shadow-lg"
              >
                <div className="text-[10px] font-bold text-slate-400">
                  #{index + 1}
                </div>
                <CardView card={card} onInspect={onInspectCard} />

                {/* アクションボタングループ */}
                <div className="flex flex-col gap-1 w-full text-[10px]">
                  <button
                    onClick={() => onDiscardCard(index)}
                    className="w-full flex items-center justify-center gap-1 py-1 px-2 bg-rose-700/80 hover:bg-rose-600 rounded text-white font-bold transition-colors shadow"
                    title="このカードを場外に捨てる（ハンデス）"
                  >
                    <Trash2 className="w-3 h-3" />
                    場外へ捨てる
                  </button>

                  {onMoveOpponentHandCard && (
                    <>
                      <button
                        onClick={() => onMoveOpponentHandCard(index, 'deckTopFaceUp')}
                        className="w-full flex items-center justify-center gap-1 py-1 px-1.5 bg-amber-950/90 hover:bg-amber-900 border border-amber-500/60 rounded text-amber-300 font-bold transition-colors shadow"
                        title="相手の山札の上に表向きで置く（朝倉シン等の効果）"
                      >
                        <Eye className="w-3 h-3 text-amber-400" />
                        山札上に表向きで置く
                      </button>

                      <div className="grid grid-cols-2 gap-1">
                        <button
                          onClick={() => onMoveOpponentHandCard(index, 'deckTop')}
                          className="flex items-center justify-center gap-0.5 py-1 px-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-200 font-semibold transition-colors"
                          title="相手の山札の上に戻す"
                        >
                          <ArrowUp className="w-2.5 h-2.5 text-indigo-400" />
                          山札上
                        </button>
                        <button
                          onClick={() => onMoveOpponentHandCard(index, 'deckBottom')}
                          className="flex items-center justify-center gap-0.5 py-1 px-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-200 font-semibold transition-colors"
                          title="相手の山札の下に戻す"
                        >
                          <ArrowDown className="w-2.5 h-2.5 text-indigo-400" />
                          山札下
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* フッター */}
        <div className="border-t border-slate-800 pt-3 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-bold text-slate-300 transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
