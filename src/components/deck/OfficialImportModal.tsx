import React, { useState } from 'react';
import {
  Globe,
  FileText,
  Code2,
  X,
  Download,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Sparkles,
  ExternalLink,
  Plus,
} from 'lucide-react';
import {
  OFFICIAL_SERIES_LIST,
  OfficialSeriesInfo,
  fetchSeriesCardsViaProxy,
  parseDeckListText,
  parseCardFromDetailHtml,
} from '../../services/officialCardService';
import {
  extractDeckCode,
  fetchBandaiDeckRecipe,
  mapBandaiDeckToDeckItems,
} from '../../services/bandaiTcgPlusService';
import { CardMaster } from '../../data/cardDatabase';
import { DeckItem } from '../../domain/deckValidation';
import { OFFICIAL_TITLES } from '../../data/officialSeriesData';

interface OfficialImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  cardPool: CardMaster[];
  onAddCardsToPool: (newCards: CardMaster[]) => void;
  onLoadDeckItems: (items: DeckItem[], deckName: string, titleCode: string) => void;
}

export const OfficialImportModal: React.FC<OfficialImportModalProps> = ({
  isOpen,
  onClose,
  cardPool,
  onAddCardsToPool,
  onLoadDeckItems,
}) => {
  const [activeTab, setActiveTab] = useState<'tcgPlus' | 'series' | 'deckText' | 'html'>('tcgPlus');

  // タブ0: BANDAI TCG+ レシピステート
  const [tcgPlusInput, setTcgPlusInput] = useState<string>('');
  const [tcgPlusDeckName, setTcgPlusDeckName] = useState<string>('TCG+ デッキ');
  const [isFetchingTcgPlus, setIsFetchingTcgPlus] = useState<boolean>(false);
  const [tcgPlusError, setTcgPlusError] = useState<string | null>(null);
  const [tcgPlusResult, setTcgPlusResult] = useState<{
    items: DeckItem[];
    newCards: CardMaster[];
    deckCode: string;
  } | null>(null);

  // タブ1: シリーズ取得ステート
  const [selectedSeriesId, setSelectedSeriesId] = useState<string>(OFFICIAL_SERIES_LIST[0].seriesId);
  const [seriesTitleFilter, setSeriesTitleFilter] = useState<string>('ALL');
  const [seriesSearch, setSeriesSearch] = useState<string>('');
  const [includeParallel, setIncludeParallel] = useState<boolean>(false);
  const [isFetchingSeries, setIsFetchingSeries] = useState(false);
  const [fetchProgress, setFetchProgress] = useState<{ current: number; total: number } | null>(null);
  const [fetchSuccessMsg, setFetchSuccessMsg] = useState<string | null>(null);
  const [fetchErrorMsg, setFetchErrorMsg] = useState<string | null>(null);

  // タブ2: デッキテキストステート
  const [deckText, setDeckText] = useState<string>('');
  const [deckNameInput, setDeckNameInput] = useState<string>('公式インポートデッキ');
  const [parsedItems, setParsedItems] = useState<DeckItem[]>([]);
  const [notFoundCodes, setNotFoundCodes] = useState<string[]>([]);
  const [hasParsed, setHasParsed] = useState<boolean>(false);

  // タブ3: HTML貼り付けステート
  const [htmlInput, setHtmlInput] = useState<string>('');
  const [htmlCardNoInput, setHtmlCardNoInput] = useState<string>('');
  const [htmlSuccessMsg, setHtmlSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  // BANDAI TCG+ レシピ取得ハンドラー
  const handleFetchTcgPlus = async () => {
    setIsFetchingTcgPlus(true);
    setTcgPlusError(null);
    setTcgPlusResult(null);

    const deckCode = extractDeckCode(tcgPlusInput);
    if (!deckCode) {
      setTcgPlusError('有効な BANDAI TCG+ のデッキURLまたはデッキコードを入力してください。');
      setIsFetchingTcgPlus(false);
      return;
    }

    try {
      const recipe = await fetchBandaiDeckRecipe(deckCode);
      const { items, newCards } = mapBandaiDeckToDeckItems(recipe.mainDeck, cardPool);

      if (items.length === 0) {
        setTcgPlusError('デッキにカードが見つかりませんでした。');
        return;
      }

      setTcgPlusResult({ items, newCards, deckCode });
      setTcgPlusDeckName(`TCG+ デッキ (${deckCode})`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '通信に失敗しました';
      setTcgPlusError(`取得エラー: ${message}`);
    } finally {
      setIsFetchingTcgPlus(false);
    }
  };

  // BANDAI TCG+ デッキ適用
  const handleApplyTcgPlusDeck = () => {
    if (!tcgPlusResult || tcgPlusResult.items.length === 0) return;

    if (tcgPlusResult.newCards.length > 0) {
      onAddCardsToPool(tcgPlusResult.newCards);
    }

    const titleCode = tcgPlusResult.items[0]?.card.titleCode || 'OTHER';
    onLoadDeckItems(tcgPlusResult.items, tcgPlusDeckName || 'TCG+ デッキ', titleCode);
    onClose();
  };

  // シリーズ取得ハンドラー
  const handleFetchSeries = async () => {
    setIsFetchingSeries(true);
    setFetchProgress(null);
    setFetchSuccessMsg(null);
    setFetchErrorMsg(null);

    const series = OFFICIAL_SERIES_LIST.find((s) => s.seriesId === selectedSeriesId);

    try {
      const cards = await fetchSeriesCardsViaProxy(
        selectedSeriesId,
        (curr, tot) => {
          setFetchProgress({ current: curr, total: tot });
        },
        { includeParallel }
      );

      if (cards.length > 0) {
        onAddCardsToPool(cards);
        setFetchSuccessMsg(
          `「${series?.name || selectedSeriesId}」から ${cards.length} 枚の公式カード（${
            includeParallel ? 'パラレル版含む' : '通常版'
          }）を取得し、カードプールに追加しました！`
        );
      } else {
        setFetchErrorMsg('カードを取得できませんでした。');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '通信に失敗しました';
      setFetchErrorMsg(`取得エラー: ${message}`);
    } finally {
      setIsFetchingSeries(false);
    }
  };

  // デッキテキストパース
  const handleParseDeckText = () => {
    const { items, notFound } = parseDeckListText(deckText, cardPool);
    setParsedItems(items);
    setNotFoundCodes(notFound);
    setHasParsed(true);
  };

  // デッキ適用
  const handleApplyDeck = () => {
    if (parsedItems.length === 0) return;
    const titleCode = parsedItems[0]?.card.titleCode || 'CGH';
    onLoadDeckItems(parsedItems, deckNameInput || 'インポートデッキ', titleCode);
    onClose();
  };

  // HTML手動パース
  const handleParseHtml = () => {
    setHtmlSuccessMsg(null);
    if (!htmlInput.trim()) return;

    try {
      const cardNo = htmlCardNoInput.trim() || 'CUSTOM/CARD-1-001';
      const parsed = parseCardFromDetailHtml(htmlInput, cardNo);
      onAddCardsToPool([parsed]);
      setHtmlSuccessMsg(`カード「${parsed.name} (${parsed.code})」をパースして追加しました！`);
      setHtmlInput('');
      setHtmlCardNoInput('');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '不明なエラー';
      alert(`パースに失敗しました: ${message}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 text-slate-100">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* モーダルヘッダー */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-2.5">
            <div className="bg-gradient-to-tr from-indigo-600 to-sky-500 p-2 rounded-xl text-white shadow">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white">公式カードリスト取得 & インポート</h3>
              <p className="text-[11px] text-slate-400">公式サイトからカード一覧やデッキレシピを直接取り込み</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* タブナビゲーション */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 text-xs px-5 pt-2 gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('tcgPlus')}
            className={`flex items-center gap-1.5 pb-2.5 px-3 font-bold border-b-2 transition whitespace-nowrap ${
              activeTab === 'tcgPlus'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            BANDAI TCG+ レシピ
          </button>
          <button
            onClick={() => setActiveTab('series')}
            className={`flex items-center gap-1.5 pb-2.5 px-3 font-bold border-b-2 transition whitespace-nowrap ${
              activeTab === 'series'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            公式シリーズ取得
          </button>
          <button
            onClick={() => setActiveTab('deckText')}
            className={`flex items-center gap-1.5 pb-2.5 px-3 font-bold border-b-2 transition whitespace-nowrap ${
              activeTab === 'deckText'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            テキスト形式貼付
          </button>
          <button
            onClick={() => setActiveTab('html')}
            className={`flex items-center gap-1.5 pb-2.5 px-3 font-bold border-b-2 transition whitespace-nowrap ${
              activeTab === 'html'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            HTML貼付
          </button>
        </div>

        {/* タブコンテンツ */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* タブ0: BANDAI TCG+ レシピ */}
          {activeTab === 'tcgPlus' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <span className="font-bold text-slate-200 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-400" /> BANDAI TCG+ のデッキコード / レシピURLから作成
                </span>
                <p className="text-slate-400 leading-relaxed text-[11px]">
                  公式アプリやWEBで共有されたデッキレシピURL（例: <code className="text-indigo-300">https://www.bandai-tcg-plus.com/deck_code_recipe/...</code>）またはデッキコードを貼り付けると、50枚のデッキ構成を直接読み込んでシミュレータに再現します。
                </p>
              </div>

              <div className="space-y-2">
                <label className="font-bold text-slate-300 block text-[11px]">
                  BANDAI TCG+ デッキレシピURL または デッキコード:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="https://www.bandai-tcg-plus.com/deck_code_recipe/lFv8V8TK9AD3EvVn"
                    value={tcgPlusInput}
                    onChange={(e) => setTcgPlusInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !isFetchingTcgPlus) {
                        handleFetchTcgPlus();
                      }
                    }}
                    disabled={isFetchingTcgPlus}
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs font-mono placeholder:text-slate-600 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                  <button
                    onClick={handleFetchTcgPlus}
                    disabled={isFetchingTcgPlus || !tcgPlusInput.trim()}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 font-bold text-white transition flex items-center gap-1.5 shrink-0 shadow-lg shadow-indigo-600/30"
                  >
                    {isFetchingTcgPlus ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>取得中...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        <span>レシピを取得</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* エラー表示 */}
              {tcgPlusError && (
                <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/50 text-rose-200 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{tcgPlusError}</span>
                </div>
              )}

              {/* 取得結果プレビュー */}
              {tcgPlusResult && (
                <div className="p-4 rounded-2xl bg-slate-950 border border-indigo-500/40 space-y-3 animate-in fade-in">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span className="font-bold text-white text-xs">
                          レシピ取得成功 (コード: {tcgPlusResult.deckCode})
                        </span>
                      </div>
                      <span className="text-[11px] text-indigo-300 font-medium pl-6 block">
                        合計 {tcgPlusResult.items.reduce((sum, it) => sum + it.count, 0)} 枚 ({tcgPlusResult.items.length} 種)
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={tcgPlusDeckName}
                        onChange={(e) => setTcgPlusDeckName(e.target.value)}
                        placeholder="デッキ名"
                        className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-100 focus:ring-1 focus:ring-indigo-500"
                      />
                      <button
                        onClick={handleApplyTcgPlusDeck}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition flex items-center gap-1 shadow-md shadow-emerald-600/30 whitespace-nowrap"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        このデッキを作成
                      </button>
                    </div>
                  </div>

                  {/* カード一覧サムネイル */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-56 overflow-y-auto p-1">
                    {tcgPlusResult.items.map((item) => (
                      <div
                        key={item.card.code}
                        className="flex items-center gap-2 p-1.5 rounded-lg bg-slate-900/80 border border-slate-800 text-[11px]"
                      >
                        {item.card.imageUrl ? (
                          <img
                            src={item.card.imageUrl}
                            alt={item.card.name}
                            className="w-8 h-11 object-cover rounded shadow shrink-0"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-8 h-11 bg-slate-800 rounded flex items-center justify-center text-[9px] text-slate-400 shrink-0">
                            No Img
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-bold text-slate-200 text-[10px]">
                            {item.card.name}
                          </p>
                          <p className="text-[9px] text-slate-400 font-mono">
                            {item.card.code}
                          </p>
                          <span className="text-[10px] font-bold text-indigo-400">
                            × {item.count}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {/* タブ1: シリーズ取得 */}
          {activeTab === 'series' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <span className="font-bold text-slate-200 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-400" /> 公式サイトから商品別カード一覧を取得
                </span>
                <p className="text-slate-400 leading-relaxed text-[11px]">
                  ユニオンアリーナ公式サイトのカードリストから、指定した商品の全カード（画像・BP・AP・効果・トリガー）をオンラインで一括取得し、シミュレータのカードプールに追加します。
                </p>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-bold text-slate-300 block mb-1 text-[11px]">作品で絞り込み (全57作品):</label>
                    <select
                      value={seriesTitleFilter}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSeriesTitleFilter(val);
                        const filtered = OFFICIAL_SERIES_LIST.filter(
                          (s) => val === 'ALL' || s.title.includes(val) || s.name.includes(val)
                        );
                        if (filtered.length > 0) setSelectedSeriesId(filtered[0].seriesId);
                      }}
                      disabled={isFetchingSeries}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    >
                      <option value="ALL">すべての作品 (全117シリーズ)</option>
                      {OFFICIAL_TITLES.map((title) => (
                        <option key={title} value={title}>
                          {title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-300 block mb-1 text-[11px]">商品名・型番検索:</label>
                    <input
                      type="text"
                      placeholder="例: UA01BT, Vol.2..."
                      value={seriesSearch}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSeriesSearch(val);
                        const filtered = OFFICIAL_SERIES_LIST.filter((s) => {
                          const matchTitle =
                            seriesTitleFilter === 'ALL' ||
                            s.title.includes(seriesTitleFilter) ||
                            s.name.includes(seriesTitleFilter);
                          const matchSearch =
                            !val.trim() ||
                            s.name.toLowerCase().includes(val.toLowerCase()) ||
                            s.seriesId.includes(val);
                          return matchTitle && matchSearch;
                        });
                        if (filtered.length > 0) setSelectedSeriesId(filtered[0].seriesId);
                      }}
                      disabled={isFetchingSeries}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-300 block text-[11px]">取得する商品・シリーズを選択:</label>
                    <span className="text-[10px] text-slate-400">
                      該当:{' '}
                      {
                        OFFICIAL_SERIES_LIST.filter((s) => {
                          const matchTitle =
                            seriesTitleFilter === 'ALL' ||
                            s.title.includes(seriesTitleFilter) ||
                            s.name.includes(seriesTitleFilter);
                          const matchSearch =
                            !seriesSearch.trim() ||
                            s.name.toLowerCase().includes(seriesSearch.toLowerCase()) ||
                            s.seriesId.includes(seriesSearch);
                          return matchTitle && matchSearch;
                        }).length
                      }{' '}
                      件
                    </span>
                  </div>
                  <select
                    value={selectedSeriesId}
                    onChange={(e) => setSelectedSeriesId(e.target.value)}
                    disabled={isFetchingSeries}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    {OFFICIAL_SERIES_LIST.filter((s) => {
                      const matchTitle =
                        seriesTitleFilter === 'ALL' ||
                        s.title.includes(seriesTitleFilter) ||
                        s.name.includes(seriesTitleFilter);
                      const matchSearch =
                        !seriesSearch.trim() ||
                        s.name.toLowerCase().includes(seriesSearch.toLowerCase()) ||
                        s.seriesId.includes(seriesSearch);
                      return matchTitle && matchSearch;
                    }).map((s: OfficialSeriesInfo) => (
                      <option key={s.seriesId} value={s.seriesId}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* パラレル取得チェックボックス */}
                <div className="p-2.5 rounded-xl bg-slate-950/40 border border-slate-800 flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-200 select-none">
                    <input
                      type="checkbox"
                      checked={includeParallel}
                      onChange={(e) => setIncludeParallel(e.target.checked)}
                      disabled={isFetchingSeries}
                      className="rounded bg-slate-900 border-slate-700 text-amber-500 focus:ring-amber-400"
                    />
                    <span className="flex items-center gap-1.5 font-bold text-[11px]">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      パラレルカード（★, AP, サイン版）も同時に取得する
                    </span>
                  </label>
                  <span className="text-[10px] text-slate-400">
                    ※OFF時は通常版のみ高速取得
                  </span>
                </div>
              </div>

              {/* プログレス表示 */}
              {isFetchingSeries && (
                <div className="p-4 rounded-xl bg-indigo-950/30 border border-indigo-500/30 space-y-2 text-center">
                  <div className="flex items-center justify-center gap-2 text-indigo-300 font-bold">
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                    <span>公式サイトからカード情報を取得中...</span>
                  </div>
                  {fetchProgress && (
                    <div className="space-y-1">
                      <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-indigo-500 h-2 rounded-full transition-all duration-300"
                          style={{
                            width: `${Math.round((fetchProgress.current / fetchProgress.total) * 100)}%`,
                          }}
                        />
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {fetchProgress.current} / {fetchProgress.total} 枚完了
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* 成功メッセージ */}
              {fetchSuccessMsg && (
                <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/50 text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{fetchSuccessMsg}</span>
                </div>
              )}

              {/* エラーメッセージ */}
              {fetchErrorMsg && (
                <div className="p-3.5 rounded-xl bg-rose-950/50 border border-rose-500/50 text-rose-200 space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-rose-300 text-xs">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>取得に失敗しました</span>
                  </div>
                  <p className="text-[11px] text-rose-300/90 leading-relaxed pl-6">
                    {fetchErrorMsg}
                  </p>
                  <div className="text-[10px] text-slate-300 bg-slate-950/80 p-2 rounded-lg mt-2 border border-slate-800 space-y-1">
                    <div className="font-semibold text-amber-300">💡 対処法:</div>
                    <div>1. Vite開発サーバー（<code className="text-indigo-300">npm run dev</code>）を再起動してブラウザをリロードしてください。</div>
                    <div>2. またはターミナルで <code className="text-emerald-300">npm run sync-cards</code> を実行すると、全カードを確実にオフライン同期できます。</div>
                  </div>
                </div>
              )}

              <button
                onClick={handleFetchSeries}
                disabled={isFetchingSeries}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 font-bold text-white shadow-lg shadow-indigo-600/30 transition flex items-center justify-center gap-2"
              >
                {isFetchingSeries ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                <span>このシリーズのカードを取得してプールに追加</span>
              </button>
            </div>
          )}

          {/* タブ2: デッキテキストインポート */}
          {activeTab === 'deckText' && (
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-300 space-y-1 text-[11px]">
                <p>
                  <strong>公式デッキコード / テキスト形式の対応:</strong>
                </p>
                <p className="text-slate-400">
                  例: <code>UA01BT/CGH-1-001 x4</code> のようにカード番号と枚数が書かれたリストをそのまま貼り付けると、自動認識して50枚デッキを構築します。
                </p>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-300">デッキ名:</label>
                <input
                  type="text"
                  value={deckNameInput}
                  onChange={(e) => setDeckNameInput(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 text-xs focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-300">デッキテキスト:</label>
                <textarea
                  rows={6}
                  value={deckText}
                  onChange={(e) => {
                    setDeckText(e.target.value);
                    setHasParsed(false);
                  }}
                  placeholder="UA01BT/CGH-1-001 x4&#10;UA01BT/CGH-1-002 x4&#10;UA01BT/CGH-1-010 4&#10;..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 font-mono text-[11px] text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleParseDeckText}
                  className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold border border-slate-700 transition"
                >
                  テキストを解析・プレビュー
                </button>
              </div>

              {/* 解析プレビュー */}
              {hasParsed && (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-indigo-300">
                      認識できたカード: {parsedItems.reduce((sum, it) => sum + it.count, 0)} 枚 ({parsedItems.length} 種)
                    </span>
                    <button
                      onClick={handleApplyDeck}
                      disabled={parsedItems.length === 0}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition flex items-center gap-1 shadow"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      このデッキを適用する
                    </button>
                  </div>

                  {notFoundCodes.length > 0 && (
                    <div className="p-2 rounded bg-amber-950/40 border border-amber-500/40 text-[11px] text-amber-300">
                      ⚠️ 現在のカードプールに見つからなかったカード ({notFoundCodes.length}件):
                      <div className="font-mono text-[10px] mt-1 text-slate-300">
                        {notFoundCodes.join(', ')}
                      </div>
                      <span className="text-[10px] text-slate-400 block mt-1">
                        ※タブ①から該当シリーズを取得すると認識できるようになります。
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* タブ3: HTML直接貼付 */}
          {activeTab === 'html' && (
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-300 space-y-1 text-[11px]">
                <p>
                  <strong>公式サイト詳細ページのHTML直接解析:</strong>
                </p>
                <p className="text-slate-400">
                  公式サイトのカード詳細（<code>detail_iframe.php</code> 等）のHTMLソースを貼り付けることで、オフラインや未収録カードでも即座にカードプールに追加できます。
                </p>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-300">カード番号 (例: UA01BT/CGH-1-001):</label>
                <input
                  type="text"
                  value={htmlCardNoInput}
                  onChange={(e) => setHtmlCardNoInput(e.target.value)}
                  placeholder="UA01BT/CGH-1-001"
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 text-xs focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-300">HTMLソースコード:</label>
                <textarea
                  rows={6}
                  value={htmlInput}
                  onChange={(e) => setHtmlInput(e.target.value)}
                  placeholder="<div class=&quot;cardDetailCol&quot;>..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 font-mono text-[10px] text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              {htmlSuccessMsg && (
                <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/50 text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{htmlSuccessMsg}</span>
                </div>
              )}

              <button
                onClick={handleParseHtml}
                disabled={!htmlInput.trim()}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 font-bold text-white transition flex items-center justify-center gap-1.5 shadow"
              >
                <Plus className="w-4 h-4" />
                <span>HTMLをパースしてカードプールに追加</span>
              </button>
            </div>
          )}
        </div>

        {/* モーダルフッター */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs">
          <a
            href="https://www.unionarena-tcg.com/jp/cardlist/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition"
          >
            <span>公式サイトのカードリストを開く</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
