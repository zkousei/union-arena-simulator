import React, { useState, useRef, useEffect } from 'react';
import { Card, CardColor, TriggerType } from '../../types/card';
import { CARD_DATABASE } from '../../data/cardDatabase';
import { CardLocation } from '../../types/game';
import { DND_MIME_TYPE, DragCardPayload } from '../../types/dnd';
import { ArrowRightLeft, Trash2, RotateCw, Swords, Layers, Snowflake, ArrowUpToLine, ArrowDownToLine, PlusCircle, ShieldAlert, Eye, ZoomIn, Zap, X } from 'lucide-react';

interface CardViewProps {
  card: Card;
  location?: CardLocation;
  isOpponent?: boolean;
  revealFaceDown?: boolean;
  onToggleRest?: () => void;
  onModifyBp?: (delta: number) => void;
  onToggleFreeze?: () => void;
  onAddMarker?: (from: 'deckTop' | 'hand') => void;
  onMoveTo?: (
    destination:
      | 'frontLine'
      | 'energyLine'
      | 'graveyard'
      | 'hand'
      | 'removed'
      | 'deckTop'
      | 'deckBottom'
      | 'life'
      | 'lifeFaceUp'
  ) => void;
  onInspect?: (card: Card) => void;
  onHoverCard?: (card: Card | null) => void;
  onClick?: () => void;
  onDeclareAttack?: () => void;
  onDirectAttack?: () => void;
  onOpenUnderCards?: () => void;
  isCompact?: boolean;
  accessibleLabel?: string;
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
  revealFaceDown = false,
  onToggleRest,
  onModifyBp,
  onToggleFreeze,
  onAddMarker,
  onMoveTo,
  onInspect,
  onHoverCard,
  onClick,
  onDeclareAttack,
  onDirectAttack,
  onOpenUnderCards,
  isCompact = false,
  accessibleLabel,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [imgError, setImgError] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const cardDimensions = isCompact
    ? 'w-[58px] h-[80px] lg:w-[62px] lg:h-[86px]'
    : 'w-20 h-28 sm:w-24 sm:h-34 md:w-28 md:h-40';

  useEffect(() => {
    const handleOutsideClick = () => setShowMenu(false);
    if (showMenu) {
      window.addEventListener('click', handleOutsideClick);
    }
    return () => window.removeEventListener('click', handleOutsideClick);
  }, [showMenu]);

  // 裏向きの表面確認は所有者側だけに限る。
  const canRevealFaceDown = revealFaceDown && !isOpponent;
  if (card.isFaceDown && !canRevealFaceDown) {
    return (
      <div
        className={`${cardDimensions} rounded-lg border-2 border-slate-700 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 shadow-md flex flex-col items-center justify-center cursor-pointer transition-transform hover:scale-105 relative group/facedown`}
        onClick={onClick}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        aria-label={onClick ? accessibleLabel || card.name : undefined}
        onKeyDown={(event) => {
          if (onClick && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            onClick();
          }
        }}
      >
        <div className={`${isCompact ? 'w-7 h-10' : 'w-12 h-16'} rounded border border-indigo-500/30 flex items-center justify-center`}>
          <span className={`${isCompact ? 'text-[8px]' : 'text-[10px]'} font-bold text-indigo-400/80 tracking-wider`}>UA</span>
        </div>
        {onInspect && !isOpponent && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onInspect(card);
            }}
            className={`absolute bottom-0.5 ${isCompact ? 'px-1 py-0 text-[7px]' : 'px-1.5 py-0.5 text-[9px]'} rounded bg-black/80 border border-amber-500/40 text-amber-300 opacity-0 group-hover/facedown:opacity-100 transition-opacity flex items-center gap-0.5 shadow`}
            title="自分のみ表面を確認"
          >
            <Eye className={`${isCompact ? 'w-2 h-2' : 'w-2.5 h-2.5'} text-amber-400`} />
            確認
          </button>
        )}
      </div>
    );
  }

  const masterCard =
    card.bp === null || card.bp === undefined
      ? CARD_DATABASE.find((c) => c.code === card.code)
      : null;
  const effectiveBp = card.bp ?? masterCard?.bp ?? null;
  const effectiveHasBpPlus = card.hasBpPlus ?? masterCard?.hasBpPlus ?? false;
  const currentBp = (effectiveBp ?? 0) + card.bpModifier;
  const isFieldCard = location?.zone === 'frontLine' || location?.zone === 'energyLine';
  const underCount = card.underCards?.length ?? 0;
  const raidBaseCount = card.underCards?.filter((c) => !c.isMarker).length ?? 0;
  const markerCount = card.underCards?.filter((c) => !!c.isMarker).length ?? 0;
  const hasRaid = raidBaseCount > 0;
  const hasMarker = markerCount > 0;
  const secondUnderCard = underCount >= 2 ? card.underCards?.[underCount - 2] : null;
  const firstUnderCard = underCount >= 1 ? card.underCards?.[underCount - 1] : null;
  const colorClass = COLOR_BORDER_MAP[card.color] || COLOR_BORDER_MAP.COLORLESS;
  const canDrag = !isOpponent && !showMenu;
  const hasValidImage = !!card.imageUrl && !imgError;

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

  return (
    <>
      {/* カードスタックコンテナ (重なりカードとレスト回転を一体化) */}
      <div
        className={`relative group/card select-none ${cardDimensions} transition-all ${
          card.isRested
            ? (isCompact ? 'card-rested-compact shadow-amber-500/20' : 'card-rested shadow-amber-500/20')
            : 'card-active hover:-translate-y-0.5'
        }`}
        onMouseEnter={() => {
          if (onHoverCard) onHoverCard(card);
        }}
        onMouseLeave={() => {
          if (onHoverCard) onHoverCard(null);
        }}
      >
        {/* レイド / マーカーの重なり視覚効果 (underCards > 0 の時、背後にずらして立体表示) */}
        {underCount >= 2 && (
          <div
            className={`absolute inset-0 rounded-lg border-2 shadow-md pointer-events-none transition-all duration-200 translate-x-2 translate-y-2 group-hover/card:translate-x-3.5 group-hover/card:translate-x-3.5 ${
              secondUnderCard?.isFaceDown
                ? 'border-slate-700 bg-slate-950/95 shadow-black/80'
                : secondUnderCard?.isMarker
                ? 'border-amber-500/80 bg-amber-950/95 shadow-amber-950/80'
                : 'border-purple-500/80 bg-purple-950/95 shadow-purple-950/80'
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
              firstUnderCard?.isFaceDown
                ? 'border-slate-700 bg-slate-950/90 shadow-black/70'
                : firstUnderCard?.isMarker
                ? 'border-amber-400 bg-amber-900/90 shadow-amber-900/70'
                : 'border-purple-400 bg-purple-900/90 shadow-purple-900/70'
            }`}
            style={{ zIndex: 1 }}
          />
        )}

        {/* 最前面メインカード本体 */}
        <div
          ref={cardRef}
          draggable={canDrag}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onContextMenu={handleContextMenu}
          onClick={onClick}
          role={onClick ? 'button' : undefined}
          tabIndex={onClick ? 0 : undefined}
          aria-label={onClick ? accessibleLabel || card.name : undefined}
          onKeyDown={(event) => {
            if (onClick && (event.key === 'Enter' || event.key === ' ')) {
              event.preventDefault();
              onClick();
            }
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            if (onToggleRest) {
              onToggleRest();
            } else if (onInspect) {
              onInspect(card);
            }
          }}
          style={{ zIndex: 2 }}
          className={`relative w-full h-full rounded-lg border-2 shadow-lg flex flex-col justify-between overflow-hidden transition-all ${colorClass} ${
            card.isParallel ? 'ring-2 ring-amber-400/70 shadow-amber-400/20' : ''
          } ${canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${
            isDragging ? 'opacity-40 scale-95 border-dashed border-amber-400' : ''
          }`}
        >
          {/* クイック操作ボタン (レスト切替 / 攻撃 / 拡大確認) */}
          <div className="absolute top-1 right-1 z-30 flex items-center gap-0.5">
            {!isOpponent && !card.isRested && onDirectAttack && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDirectAttack();
                }}
                title="アタック（1クリックで相手プレイヤーへ攻撃宣言）"
                className="p-0.5 rounded transition-all border shadow bg-rose-950/90 text-rose-300 border-rose-500/60 hover:bg-rose-600 hover:text-white opacity-85 group-hover/card:opacity-100 animate-in fade-in"
              >
                <Swords className={isCompact ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
              </button>
            )}
            {onToggleRest && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleRest();
                }}
                title={card.isRested ? 'アクティブにする (ダブルクリックでも切替可)' : 'レストにする (ダブルクリックでも切替可)'}
                className={`p-0.5 rounded transition-all border shadow ${
                  card.isRested
                    ? 'bg-emerald-800/90 text-emerald-200 border-emerald-400 hover:bg-emerald-600 hover:text-white'
                    : 'bg-black/75 text-amber-300 border-amber-500/50 hover:bg-amber-600 hover:text-white opacity-80 group-hover/card:opacity-100'
                }`}
              >
                <RotateCw className={isCompact ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
              </button>
            )}
            {onInspect && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onInspect(card);
                }}
                title="カード詳細を確認 (拡大表示)"
                className="p-1 sm:p-0.5 rounded bg-black/75 hover:bg-indigo-600 text-slate-300 hover:text-white opacity-100 sm:opacity-0 sm:group-hover/card:opacity-100 transition-opacity border border-white/20 shadow"
              >
                <ZoomIn className={isCompact ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
              </button>
            )}
          </div>

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

          {/* レイド / マーカー 重ねバッジ (上部のクイック操作ボタンと重ならないよう左側中段に配置) */}
          {underCount > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onOpenUnderCards) onOpenUnderCards();
              }}
              title={`クリックで下敷きカード（${
                hasRaid && hasMarker ? 'レイド元・マーカー' : hasRaid ? 'レイド元' : 'マーカー'
              }）を確認・操作`}
              className={`absolute ${
                isCompact ? 'top-6 left-0.5 text-[8px] px-1 py-0.2' : 'top-7 left-1 text-[9px] px-1.5 py-0.5'
              } text-white font-black rounded-full shadow-lg border z-30 cursor-pointer transition-transform hover:scale-110 flex items-center gap-0.5 ${
                hasRaid && !hasMarker
                  ? 'bg-purple-600 hover:bg-purple-500 border-purple-200 shadow-purple-900/50'
                  : !hasRaid && hasMarker
                  ? 'bg-amber-600 hover:bg-amber-500 border-amber-200 shadow-amber-900/50'
                  : 'bg-gradient-to-r from-purple-600 to-amber-600 hover:from-purple-500 hover:to-amber-500 border-purple-200 shadow-purple-900/50'
              }`}
            >
              <Layers className="w-2.5 h-2.5" />
              {hasRaid && hasMarker ? (
                <>
                  <span>RAID</span>
                  <span className="bg-black/40 px-1 rounded-full text-[8px] font-extrabold">{raidBaseCount}</span>
                  <span>MARK</span>
                  <span className="bg-black/40 px-1 rounded-full text-[8px] font-extrabold">{markerCount}</span>
                </>
              ) : hasRaid ? (
                <>
                  <span>RAID</span>
                  <span className="bg-black/40 px-1 rounded-full text-[8px] font-extrabold">{raidBaseCount}</span>
                </>
              ) : (
                <>
                  <span>MARK</span>
                  <span className="bg-black/40 px-1 rounded-full text-[8px] font-extrabold">{markerCount}</span>
                </>
              )}
            </button>
          )}

          {/* フリーズ表示インジケータ */}
          {card.isFrozen && (
            <div className="absolute top-1 left-1/2 -translate-x-1/2 bg-cyan-700/90 text-white text-[8px] sm:text-[9px] font-black px-1.5 py-0.5 rounded shadow z-20 border border-cyan-300 flex items-center gap-0.5 animate-pulse whitespace-nowrap">
              <Snowflake className="w-2.5 h-2.5 text-cyan-200" />
              FROZEN
            </div>
          )}

        {/* レアリティバッジ (右肩) */}
        {card.rarity && (
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

        {/* 裏向きマーカー表示バッジ（コントローラー自身のみ確認中） */}
        {card.isFaceDown && (
          <div className="absolute top-0 left-0 right-0 bg-amber-950/95 text-amber-300 text-[8px] font-black py-0.5 px-1 text-center border-b border-amber-500/60 z-20 flex items-center justify-center gap-1 shadow-md">
            <Eye className="w-2.5 h-2.5 text-amber-400" />
            <span>マーカー（裏向き）</span>
          </div>
        )}

        {/* ヘッダー: エナジー / AP */}
        <div className={`relative z-10 flex items-center justify-between gap-0.5 ${isCompact ? 'text-[8px] p-0.5' : 'text-[9px] sm:text-[10px] p-1'} font-bold leading-none pointer-events-none ${
          card.isFaceDown ? (isCompact ? 'pt-2.5' : 'pt-3.5') : ''
        }`}>
          <div className="flex items-center gap-0.5">
            {card.reqEnergy > 0 && (
              <span className={`bg-slate-900/90 ${isCompact ? 'px-0.5 py-0.2 text-[8px]' : 'px-1 py-0.5'} rounded text-amber-300 border border-amber-500/40`} title={`必要エナジー: ${card.reqEnergy}`}>
                ⚡{card.reqEnergy}
              </span>
            )}
            {card.genEnergy > 0 && (
              <span className={`bg-emerald-950/90 ${isCompact ? 'px-0.5 py-0.2 text-[8px]' : 'px-1 py-0.5'} rounded text-emerald-300 border border-emerald-500/40`} title={`発生エナジー: ${card.genEnergy}`}>
                +{card.genEnergy}
              </span>
            )}
          </div>
          {card.apCost > 0 && (
            <span className={`bg-sky-950/90 ${isCompact ? 'px-0.5 py-0.2 text-[8px]' : 'px-1 py-0.5'} rounded text-sky-300 border border-sky-500/40`} title={`APコスト: ${card.apCost}`}>
              AP{card.apCost}
            </span>
          )}
        </div>

        {/* カード名 & タイプ (画像なし時または画像下部の名前強調) */}
        {!hasValidImage && (
          <div className="my-auto text-center px-0.5 pointer-events-none relative z-10">
            <div className={`${isCompact ? 'text-[9px]' : 'text-[10px] sm:text-xs'} font-bold truncate leading-tight drop-shadow`}>
              {card.name}
            </div>
            {card.cardType !== 'CHARACTER' && (
              <div className={`${isCompact ? 'text-[7px]' : 'text-[8px] sm:text-[9px]'} text-slate-400 font-semibold`}>
                [{card.cardType}]
              </div>
            )}
          </div>
        )}

        {/* フッター: BP / トリガー */}
        <div className={`relative z-10 flex items-center justify-between ${isCompact ? 'text-[8px] p-0.5' : 'text-[9px] sm:text-[10px] p-1'} font-bold pointer-events-none mt-auto`}>
          {effectiveBp !== null ? (
            <div
              className={`${isCompact ? 'px-0.5 py-0 text-[10px]' : 'px-1 py-0.5 text-xs'} rounded leading-none border shadow-md font-black ${
                card.bpModifier > 0
                  ? 'bg-emerald-600 text-white border-emerald-400 scale-105'
                  : card.bpModifier < 0
                  ? 'bg-rose-600 text-white border-rose-400'
                  : 'bg-slate-950/90 text-slate-100 border-slate-700'
              }`}
            >
              {currentBp}{effectiveHasBpPlus ? '+' : ''}
            </div>
          ) : (
            <div />
          )}

          {card.triggers && card.triggers.length > 0 && (
            <div className="flex gap-0.5">
              {card.triggers.map((t, idx) => (
                <span
                  key={idx}
                  className={`${TRIGGER_BADGE_MAP[t]?.bg || 'bg-slate-700'} text-white ${isCompact ? 'text-[7px] px-0.5 py-0.2' : 'text-[8px] px-1 py-0.5'} rounded shadow`}
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
          className="fixed z-50 bg-slate-900/95 backdrop-blur-sm border border-slate-700 rounded-xl shadow-2xl p-2 w-56 max-w-[92vw] max-h-[calc(100vh-24px)] sm:max-h-[calc(100dvh-32px)] overflow-y-auto scrollbar-thin text-xs text-slate-200 flex flex-col gap-1"
          style={{
            top: Math.max(8, Math.min(menuPos.y, window.innerHeight - 450)),
            left: Math.max(8, Math.min(menuPos.x, window.innerWidth - 240)),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* ヘッダー */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-1 mb-0.5 px-0.5">
            <span className={`font-bold truncate text-xs ${isOpponent ? 'text-rose-400' : 'text-indigo-400'}`}>
              {isOpponent ? `[相手] ${card.name}` : card.name}
            </span>
            <button
              type="button"
              onClick={() => setShowMenu(false)}
              className="p-0.5 text-slate-400 hover:text-white rounded ml-1"
              title="閉じる"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {!isOpponent && !card.isRested && onDirectAttack && card.cardType === 'CHARACTER' && (
            <button
              onClick={() => {
                onDirectAttack();
                setShowMenu(false);
              }}
              className="w-full text-left px-2 py-1.5 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 font-bold rounded flex items-center gap-2"
            >
              <Swords className="w-3.5 h-3.5 text-rose-400" />
              アタック（相手プレイヤーへ攻撃）
            </button>
          )}

          {!isOpponent && !card.isRested && onDeclareAttack && card.cardType === 'CHARACTER' && (
            <button
              onClick={() => {
                onDeclareAttack();
                setShowMenu(false);
              }}
              className="w-full text-left px-2 py-1.5 bg-amber-950/60 hover:bg-amber-900/80 text-amber-300 font-bold rounded flex items-center gap-2"
            >
              <Swords className="w-3.5 h-3.5 text-amber-400" />
              アタック対象を選択（狙い撃ち）
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

          {onInspect && (
            <button
              onClick={() => {
                onInspect(card);
                setShowMenu(false);
              }}
              className="w-full text-left px-2 py-1.5 hover:bg-slate-800 rounded flex items-center gap-2 text-sky-400"
            >
              <Eye className="w-3.5 h-3.5 text-sky-400" />
              カード詳細・効果を見る
            </button>
          )}

          {card.underCards && card.underCards.length > 0 && onOpenUnderCards && (
            <button
              onClick={() => {
                onOpenUnderCards();
                setShowMenu(false);
              }}
              className="w-full text-left px-2 py-1.5 hover:bg-slate-800 rounded flex items-center gap-2 text-purple-300"
            >
              <Layers className="w-3.5 h-3.5 text-purple-400" />
              下敷きカードを確認 ({card.underCards.length}枚)
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

          {isFieldCard && onModifyBp && effectiveBp !== null && (
            <div className="flex flex-col gap-1 p-1.5 bg-slate-800/70 rounded my-0.5 text-xs">
              <div className="flex items-center justify-between text-[11px] font-medium">
                <span className="text-slate-400">BP修正:</span>
                <span className={`font-bold ${card.bpModifier > 0 ? 'text-emerald-400' : card.bpModifier < 0 ? 'text-rose-400' : 'text-slate-300'}`}>
                  {card.bpModifier > 0 ? `+${card.bpModifier}` : card.bpModifier}
                  <span className="text-[10px] text-slate-400 font-normal ml-1">
                    (計 {currentBp}{effectiveHasBpPlus ? '+' : ''})
                  </span>
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1 text-[10px]">
                <button
                  type="button"
                  onClick={() => onModifyBp(-1000)}
                  className="py-1 px-0.5 bg-rose-900/80 hover:bg-rose-700 rounded text-rose-200 font-bold text-center transition-colors"
                  title="BPを -1000"
                >
                  -1000
                </button>
                <button
                  type="button"
                  onClick={() => onModifyBp(-500)}
                  className="py-1 px-0.5 bg-rose-800/80 hover:bg-rose-600 rounded text-rose-200 font-bold text-center transition-colors"
                  title="BPを -500"
                >
                  -500
                </button>
                <button
                  type="button"
                  onClick={() => onModifyBp(500)}
                  className="py-1 px-0.5 bg-emerald-800/80 hover:bg-emerald-600 rounded text-emerald-200 font-bold text-center transition-colors"
                  title="BPを +500"
                >
                  +500
                </button>
                <button
                  type="button"
                  onClick={() => onModifyBp(1000)}
                  className="py-1 px-0.5 bg-emerald-900/80 hover:bg-emerald-700 rounded text-emerald-200 font-bold text-center transition-colors"
                  title="BPを +1000"
                >
                  +1000
                </button>
              </div>
              {card.bpModifier !== 0 && (
                <button
                  type="button"
                  onClick={() => onModifyBp(-card.bpModifier)}
                  className="text-[10px] text-slate-400 hover:text-white hover:bg-slate-700/60 py-0.5 rounded text-center transition-colors mt-0.5"
                >
                  修正リセット (±0)
                </button>
              )}
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
                  className="w-full text-left px-2 py-1.5 hover:bg-slate-800 rounded flex items-center gap-2 text-sky-300"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5 text-sky-400" />
                  エナジーLへ移動
                </button>
              ) : card.cardType !== 'FIELD' ? (
                <button
                  onClick={() => {
                    onMoveTo('frontLine');
                    setShowMenu(false);
                  }}
                  className="w-full text-left px-2 py-1.5 hover:bg-slate-800 rounded flex items-center gap-2 text-sky-300"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5 text-sky-400" />
                  フロントLへ移動
                </button>
              ) : null}
            </>
          )}

          {/* 移動先ボタングループ */}
          {onMoveTo && (
            <div className="pt-1 border-t border-slate-800 flex flex-col gap-1">
              <span className="text-[10px] font-bold text-slate-400 px-0.5">移動・登場:</span>

              {/* 手札カード専用登場アクション */}
              {location?.zone === 'hand' && !isOpponent && (
                <div className="flex flex-col gap-1 mb-1">
                  {card.cardType === 'EVENT' ? (
                    <button
                      onClick={() => {
                        onMoveTo('graveyard');
                        setShowMenu(false);
                      }}
                      className="w-full text-left px-2 py-1.5 bg-amber-950/70 hover:bg-amber-900/80 rounded flex items-center gap-2 text-amber-300 font-bold border border-amber-500/40"
                    >
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      イベントを使用（場外へ）
                    </button>
                  ) : card.cardType === 'FIELD' ? (
                    <button
                      onClick={() => {
                        onMoveTo('energyLine');
                        setShowMenu(false);
                      }}
                      className="w-full py-1.5 px-2 bg-emerald-950/70 hover:bg-emerald-900/80 rounded flex items-center justify-center gap-1.5 text-emerald-300 font-bold border border-emerald-500/40 text-[11px]"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5 text-emerald-400" />
                      エナジーL登場（フィールド）
                    </button>
                  ) : (
                    <div className="grid grid-cols-2 gap-1">
                      <button
                        onClick={() => {
                          onMoveTo('frontLine');
                          setShowMenu(false);
                        }}
                        className="py-1 px-1 bg-indigo-950/70 hover:bg-indigo-900/80 rounded flex items-center justify-center gap-1 text-indigo-300 font-bold border border-indigo-500/30 text-[11px]"
                      >
                        <ArrowRightLeft className="w-3 h-3 text-indigo-400" />
                        フロントL登場
                      </button>
                      <button
                        onClick={() => {
                          onMoveTo('energyLine');
                          setShowMenu(false);
                        }}
                        className="py-1 px-1 bg-emerald-950/70 hover:bg-emerald-900/80 rounded flex items-center justify-center gap-1 text-emerald-300 font-bold border border-emerald-500/30 text-[11px]"
                      >
                        <ArrowRightLeft className="w-3 h-3 text-emerald-400" />
                        エナジーL登場
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* 移動先グリッド */}
              <div className="grid grid-cols-2 gap-1 text-[11px]">
                {location?.zone !== 'hand' && (
                  <button
                    onClick={() => {
                      onMoveTo('hand');
                      setShowMenu(false);
                    }}
                    className="py-1 px-1.5 hover:bg-slate-800 bg-slate-950/50 border border-slate-800 rounded flex items-center gap-1 text-amber-300 text-left"
                  >
                    <ArrowRightLeft className="w-3 h-3 shrink-0" />
                    <span className="truncate">{isOpponent ? '手札(バウンス)' : '手札に戻す'}</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    onMoveTo('graveyard');
                    setShowMenu(false);
                  }}
                  className={`py-1 px-1.5 hover:bg-slate-800 bg-slate-950/50 border border-slate-800 rounded flex items-center gap-1 text-rose-300 text-left ${location?.zone === 'hand' ? 'col-span-2' : ''}`}
                >
                  <Trash2 className="w-3 h-3 shrink-0" />
                  <span className="truncate">{isOpponent ? '退場(場外へ)' : location?.zone === 'hand' ? '場外へ捨てる' : '場外へ送る'}</span>
                </button>

                <button
                  onClick={() => {
                    onMoveTo('deckTop');
                    setShowMenu(false);
                  }}
                  className="py-1 px-1.5 hover:bg-slate-800 bg-slate-950/50 border border-slate-800 rounded flex items-center gap-1 text-emerald-300 text-left"
                >
                  <ArrowUpToLine className="w-3 h-3 shrink-0" />
                  <span className="truncate">山札の上へ戻す</span>
                </button>

                <button
                  onClick={() => {
                    onMoveTo('deckBottom');
                    setShowMenu(false);
                  }}
                  className="py-1 px-1.5 hover:bg-slate-800 bg-slate-950/50 border border-slate-800 rounded flex items-center gap-1 text-emerald-300 text-left"
                >
                  <ArrowDownToLine className="w-3 h-3 shrink-0" />
                  <span className="truncate">{isOpponent ? '山札下(バウンス)' : '山札の下へ戻す'}</span>
                </button>

                <button
                  onClick={() => {
                    onMoveTo('lifeFaceUp');
                    setShowMenu(false);
                  }}
                  className="py-1 px-1.5 hover:bg-amber-950/60 bg-slate-950/50 border border-slate-800 rounded flex items-center gap-1 text-amber-300 font-medium text-left"
                  title={isOpponent ? '相手ライフに表向きで送る' : 'ライフに表向きで置く'}
                >
                  <ShieldAlert className="w-3 h-3 text-amber-400 shrink-0" />
                  <span className="truncate">{isOpponent ? '相手ライフ(表)' : 'ライフに表向きで置く'}</span>
                </button>

                <button
                  onClick={() => {
                    onMoveTo('life');
                    setShowMenu(false);
                  }}
                  className="py-1 px-1.5 hover:bg-slate-800 bg-slate-950/50 border border-slate-800 rounded flex items-center gap-1 text-rose-300 text-left"
                  title={isOpponent ? '相手ライフに裏向きで送る' : 'ライフに裏向きで置く'}
                >
                  <ShieldAlert className="w-3 h-3 text-rose-400 shrink-0" />
                  <span className="truncate">{isOpponent ? '相手ライフ(裏)' : 'ライフに裏向きで置く'}</span>
                </button>

                <button
                  onClick={() => {
                    onMoveTo('removed');
                    setShowMenu(false);
                  }}
                  className="col-span-2 py-1 px-1.5 hover:bg-purple-950/60 bg-slate-950/50 border border-slate-800 rounded flex items-center gap-1 text-purple-300 text-left"
                >
                  <ShieldAlert className="w-3 h-3 shrink-0" />
                  <span>除外する（リムーブ）</span>
                </button>
              </div>
            </div>
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
        </div>
      )}
    </>
  );
};
