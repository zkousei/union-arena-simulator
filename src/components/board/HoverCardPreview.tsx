import React, { useState } from 'react';
import { Card } from '../../types/card';
import { CARD_DATABASE } from '../../data/cardDatabase';
import { ShieldAlert } from 'lucide-react';

interface HoverCardPreviewProps {
  card: Card | null;
  enabled?: boolean;
}

export const HoverCardPreview: React.FC<HoverCardPreviewProps> = ({
  card,
  enabled = true,
}) => {
  const [imgError, setImgError] = useState(false);

  if (!card || !enabled) return null;

  const masterCard =
    card.bp === null || card.bp === undefined
      ? CARD_DATABASE.find((c) => c.code === card.code)
      : null;
  const effectiveBp = card.bp ?? masterCard?.bp ?? null;
  const effectiveHasBpPlus = card.hasBpPlus ?? masterCard?.hasBpPlus ?? false;
  const hasValidImage = !!card.imageUrl && !imgError;

  return (
    <div className="fixed bottom-4 left-4 z-40 pointer-events-none hidden lg:flex flex-col bg-slate-900/95 border-2 border-indigo-500/70 rounded-2xl shadow-2xl p-3 w-64 backdrop-blur-md animate-in fade-in zoom-in-95 duration-150 text-slate-100">
      {/* カード画像 */}
      {hasValidImage ? (
        <div className="relative rounded-xl overflow-hidden border border-slate-700 bg-black mb-2 shadow">
          <img
            src={card.imageUrl}
            alt={card.name}
            onError={() => setImgError(true)}
            className="w-full h-auto object-contain max-h-[220px] rounded-xl"
          />
        </div>
      ) : (
        <div className="bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 border border-slate-700 rounded-xl p-2.5 mb-2 text-center">
          <div className="text-[10px] text-indigo-300 font-bold">{card.code}</div>
          <div className="text-xs font-bold text-white my-1">{card.name}</div>
          <div className="text-[10px] text-slate-400">[{card.cardType}]</div>
        </div>
      )}

      {/* カードステータス */}
      <div className="flex items-center justify-between gap-1 mb-1.5">
        <span className="font-bold text-xs text-white truncate">{card.name}</span>
        {effectiveBp !== null && (
          <span className="px-1.5 py-0.5 rounded bg-amber-950 border border-amber-500/60 font-black text-amber-300 text-[10px] shrink-0">
            BP {effectiveBp}{effectiveHasBpPlus ? '+' : ''}
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-1 bg-slate-950/80 p-1.5 rounded-lg border border-slate-800 text-center text-[10px] mb-1.5">
        <div>
          <span className="text-slate-400">AP:</span>{' '}
          <strong className="text-sky-400">{card.apCost}</strong>
        </div>
        <div>
          <span className="text-slate-400">必要:</span>{' '}
          <strong className="text-amber-400">{card.reqEnergy}</strong>
        </div>
        <div>
          <span className="text-slate-400">発生:</span>{' '}
          <strong className="text-emerald-400">{card.genEnergy}</strong>
        </div>
      </div>

      {card.triggers.length > 0 && (
        <div className="flex items-center gap-1 mb-1.5 flex-wrap">
          <ShieldAlert className="w-3 h-3 text-amber-400 shrink-0" />
          {card.triggers.map((trig, i) => (
            <span
              key={i}
              className="bg-amber-600 text-white font-black px-1.5 py-0.2 rounded text-[9px]"
            >
              {trig}
            </span>
          ))}
        </div>
      )}

      {/* 効果テキスト */}
      <div className="bg-slate-950/90 p-2 rounded-lg border border-slate-800 text-[10px] leading-relaxed text-slate-200 whitespace-pre-line max-h-28 overflow-y-auto scrollbar-thin">
        {card.effectText || '（通常効果なし）'}
      </div>
    </div>
  );
};
