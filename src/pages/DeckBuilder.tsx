import { useCardCatalog } from '../hooks/useCardCatalog';
import { useCardOperation } from '../hooks/useCardOperation';
import { ensureCardData } from '../data/cardData';
import { isCardMaster } from '../data/officialCardAsset';
import React, { useState, useEffect, useCallback } from 'react';
import { UserDeck, DeckItem } from '../domain/deckValidation';
import { CardMaster, getCardMaster, isOfficialCardCode } from '../data/cardDatabase';
import { DeckBuilderLibraryPane } from '../components/deckBuilder/DeckBuilderLibraryPane';
import { DeckBuilderDeckPane } from '../components/deckBuilder/DeckBuilderDeckPane';
import { DeckBuilderMyDecksModal } from '../components/deckBuilder/DeckBuilderMyDecksModal';
import { DeckBuilderImportModal } from '../components/deckBuilder/DeckBuilderImportModal';
import { OfficialImportModal } from '../components/deck/OfficialImportModal';
import { RevealedCardModal } from '../components/board/RevealedCardModal';
import {
  loadSavedDeckSummaries,
  loadSavedDeckById,
  type SavedDeckSummary,
  saveDeck,
  deleteDeck,
  exportDeckToJson,
} from '../utils/deckStorage';
import { Card } from '../types/card';

const CUSTOM_CARDS_STORAGE_KEY = 'UA_CUSTOM_CARDS';

function mergeWithOfficialCard(card: CardMaster): CardMaster {
  const master = getCardMaster(card.code);
  return master
    ? {
        ...card,
        ...master,
        reqEnergyColors: master.reqEnergyColors,
        hasBpPlus: master.hasBpPlus ?? false,
        hasGenEnergyPlus: master.hasGenEnergyPlus ?? false,
      }
    : card;
}

interface DeckBuilderPageProps {
  onPlayWithDeck: (deck: UserDeck) => void;
}

export const DeckBuilderPage: React.FC<DeckBuilderPageProps> = ({ onPlayWithDeck }) => {
  const [savedDecks, setSavedDecks] = useState<SavedDeckSummary[]>([]);
  const [savedDeckIssue, setSavedDeckIssue] = useState<ReturnType<typeof loadSavedDeckSummaries> | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const [requestedDeckId, setRequestedDeckId] = useState<string | null>(null);
  const [activeDeck, setActiveDeck] = useState<UserDeck | null>(null);
  const [mobilePane, setMobilePane] = useState<'library' | 'deck'>('library');

  const operation = useCardOperation();
  const { run } = operation;
  const officialCards = useCardCatalog();
  const [customCards, setCustomCards] = useState<CardMaster[]>(() => {
    try {
      const raw: unknown = JSON.parse(localStorage.getItem(CUSTOM_CARDS_STORAGE_KEY) || '[]');
      return Array.isArray(raw) ? raw.filter(isCardMaster) : [];
    } catch { return []; }
  });
  const pool = new Map(officialCards.map((card) => [card.code, card]));
  for (const card of customCards) if (!isOfficialCardCode(card.code) || getCardMaster(card.code)) pool.set(card.code, mergeWithOfficialCard(card));
  const cardPool = Array.from(pool.values());
  const selectSavedDeck = useCallback((id: string) => {
    void run(async () => {
      setRequestedDeckId(id);
      const deck = await loadSavedDeckById(id);
      if (!deck) throw new Error('デッキを読み込めませんでした。');
      return deck;
    }, setActiveDeck);
  }, [run]);

  const [isMyDecksOpen, setIsMyDecksOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isOfficialImportOpen, setIsOfficialImportOpen] = useState(false);
  const [inspectCard, setInspectCard] = useState<Card | null>(null);
  const [saveToast, setSaveToast] = useState(false);

  const refreshSavedDecks = () => {
    const result = loadSavedDeckSummaries();
    setSavedDecks(result.decks);
    setSavedDeckIssue(result.backupJson !== null || result.unreadable ? result : null);
    return result.decks;
  };

  const persistDeck = (deck: UserDeck) => {
    const saved = saveDeck(deck);
    setSaveFailed(!saved);
    return saved;
  };

  const handleDownloadBackup = () => {
    if (!savedDeckIssue?.backupJson) return;
    const blob = new Blob([savedDeckIssue.backupJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'union-arena-saved-decks-backup.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  // カードプールに新しいカード群を追加（差分のみLocalStorageに保存して5MB容量制限を回避）
  const handleAddCardsToPool = (newCards: CardMaster[]) => {
    setCustomCards((prev) => {
      const map = new Map(prev.map((card) => [card.code, card]));
      for (const card of newCards) if (isCardMaster(card)) map.set(card.code, card);
      const updated = Array.from(map.values()).filter((card) => !isOfficialCardCode(card.code));
      try { localStorage.setItem(CUSTOM_CARDS_STORAGE_KEY, JSON.stringify(updated)); }
      catch (error) { console.warn('Failed to persist custom cards:', error); }
      return updated;
    });
  };

  // デッキ一括読み込み（公式インポートから）
  const handleLoadDeckItems = (items: DeckItem[], deckName: string, titleCode: string) => {
    const importedDeck: UserDeck = {
      id: `deck-${Date.now()}`,
      name: deckName,
      titleCode,
      items,
      updatedAt: Date.now(),
    };
    const saved = persistDeck(importedDeck);
    refreshSavedDecks();
    setActiveDeck(importedDeck);
    if (saved) {
      setSaveToast(true);
      setTimeout(() => setSaveToast(false), 2000);
    }
  };

  // 初回ロード
  useEffect(() => {
    const result = loadSavedDeckSummaries();
    const decks = result.decks;
    setSavedDecks(decks);
    setSavedDeckIssue(result.backupJson !== null || result.unreadable ? result : null);
    if (decks.length > 0) {
      selectSavedDeck(decks[0].id);
    } else {
      setActiveDeck({
        id: `deck-${Date.now()}`,
        name: '新規デッキ',
        titleCode: 'CGH',
        items: [],
        updatedAt: Date.now(),
      });
    }
  }, [selectSavedDeck]);

  // カード投入枚数マップ
  const deckCardCounts: Record<string, number> = {};
  if (activeDeck) {
    activeDeck.items.forEach((item) => {
      deckCardCounts[item.card.code] = item.count;
    });
  }

  // カード追加 (ライブラリ -> デッキ)
  const handleAddCard = (card: CardMaster) => {
    if (!activeDeck) return;
    const existingIndex = activeDeck.items.findIndex((i) => i.card.code === card.code);
    const newItems = [...activeDeck.items];

    if (existingIndex >= 0) {
      if (newItems[existingIndex].count >= 4) return;
      newItems[existingIndex] = {
        ...newItems[existingIndex],
        count: newItems[existingIndex].count + 1,
      };
    } else {
      newItems.push({ card, count: 1 });
    }

    const updated = {
      ...activeDeck,
      items: newItems,
      titleCode: activeDeck.items.length === 0 ? card.titleCode : activeDeck.titleCode,
      updatedAt: Date.now(),
    };
    setActiveDeck(updated);
  };

  // 1枚増加
  const handleIncrementCard = (cardCode: string) => {
    if (!activeDeck) return;
    const newItems = activeDeck.items.map((item) => {
      if (item.card.code === cardCode && item.count < 4) {
        return { ...item, count: item.count + 1 };
      }
      return item;
    });
    setActiveDeck({ ...activeDeck, items: newItems, updatedAt: Date.now() });
  };

  // 1枚減少
  const handleDecrementCard = (cardCode: string) => {
    if (!activeDeck) return;
    const newItems = activeDeck.items
      .map((item) => {
        if (item.card.code === cardCode) {
          return { ...item, count: item.count - 1 };
        }
        return item;
      })
      .filter((item) => item.count > 0);
    setActiveDeck({ ...activeDeck, items: newItems, updatedAt: Date.now() });
  };

  // 削除
  const handleRemoveCard = (cardCode: string) => {
    if (!activeDeck) return;
    const newItems = activeDeck.items.filter((item) => item.card.code !== cardCode);
    setActiveDeck({ ...activeDeck, items: newItems, updatedAt: Date.now() });
  };

  // デッキ名更新
  const handleUpdateName = (name: string) => {
    if (!activeDeck) return;
    setActiveDeck({ ...activeDeck, name, updatedAt: Date.now() });
  };

  // 保存
  const handleSave = () => {
    if (!activeDeck) return;
    if (!persistDeck(activeDeck)) return;
    refreshSavedDecks();
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 2000);
  };

  // 新規デッキ作成
  const handleCreateNewDeck = () => {
    operation.clearError();
    const newDeck: UserDeck = {
      id: `deck-${Date.now()}`,
      name: '新規デッキ',
      titleCode: 'CGH',
      items: [],
      updatedAt: Date.now(),
    };
    persistDeck(newDeck);
    refreshSavedDecks();
    setActiveDeck(newDeck);
  };

  // デッキ削除
  const handleDeleteDeck = (deckId: string) => {
    deleteDeck(deckId);
    const updated = refreshSavedDecks();
    if (activeDeck?.id === deckId && updated.length > 0) {
      selectSavedDeck(updated[0].id);
    }
  };

  // JSONダウンロード
  const handleExportJson = () => {
    if (!activeDeck) return;
    const jsonStr = exportDeckToJson(activeDeck);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeDeck.name.replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const deckManagementDialogs = <>
    {/* マイデッキモーダル */}
    <DeckBuilderMyDecksModal
      isOpen={isMyDecksOpen}
      decks={savedDecks}
      activeDeckId={activeDeck?.id || ''}
      onSelectDeck={(deck) => selectSavedDeck(deck.id)}
      onCreateNewDeck={handleCreateNewDeck}
      onDeleteDeck={handleDeleteDeck}
      onOpenImport={() => {
        setIsMyDecksOpen(false);
        setIsImportOpen(true);
      }}
      onClose={() => setIsMyDecksOpen(false)}
    />

    {/* インポートモーダル (JSON) */}
    <DeckBuilderImportModal
      isOpen={isImportOpen}
      onImportSuccess={(deck) => {
        operation.clearError();
        persistDeck(deck);
        refreshSavedDecks();
        setActiveDeck(deck);
      }}
      onClose={() => setIsImportOpen(false)}
    />
  </>;

  if (!activeDeck) {
    return <div className="p-4 sm:p-8 text-center text-slate-300">
      {operation.error ? <div role="alert">
        {operation.error}
        <button type="button" className="block mx-auto mt-4 underline" onClick={() => {
          const id = requestedDeckId || savedDecks[0]?.id;
          if (id) selectSavedDeck(id);
        }}>デッキ読込を再試行</button>
        <button type="button" className="block mx-auto mt-4 underline" onClick={() => window.location.reload()}>ページを再読み込み</button>
      </div> : <p role="status">デッキを読み込み中…</p>}
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button type="button" disabled={operation.busy} className="rounded-lg bg-indigo-600 p-3 disabled:opacity-40" onClick={() => setIsMyDecksOpen(true)}>別の保存デッキを選択</button>
        <button type="button" disabled={operation.busy} className="rounded-lg bg-slate-700 p-3 disabled:opacity-40" onClick={handleCreateNewDeck}>新規デッキ作成</button>
        <button type="button" disabled={operation.busy} className="rounded-lg bg-slate-700 p-3 disabled:opacity-40" onClick={() => setIsImportOpen(true)}>JSONインポート</button>
      </div>
      {deckManagementDialogs}
    </div>;
  }

  const totalCards = activeDeck.items.reduce((sum, item) => sum + item.count, 0);

  return (
    <fieldset disabled={operation.busy} className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden relative border-0 p-0 m-0">
      {operation.busy && <p role="status" className="p-2">デッキのカードデータを読み込み中…</p>}
      {operation.error && <p role="alert" className="p-2 text-amber-200">{operation.error} デッキを選び直して再試行してください。</p>}
      {/* 保存完了トースト */}
      {saveToast && (
        <div className="absolute top-4 right-4 z-40 bg-emerald-600 text-white font-bold text-xs px-3 py-2 rounded-xl shadow-xl animate-in fade-in slide-in-from-top-2">
          デッキを保存しました！
        </div>
      )}

      {(savedDeckIssue || saveFailed) && (
        <div role="alert" className="shrink-0 flex flex-wrap items-center gap-2 border-b border-amber-500/40 bg-amber-950/70 px-3 py-2 text-xs text-amber-100">
          <span>
            {savedDeckIssue?.unreadable
              ? '保存データを読み込めませんでした。元データは保持しています。'
              : savedDeckIssue
                ? `保存データの一部を読み込めませんでした（${savedDeckIssue.skippedCount}件）。元データは保持しています。`
                : 'デッキを保存できませんでした。'}
            {saveFailed && savedDeckIssue && ' デッキの保存にも失敗しました。'}
          </span>
          {savedDeckIssue?.backupJson && (
            <button type="button" onClick={handleDownloadBackup} className="rounded border border-amber-400/50 px-2 py-1 font-bold hover:bg-amber-800/60">
              元データをバックアップ
            </button>
          )}
        </div>
      )}

      <div
        className="md:hidden shrink-0 grid grid-cols-2 gap-1 p-1.5 bg-slate-950 border-b border-slate-800"
        aria-label="デッキ構築画面の表示切替"
      >
        <button
          type="button"
          onClick={() => setMobilePane('library')}
          aria-pressed={mobilePane === 'library'}
          className={`rounded-lg px-3 py-2 text-xs font-bold transition ${
            mobilePane === 'library'
              ? 'bg-indigo-600 text-white'
              : 'bg-slate-900 text-slate-400 hover:text-white'
          }`}
        >
          カード一覧
        </button>
        <button
          type="button"
          onClick={() => setMobilePane('deck')}
          aria-pressed={mobilePane === 'deck'}
          className={`rounded-lg px-3 py-2 text-xs font-bold transition ${
            mobilePane === 'deck'
              ? 'bg-indigo-600 text-white'
              : 'bg-slate-900 text-slate-400 hover:text-white'
          }`}
        >
          現在のデッキ ({totalCards}/50)
        </button>
      </div>

      <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
        {/* 左: カードプールライブラリ */}
        <div
          className={`${mobilePane === 'library' ? 'flex' : 'hidden'} md:flex flex-1 min-w-0 min-h-0 overflow-hidden`}
        >
          <DeckBuilderLibraryPane
            cards={cardPool}
            deckCardCounts={deckCardCounts}
            onAddCard={handleAddCard}
            onOpenOfficialImport={() => setIsOfficialImportOpen(true)}
            onInspectCard={(c) => {
              setInspectCard({
                ...c,
                id: `inspect-${c.code}`,
                isRested: false,
                bpModifier: 0,
                underCards: [],
              });
            }}
          />
        </div>

        {/* 右: デッキ構築ペイン */}
        <div
          className={`${mobilePane === 'deck' ? 'flex' : 'hidden'} md:flex w-full md:w-[420px] flex-1 md:flex-none min-h-0 border-l border-slate-800 overflow-hidden flex-col`}
        >
          <DeckBuilderDeckPane
            deck={activeDeck}
            onUpdateDeckName={handleUpdateName}
            onIncrementCard={handleIncrementCard}
            onDecrementCard={handleDecrementCard}
            onRemoveCard={handleRemoveCard}
            onSave={handleSave}
            onOpenMyDecks={() => setIsMyDecksOpen(true)}
            onExportJson={handleExportJson}
            onPlayWithDeck={() => { void operation.run(() => ensureCardData(activeDeck), () => onPlayWithDeck(activeDeck)); }}
            onInspectCard={(c) => {
              setInspectCard({
                ...c,
                id: `inspect-${c.code}`,
                isRested: false,
                bpModifier: 0,
                underCards: [],
              });
            }}
          />
        </div>
      </div>

      {deckManagementDialogs}

      {/* 公式カードリスト取得 & インポートモーダル */}
      <OfficialImportModal
        isOpen={isOfficialImportOpen}
        cardPool={cardPool}
        onAddCardsToPool={handleAddCardsToPool}
        onLoadDeckItems={handleLoadDeckItems}
        onClose={() => setIsOfficialImportOpen(false)}
      />

      {/* カード詳細モーダル */}
      <RevealedCardModal
        revealed={null}
        inspectCard={inspectCard}
        onCloseInspect={() => setInspectCard(null)}
      />
    </fieldset>
  );
};
