import React from 'react';
import { UserDeck } from '../../domain/deckValidation';
import { FolderOpen, Plus, Trash2, Check, Upload, X } from 'lucide-react';

interface DeckBuilderMyDecksModalProps {
  isOpen: boolean;
  decks: UserDeck[];
  activeDeckId: string;
  onSelectDeck: (deck: UserDeck) => void;
  onCreateNewDeck: () => void;
  onDeleteDeck: (deckId: string) => void;
  onOpenImport: () => void;
  onClose: () => void;
}

export const DeckBuilderMyDecksModal: React.FC<DeckBuilderMyDecksModalProps> = ({
  isOpen,
  decks,
  activeDeckId,
  onSelectDeck,
  onCreateNewDeck,
  onDeleteDeck,
  onOpenImport,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 text-xs">
      <div className="bg-slate-900 border-2 border-indigo-500/80 rounded-2xl max-w-lg w-full max-h-[80vh] flex flex-col p-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* ヘッダー */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-base text-white">
              マイデッキ一覧 ({decks.length})
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* アクションボタン */}
        <div className="flex items-center gap-2 py-3 border-b border-slate-800">
          <button
            onClick={() => {
              onCreateNewDeck();
              onClose();
            }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow"
          >
            <Plus className="w-4 h-4" />
            新規デッキ作成
          </button>
          <button
            onClick={() => {
              onOpenImport();
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl border border-slate-700"
          >
            <Upload className="w-4 h-4" />
            JSONインポート
          </button>
        </div>

        {/* デッキリスト */}
        <div className="flex-1 overflow-y-auto py-2 space-y-2 scrollbar-thin">
          {decks.map((deck) => {
            const total = deck.items.reduce((sum, item) => sum + item.count, 0);
            const isCurrent = deck.id === activeDeckId;

            return (
              <div
                key={deck.id}
                onClick={() => {
                  onSelectDeck(deck);
                  onClose();
                }}
                className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                  isCurrent
                    ? 'bg-indigo-950/60 border-indigo-500/80 ring-1 ring-indigo-500'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex flex-col gap-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-100 text-sm truncate">{deck.name}</span>
                    <span className="px-1.5 py-0.5 bg-slate-800 rounded text-[10px] font-mono text-indigo-300">
                      {deck.titleCode}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {total} 枚 | 更新: {new Date(deck.updatedAt).toLocaleDateString()}
                  </div>
                </div>

                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  {isCurrent && (
                    <span className="text-indigo-400 flex items-center gap-1 font-bold text-[11px]">
                      <Check className="w-3.5 h-3.5" /> 選択中
                    </span>
                  )}
                  {decks.length > 1 && (
                    <button
                      onClick={() => {
                        if (window.confirm(`デッキ「${deck.name}」を削除しますか？`)) {
                          onDeleteDeck(deck.id);
                        }
                      }}
                      className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition"
                      title="デッキを削除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
