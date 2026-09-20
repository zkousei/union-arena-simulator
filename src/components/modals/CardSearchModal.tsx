import React, { useState } from 'react';
import { Card } from '../../types/card';
import { CardView } from '../board/CardView';
import { Search, Hand, Trash2, Shuffle, X } from 'lucide-react';

interface CardSearchModalProps {
  isOpen: boolean;
  cards: Card[];
  title?: string;
  onSelectCard: (cardId: string, destination: 'hand' | 'graveyard') => void;
  onClose: (shuffleDeck?: boolean) => void;
}

export const CardSearchModal: React.FC<CardSearchModalProps> = ({
  isOpen,
  cards,
  title = '山札からカードを探す',
  onSelectCard,
  onClose,
}) => {
  const [query, setQuery] = useState('');

  if (!isOpen) return null;

  const filteredCards = cards.filter((c) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    const matchName = c.name.toLowerCase().includes(q);
    const matchCode = c.code.toLowerCase().includes(q);
    const matchTraits = c.traits.some((t) => t.toLowerCase().includes(q));
    const matchType = c.cardType.toLowerCase().includes(q);
    const matchEffect = c.effectText.toLowerCase().includes(q);
    return matchName || matchCode || matchTraits || matchType || matchEffect;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border-2 border-indigo-500/80 rounded-2xl max-w-5xl w-full max-h-[85vh] flex flex-col p-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* ヘッダー */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Search className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-base text-white">
              {title} ({filteredCards.length} / {cards.length} 枚)
            </h3>
          </div>
          <button
            onClick={() => onClose(false)}
            className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 検索入力バー */}
        <div className="py-2.5">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="カード名、特徴（例: 生徒会, 黒の騎士団）、種類、テキストで検索..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* カード一覧 */}
        <div className="flex-1 overflow-y-auto p-2 flex flex-wrap gap-3 justify-center scrollbar-thin">
          {filteredCards.length === 0 ? (
            <div className="text-slate-500 py-12 text-center text-xs">
              該当するカードが見つかりません
            </div>
          ) : (
            filteredCards.map((card) => (
              <div
                key={card.id}
                className="flex flex-col items-center gap-2 bg-slate-950/80 p-2 rounded-xl border border-slate-800 shadow hover:border-indigo-500/60 transition"
              >
                <CardView card={card} />
                <div className="flex items-center gap-1.5 w-full text-[10px]">
                  <button
                    onClick={() => onSelectCard(card.id, 'hand')}
                    className="flex-1 flex items-center justify-center gap-1 py-1 bg-sky-700 hover:bg-sky-600 rounded text-white font-bold"
                    title="手札に加える"
                  >
                    <Hand className="w-3 h-3" />
                    手札へ
                  </button>
                  <button
                    onClick={() => onSelectCard(card.id, 'graveyard')}
                    className="flex-1 flex items-center justify-center gap-1 py-1 bg-rose-700 hover:bg-rose-600 rounded text-white font-bold"
                    title="場外に置く"
                  >
                    <Trash2 className="w-3 h-3" />
                    場外へ
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* フッター */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-xs">
          <span className="text-slate-400">
            ※ サーチ後は山札をシャッフルすることがルール上推奨されます。
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onClose(true)}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg shadow"
            >
              <Shuffle className="w-3.5 h-3.5" />
              シャッフルして閉じる
            </button>
            <button
              onClick={() => onClose(false)}
              className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-lg"
            >
              そのまま閉じる
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
