import React, { useState } from 'react';
import { CARD_DATABASE, AVAILABLE_TITLES, CardMaster } from '../../data/cardDatabase';
import { CardView } from '../board/CardView';
import { Search, Plus, Globe, Sparkles } from 'lucide-react';
import { getBaseCardCode } from '../../types/card';

interface DeckBuilderLibraryPaneProps {
  cards?: CardMaster[];
  deckCardCounts: Record<string, number>;
  onAddCard: (card: CardMaster) => void;
  onInspectCard: (card: CardMaster) => void;
  onOpenOfficialImport?: () => void;
}

export const DeckBuilderLibraryPane: React.FC<DeckBuilderLibraryPaneProps> = ({
  cards = CARD_DATABASE,
  deckCardCounts,
  onAddCard,
  onInspectCard,
  onOpenOfficialImport,
}) => {
  const [selectedTitle, setSelectedTitle] = useState<string>('ALL');
  const [selectedColor, setSelectedColor] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showParallel, setShowParallel] = useState<boolean>(false);
  const [showUnrevealed, setShowUnrevealed] = useState<boolean>(true);

  // 1万枚規模の大規模カードプールに対応する順次読み込み（ページング）
  const PAGE_SIZE = 60;
  const [displayLimit, setDisplayLimit] = useState<number>(PAGE_SIZE);

  // フィルター変更時は表示件数をリセット
  React.useEffect(() => {
    setDisplayLimit(PAGE_SIZE);
  }, [selectedTitle, selectedColor, selectedType, searchQuery, showParallel, showUnrevealed]);

  const filteredCards = cards.filter((c) => {
    // 作品絞り込み: 作品名 (c.title) または 作品コード (c.titleCode)
    if (selectedTitle !== 'ALL' && c.title !== selectedTitle && c.titleCode !== selectedTitle) {
      return false;
    }
    if (selectedColor !== 'ALL' && c.color !== selectedColor) return false;
    if (selectedType !== 'ALL' && c.cardType !== selectedType) return false;

    // パラレル版フィルター (デフォルト非表示)
    if (!showParallel && c.isParallel) return false;

    // 未公開カードフィルター
    if (!showUnrevealed && c.isUnrevealed) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = c.name.toLowerCase().includes(q);
      const matchCode = c.code.toLowerCase().includes(q);
      const matchBaseCode = c.baseCode ? c.baseCode.toLowerCase().includes(q) : false;
      const matchRarity = c.rarity ? c.rarity.toLowerCase().includes(q) : false;
      const matchTrait = c.traits.some((t) => t.toLowerCase().includes(q));
      const matchEffect = c.effectText.toLowerCase().includes(q);
      if (!matchName && !matchCode && !matchBaseCode && !matchRarity && !matchTrait && !matchEffect) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="flex flex-col h-full bg-slate-900 border-r border-slate-800 text-xs">
      {/* フィルターヘッダー */}
      <div className="p-3 bg-slate-950/80 border-b border-slate-800 space-y-2.5">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="カード名、特徴、テキスト、レアリティで検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-xs"
            />
          </div>
          {onOpenOfficialImport && (
            <button
              onClick={onOpenOfficialImport}
              className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] transition flex items-center gap-1 shrink-0 shadow shadow-indigo-600/30"
              title="公式カードリストから取得・インポート"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>公式から取得</span>
            </button>
          )}
        </div>

        {/* 作品 & 色 & 種類 ドロップダウン */}
        <div className="grid grid-cols-3 gap-1.5">
          <select
            value={selectedTitle}
            onChange={(e) => setSelectedTitle(e.target.value)}
            className="w-full min-w-0 bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-2 py-1 focus:outline-none text-[11px]"
          >
            {AVAILABLE_TITLES.map((t) => (
              <option key={t.code} value={t.code}>
                {t.name}
              </option>
            ))}
          </select>

          <select
            value={selectedColor}
            onChange={(e) => setSelectedColor(e.target.value)}
            className="w-full min-w-0 bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-2 py-1 focus:outline-none text-[11px]"
          >
            <option value="ALL">すべての色</option>
            <option value="PURPLE">紫</option>
            <option value="GREEN">緑</option>
            <option value="RED">赤</option>
            <option value="BLUE">青</option>
            <option value="YELLOW">黄</option>
          </select>

          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="w-full min-w-0 bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-2 py-1 focus:outline-none text-[11px]"
          >
            <option value="ALL">すべての種類</option>
            <option value="CHARACTER">キャラ</option>
            <option value="EVENT">イベント</option>
            <option value="FIELD">フィールド</option>
          </select>
        </div>

        {/* オプションフィルター: パラレルカード & 未公開カード */}
        <div className="flex items-center justify-between text-[11px] pt-0.5 px-0.5 border-t border-slate-800/60">
          <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-amber-300 select-none transition">
            <input
              type="checkbox"
              checked={showParallel}
              onChange={(e) => setShowParallel(e.target.checked)}
              className="rounded bg-slate-900 border-slate-700 text-amber-500 focus:ring-amber-400"
            />
            <span className="flex items-center gap-1 font-medium">
              <Sparkles className="w-3 h-3 text-amber-400" />
              パラレルカードを表示
            </span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer text-slate-400 hover:text-slate-200 select-none transition">
            <input
              type="checkbox"
              checked={showUnrevealed}
              onChange={(e) => setShowUnrevealed(e.target.checked)}
              className="rounded bg-slate-900 border-slate-700 text-indigo-500 focus:ring-indigo-400"
            />
            <span>未公開を表示</span>
          </label>
        </div>

        {/* 検索件数表示 */}
        <div className="flex items-center justify-between text-[10px] text-slate-400 px-0.5 pt-0.5">
          <span>
            表示中: <strong className="text-indigo-300">{Math.min(displayLimit, filteredCards.length)}</strong> / {filteredCards.length} 件 (全 {cards.length} 件)
          </span>
          <span className="text-slate-500">※クリックで詳細拡大</span>
        </div>
      </div>

      {/* カード一覧 */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-wrap gap-2.5 justify-center content-start scrollbar-thin">
        {filteredCards.length === 0 ? (
          <div className="text-slate-500 py-16 text-center">
            条件に一致するカードがありません
          </div>
        ) : (
          <>
            {filteredCards.slice(0, displayLimit).map((card) => {
              const cardBaseCode = card.baseCode || getBaseCardCode(card.code);
              const currentCount = deckCardCounts[card.code] || 0;

              // 同一基本カード番号（通常版＋パラレル版合算）のデッキ内総枚数
              const totalBaseCount = Object.entries(deckCardCounts).reduce((sum, [code, count]) => {
                return getBaseCardCode(code) === cardBaseCode ? sum + count : sum;
              }, 0);

              const isMax = totalBaseCount >= 4;

              // CardView 用のダミーインスタンス変換
              const cardInstance = {
                ...card,
                id: `lib-${card.code}`,
                isRested: false,
                bpModifier: 0,
                underCards: [],
              };

              return (
                <div
                  key={card.code}
                  className="flex flex-col items-center bg-slate-950/60 p-2 rounded-xl border border-slate-800 shadow relative group"
                >
                  {/* 現在デッキ内枚数バッジ */}
                  {totalBaseCount > 0 && (
                    <div className={`absolute top-1 left-1 z-20 text-white font-black text-[10px] px-1.5 py-0.5 rounded shadow ${
                      isMax ? 'bg-rose-600' : 'bg-indigo-600'
                    }`} title={card.isParallel ? `このカード: ${currentCount}枚 / 同一基本カード合計: ${totalBaseCount}枚` : undefined}>
                      {card.isParallel ? `${currentCount}枚 (計${totalBaseCount}/4)` : `${totalBaseCount} / 4`}
                    </div>
                  )}

                  <CardView
                    card={cardInstance}
                    onClick={() => onInspectCard(card)}
                  />

                  {/* デッキに追加ボタン */}
                  <button
                    onClick={() => onAddCard(card)}
                    disabled={isMax}
                    className={`mt-1.5 w-full flex items-center justify-center gap-1 py-1 rounded text-[11px] font-bold transition shadow ${
                      isMax
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        : card.isUnrevealed
                        ? 'bg-amber-600/90 hover:bg-amber-500 text-white'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                    }`}
                  >
                    <Plus className="w-3 h-3" />
                    {isMax ? '合算上限 (4枚)' : card.isUnrevealed ? '未公開を追加' : 'デッキに追加'}
                  </button>
                </div>
              );
            })}

            {/* さらに表示ボタン */}
            {displayLimit < filteredCards.length && (
              <div className="w-full flex justify-center py-4">
                <button
                  onClick={() => setDisplayLimit((prev) => prev + PAGE_SIZE)}
                  className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white font-bold text-xs transition border border-slate-700 shadow-md flex items-center gap-1.5"
                >
                  さらに表示（残り {filteredCards.length - displayLimit} 件）
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
