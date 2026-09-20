import React, { useState, useEffect } from 'react';
import { Card } from '../../types/card';
import { CardView } from '../board/CardView';
import { ShieldAlert, ArrowUp, ArrowDown, Check, X, Eye } from 'lucide-react';

interface LifeReorderModalProps {
  isOpen: boolean;
  lifeCards: Card[];
  playerName: string;
  onConfirmReorder: (newCards: Card[]) => void;
  onClose: () => void;
}

export const LifeReorderModal: React.FC<LifeReorderModalProps> = ({
  isOpen,
  lifeCards,
  playerName,
  onConfirmReorder,
  onClose,
}) => {
  const [cards, setCards] = useState<Card[]>([]);

  useEffect(() => {
    if (isOpen) {
      // 複製して初期化
      setCards([...lifeCards]);
    }
  }, [isOpen, lifeCards]);

  if (!isOpen) return null;

  const moveCard = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= cards.length) return;
    const next = [...cards];
    const [item] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, item);
    setCards(next);
  };

  const handleSave = () => {
    onConfirmReorder(cards);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border-2 border-rose-500/80 rounded-2xl max-w-4xl w-full p-5 shadow-2xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh]">
        {/* ヘッダー */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-rose-400" />
            <div>
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                ライフ確認・並び替え ({playerName})
                <span className="text-xs font-normal text-rose-300 bg-rose-950/80 px-2 py-0.5 rounded-full border border-rose-500/40">
                  {cards.length}枚
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                サー・ナイトアイ等の効果で、自分のライフのカードを全て確認し、望む順序に並び替えることができます。
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

        {/* ライフカード並び替えリスト */}
        <div className="flex items-center justify-start gap-3 overflow-x-auto py-3 px-1 scrollbar-thin">
          {cards.length === 0 ? (
            <div className="text-sm text-slate-500 py-12 text-center w-full">
              ライフエリアにカードがありません
            </div>
          ) : (
            cards.map((card, index) => {
              const isFaceDown = card.isFaceDown !== false;
              const isFirst = index === 0;
              const isLast = index === cards.length - 1;

              return (
                <div
                  key={`${card.id}-${index}`}
                  className={`flex flex-col items-center gap-2 bg-slate-950/90 p-2.5 rounded-xl border shadow-lg relative shrink-0 transition-all ${
                    !isFaceDown
                      ? 'border-amber-500/60 ring-1 ring-amber-500/40'
                      : 'border-rose-900/60'
                  }`}
                >
                  <div className="flex items-center justify-between w-full text-[11px] font-bold px-1">
                    <span className="text-rose-400">
                      #{index + 1} {isFirst ? '(最上面)' : isLast ? '(最下面)' : ''}
                    </span>
                    <span
                      className={`text-[9px] px-1 rounded ${
                        !isFaceDown
                          ? 'bg-amber-950 text-amber-300 border border-amber-500/40'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {!isFaceDown ? '表向き' : '裏向き'}
                    </span>
                  </div>

                  {/* カードビュー（確認用として表向きで描画） */}
                  <div className="relative">
                    <CardView card={{ ...card, isFaceDown: false }} />
                  </div>

                  {/* 順序変更ボタングループ */}
                  <div className="grid grid-cols-2 gap-1 w-full mt-1">
                    <button
                      onClick={() => moveCard(index, index - 1)}
                      disabled={isFirst}
                      className="flex items-center justify-center gap-0.5 py-1 px-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 rounded text-slate-200 text-[10px] font-bold transition-colors"
                      title="上（先頭側）へ移動"
                    >
                      <ArrowUp className="w-3 h-3 text-rose-400" />
                      上へ
                    </button>
                    <button
                      onClick={() => moveCard(index, index + 1)}
                      disabled={isLast}
                      className="flex items-center justify-center gap-0.5 py-1 px-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 rounded text-slate-200 text-[10px] font-bold transition-colors"
                      title="下（末尾側）へ移動"
                    >
                      <ArrowDown className="w-3 h-3 text-rose-400" />
                      下へ
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* フッター */}
        <div className="border-t border-slate-800 pt-3 flex items-center justify-between">
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <Eye className="w-3.5 h-3.5 text-rose-400" />
            ※ 並び替え後も、各カードの表向き・裏向き状態はそのまま維持されます。
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-bold text-slate-300 transition-colors"
            >
              キャンセル
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-500 rounded-lg text-xs font-bold text-white shadow-lg shadow-rose-600/30 transition-colors"
            >
              <Check className="w-4 h-4" />
              この順序で確定する
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
