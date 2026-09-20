import React, { useState, useRef, useEffect } from 'react';
import { Card, CardColor, TriggerType } from '../../types/card';
import { CardLocation } from '../../types/game';
import { DND_MIME_TYPE, DragCardPayload } from '../../types/dnd';
import { ArrowRightLeft, Trash2, RotateCw, Plus, Minus, Info, Swords, Layers, Snowflake, ArrowUpToLine, ArrowDownToLine, PlusCircle, ShieldAlert } from 'lucide-react';

interface CardViewProps {
  card: Card;
  location?: CardLocation;
  isOpponent?: boolean;
  onToggleRest?: () => void;
  onModifyBp?: (delta: number) => void;
  onToggleFreeze?: () => void;
  onAddMarker?: (from: 'deckTop' | 'hand') => void;
  onMoveTo?: (destination: 'frontLine' | 'energyLine' | 'graveyard' | 'hand' | 'removed' | 'deckTop' | 'deckBottom') => void;
  onInspect?: (card: Card) => void;
  onClick?: () => void;
  onDeclareAttack?: () => void;
  onOpenUnderCards?: () => void;
}

const COLOR_BORDER_MAP: Record<CardColor, string> = {
  PURPLE: 'border-purple-500 bg-purple-950/40 text-purple-200',
  RED: 'border-red-500 bg-red-950/40 text-red-200',
  BLUE: 'border-blue-500 bg-blue-950/40 text-blue-200',
  YELLOW: 'border-yellow-500 bg-yellow-950/40 text-yellow-200',
  GREEN: 'border-emerald-500 bg-emerald-950/40 text-emerald-200',
  COLORLESS: 'border-slate-500 bg-slate-900/60 text-slate-200',
};

const TRIGGER_BADGE_MAP: Record<TriggerType, { bg: string; text: string }> = {
  DRAW: { bg: 'bg-sky-600', text: 'ドロー' },
  ACTIVE: { bg: 'bg-emerald-600', text: 'アクティブ' },
  RAID: { bg: 'bg-purple-600', text: 'レイド' },
  GET: { bg: 'bg-amber-600', text: 'ゲット' },
  BOUNCE: { bg: 'bg-teal-600', text: 'バウンス' },
  COLOR: { bg: 'bg-pink-600', text: 'カラー' },
  SPECIAL: { bg: 'bg-red-600', text: 'Special' },
  FINAL: { bg: 'bg-yellow-600', text: 'Final' },
};

export const CardView: React.FC<CardViewProps> = ({
  card,
  location,
  isOpponent = false,
  onToggleRest,
  onModifyBp,
  onToggleFreeze,
  onAddMarker,
  onMoveTo,
  onInspect,
  onClick,
  onDeclareAttack,
  onOpenUnderCards,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [imgError, setImgError] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // 裏向き表示
  if (card.isFaceDown) {
    return (
      <div
        className="w-20 h-28 sm:w-24 sm:h-34 md:w-28 md:h-40 rounded-lg border-2 border-slate-700 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 shadow-md flex flex-col items-center justify-center cursor-pointer transition-transform hover:scale-105"
        onClick={onClick}
      >
        <div className="w-12 h-16 rounded border border-indigo-500/30 flex items-center justify-center">
          <span className="text-[10px] font-bold text-indigo-400/80 tracking-wider">UA</span>
        </div>
      </div>
    );
  }

  const currentBp = (card.bp ?? 0) + card.bpModifier;
  const colorClass = COLOR_BORDER_MAP[card.color] || COLOR_BORDER_MAP.COLORLESS;
  const canDrag = !isOpponent && !!location;
  const isFieldCard = location?.zone === 'frontLine' || location?.zone === 'energyLine';
  const hasValidImage = !!card.imageUrl && !imgError;

  const underCards = card.underCards || [];
  const underCount = underCards.length;
  const isRaid = !!(
    card.triggers?.includes('RAID') ||
    card.effectText?.includes('【レイド】') ||
    card.effectText?.includes('[レイド]')
  );
  const topUnderCard = underCount > 0 ? underCards[underCount - 1] : null;
  const secondUnderCard = underCount >= 2 ? underCards[underCount - 2] : null;

  const handleDragStart = (e: React.DragEvent) => {
    if (!canDrag || !location) return;
    setIsDragging(true);
    const payload: DragCardPayload = {
      cardId: card.id,
      from: location,
    };
    e.dataTransfer.setData(DND_MIME_TYPE, JSON.stringify(payload));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    // 相手手札等はコンテキストメニュー不要だが、相手の盤面カードは操作可能にする
    if (isOpponent && !isFieldCard) return;
    e.preventDefault();
    setMenuPos({ x: e.clientX, y: e.clientY });
    setShowMenu(true);
  };

  useEffect(() => {
    const handleOutsideClick = () => setShowMenu(false);
    if (showMenu) {
      window.addEventListener('click', handleOutsideClick);
    }
    return () => window.removeEventListener('click', handleOutsideClick);
  }, [showMenu]);

  return (
    <>
      {/* カードスタックコンテナ (重なりカードとレスト回転を一体化) */}
      <div
        className={`relative group/card select-none w-20 h-28 sm:w-24 sm:h-34 md:w-28 md:h-40 transition-all ${
          card.isRested ? 'card-rested shadow-amber-500/20' : 'card-active hover:-translate-y-1'
        }`}
      >
        {/* レイド / マーカーの重なり視覚効果 (underCards > 0 の時、背後にずらして立体表示) */}
        {underCount >= 2 && (
          <div
            className={`absolute inset-0 rounded-lg border-2 shadow-md pointer-events-none transition-all duration-200 translate-x-2 translate-y-2 group-hover/card:translate-x-3.5 group-hover/card:translate-y-3.5 ${
              secondUnderCard?.isFaceDown
                ? 'border-slate-700 bg-slate-950/95 shadow-black/80'
                : isRaid
                ? 'border-purple-500/80 bg-purple-950/95 shadow-purple-950/80'
                : 'border-amber-500/80 bg-amber-950/95 shadow-amber-950/80'
            }`}
            style={{ zIndex: 0 }}
          >
            {/* 3段目カードの角アクセント */}
            <div className="absolute top-1 right-1 px-1 rounded-[3px] border border-white/20 bg-black/70 flex items-center justify-center">
              <span className="text-[7px] font-black text-white/70 leading-tight">2</span>
            </div>
          </div>
        )}

        {underCount >= 1 && (
          <div
            className={`absolute inset-0 rounded-lg border-2 shadow-md pointer-events-none transition-all duration-200 translate-x-1 translate-y-1 group-hover/card:translate-x-2 group-hover/card:translate-y-2 ${
              topUnderCard?.isFaceDown
                ? 'border-slate-600 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 shadow-black/70'
                : isRaid
                ? 'border-purple-400/90 bg-gradient-to-br from-slate-900 via-purple-950 to-slate-950 shadow-purple-900/60'
                : 'border-amber-400/90 bg-gradient-to-br from-slate-900 via-amber-950 to-slate-950 shadow-amber-900/60'
            }`}
            style={{ zIndex: 1 }}
          >
            {/* 2段目カードの角アクセント */}
            <div className="absolute top-1 right-1 px-1 rounded-[3px] border border-white/20 bg-black/70 flex items-center justify-center">
              <span className="text-[7px] font-black text-white/90 leading-tight">1</span>
            </div>
            {/* 下敷きカード名のチラ見せ */}
            {topUnderCard && !topUnderCard.isFaceDown && (
              <div className="absolute bottom-1 right-1 text-[7px] font-bold text-slate-300/80 bg-black/60 px-1 rounded max-w-[80%] truncate">
                {topUnderCard.name}
              </div>
            )}
          </div>
        )}

        {/* 最前面メインカード本体 */}
        <div
          ref={cardRef}
          draggable={canDrag}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onContextMenu={handleContextMenu}
          onClick={onClick}
          style={{ zIndex: 2 }}
          className={`relative w-full h-full rounded-lg border-2 shadow-lg flex flex-col justify-between overflow-hidden transition-all ${colorClass} ${
            card.isParallel ? 'ring-2 ring-amber-400/70 shadow-amber-400/20' : ''
          } ${canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${
            isDragging ? 'opacity-40 scale-95 border-dashed border-amber-400' : ''
          }`}
        >
          {/* 公式カード画像背景 (存在する場合) */}
          {hasValidImage ? (
            <>
              <img
                src={card.imageUrl}
                alt={card.name}
                onError={() => setImgError(true)}
                className="absolute inset-0 w-full h-full object-cover pointer-events-none"
              />
              {/* 盤面ステータス強調用の薄いグラデーション */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/60 pointer-events-none" />
            </>
          ) : null}

          {/* レイド / マーカー 重ねバッジ */}
          {underCount > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onOpenUnderCards) onOpenUnderCards();
              }}
              title={`クリックで下敷きカード（${isRaid ? 'レイド元' : 'マーカー'}）を確認・操作`}
              className={`absolute -top-1.5 -left-1.5 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-lg border z-30 cursor-pointer transition-transform hover:scale-110 flex items-center gap-0.5 ${
                isRaid
                  ? 'bg-purple-600 hover:bg-purple-500 border-purple-200 shadow-purple-900/50'
                  : 'bg-amber-600 hover:bg-amber-500 border-amber-200 shadow-amber-900/50'
              }`}
            >
              <Layers className="w-2.5 h-2.5" />
              <span>{isRaid ? 'RAID' : 'MARK'}</span>
              <span className="bg-black/40 px-1 rounded-full text-[8px] font-extrabold">{underCount}</span>
            </button>
          )}

          {/* フリーズ表示インジケータ */}
          {card.isFrozen && (
            <div className="absolute top-1 left-1/2 -translate-x-1/2 bg-cyan-700/90 text-white text-[8px] sm:text-[9px] font-black px-1.5 py-0.5 rounded shadow z-20 border border-cyan-300 flex items-center gap-0.5 animate-pulse whitespace-nowrap">
              <Snowflake className="w-2.5 h-2.5 text-cyan-200" />
              FROZEN
            </div>
          )}

        {/* レスト表示インジケータ */}
        {card.isRested && (
          <div className="absolute top-1 right-1 bg-amber-600/90 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow z-20 border border-amber-300">
            REST
          </div>
        )}

        {/* レアリティバッジ (右肩) */}
        {card.rarity && !card.isRested && (
          <div className={`absolute top-1 right-1 text-[8px] sm:text-[9px] font-black px-1 py-0.5 rounded shadow z-20 border leading-none ${
            card.rarity.includes('★') || card.isParallel
              ? 'bg-amber-400 text-slate-950 border-amber-200 shadow-amber-400/50'
              : card.rarity === 'SR'
              ? 'bg-gradient-to-r from-amber-500 to-rose-500 text-white border-amber-300'
              : card.rarity === 'R'
              ? 'bg-indigo-600 text-white border-indigo-400'
              : 'bg-slate-800/90 text-slate-300 border-slate-600'
          }`}>
            {card.rarity}
          </div>
        )}

        {/* 未公開 (COMING SOON) バッジ */}
        {card.isUnrevealed && (
          <div className="absolute inset-0 z-30 bg-slate-950/80 backdrop-blur-[2px] flex flex-col items-center justify-center p-1 text-center border-2 border-dashed border-amber-400/80 rounded-lg">
            <span className="text-[9px] sm:text-[10px] font-black text-amber-400 tracking-wider animate-pulse">
              COMING SOON
            </span>
            <span className="text-[8px] text-slate-400 mt-0.5">未公開カード</span>
          </div>
        )}

        {/* ヘッダー: エナジー / AP */}
        <div className="relative z-10 flex items-center justify-between gap-0.5 text-[9px] sm:text-[10px] font-bold leading-none p-1 pointer-events-none">
          <div className="flex items-center gap-0.5">
            {card.reqEnergy > 0 && (
              <span className="bg-slate-900/90 px-1 py-0.5 rounded text-amber-300 border border-amber-500/40" title={`必要エナジー: ${card.reqEnergy}`}>
                ⚡{card.reqEnergy}
              </span>
            )}
            {card.genEnergy > 0 && (
              <span className="bg-emerald-950/90 px-1 py-0.5 rounded text-emerald-300 border border-emerald-500/40" title={`発生エナジー: ${card.genEnergy}`}>
                +{card.genEnergy}
              </span>
            )}
          </div>
          {card.apCost > 0 && (
            <span className="bg-sky-950/90 px-1 py-0.5 rounded text-sky-300 border border-sky-500/40" title={`APコスト: ${card.apCost}`}>
              AP{card.apCost}
            </span>
          )}
        </div>

        {/* カード名 & タイプ (画像なし時または画像下部の名前強調) */}
        {!hasValidImage && (
          <div className="my-auto text-center px-0.5 pointer-events-none relative z-10">
            <div className="text-[10px] sm:text-xs font-bold truncate leading-tight drop-shadow">
              {card.name}
            </div>
            {card.cardType !== 'CHARACTER' && (
              <div className="text-[8px] sm:text-[9px] text-slate-400 font-semibold">
                [{card.cardType}]
              </div>
            )}
          </div>
        )}

        {/* フッター: BP / トリガー */}
        <div className="relative z-10 flex items-center justify-between text-[9px] sm:text-[10px] font-bold p-1 pointer-events-none mt-auto">
          {card.bp !== null ? (
            <div
              className={`px-1 py-0.5 rounded text-xs leading-none border shadow-md font-black ${
                card.bpModifier > 0
                  ? 'bg-emerald-600 text-white border-emerald-400 scale-105'
                  : card.bpModifier < 0
                  ? 'bg-rose-600 text-white border-rose-400'
                  : 'bg-slate-950/90 text-slate-100 border-slate-700'
              }`}
            >
              {currentBp}
            </div>
          ) : (
            <div />
          )}

          {card.triggers && card.triggers.length > 0 && (
            <div className="flex gap-0.5">
              {card.triggers.map((t, idx) => (
                <span
                  key={idx}
                  className={`${TRIGGER_BADGE_MAP[t]?.bg || 'bg-slate-700'} text-white text-[8px] px-1 py-0.5 rounded shadow`}
                >
                  {TRIGGER_BADGE_MAP[t]?.text || t}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      </div>

      {/* 右クリックコンテキストメニュー */}
      {showMenu && (
        <div
          className="fixed z-50 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl p-1.5 w-48 text-xs text-slate-200"
          style={{ top: Math.min(menuPos.y, window.innerHeight - 250), left: Math.min(menuPos.x, window.innerWidth - 200) }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={`font-bold border-b border-slate-800 pb-1 mb-1 px-1 truncate ${isOpponent ? 'text-rose-400' : 'text-indigo-400'}`}>
            {isOpponent ? `[相手] ${card.name}` : card.name}
          </div>

          {!isOpponent && !card.isRested && onDeclareAttack && (
            <button
              onClick={() => {
                onDeclareAttack();
                setShowMenu(false);
              }}
              className="w-full text-left px-2 py-1.5 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 font-bold rounded flex items-center gap-2 mb-1"
            >
              <Swords className="w-3.5 h-3.5 text-rose-400" />
              アタック宣言（攻撃）
            </button>
          )}

          {onToggleRest && (
            <button
              onClick={() => {
                onToggleRest();
                setShowMenu(false);
              }}
              className="w-full text-left px-2 py-1.5 hover:bg-slate-800 rounded flex items-center gap-2"
            >
              <RotateCw className="w-3.5 h-3.5 text-amber-400" />
              {card.isRested ? 'アクティブにする' : 'レストにする'}
            </button>
          )}

          {isFieldCard && onToggleFreeze && (
            <button
              onClick={() => {
                onToggleFreeze();
                setShowMenu(false);
              }}
              className="w-full text-left px-2 py-1.5 hover:bg-slate-800 rounded flex items-center gap-2 text-cyan-300"
            >
              <Snowflake className="w-3.5 h-3.5 text-cyan-400" />
              {card.isFrozen ? 'フリーズ解除' : 'フリーズ状態にする'}
            </button>
          )}

          {isFieldCard && onModifyBp && card.bp !== null && (
            <div className="flex items-center justify-between px-2 py-1 bg-slate-800/60 rounded my-1">
              <span className="text-slate-400">BP修正:</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onModifyBp(-1000)}
                  className="px-1.5 py-0.5 bg-rose-700/80 hover:bg-rose-600 rounded text-[10px] flex items-center"
                >
                  <Minus className="w-3 h-3" /> 1000
                </button>
                <button
                  onClick={() => onModifyBp(1000)}
                  className="px-1.5 py-0.5 bg-emerald-700/80 hover:bg-emerald-600 rounded text-[10px] flex items-center"
                >
                  <Plus className="w-3 h-3" /> 1000
                </button>
              </div>
            </div>
          )}

          {isFieldCard && onAddMarker && (
            <button
              onClick={() => {
                onAddMarker('deckTop');
                setShowMenu(false);
              }}
              className="w-full text-left px-2 py-1.5 hover:bg-indigo-950/60 rounded flex items-center gap-2 text-indigo-300"
            >
              <PlusCircle className="w-3.5 h-3.5 text-indigo-400" />
              マーカー追加（山札上から）
            </button>
          )}

          {isFieldCard && onMoveTo && (
            <>
              {location?.zone === 'frontLine' ? (
                <button
                  onClick={() => {
                    onMoveTo('energyLine');
                    setShowMenu(false);
                  }}
                  className="w-full text-left px-2 py-1.5 hover:bg-slate-800 rounded flex items-center gap-2"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5 text-blue-400" />
                  エナジーLへ移動
                </button>
              ) : (
                <button
                  onClick={() => {
                    onMoveTo('frontLine');
                    setShowMenu(false);
                  }}
                  className="w-full text-left px-2 py-1.5 hover:bg-slate-800 rounded flex items-center gap-2"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5 text-blue-400" />
                  フロントLへ移動
                </button>
              )}
            </>
          )}

          {onMoveTo && (
            <>
              {location?.zone !== 'hand' && (
                <button
                  onClick={() => {
                    onMoveTo('hand');
                    setShowMenu(false);
                  }}
                  className="w-full text-left px-2 py-1.5 hover:bg-slate-800 rounded flex items-center gap-2"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5 text-amber-300" />
                  {isOpponent ? '手札に戻す（バウンス）' : '手札に戻す'}
                </button>
              )}
              <button
                onClick={() => {
                  onMoveTo('graveyard');
                  setShowMenu(false);
                }}
                className="w-full text-left px-2 py-1.5 hover:bg-slate-800 rounded flex items-center gap-2 text-rose-300"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {isOpponent ? '退場させる（場外へ）' : location?.zone === 'hand' ? '場外へ捨てる' : '場外へ送る'}
              </button>
              <button
                onClick={() => {
                  onMoveTo('deckTop');
                  setShowMenu(false);
                }}
                className="w-full text-left px-2 py-1.5 hover:bg-slate-800 rounded flex items-center gap-2 text-emerald-300"
              >
                <ArrowUpToLine className="w-3.5 h-3.5" />
                山札の上へ戻す
              </button>
              <button
                onClick={() => {
                  onMoveTo('deckBottom');
                  setShowMenu(false);
                }}
                className="w-full text-left px-2 py-1.5 hover:bg-slate-800 rounded flex items-center gap-2 text-emerald-300"
              >
                <ArrowDownToLine className="w-3.5 h-3.5" />
                {isOpponent ? '山札の下へ戻す（バウンス）' : '山札の下へ戻す'}
              </button>
              <button
                onClick={() => {
                  onMoveTo('removed');
                  setShowMenu(false);
                }}
                className="w-full text-left px-2 py-1.5 hover:bg-purple-950/60 rounded flex items-center gap-2 text-purple-300"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                除外する（リムーブ）
              </button>
            </>
          )}

          {card.underCards && card.underCards.length > 0 && onOpenUnderCards && (
            <button
              onClick={() => {
                onOpenUnderCards();
                setShowMenu(false);
              }}
              className="w-full text-left px-2 py-1.5 hover:bg-purple-950/60 rounded flex items-center gap-2 text-purple-300 font-bold border-t border-slate-800 mt-1"
            >
              <Layers className="w-3.5 h-3.5 text-purple-400" />
              下のカードを確認 ({card.underCards.length}枚)
            </button>
          )}

          {onInspect && (
            <button
              onClick={() => {
                onInspect(card);
                setShowMenu(false);
              }}
              className="w-full text-left px-2 py-1.5 hover:bg-slate-800 rounded flex items-center gap-2 text-sky-400 border-t border-slate-800 mt-1"
            >
              <Info className="w-3.5 h-3.5" />
              カード効果を見る
            </button>
          )}
        </div>
      )}
    </>
  );
};
