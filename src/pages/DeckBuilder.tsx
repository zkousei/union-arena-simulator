import React, { useState, useEffect } from 'react';
import { UserDeck, DeckItem } from '../domain/deckValidation';
import { CARD_DATABASE, CardMaster } from '../data/cardDatabase';
import { DeckBuilderLibraryPane } from '../components/deckBuilder/DeckBuilderLibraryPane';
import { DeckBuilderDeckPane } from '../components/deckBuilder/DeckBuilderDeckPane';
import { DeckBuilderMyDecksModal } from '../components/deckBuilder/DeckBuilderMyDecksModal';
import { DeckBuilderImportModal } from '../components/deckBuilder/DeckBuilderImportModal';
import { OfficialImportModal } from '../components/deck/OfficialImportModal';
import { RevealedCardModal } from '../components/board/RevealedCardModal';
import {
  loadSavedDecks,
  saveDeck,
  deleteDeck,
  exportDeckToJson,
} from '../utils/deckStorage';
import { Card } from '../types/card';

const CUSTOM_CARDS_STORAGE_KEY = 'UA_CUSTOM_CARDS';

interface DeckBuilderPageProps {
  onPlayWithDeck: (deck: UserDeck) => void;
}

export const DeckBuilderPage: React.FC<DeckBuilderPageProps> = ({ onPlayWithDeck }) => {
  const [savedDecks, setSavedDecks] = useState<UserDeck[]>([]);
  const [activeDeck, setActiveDeck] = useState<UserDeck | null>(null);

  // カードプール (公式同梱530枚 + ユーザーが動的インポートしたカード)
  const [cardPool, setCardPool] = useState<CardMaster[]>(() => {
    try {
      const stored = localStorage.getItem(CUSTOM_CARDS_STORAGE_KEY);
      if (stored) {
        const extraCards: CardMaster[] = JSON.parse(stored);
        const map = new Map<string, CardMaster>();
        CARD_DATABASE.forEach((c) => map.set(c.code, c));
        extraCards.forEach((c) => {
          const master = CARD_DATABASE.find((m) => m.code === c.code);
          map.set(
            c.code,
            master
              ? { ...c, bp: master.bp ?? c.bp, hasBpPlus: master.hasBpPlus ?? c.hasBpPlus }
              : c
          );
        });
        return Array.from(map.values());
      }
    } catch (e) {
      console.warn('Failed to load custom cards:', e);
    }
    return CARD_DATABASE;
  });

  const [isMyDecksOpen, setIsMyDecksOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isOfficialImportOpen, setIsOfficialImportOpen] = useState(false);
  const [inspectCard, setInspectCard] = useState<Card | null>(null);
  const [saveToast, setSaveToast] = useState(false);

  // カードプールに新しいカード群を追加（差分のみLocalStorageに保存して5MB容量制限を回避）
  const handleAddCardsToPool = (newCards: CardMaster[]) => {
    setCardPool((prev) => {
      const map = new Map<string, CardMaster>();
      prev.forEach((c) => map.set(c.code, c));
      newCards.forEach((c) => map.set(c.code, c));
      const updated = Array.from(map.values());
      try {
        const baseSet = new Set(CARD_DATABASE.map((c) => c.code));
        const customOnly = updated.filter((c) => !baseSet.has(c.code));
        localStorage.setItem(CUSTOM_CARDS_STORAGE_KEY, JSON.stringify(customOnly));
      } catch (e) {
        console.warn('Failed to persist custom cards to localStorage:', e);
      }
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
    saveDeck(importedDeck);
    const updated = loadSavedDecks();
    setSavedDecks(updated);
    setActiveDeck(importedDeck);
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 2000);
  };

  // 初回ロード
  useEffect(() => {
    const decks = loadSavedDecks();
    setSavedDecks(decks);
    if (decks.length > 0) {
      setActiveDeck(decks[0]);
    } else {
      setActiveDeck({
        id: `deck-${Date.now()}`,
        name: '新規デッキ',
        titleCode: 'CGH',
        items: [],
        updatedAt: Date.now(),
      });
    }
  }, []);

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
    saveDeck(activeDeck);
    setSavedDecks(loadSavedDecks());
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 2000);
  };

  // 新規デッキ作成
  const handleCreateNewDeck = () => {
    const newDeck: UserDeck = {
      id: `deck-${Date.now()}`,
      name: '新規デッキ',
      titleCode: 'CGH',
      items: [],
      updatedAt: Date.now(),
    };
    saveDeck(newDeck);
    const updated = loadSavedDecks();
    setSavedDecks(updated);
    setActiveDeck(newDeck);
  };

  // デッキ削除
  const handleDeleteDeck = (deckId: string) => {
    deleteDeck(deckId);
    const updated = loadSavedDecks();
    setSavedDecks(updated);
    if (activeDeck?.id === deckId && updated.length > 0) {
      setActiveDeck(updated[0]);
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

  if (!activeDeck) {
    return <div className="p-8 text-center text-slate-400">読み込み中...</div>;
  }

  return (
    <div className="flex-1 flex overflow-hidden relative">
      {/* 保存完了トースト */}
      {saveToast && (
        <div className="absolute top-4 right-4 z-40 bg-emerald-600 text-white font-bold text-xs px-3 py-2 rounded-xl shadow-xl animate-in fade-in slide-in-from-top-2">
          デッキを保存しました！
        </div>
      )}

      {/* 左: カードプールライブラリ */}
      <div className="flex-1 h-full overflow-hidden">
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
      <div className="w-80 sm:w-96 md:w-[420px] h-full border-l border-slate-800 overflow-hidden flex flex-col">
        <DeckBuilderDeckPane
          deck={activeDeck}
          onUpdateDeckName={handleUpdateName}
          onIncrementCard={handleIncrementCard}
          onDecrementCard={handleDecrementCard}
          onRemoveCard={handleRemoveCard}
          onSave={handleSave}
          onOpenMyDecks={() => setIsMyDecksOpen(true)}
          onExportJson={handleExportJson}
          onPlayWithDeck={() => onPlayWithDeck(activeDeck)}
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

      {/* マイデッキモーダル */}
      <DeckBuilderMyDecksModal
        isOpen={isMyDecksOpen}
        decks={savedDecks}
        activeDeckId={activeDeck.id}
        onSelectDeck={setActiveDeck}
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
          saveDeck(deck);
          setSavedDecks(loadSavedDecks());
          setActiveDeck(deck);
        }}
        onClose={() => setIsImportOpen(false)}
      />

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
    </div>
  );
};
