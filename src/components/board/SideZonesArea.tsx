import React, { useState } from 'react';
import { PlayerState, CardLocation } from '../../types/game';
import { Card } from '../../types/card';
import {
  Layers,
  ShieldAlert,
  Zap,
  Skull,
  Shuffle,
  Plus,
  Minus,
  Eye,
  Search,
  Ban,
  HeartPulse,
  Hand,
  MoreVertical,
  ArrowUp,
  ArrowDown,
  Target,
} from 'lucide-react';
import { GraveyardModal } from '../modals/GraveyardModal';
import { RemovedModal } from '../modals/RemovedModal';
import { LifePlacementModal } from '../modals/LifePlacementModal';
import { DeckPlacementModal } from '../modals/DeckPlacementModal';

interface SideZonesAreaProps {
  player: PlayerState;
  isOpponent?: boolean;
  isSoloMode?: boolean;
  onDraw?: () => void;
  onShuffle?: () => void;
  onCheckLife?: (lifeIndex: number) => void;
  onRecoverLife?: (isFaceUp?: boolean) => void;
  onTakeLife?: (destination: 'hand' | 'graveyard' | 'deckTop' | 'deckBottom', lifeIndex?: number) => void;
  onFlipLife?: (lifeIndex: number) => void;
  onOpenLifeReorder?: () => void;
  onOpenLifeSelectModal?: () => void;
  onUseAp?: () => void;
  onRecoverAp?: () => void;
  onLookAtTopDeck?: (count: number) => void;
  onOpenSearchDeck?: () => void;
  onRevealTopDeck?: (reveal?: boolean) => void;
  onBottomDeckAction?: (action: 'view' | 'mill' | 'toHand') => void;
  onMillTopDeck?: () => void;
  onInspectCard?: (card: Card) => void;
  onDropToGraveyard?: (from: CardLocation) => void;
  onDropToRemoved?: (from: CardLocation) => void;
  onMoveFromGraveyard?: (
    cardId: string,
    destination: 'hand' | 'deckTop' | 'deckBottom' | 'frontLine' | 'energyLine' | 'removed' | 'life' | 'lifeFaceUp'
  ) => void;
  onMoveFromRemoved?: (
    cardId: string,
    destination: 'hand' | 'graveyard' | 'deckTop' | 'deckBottom' | 'frontLine' | 'energyLine' | 'life' | 'lifeFaceUp'
  ) => void;
  onOpenDeckPicker?: () => void;
  onDropToLife?: (from: CardLocation, isFaceDown?: boolean) => void;
  onDropToDeck?: (from: CardLocation, destination: 'deckTop' | 'deckBottom') => void;
  isCompact?: boolean;
}

export const SideZonesArea: React.FC<SideZonesAreaProps> = ({
  player,
  isOpponent = false,
  isSoloMode = false,
  isCompact = false,
  onDraw,
  onShuffle,
  onCheckLife,
  onRecoverLife,
  onTakeLife,
  onFlipLife,
  onOpenLifeReorder,
  onOpenLifeSelectModal,
  onUseAp,
  onRecoverAp,
  onLookAtTopDeck,
  onOpenSearchDeck,
  onRevealTopDeck,
  onBottomDeckAction,
  onMillTopDeck,
  onInspectCard,
  onDropToGraveyard,
  onDropToRemoved,
  onMoveFromGraveyard,
  onMoveFromRemoved,
  onOpenDeckPicker,
  onDropToLife,
  onDropToDeck,
}) => {
  const [showGraveyardModal, setShowGraveyardModal] = useState(false);
  const [showRemovedModal, setShowRemovedModal] = useState(false);
  const [showTopDeckDropdown, setShowTopDeckDropdown] = useState(false);
  const [showBottomDeckDropdown, setShowBottomDeckDropdown] = useState(false);
  const [showLifeMenu, setShowLifeMenu] = useState(false);
  const [selectedMyLifeIndex, setSelectedMyLifeIndex] = useState<number | null>(null);
  const [pendingLifeDrop, setPendingLifeDrop] = useState<CardLocation | null>(null);
  const [pendingDeckDrop, setPendingDeckDrop] = useState<CardLocation | null>(null);

  const hasEmptyFrontSlot = player.frontLine.some((c) => c === null);
  const hasEmptyEnergySlot = player.energyLine.some((c) => c === null);

  return (
    <div className={`flex flex-col rounded-xl border border-slate-800/80 bg-slate-900/40 ${
      isCompact
        ? 'w-40 sm:w-44 p-1.5 gap-1 text-[11px] shrink-0 justify-between'
        : 'w-48 sm:w-52 p-2 gap-2 text-xs'
    }`}>
      {/* APエリア */}
      <div className={`flex items-center justify-between bg-slate-950/80 rounded-lg border border-amber-500/30 ${isCompact ? 'p-1' : 'p-2'}`}>
        <div className="flex items-center gap-1.5 font-bold text-amber-400">
          <Zap className={`${isCompact ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} />
          <span>AP</span>
        </div>
        <div className="flex items-center gap-1">
          <span className={`${isCompact ? 'text-sm px-1.5' : 'text-base px-2'} font-extrabold text-white py-0.5 bg-amber-950/80 rounded border border-amber-500/50`}>
            {player.apCurrent} / {player.apMax}
          </span>
          {(!isOpponent || isSoloMode) && (
            <div className="flex items-center gap-0.5 ml-1">
              <button
                onClick={onUseAp}
                disabled={player.apCurrent <= 0}
                className="p-1 bg-rose-900/60 hover:bg-rose-800 disabled:opacity-30 rounded text-white transition-colors"
                title="APを1消費"
              >
                <Minus className="w-3 h-3" />
              </button>
              <button
                onClick={onRecoverAp}
                disabled={player.apCurrent >= player.apMax}
                className="p-1 bg-emerald-900/60 hover:bg-emerald-800 disabled:opacity-30 rounded text-white transition-colors"
                title="APを1回復"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ライフエリア */}
      <div
        onDragOver={(e) => {
          if (isOpponent && !isSoloMode) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
        }}
        onDrop={(e) => {
          if (isOpponent && !isSoloMode) return;
          e.preventDefault();
          try {
            const raw = e.dataTransfer.getData('application/x-union-arena-card');
            if (!raw) return;
            const payload = JSON.parse(raw);
            if (onDropToLife && payload.from) {
              setPendingLifeDrop(payload.from);
            }
          } catch (err) {
            console.error('Failed to parse dropped card to life:', err);
          }
        }}
        className={`flex flex-col bg-slate-950/80 rounded-lg border border-rose-500/30 relative hover:border-rose-500/60 transition-colors ${
          isCompact ? 'p-1 gap-0.5' : 'p-2 gap-1.5'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-bold text-rose-400">
            <ShieldAlert className="w-4 h-4" />
            <span>ライフ</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onOpenLifeSelectModal}
              disabled={player.life.length === 0}
              className="text-base font-extrabold text-white px-2 py-0.5 bg-rose-950/80 hover:bg-rose-900 rounded border border-rose-500/50 cursor-pointer disabled:cursor-default transition-colors"
              title="クリックでライフ一覧・選択モーダルを開く"
            >
              {player.life.length}
            </button>
            {isOpponent ? (
              <div className="flex items-center gap-1">
                {onOpenLifeSelectModal && (
                  <button
                    onClick={onOpenLifeSelectModal}
                    disabled={player.life.length === 0}
                    className="px-1.5 py-1 bg-indigo-700 hover:bg-indigo-600 disabled:opacity-40 rounded text-[9px] font-bold text-white shadow flex items-center gap-0.5 transition-colors"
                    title="ライフ一覧から好きなカードを任意指定してトリガーチェックや操作を行う"
                  >
                    <Target className="w-2.5 h-2.5" />
                    選択
                  </button>
                )}
                {onCheckLife && (
                  <button
                    onClick={() => onCheckLife(0)}
                    disabled={player.life.length === 0}
                    className="px-1.5 py-1 bg-rose-700 hover:bg-rose-600 disabled:opacity-40 rounded text-[9px] font-bold text-white shadow flex items-center gap-0.5 transition-colors"
                    title="相手のライフ（先頭）をトリガーチェック（下のカードまたは「選択」ボタンで任意指定可能）"
                  >
                    <Eye className="w-2.5 h-2.5" />
                    チェック
                  </button>
                )}
                {onTakeLife && (
                  <button
                    onClick={() => onTakeLife('graveyard', 0)}
                    disabled={player.life.length === 0}
                    className="px-1.5 py-1 bg-rose-900 hover:bg-rose-800 disabled:opacity-40 rounded text-[9px] font-bold text-rose-200 border border-rose-500/40 shadow flex items-center transition-colors"
                    title="相手のライフ（先頭）を直接1枚場外へ置く（ダメージ2、インパクト等）"
                  >
                    -1ダメ
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1">
                {onOpenLifeSelectModal && (
                  <button
                    onClick={onOpenLifeSelectModal}
                    disabled={player.life.length === 0}
                    className="px-1.5 py-1 bg-indigo-700 hover:bg-indigo-600 disabled:opacity-40 rounded text-[9px] font-bold text-white shadow flex items-center gap-0.5 transition-colors"
                    title="ライフ一覧から好きなカードを任意指定して操作を行う"
                  >
                    <Target className="w-2.5 h-2.5" />
                    選択
                  </button>
                )}
                <button
                  onClick={() => onCheckLife && onCheckLife(0)}
                  disabled={player.life.length === 0}
                  className="px-2 py-1 bg-rose-700 hover:bg-rose-600 disabled:opacity-40 rounded text-[10px] font-bold text-white shadow flex items-center gap-1 transition-colors"
                  title="アタックダメージのトリガーチェック"
                >
                  <Eye className="w-3 h-3" />
                  チェック
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ライフカード一覧（攻撃側が好きなカードを選択可能） */}
        {player.life.length > 0 && (
          <div className="flex flex-col gap-1 pt-1 border-t border-slate-800/80">
            <div className="flex items-center justify-between text-[9px] text-slate-400">
              <span className="font-semibold text-rose-300">
                {isOpponent ? '🎯 クリックで指定チェック' : '各ライフカード'}
              </span>
              {onOpenLifeSelectModal && (
                <button
                  type="button"
                  onClick={onOpenLifeSelectModal}
                  className="text-[8px] text-indigo-400 hover:text-indigo-200 underline font-bold"
                  title="大きな画面で全ライフを確認・選択"
                >
                  一覧・任意選択
                </button>
              )}
            </div>

            <div className="flex items-center gap-1 overflow-x-auto py-1 px-0.5 max-w-full">
              {player.life.map((card, idx) => {
                const isFaceDown = card.isFaceDown !== false;
                return (
                  <div key={`${card.id}-${idx}`} className="group relative shrink-0">
                    <button
                      onClick={() => {
                        if (isOpponent) {
                          // 公式ルール P12: 攻撃側が好きなカードを選択してトリガーチェック！
                          onCheckLife?.(idx);
                        } else {
                          setSelectedMyLifeIndex(selectedMyLifeIndex === idx ? null : idx);
                        }
                      }}
                      className={`${
                        isCompact ? 'w-5 h-7 text-[8px] p-0' : 'w-7 h-10 text-[9px] p-0.5'
                      } rounded border font-bold flex flex-col items-center justify-between transition-all transform hover:scale-105 hover:z-10 shadow-sm ${
                        !isFaceDown
                          ? 'bg-amber-950/90 border-amber-400/80 text-amber-200 ring-1 ring-amber-400/50'
                          : isOpponent
                          ? 'bg-gradient-to-b from-rose-900 to-rose-950 border-rose-500/60 hover:border-rose-400 hover:ring-1 hover:ring-rose-400 text-rose-200'
                          : 'bg-gradient-to-b from-rose-950 to-slate-900 border-rose-700/60 hover:border-rose-500 text-rose-300'
                      }`}
                      title={
                        !isFaceDown
                          ? `ライフ #${idx + 1}【表向き】: ${card.name} (トリガー: ${card.triggers.join(', ') || 'なし'}) - クリックで対象指定`
                          : `ライフ #${idx + 1} - クリックで${isOpponent ? 'トリガーチェック' : '操作メニュー'}`
                      }
                    >
                      <span className="text-[8px] opacity-70">#{idx + 1}</span>
                      {!isFaceDown ? (
                        <span className="text-[7px] font-extrabold truncate w-full text-center leading-none text-amber-300">
                          {card.name.slice(0, 3)}
                        </span>
                      ) : (
                        <ShieldAlert className="w-2.5 h-2.5 opacity-60" />
                      )}
                      <span className="text-[7px] opacity-60">{!isFaceDown ? '表' : '裏'}</span>
                    </button>

                    {/* 相手の表向きライフの「詳細確認」ボタン */}
                    {isOpponent && !isFaceDown && onInspectCard && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onInspectCard(card);
                        }}
                        className="absolute -top-2 -left-1 bg-slate-900 hover:bg-slate-800 border border-amber-400 rounded px-1 text-[7px] text-amber-300 font-bold shadow z-20"
                        title="表向きライフカードの効果を確認"
                      >
                        詳細
                      </button>
                    )}

                    {/* 相手ライフのホバー時「直接場外送り（-1ダメ）」ボタン */}
                    {isOpponent && onTakeLife && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onTakeLife('graveyard', idx);
                        }}
                        className="hidden group-hover:flex absolute -top-2 -right-1 bg-rose-950 hover:bg-rose-900 border border-rose-500 rounded px-1 text-[7px] text-rose-200 font-bold shadow z-20 whitespace-nowrap"
                        title="このライフカードを直接場外へ送る"
                      >
                        破棄
                      </button>
                    )}

                    {/* 相手ライフのホバー時「表/裏切替」ボタン（眞霜平助等） */}
                    {isOpponent && onFlipLife && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onFlipLife(idx);
                        }}
                        className="hidden group-hover:flex absolute -bottom-2 -left-1 bg-amber-950 hover:bg-amber-900 border border-amber-500 rounded px-1 text-[7px] text-amber-200 font-bold shadow z-20 whitespace-nowrap"
                        title="相手のライフの表/裏を切り替える（眞霜平助等）"
                      >
                        表裏
                      </button>
                    )}

                    {/* 自分ライフの個別操作ポップアップ */}
                    {!isOpponent && selectedMyLifeIndex === idx && (
                      <div
                        className="absolute left-0 bottom-full mb-1 z-30 bg-slate-900 border border-slate-700 rounded-lg shadow-xl p-1 flex flex-col gap-1 w-36 text-[10px]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="text-[9px] text-slate-400 font-bold px-1 border-b border-slate-800 pb-0.5 truncate">
                          ライフ #{idx + 1} {!isFaceDown ? `(${card.name})` : ''}
                        </div>
                        {onInspectCard && !isFaceDown && (
                          <button
                            onClick={() => {
                              onInspectCard(card);
                              setSelectedMyLifeIndex(null);
                            }}
                            className="px-1.5 py-1 hover:bg-slate-800 rounded text-left text-amber-300 font-bold flex items-center gap-1"
                          >
                            <Eye className="w-2.5 h-2.5" />
                            カード詳細を見る
                          </button>
                        )}
                        <button
                          onClick={() => {
                            onCheckLife?.(idx);
                            setSelectedMyLifeIndex(null);
                          }}
                          className="px-1.5 py-1 hover:bg-slate-800 rounded text-left text-rose-300 flex items-center gap-1"
                        >
                          <Eye className="w-2.5 h-2.5" />
                          チェック
                        </button>
                        <button
                          onClick={() => {
                            onTakeLife?.('hand', idx);
                            setSelectedMyLifeIndex(null);
                          }}
                          className="px-1.5 py-1 hover:bg-slate-800 rounded text-left text-sky-300 flex items-center gap-1"
                        >
                          <Hand className="w-2.5 h-2.5" />
                          手札に回収
                        </button>
                        <button
                          onClick={() => {
                            onTakeLife?.('graveyard', idx);
                            setSelectedMyLifeIndex(null);
                          }}
                          className="px-1.5 py-1 hover:bg-slate-800 rounded text-left text-rose-400 flex items-center gap-1"
                        >
                          <Skull className="w-2.5 h-2.5" />
                          自傷で場外へ
                        </button>
                        <button
                          onClick={() => {
                            onTakeLife?.('deckTop', idx);
                            setSelectedMyLifeIndex(null);
                          }}
                          className="px-1.5 py-1 hover:bg-slate-800 rounded text-left text-emerald-300 flex items-center gap-1"
                          title="山札の一番上に戻す"
                        >
                          <ArrowUp className="w-2.5 h-2.5 text-emerald-400" />
                          山札の上へ戻す
                        </button>
                        <button
                          onClick={() => {
                            onTakeLife?.('deckBottom', idx);
                            setSelectedMyLifeIndex(null);
                          }}
                          className="px-1.5 py-1 hover:bg-slate-800 rounded text-left text-emerald-400 flex items-center gap-1"
                          title="仮面ライダーオーズ等の効果"
                        >
                          <ArrowDown className="w-2.5 h-2.5 text-emerald-400" />
                          山札の下へ送る
                        </button>
                        {onFlipLife && (
                          <button
                            onClick={() => {
                              onFlipLife(idx);
                              setSelectedMyLifeIndex(null);
                            }}
                            className="px-1.5 py-1 hover:bg-slate-800 rounded text-left text-amber-300 flex items-center gap-1 border-t border-slate-800 mt-0.5"
                          >
                            <Eye className="w-2.5 h-2.5" />
                            表/裏切替
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 表向きライフのインジケータ（存在する場合） */}
        {player.life.some((c) => !c.isFaceDown) && (
          <div className="text-[9px] bg-rose-900/40 border border-rose-500/40 rounded px-1.5 py-0.5 text-rose-200 font-semibold flex items-center gap-1 truncate">
            <Eye className="w-2.5 h-2.5 text-amber-400 shrink-0" />
            <span className="truncate">
              表向き: {player.life.filter((c) => !c.isFaceDown).map((c) => c.name).join(', ')}
            </span>
          </div>
        )}

        {/* ライフ高度操作 (回復・自傷コスト・手札回収・表向き化) */}
        {(!isOpponent || isSoloMode) && (
          <div className="flex items-center gap-1 pt-1 border-t border-slate-800 text-[10px] relative">
            <button
              onClick={() => onRecoverLife?.()}
              disabled={player.deck.length === 0}
              className="flex-1 flex items-center justify-center gap-0.5 py-1 bg-emerald-900/40 hover:bg-emerald-800/60 border border-emerald-600/30 rounded text-emerald-300 font-semibold transition-colors"
              title="山札の上から1枚をライフに追加（ライフ回復）"
            >
              <HeartPulse className="w-3 h-3 text-emerald-400" />
              +1回復
            </button>

            <div className="relative">
              <button
                onClick={() => setShowLifeMenu(!showLifeMenu)}
                className="px-1.5 py-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 font-semibold flex items-center transition-colors"
                title="自傷・回収・表裏メニュー"
              >
                <MoreVertical className="w-3 h-3" />
              </button>

              {showLifeMenu && (
                <div
                  className="absolute right-0 bottom-full mb-1 z-30 bg-slate-900 border border-slate-700 rounded-lg shadow-xl p-1 flex flex-col gap-1 w-40 text-[11px]"
                  onClick={() => setShowLifeMenu(false)}
                >
                  <button
                    onClick={() => onTakeLife && onTakeLife('hand')}
                    disabled={player.life.length === 0}
                    className="px-2 py-1.5 hover:bg-slate-800 rounded text-left text-sky-300 flex items-center gap-1.5"
                    title="ライフの一番上を手札に加える（エレン等）"
                  >
                    <Hand className="w-3 h-3" />
                    手札に回収
                  </button>
                  <button
                    onClick={() => onTakeLife && onTakeLife('graveyard')}
                    disabled={player.life.length === 0}
                    className="px-2 py-1.5 hover:bg-slate-800 rounded text-left text-rose-300 flex items-center gap-1.5"
                    title="ライフを場外へ送る（宿儺の指等の自傷コスト）"
                  >
                    <Skull className="w-3 h-3" />
                    自傷で場外へ
                  </button>
                  <button
                    onClick={() => onRecoverLife && onRecoverLife(false)}
                    disabled={player.deck.length === 0}
                    className="px-2 py-1.5 hover:bg-slate-800 rounded text-left text-amber-300 flex items-center gap-1.5"
                    title="山札の上から1枚を表向きでライフに置く（ランカ・リー、オベリスク等）"
                  >
                    <HeartPulse className="w-3 h-3 text-amber-400" />
                    山札から表向きでライフへ
                  </button>
                  {onOpenLifeReorder && (
                    <button
                      onClick={onOpenLifeReorder}
                      disabled={player.life.length === 0}
                      className="px-2 py-1.5 hover:bg-slate-800 rounded text-left text-indigo-300 flex items-center gap-1.5"
                      title="ライフを全て確認し、望む順序に並び替える（サー・ナイトアイ等）"
                    >
                      <Layers className="w-3 h-3 text-indigo-400" />
                      ライフ確認・並び替え
                    </button>
                  )}
                  {onFlipLife && (
                    <button
                      onClick={() => onFlipLife(0)}
                      disabled={player.life.length === 0}
                      className="px-2 py-1.5 hover:bg-slate-800 rounded text-left text-amber-300 flex items-center gap-1.5 border-t border-slate-800 mt-0.5"
                      title="ライフの一番上の表向き/裏向きを切り替える（眞霜平助等）"
                    >
                      <Eye className="w-3 h-3" />
                      一番上を表/裏切替
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 山札 (Deck) */}
      <div
        onDragOver={(e) => {
          if (isOpponent && !isSoloMode) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
        }}
        onDrop={(e) => {
          if (isOpponent && !isSoloMode) return;
          e.preventDefault();
          try {
            const raw = e.dataTransfer.getData('application/x-union-arena-card');
            if (!raw) return;
            const payload = JSON.parse(raw);
            if (onDropToDeck && payload.from) {
              setPendingDeckDrop(payload.from);
            }
          } catch (err) {
            console.error('Failed to parse dropped card to deck:', err);
          }
        }}
        className={`flex flex-col bg-slate-950/80 rounded-lg border border-indigo-500/30 relative hover:border-indigo-500/60 transition-colors ${
          isCompact ? 'p-1 gap-0.5' : 'p-2 gap-1.5'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-bold text-indigo-400">
            <Layers className="w-4 h-4" />
            <span>山札</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-indigo-200">
              {player.deck.length} 枚
            </span>
            {player.deck.length === 0 && player.hand.length === 0 && onOpenDeckPicker ? (
              <button
                onClick={onOpenDeckPicker}
                className="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-500 rounded text-[10px] font-bold text-white shadow transition animate-pulse"
                title="保存済みデッキまたはプリセットデッキを選択してセット"
              >
                デッキをセット
              </button>
            ) : isOpponent ? (
              <div className="flex items-center gap-1">
                {onRevealTopDeck && (
                  <button
                    onClick={() => onRevealTopDeck()}
                    disabled={player.deck.length === 0}
                    className="px-1.5 py-1 bg-amber-950/80 hover:bg-amber-900 border border-amber-500/40 rounded text-[9px] font-bold text-amber-300 shadow transition-colors"
                    title="相手の山札の一番上を表向き/裏向きにする（朝倉シン等）"
                  >
                    {player.revealedTopDeckCard ? 'トップ裏' : 'トップ表'}
                  </button>
                )}
                {onMillTopDeck && (
                  <button
                    onClick={onMillTopDeck}
                    disabled={player.deck.length === 0}
                    className="px-1.5 py-1 bg-rose-950/80 hover:bg-rose-900 border border-rose-500/40 rounded text-[9px] font-bold text-rose-300 shadow transition-colors"
                    title="相手の山札の上から1枚を場外へ送る（宿儺、無為転変等の山札削り）"
                  >
                    1枚削る
                  </button>
                )}
                {onDraw && (
                  <button
                    onClick={onDraw}
                    disabled={player.deck.length === 0}
                    className="px-1.5 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 rounded text-[9px] font-bold text-white shadow transition-colors"
                    title="相手の山札から1枚引く"
                  >
                    引く
                  </button>
                )}
              </div>
            ) : (
              <>
                <button
                  onClick={onDraw}
                  disabled={player.deck.length === 0}
                  className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 rounded text-[10px] font-bold text-white shadow transition-colors"
                  title="山札から1枚引く"
                >
                  引く
                </button>
                <button
                  onClick={onShuffle}
                  className="p-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 transition-colors"
                  title="山札をシャッフル"
                >
                  <Shuffle className="w-3 h-3" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* 山札の一番上が表向きの場合のインジケータ（朝倉シン等） */}
        {player.revealedTopDeckCard && (
          <div className="text-[9px] bg-indigo-900/50 border border-indigo-400/50 rounded px-1.5 py-0.5 text-indigo-200 font-semibold flex items-center gap-1 truncate animate-pulse">
            <Eye className="w-2.5 h-2.5 text-amber-400 shrink-0" />
            <span className="truncate">トップ公開: {player.revealedTopDeckCard.name}</span>
          </div>
        )}

        {/* 山札確認・サーチボタングループ (自分のみ、またはソロモード) */}
        {(!isOpponent || isSoloMode) && (
          <div className="flex items-center gap-1 pt-1 border-t border-slate-800 text-[10px]">
            {/* 上からN枚見るボタン */}
            <div className="relative flex-1">
              <button
                onClick={() => setShowTopDeckDropdown(!showTopDeckDropdown)}
                disabled={player.deck.length === 0}
                className="w-full flex items-center justify-center gap-1 py-1 bg-slate-800 hover:bg-slate-700 rounded text-sky-300 font-semibold transition-colors"
                title="山札の上からカードを確認します"
              >
                <Eye className="w-3 h-3" />
                上を見る
              </button>

              {showTopDeckDropdown && (
                <div
                  className="absolute left-0 bottom-full mb-1 z-30 bg-slate-900 border border-slate-700 rounded-lg shadow-xl p-1 flex flex-col gap-1 w-32"
                  onClick={() => setShowTopDeckDropdown(false)}
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      onClick={() => onLookAtTopDeck && onLookAtTopDeck(n)}
                      className="px-2 py-1 hover:bg-slate-800 rounded text-left text-slate-200 text-xs"
                    >
                      上から {n} 枚
                    </button>
                  ))}
                  {onRevealTopDeck && (
                    <button
                      onClick={() => onRevealTopDeck()}
                      className="px-2 py-1 hover:bg-slate-800 rounded text-left text-amber-300 text-xs border-t border-slate-800 mt-0.5"
                      title="山札の一番上を表向き/裏向きにする（朝倉シン等）"
                    >
                      {player.revealedTopDeckCard ? 'トップを裏に戻す' : 'トップを表向きに'}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* 山札の下から（ガメラ、VF-0D等） */}
            <div className="relative flex-1">
              <button
                onClick={() => setShowBottomDeckDropdown(!showBottomDeckDropdown)}
                disabled={player.deck.length === 0}
                className="w-full flex items-center justify-center gap-1 py-1 bg-slate-800 hover:bg-slate-700 rounded text-amber-300 font-semibold transition-colors"
                title="山札の一番下のカードに対する操作"
              >
                下から
              </button>

              {showBottomDeckDropdown && (
                <div
                  className="absolute left-0 bottom-full mb-1 z-30 bg-slate-900 border border-slate-700 rounded-lg shadow-xl p-1 flex flex-col gap-1 w-36"
                  onClick={() => setShowBottomDeckDropdown(false)}
                >
                  <button
                    onClick={() => {
                      if (player.deck.length > 0 && onInspectCard) {
                        onInspectCard(player.deck[player.deck.length - 1]);
                      } else if (onBottomDeckAction) {
                        onBottomDeckAction('view');
                      }
                    }}
                    className="px-2 py-1 hover:bg-slate-800 rounded text-left text-sky-300 text-xs"
                    title="山札の一番下のカードを確認する（自分のみ）"
                  >
                    一番下を確認
                  </button>
                  <button
                    onClick={() => onBottomDeckAction && onBottomDeckAction('view')}
                    className="px-2 py-1 hover:bg-slate-800 rounded text-left text-amber-300 text-xs"
                    title="山札の一番下のカードを公開する（相手にも公開）"
                  >
                    一番下を公開
                  </button>
                  <button
                    onClick={() => onBottomDeckAction && onBottomDeckAction('mill')}
                    className="px-2 py-1 hover:bg-slate-800 rounded text-left text-rose-300 text-xs"
                    title="山札の一番下のカードを場外へ置く（VF-0D等）"
                  >
                    一番下を場外へ
                  </button>
                  <button
                    onClick={() => onBottomDeckAction && onBottomDeckAction('toHand')}
                    className="px-2 py-1 hover:bg-slate-800 rounded text-left text-emerald-300 text-xs"
                    title="山札の一番下のカードを手札に加える"
                  >
                    一番下を手札へ
                  </button>
                </div>
              )}
            </div>

            {/* 山札サーチボタン */}
            <button
              onClick={onOpenSearchDeck}
              disabled={player.deck.length === 0}
              className="flex-1 flex items-center justify-center gap-1 py-1 bg-slate-800 hover:bg-slate-700 rounded text-indigo-300 font-semibold transition-colors"
              title="山札全体からカードを探します"
            >
              <Search className="w-3 h-3" />
              探す
            </button>
          </div>
        )}
      </div>

      {/* 場外 (Graveyard) & 除外 (Removed) */}
      <div className={`grid grid-cols-2 ${isCompact ? 'gap-1' : 'gap-1.5'}`}>
        <button
          onClick={() => setShowGraveyardModal(true)}
          onDragOver={(e) => {
            if (isOpponent && !isSoloMode) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
          }}
          onDrop={(e) => {
            if (isOpponent && !isSoloMode) return;
            e.preventDefault();
            try {
              const raw = e.dataTransfer.getData('application/x-union-arena-card');
              if (!raw) return;
              const payload = JSON.parse(raw);
              if (onDropToGraveyard) {
                onDropToGraveyard(payload.from);
              }
            } catch (err) {
              console.error('Failed to parse dropped graveyard card:', err);
            }
          }}
          className={`flex flex-col items-center justify-center bg-slate-950/80 hover:bg-slate-900 border border-slate-700 rounded-lg text-slate-300 transition hover:border-rose-500/80 hover:ring-1 hover:ring-rose-500 cursor-pointer ${
            isCompact ? 'p-1' : 'p-1.5'
          }`}
          title="クリックで一覧確認・回収 / ドロップで場外へ送る"
        >
          <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-400">
            <Skull className="w-3 h-3 text-rose-400" />
            <span>場外</span>
          </div>
          <span className={`font-bold ${isCompact ? 'text-xs' : 'text-sm'} text-white`}>{player.graveyard.length}</span>
        </button>

        <button
          onClick={() => setShowRemovedModal(true)}
          onDragOver={(e) => {
            if (isOpponent && !isSoloMode) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
          }}
          onDrop={(e) => {
            if (isOpponent && !isSoloMode) return;
            e.preventDefault();
            try {
              const raw = e.dataTransfer.getData('application/x-union-arena-card');
              if (!raw) return;
              const payload = JSON.parse(raw);
              if (onDropToRemoved) {
                onDropToRemoved(payload.from);
              }
            } catch (err) {
              console.error('Failed to parse dropped removed card:', err);
            }
          }}
          className={`flex flex-col items-center justify-center bg-slate-950/80 hover:bg-slate-900 border border-slate-700 rounded-lg text-slate-300 transition hover:border-purple-500/80 hover:ring-1 hover:ring-purple-500 cursor-pointer ${
            isCompact ? 'p-1' : 'p-1.5'
          }`}
          title="クリックで一覧確認・回収 / ドロップで除外（リムーブ）へ送る"
        >
          <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-400">
            <Ban className="w-3 h-3 text-purple-400" />
            <span>除外</span>
          </div>
          <span className={`font-bold ${isCompact ? 'text-xs' : 'text-sm'} text-white`}>{player.removed.length}</span>
        </button>
      </div>

      {/* 場外一覧モーダル */}
      <GraveyardModal
        isOpen={showGraveyardModal}
        cards={player.graveyard}
        playerName={player.name}
        isOpponent={isOpponent}
        hasEmptyFrontSlot={hasEmptyFrontSlot}
        hasEmptyEnergySlot={hasEmptyEnergySlot}
        onMoveCard={(cardId, destination) => {
          if (onMoveFromGraveyard) {
            onMoveFromGraveyard(cardId, destination);
          }
        }}
        onInspectCard={(card) => onInspectCard && onInspectCard(card)}
        onClose={() => setShowGraveyardModal(false)}
      />

      {/* 除外一覧モーダル */}
      <RemovedModal
        isOpen={showRemovedModal}
        cards={player.removed}
        playerName={player.name}
        isOpponent={isOpponent}
        hasEmptyFrontSlot={hasEmptyFrontSlot}
        hasEmptyEnergySlot={hasEmptyEnergySlot}
        onMoveCard={(cardId, destination) => {
          if (onMoveFromRemoved) {
            onMoveFromRemoved(cardId, destination);
          }
        }}
        onInspectCard={(card) => onInspectCard && onInspectCard(card)}
        onClose={() => setShowRemovedModal(false)}
      />

      {/* ライフ配置方法選択モーダル */}
      <LifePlacementModal
        isOpen={pendingLifeDrop !== null}
        onConfirm={(isFaceDown) => {
          if (pendingLifeDrop && onDropToLife) {
            onDropToLife(pendingLifeDrop, isFaceDown);
          }
          setPendingLifeDrop(null);
        }}
        onClose={() => setPendingLifeDrop(null)}
      />

      {/* 山札配置方法選択モーダル */}
      <DeckPlacementModal
        isOpen={pendingDeckDrop !== null}
        onSelect={(destination) => {
          if (pendingDeckDrop && onDropToDeck) {
            onDropToDeck(pendingDeckDrop, destination);
          }
          setPendingDeckDrop(null);
        }}
        onCancel={() => setPendingDeckDrop(null)}
      />
    </div>
  );
};
