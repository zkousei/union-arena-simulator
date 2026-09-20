import React from 'react';
import { UserDeck, validateDeck } from '../../domain/deckValidation';
import { CardMaster } from '../../data/cardDatabase';
import { Plus, Minus, Trash2, CheckCircle2, AlertTriangle, Play, Save, Download, FolderOpen } from 'lucide-react';

interface DeckBuilderDeckPaneProps {
  deck: UserDeck;
  onUpdateDeckName: (name: string) => void;
  onIncrementCard: (cardCode: string) => void;
  onDecrementCard: (cardCode: string) => void;
  onRemoveCard: (cardCode: string) => void;
  onSave: () => void;
  onOpenMyDecks: () => void;
  onExportJson: () => void;
  onPlayWithDeck: () => void;
  onInspectCard: (card: CardMaster) => void;
}

export const DeckBuilderDeckPane: React.FC<DeckBuilderDeckPaneProps> = ({
  deck,
  onUpdateDeckName,
  onIncrementCard,
  onDecrementCard,
  onRemoveCard,
  onSave,
  onOpenMyDecks,
  onExportJson,
  onPlayWithDeck,
  onInspectCard,
}) => {
  const validation = validateDeck(deck);

  // エナジー順にソート
  const sortedItems = [...deck.items].sort((a, b) => a.card.reqEnergy - b.card.reqEnergy);

  // エナジーカーブ計算 (0, 1, 2, 3, 4, 5+)
  const energyCurve: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  deck.items.forEach((item) => {
    const e = Math.min(item.card.reqEnergy, 5);
    energyCurve[e] = (energyCurve[e] || 0) + item.count;
  });

  return (
    <div className="flex flex-col h-full bg-slate-900 text-xs">
      {/* デッキヘッダー */}
      <div className="p-3 bg-slate-950/80 border-b border-slate-800 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <input
            type="text"
            value={deck.name}
            onChange={(e) => onUpdateDeckName(e.target.value)}
            placeholder="デッキ名を入力..."
            className="flex-1 font-bold text-sm bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-100 focus:outline-none focus:border-indigo-500"
          />

          <div className="flex items-center gap-1">
            <button
              onClick={onOpenMyDecks}
              className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-semibold"
              title="保存済みデッキ一覧を開く"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              一覧
            </button>
            <button
              onClick={onSave}
              className="flex items-center gap-1 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold shadow"
              title="デッキを保存 (LocalStorage)"
            >
              <Save className="w-3.5 h-3.5" />
              保存
            </button>
            <button
              onClick={onExportJson}
              className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
              title="JSONダウンロード"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 枚数プログレス ＆ 対戦開始ボタン */}
        <div className="flex items-center justify-between bg-slate-900/90 p-2 rounded-xl border border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-semibold">合計枚数:</span>
            <span
              className={`text-base font-extrabold px-2 py-0.5 rounded ${
                validation.totalCards === 50
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                  : 'bg-rose-950 text-rose-300 border border-rose-500/40'
              }`}
            >
              {validation.totalCards} / 50 枚
            </span>
          </div>

          <button
            onClick={onPlayWithDeck}
            disabled={!validation.isValid}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 text-white font-extrabold rounded-lg shadow-lg shadow-emerald-600/30 transition transform active:scale-95"
            title="この50枚デッキを対戦シミュレータに展開してゲームを開始します"
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            このデッキで対戦する
          </button>
        </div>

        {/* バリデーションステータス表示 */}
        <div>
          {validation.isValid ? (
            <div className="flex items-center gap-1.5 text-emerald-400 font-bold bg-emerald-950/40 border border-emerald-500/30 p-2 rounded-lg text-[11px]">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>公式レギュレーション適合（50枚・同名4枚・トリガー制限準拠）</span>
            </div>
          ) : (
            <div className="bg-rose-950/40 border border-rose-500/30 p-2 rounded-lg space-y-1">
              {validation.errors.map((err, idx) => (
                <div key={idx} className="flex items-center gap-1.5 text-rose-300 text-[11px]">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 text-rose-400" />
                  <span>{err.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* デッキ内カードリスト */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5 scrollbar-thin">
        {sortedItems.length === 0 ? (
          <div className="text-slate-500 py-20 text-center">
            左側のカード一覧からカードを追加してください
          </div>
        ) : (
          sortedItems.map((item) => (
            <div
              key={item.card.code}
              className="flex items-center justify-between bg-slate-950/70 p-2 rounded-xl border border-slate-800 hover:border-slate-700 transition"
            >
              {/* カード情報 */}
              <div
                onClick={() => onInspectCard(item.card)}
                className="flex items-center gap-2 cursor-pointer flex-1 min-w-0"
              >
                <span className="px-1.5 py-0.5 rounded bg-amber-950/80 border border-amber-500/40 text-amber-300 text-[10px] font-bold">
                  ⚡{item.card.reqEnergy}
                </span>
                <span className="font-bold text-slate-200 truncate">{item.card.name}</span>
                {item.card.triggers.length > 0 && (
                  <span className="text-[9px] bg-slate-800 text-slate-300 px-1 py-0.2 rounded font-semibold">
                    {item.card.triggers.join(',')}
                  </span>
                )}
              </div>

              {/* 枚数操作ボタン */}
              <div className="flex items-center gap-1.5 ml-2">
                <button
                  onClick={() => onDecrementCard(item.card.code)}
                  className="p-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-300"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="font-extrabold w-5 text-center text-slate-100">
                  {item.count}
                </span>
                <button
                  onClick={() => onIncrementCard(item.card.code)}
                  disabled={item.count >= 4}
                  className="p-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 rounded text-slate-300"
                >
                  <Plus className="w-3 h-3" />
                </button>
                <button
                  onClick={() => onRemoveCard(item.card.code)}
                  className="p-1 text-slate-500 hover:text-rose-400 rounded ml-1"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* フッター: エナジー曲線 & 特別トリガー内訳 */}
      <div className="p-3 bg-slate-950/90 border-t border-slate-800 space-y-2">
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span>エナジー分布:</span>
          <div className="flex items-center gap-1.5">
            {[0, 1, 2, 3, 4, 5].map((e) => (
              <span key={e} className="px-1.5 py-0.5 bg-slate-900 rounded font-mono text-[10px]">
                {e === 5 ? '5+' : e}: <strong className="text-white">{energyCurve[e] || 0}</strong>
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span>特別トリガー:</span>
          <div className="flex items-center gap-2 text-[10px]">
            <span>SPECIAL: <strong className={validation.specialCount > 4 ? 'text-rose-400' : 'text-white'}>{validation.specialCount}/4</strong></span>
            <span>COLOR: <strong className={validation.colorCount > 4 ? 'text-rose-400' : 'text-white'}>{validation.colorCount}/4</strong></span>
            <span>FINAL: <strong className={validation.finalCount > 4 ? 'text-rose-400' : 'text-white'}>{validation.finalCount}/4</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
};
