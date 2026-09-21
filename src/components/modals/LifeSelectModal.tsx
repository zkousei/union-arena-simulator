import React from 'react';
import { Card } from '../../types/card';
import { ShieldAlert, Zap, Trash2, Hand, ArrowUp, ArrowDown, RefreshCw, Eye, X } from 'lucide-react';

export interface LifeSelectModalProps {
  isOpen: boolean;
  lifeCards: Card[];
  playerName: string;
  isOpponent: boolean;
  onCheckLife: (lifeIndex: number) => void;
  onTakeLife: (destination: 'hand' | 'graveyard' | 'deckTop' | 'deckBottom', lifeIndex: number) => void;
  onFlipLife?: (lifeIndex: number) => void;
  onInspectCard?: (card: Card) => void;
  onClose: () => void;
}

export const LifeSelectModal: React.FC<LifeSelectModalProps> = ({
  isOpen,
  lifeCards,
  playerName,
  isOpponent,
  onCheckLife,
  onTakeLife,
  onFlipLife,
  onInspectCard,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isOpponent ? '相手ライフの指定・操作' : '自分ライフの選択・操作'}
        className="bg-slate-900 border-2 border-rose-500/80 rounded-2xl max-w-4xl w-full p-3 sm:p-5 shadow-2xl flex flex-col gap-3 sm:gap-4 animate-in fade-in zoom-in-95 duration-200 text-slate-100 my-auto max-h-[calc(100dvh-1.5rem)] sm:max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3 shrink-0">
          <div className="flex items-start gap-2 min-w-0">
            <ShieldAlert className="w-5 h-5 text-rose-400" />
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-white flex flex-col sm:flex-row gap-1 sm:gap-2">
                <span>{isOpponent ? '🎯 相手ライフの指定・操作' : '🛡️ 自分ライフの選択・操作'}</span>
                <span className="text-xs font-normal text-rose-300 bg-rose-950/80 px-2 py-0.5 rounded-full border border-rose-500/40">
                  {playerName}（残り {lifeCards.length}枚）
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {isOpponent
                  ? '公式ルール: 攻撃側プレイヤーは相手ライフから好きなカードを1枚指定してトリガーチェックを行います。'
                  : 'ライフの確認・手札回収・自傷・山札戻しなどを手動で実行できます。'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            {lifeCards.length > 0 && (
              <button
                onClick={() => {
                  onCheckLife(0);
                  onClose();
                }}
                className="px-2.5 py-1.5 bg-rose-700 hover:bg-rose-600 rounded-lg text-xs font-bold text-white shadow flex items-center gap-1 transition-colors"
                title="先頭(#1)のライフカードを素早くトリガーチェック"
              >
                <Zap className="w-3.5 h-3.5" />
                <span className="sm:hidden">先頭をチェック</span>
                <span className="hidden sm:inline">先頭(#1)をトリガーチェック</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
              title="閉じる (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ライフカード一覧 */}
        <div className="overflow-y-auto max-h-[65vh] pr-1 scrollbar-thin">
          {lifeCards.length === 0 ? (
            <div className="text-sm text-slate-400 py-16 text-center">
              ライフエリアにカードがありません。
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {lifeCards.map((card, idx) => {
                const isFaceDown = card.isFaceDown !== false;
                return (
                  <div
                    key={`${card.id}-${idx}`}
                    className={`rounded-xl border p-2.5 flex flex-col justify-between gap-2 shadow-lg transition-all ${
                      !isFaceDown
                        ? 'bg-amber-950/40 border-amber-500/80 shadow-amber-950/40'
                        : isOpponent
                        ? 'bg-slate-950/80 border-rose-700/60 shadow-black/60'
                        : 'bg-slate-950/80 border-slate-700/80 shadow-black/60'
                    }`}
                  >
                    {/* カード上部情報 */}
                    <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-1.5">
                      <span className="font-extrabold text-white text-sm">ライフ #{idx + 1}</span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          !isFaceDown
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}
                      >
                        {!isFaceDown ? '表向き (公開中)' : '裏向き'}
                      </span>
                    </div>

                    {/* カードプレビュー */}
                    <div className="flex flex-col items-center justify-center min-h-[90px] py-1 text-center">
                      {!isFaceDown ? (
                        <div className="w-full flex flex-col items-center gap-1">
                          {card.imageUrl ? (
                            <img
                              src={card.imageUrl}
                              alt={card.name}
                              className="w-16 h-22 object-contain rounded border border-slate-700 shadow"
                            />
                          ) : (
                            <div className="w-16 h-22 bg-slate-800 rounded border border-slate-700 flex flex-col items-center justify-center p-1">
                              <span className="text-[9px] text-amber-300 font-bold">{card.code}</span>
                            </div>
                          )}
                          <div className="font-bold text-xs text-white truncate max-w-full">
                            {card.name}
                          </div>
                          {card.triggers.length > 0 && (
                            <div className="flex gap-1 flex-wrap justify-center">
                              {card.triggers.map((trig, tIdx) => (
                                <span
                                  key={tIdx}
                                  className="bg-amber-600 text-white font-black px-1.5 py-0.2 rounded text-[8px]"
                                >
                                  {trig}
                                </span>
                              ))}
                            </div>
                          )}
                          {onInspectCard && (
                            <button
                              type="button"
                              onClick={() => onInspectCard(card)}
                              className="text-[10px] text-indigo-300 hover:text-white flex items-center gap-0.5 mt-0.5"
                            >
                              <Eye className="w-3 h-3" />
                              詳細確認
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center text-slate-500 py-3">
                          <ShieldAlert className="w-8 h-8 opacity-40 mb-1 text-rose-400" />
                          <span className="text-[11px] font-semibold text-slate-400">非公開カード</span>
                        </div>
                      )}
                    </div>

                    {/* アクションボタン群 */}
                    <div className="flex flex-col gap-1.5 pt-1.5 border-t border-slate-800/80">
                      {/* メイン: トリガーチェック */}
                      <button
                        onClick={() => {
                          onCheckLife(idx);
                          onClose();
                        }}
                        className="w-full py-1.5 bg-rose-700 hover:bg-rose-600 text-white font-extrabold rounded-lg text-xs shadow-md shadow-rose-900/30 flex items-center justify-center gap-1 transition-colors"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        このライフでトリガーチェック
                      </button>

                      {isOpponent ? (
                        <div className="text-[10px]">
                          <button
                            onClick={() => {
                              onTakeLife('graveyard', idx);
                              onClose();
                            }}
                            className="py-1 bg-rose-950 hover:bg-rose-900 border border-rose-600/50 text-rose-200 rounded font-bold flex items-center justify-center gap-0.5 transition-colors"
                            title="このカードを直接場外へ送る（ダメージ2、インパクト等）"
                          >
                            <Trash2 className="w-3 h-3 text-rose-400" />
                            場外へ (-1)
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1 text-[10px]">
                          <div className="grid grid-cols-2 gap-1">
                            <button
                              onClick={() => {
                                onTakeLife('hand', idx);
                                onClose();
                              }}
                              className="py-1 bg-sky-950 hover:bg-sky-900 border border-sky-500/50 text-sky-200 rounded font-bold flex items-center justify-center gap-0.5 transition-colors"
                              title="手札に加える"
                            >
                              <Hand className="w-3 h-3 text-sky-400" />
                              手札に回収
                            </button>
                            <button
                              onClick={() => {
                                onTakeLife('graveyard', idx);
                                onClose();
                              }}
                              className="py-1 bg-rose-950 hover:bg-rose-900 border border-rose-600/50 text-rose-200 rounded font-bold flex items-center justify-center gap-0.5 transition-colors"
                              title="自傷や効果で場外へ送る"
                            >
                              <Trash2 className="w-3 h-3 text-rose-400" />
                              場外へ
                            </button>
                          </div>
                          <div className="grid grid-cols-3 gap-1">
                            <button
                              onClick={() => {
                                onTakeLife('deckTop', idx);
                                onClose();
                              }}
                              className="py-1 bg-emerald-950 hover:bg-emerald-900 border border-emerald-500/50 text-emerald-200 rounded text-[9px] font-medium flex items-center justify-center gap-0.5 transition-colors"
                              title="山札の一番上に戻す"
                            >
                              <ArrowUp className="w-2.5 h-2.5 text-emerald-400" />
                              山札上
                            </button>
                            <button
                              onClick={() => {
                                onTakeLife('deckBottom', idx);
                                onClose();
                              }}
                              className="py-1 bg-emerald-950 hover:bg-emerald-900 border border-emerald-500/50 text-emerald-200 rounded text-[9px] font-medium flex items-center justify-center gap-0.5 transition-colors"
                              title="山札の一番下へ送る"
                            >
                              <ArrowDown className="w-2.5 h-2.5 text-emerald-400" />
                              山札下
                            </button>
                            {onFlipLife && (
                              <button
                                onClick={() => onFlipLife(idx)}
                                className="py-1 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 rounded text-[9px] font-medium flex items-center justify-center gap-0.5 transition-colors"
                                title="表/裏を切り替える"
                              >
                                <RefreshCw className="w-2.5 h-2.5 text-amber-400" />
                                表/裏
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
