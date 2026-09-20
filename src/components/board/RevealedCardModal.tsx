import React, { useState } from 'react';
import { Card } from '../../types/card';
import { CARD_DATABASE } from '../../data/cardDatabase';
import { Sparkles, Hand, Trash2, ArrowLeft, X, ShieldAlert } from 'lucide-react';

interface RevealedCardModalProps {
  revealed: {
    card: Card;
    source: string;
    fromPlayerId: string;
    isTrigger?: boolean;
  } | null;
  inspectCard: Card | null;
  onDismissRevealed?: (destination: 'hand' | 'graveyard' | 'life' | 'cancel') => void;
  onCloseInspect?: () => void;
}

const KEYWORD_STYLE_MAP: Record<string, string> = {
  '登場時': 'bg-purple-900/90 text-purple-200 border-purple-400/60',
  '退場時': 'bg-rose-900/90 text-rose-200 border-rose-400/60',
  'アタック時': 'bg-amber-900/90 text-amber-200 border-amber-400/60',
  'ブロック時': 'bg-sky-900/90 text-sky-200 border-sky-400/60',
  '起動メイン': 'bg-emerald-900/90 text-emerald-200 border-emerald-400/60',
  'レイド': 'bg-fuchsia-900/90 text-fuchsia-200 border-fuchsia-400/60',
  '自分のターン中': 'bg-indigo-900/90 text-indigo-200 border-indigo-400/60',
  '相手のターン中': 'bg-blue-900/90 text-blue-200 border-blue-400/60',
  'ターン1回': 'bg-slate-800 text-amber-300 border-amber-500/40',
  'インパクト': 'bg-red-900/90 text-amber-200 border-red-500/60',
  'ダメージ2': 'bg-red-900/90 text-amber-200 border-red-500/60',
  '狙い撃ち': 'bg-amber-950 text-amber-300 border-amber-500/60',
};

const formatEffectText = (text: string): React.ReactNode[] => {
  const parts = text.split(/(【[^】]+】|\[[^\]]+\])/g);
  return parts.map((part, i) => {
    if (part.startsWith('【') && part.endsWith('】')) {
      const keyword = part.slice(1, -1);
      const style = KEYWORD_STYLE_MAP[keyword] || 'bg-slate-800 text-amber-300 border-slate-600';
      return (
        <span
          key={i}
          className={`inline-block font-black text-[11px] px-1.5 py-0.5 rounded border mx-0.5 my-0.5 shadow-sm align-middle leading-tight ${style}`}
        >
          {part}
        </span>
      );
    }
    if (part.startsWith('[') && part.endsWith(']')) {
      const keyword = part.slice(1, -1);
      const style = KEYWORD_STYLE_MAP[keyword] || 'bg-slate-800 text-sky-300 border-slate-600';
      return (
        <span
          key={i}
          className={`inline-block font-bold text-[10px] px-1 py-0.2 rounded border mx-0.5 shadow-sm align-middle leading-tight ${style}`}
        >
          {part}
        </span>
      );
    }
    return part;
  });
};

export const RevealedCardModal: React.FC<RevealedCardModalProps> = ({
  revealed,
  inspectCard,
  onDismissRevealed,
  onCloseInspect,
}) => {
  const [imgError, setImgError] = useState(false);
  const [isEnlargedImage, setIsEnlargedImage] = useState(false);
  const card = revealed ? revealed.card : inspectCard;
  const isTriggerModal = !!revealed && revealed.isTrigger !== false;

  const handleClose = () => {
    if (isTriggerModal) {
      onDismissRevealed?.('graveyard');
    } else if (revealed) {
      onDismissRevealed?.('cancel');
    } else {
      onCloseInspect?.();
    }
  };

  if (!card) return null;

  const masterCard =
    card.bp === null || card.bp === undefined
      ? CARD_DATABASE.find((c) => c.code === card.code)
      : null;
  const effectiveBp = card.bp ?? masterCard?.bp ?? null;
  const effectiveHasBpPlus = card.hasBpPlus ?? masterCard?.hasBpPlus ?? false;

  const hasValidImage = !!card.imageUrl && !imgError;

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto"
        onClick={() => {
          if (!isTriggerModal) handleClose();
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={isTriggerModal ? `トリガー確認: ${revealed?.source || ''}` : 'カード情報詳細'}
          className="bg-slate-900 border-2 border-indigo-500/70 rounded-2xl max-w-2xl w-full max-h-[calc(100dvh-1.5rem)] p-3 sm:p-5 shadow-2xl flex flex-col gap-3 sm:gap-4 overflow-y-auto animate-in fade-in zoom-in-95 duration-200 text-slate-100 my-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* ヘッダー */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <h3 className="font-extrabold text-sm sm:text-base text-white flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                <span>{isTriggerModal ? `⚡ ${revealed.source}` : revealed ? `🔍 ${revealed.source}` : 'カード情報詳細'}</span>
                <span className="text-xs font-normal text-indigo-300 bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-700/50">
                  {card.code}
                </span>
              </h3>
            </div>
            {!isTriggerModal && (
              <button
                onClick={handleClose}
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition"
                title="閉じる (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* メインコンテンツ: 左側カード画像、右側詳細情報 */}
          <div className="flex flex-col sm:flex-row gap-4 items-center sm:items-start">
            {/* カード画像またはフォールバック */}
            <div className="w-48 sm:w-56 shrink-0 flex flex-col items-center">
              {hasValidImage ? (
                <div
                  className="relative rounded-xl overflow-hidden border-2 border-slate-700 shadow-2xl bg-black cursor-zoom-in group"
                  onClick={() => setIsEnlargedImage(true)}
                  title="クリックでさらに拡大表示"
                >
                  <img
                    src={card.imageUrl}
                    alt={card.name}
                    onError={() => setImgError(true)}
                    className="w-full h-auto object-contain max-h-[320px] rounded-xl transition-transform group-hover:scale-105"
                  />
                  <div className="absolute bottom-1 right-1 bg-black/75 text-[9px] text-slate-300 px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                    クリックで拡大
                  </div>
                </div>
              ) : (
                <div className="w-48 h-64 bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 border-2 border-slate-700 rounded-xl p-3 flex flex-col justify-between items-center text-center shadow-lg">
                  <div className="text-xs font-bold text-indigo-300">{card.code}</div>
                  <div className="my-auto">
                    <div className="text-sm font-bold text-white mb-1">{card.name}</div>
                    <div className="text-xs text-slate-400">[{card.cardType}]</div>
                  </div>
                  {effectiveBp !== null && (
                    <div className="bg-slate-800 px-3 py-1 rounded text-xs font-bold text-amber-300 border border-amber-500/40">
                      BP {effectiveBp}{effectiveHasBpPlus ? '+' : ''}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 右側詳細スペック＆効果テキスト */}
            <div className="flex-1 flex flex-col gap-2.5 w-full text-xs">
              {/* カード名・タイプ・BP */}
              <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-extrabold text-sm sm:text-base text-white">{card.name}</span>
                  {effectiveBp !== null && (
                    <span className="px-2 py-0.5 rounded bg-amber-950 border border-amber-500/60 font-black text-amber-300 text-xs shadow">
                      BP {effectiveBp}{effectiveHasBpPlus ? '+' : ''}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-400">
                  <span>種別: <strong className="text-slate-200">{card.cardType}</strong></span>
                  <span>•</span>
                  <span>色: <strong className="text-purple-300">{card.color}</strong></span>
                </div>
              </div>

              {/* コスト / エナジー グリッド */}
              <div className="grid grid-cols-3 gap-1.5 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 text-center">
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-400">APコスト</span>
                  <span className="font-black text-sky-400 text-sm">{card.apCost}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-400">必要エナジー</span>
                  <span className="font-black text-amber-400 text-sm">{card.reqEnergy}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-400">発生エナジー</span>
                  <span className="font-black text-emerald-400 text-sm">+{card.genEnergy}</span>
                </div>
              </div>

              {/* 特徴 & トリガー */}
              {(card.traits.length > 0 || card.triggers.length > 0) && (
                <div className="flex flex-col gap-1.5 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                  {card.traits.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] text-slate-400 font-semibold">特徴:</span>
                      {card.traits.map((trait, i) => (
                        <span
                          key={i}
                          className="bg-slate-800/90 text-slate-300 border border-slate-700 px-2 py-0.5 rounded-md text-[10px] font-medium"
                        >
                          {trait}
                        </span>
                      ))}
                    </div>
                  )}
                  {card.triggers.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-amber-400 font-semibold flex items-center gap-0.5">
                        <ShieldAlert className="w-3.5 h-3.5" />
                        トリガー:
                      </span>
                      {card.triggers.map((trig, i) => (
                        <span
                          key={i}
                          className="bg-gradient-to-r from-amber-600 to-amber-500 text-white font-black px-2.5 py-0.5 rounded-md text-[11px] shadow"
                        >
                          {trig}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* テキスト効果 */}
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs leading-relaxed text-slate-200 whitespace-pre-line shadow-inner max-h-48 overflow-y-auto scrollbar-thin">
                {card.effectText ? (
                  <div>{formatEffectText(card.effectText)}</div>
                ) : (
                  <div className="text-slate-500 italic">（通常効果テキストなし）</div>
                )}
              </div>
            </div>
          </div>

        {/* トリガーモーダル用アクションボタン */}
        {isTriggerModal && onDismissRevealed && (
          <div className="flex flex-col gap-2 pt-2 border-t border-slate-800">
            <span className="text-xs text-slate-400">
              公式ルール: トリガー処理後、カードは原則<strong>場外</strong>に置かれます（ゲットトリガー時のみ手札）：
            </span>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => onDismissRevealed('graveyard')}
                className="flex items-center justify-center gap-1.5 bg-rose-600 hover:bg-rose-500 text-white py-2 rounded-lg text-xs font-bold shadow-lg shadow-rose-600/30 ring-1 ring-rose-400 transition"
              >
                <Trash2 className="w-4 h-4" />
                場外へ送る (基本)
              </button>
              <button
                onClick={() => onDismissRevealed('hand')}
                className="flex items-center justify-center gap-1.5 bg-sky-700 hover:bg-sky-600 text-white py-2 rounded-lg text-xs font-bold transition"
              >
                <Hand className="w-4 h-4" />
                手札に加える
              </button>
              <button
                onClick={() => onDismissRevealed('life')}
                className="flex items-center justify-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg text-xs font-bold transition"
              >
                <ArrowLeft className="w-4 h-4" />
                ライフに戻す
              </button>
            </div>
          </div>
        )}

        {/* 非トリガー時（カード情報確認・公開時）の閉じるボタン */}
        {!isTriggerModal && (
          <div className="flex justify-end pt-2 border-t border-slate-800">
            <button
              onClick={handleClose}
              className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 border border-slate-700"
            >
              <X className="w-4 h-4" />
              閉じる (Esc)
            </button>
          </div>
        )}
      </div>
    </div>

    {/* カード画像フルスクリーン拡大ビュー */}
    {isEnlargedImage && hasValidImage && (
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 p-4 cursor-zoom-out animate-in fade-in duration-150"
        onClick={() => setIsEnlargedImage(false)}
        title="クリックで拡大を閉じる"
      >
        <img
          src={card.imageUrl}
          alt={card.name}
          className="max-w-full max-h-[92vh] object-contain rounded-2xl shadow-2xl border-2 border-indigo-400/80 animate-in zoom-in-95 duration-150"
        />
      </div>
    )}
  </>
  );
};
