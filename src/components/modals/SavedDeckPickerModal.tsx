import React, { useState, useEffect, useMemo } from 'react';
import { UserDeck } from '../../domain/deckValidation';
import { loadSavedDecks } from '../../utils/deckStorage';
import { PRESET_DECKS, PresetDeckInfo } from '../../data/sampleDeck';
import {
  Layers,
  X,
  Search,
  CheckCircle2,
  AlertTriangle,
  Play,
  Sparkles,
} from 'lucide-react';

interface SavedDeckPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectDeck: (deck: UserDeck, targetPlayerId: string) => void;
  myPlayerId: string;
  isSoloMode: boolean;
  player1Name?: string;
  player2Name?: string;
  onNavigateToDeckBuilder?: () => void;
}

export const SavedDeckPickerModal: React.FC<SavedDeckPickerModalProps> = ({
  isOpen,
  onClose,
  onSelectDeck,
  myPlayerId,
  isSoloMode,
  player1Name = 'Player 1',
  player2Name = 'Player 2',
  onNavigateToDeckBuilder,
}) => {
  const [activeTab, setActiveTab] = useState<'saved' | 'presets'>('saved');
  const [searchQuery, setSearchQuery] = useState('');
  const [savedDecks, setSavedDecks] = useState<UserDeck[]>([]);

  // モーダルが開かれた時にローカルストレージから最新のデッキ一覧を再取得
  useEffect(() => {
    if (isOpen) {
      const decks = loadSavedDecks();
      setSavedDecks(decks);
      // 保存済みデッキが0件なら初期タブをプリセットに誘導
      if (decks.length === 0) {
        setActiveTab('presets');
      } else {
        setActiveTab('saved');
      }
      setSearchQuery('');
    }
  }, [isOpen]);

  // フィルタリング処理
  const filteredSavedDecks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return savedDecks;
    return savedDecks.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.titleCode.toLowerCase().includes(q)
    );
  }, [savedDecks, searchQuery]);

  const filteredPresets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return PRESET_DECKS;
    return PRESET_DECKS.filter(
      (p) =>
        p.deckName.toLowerCase().includes(q) ||
        p.title.toLowerCase().includes(q) ||
        p.titleCode.toLowerCase().includes(q) ||
        p.leadCardName.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  if (!isOpen) return null;

  return (
    <div
      role="presentation"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 text-xs"
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-200 text-slate-100"
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-600/20 text-indigo-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">デッキを選択してセット</h3>
              <p className="text-[11px] text-slate-400">
                保存済みマイデッキ、または公式プリセットデッキから盤面に読み込みます。
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* タブ切り替え & 検索バー */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3 border-b border-slate-800">
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('saved')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs transition ${
                activeTab === 'saved'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>保存済みマイデッキ</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300">
                {savedDecks.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('presets')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs transition ${
                activeTab === 'presets'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>公式プリセット</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300">
                {PRESET_DECKS.length}
              </span>
            </button>
          </div>

          <div className="relative flex-1 sm:max-w-xs">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="デッキ名や作品コードで検索..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* コンテンツ領域 */}
        <div className="flex-1 overflow-y-auto py-3 space-y-2.5 pr-1 scrollbar-thin">
          {activeTab === 'saved' ? (
            /* 保存済みマイデッキ一覧 */
            filteredSavedDecks.length > 0 ? (
              filteredSavedDecks.map((deck) => {
                const totalCards = deck.items.reduce((sum, item) => sum + item.count, 0);
                const isComplete = totalCards === 50;

                return (
                  <div
                    key={deck.id}
                    className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/70 hover:border-slate-700 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-white text-sm truncate">{deck.name}</span>
                        <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] font-mono text-indigo-300">
                          {deck.titleCode}
                        </span>
                        {isComplete ? (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-600/40 text-emerald-300 text-[10px] font-bold">
                            <CheckCircle2 className="w-3 h-3" />
                            50枚デッキ
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-950/60 border border-amber-600/40 text-amber-300 text-[10px] font-bold">
                            <AlertTriangle className="w-3 h-3" />
                            {totalCards} / 50 枚
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        最終更新: {new Date(deck.updatedAt).toLocaleString('ja-JP')}
                      </div>
                    </div>

                    {/* セットボタン */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isSoloMode ? (
                        <>
                          <button
                            onClick={() => {
                              onSelectDeck(deck, 'player-1');
                              onClose();
                            }}
                            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition flex items-center gap-1 shadow"
                            title={`${player1Name}のデッキとしてセット`}
                          >
                            <Play className="w-3 h-3 fill-white" />
                            <span>{player1Name}にセット</span>
                          </button>
                          <button
                            onClick={() => {
                              onSelectDeck(deck, 'player-2');
                              onClose();
                            }}
                            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-xs transition flex items-center gap-1 shadow"
                            title={`${player2Name}のデッキとしてセット`}
                          >
                            <Play className="w-3 h-3" />
                            <span>{player2Name}にセット</span>
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => {
                            onSelectDeck(deck, myPlayerId);
                            onClose();
                          }}
                          className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition flex items-center gap-1.5 shadow"
                        >
                          <Play className="w-3.5 h-3.5 fill-white" />
                          <span>自分のデッキにセット</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              /* 空状態 */
              <div className="py-10 text-center space-y-3 bg-slate-950/40 rounded-2xl border border-slate-800/60 p-6">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400">
                  <Layers className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">保存されたデッキがありません</h4>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    デッキビルダーでカードを組み合わせてマイデッキを作成・保存してください。
                  </p>
                </div>
                <div className="flex items-center justify-center gap-2 pt-2">
                  {onNavigateToDeckBuilder && (
                    <button
                      onClick={() => {
                        onClose();
                        onNavigateToDeckBuilder();
                      }}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition flex items-center gap-1.5 shadow"
                    >
                      <Layers className="w-4 h-4" />
                      <span>デッキビルダーを開く</span>
                    </button>
                  )}
                  <button
                    onClick={() => setActiveTab('presets')}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold rounded-xl transition flex items-center gap-1.5"
                  >
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>公式プリセットを見る</span>
                  </button>
                </div>
              </div>
            )
          ) : (
            /* 公式プリセット一覧 */
            filteredPresets.map((preset: PresetDeckInfo) => (
              <div
                key={preset.id}
                className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/70 hover:border-slate-700 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-white text-sm truncate">{preset.deckName}</span>
                    <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] font-mono text-indigo-300">
                      {preset.titleCode}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-purple-950/60 border border-purple-600/40 text-purple-300 text-[10px] font-bold">
                      {preset.title}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-600/40 text-emerald-300 text-[10px] font-bold">
                      公式50枚完全準拠
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 truncate">
                    主力: <strong className="text-slate-200">{preset.leadCardName}</strong> — {preset.description}
                  </div>
                </div>

                {/* セットボタン */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {isSoloMode ? (
                    <>
                      <button
                        onClick={() => {
                          onSelectDeck(preset.deck, 'player-1');
                          onClose();
                        }}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition flex items-center gap-1 shadow"
                        title={`${player1Name}のデッキとしてセット`}
                      >
                        <Play className="w-3 h-3 fill-white" />
                        <span>{player1Name}にセット</span>
                      </button>
                      <button
                        onClick={() => {
                          onSelectDeck(preset.deck, 'player-2');
                          onClose();
                        }}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-xs transition flex items-center gap-1 shadow"
                        title={`${player2Name}のデッキとしてセット`}
                      >
                        <Play className="w-3 h-3" />
                        <span>{player2Name}にセット</span>
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => {
                        onSelectDeck(preset.deck, myPlayerId);
                        onClose();
                      }}
                      className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition flex items-center gap-1.5 shadow"
                    >
                      <Play className="w-3.5 h-3.5 fill-white" />
                      <span>自分のデッキにセット</span>
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* フッター */}
        <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-slate-400 text-[11px]">
          <span>※ デッキをセットすると手札7枚が引かれ、試合前準備（マリガン・ライフ配置）に進みます。</span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
