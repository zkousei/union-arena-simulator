import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardColor } from '../../types/card';
import { FieldSlotIndex, GameState, CardLocation } from '../../types/game';
import { GameAction } from '../../types/actions';
import { FieldZone } from './FieldZone';
import { SideZonesArea } from './SideZonesArea';
import { HandArea } from './HandArea';
import { PhaseBar } from '../controls/PhaseBar';
import { RevealedCardModal } from './RevealedCardModal';
import { TopDeckModal } from '../modals/TopDeckModal';
import { CardSearchModal } from '../modals/CardSearchModal';
import { UnderCardsModal } from '../modals/UnderCardsModal';
import { LifeReorderModal } from '../modals/LifeReorderModal';
import { LifeSelectModal } from '../modals/LifeSelectModal';
import { RaidOrMarkerModal } from '../modals/RaidOrMarkerModal';
import { AttackLineOverlay } from './AttackLineOverlay';
import { ConfirmModal } from '../modals/ConfirmModal';
import { Shield, ShieldAlert, X, Zap } from 'lucide-react';
import { calculateGeneratedEnergy } from '../../domain/energy';

interface BoardProps {
  gameState: GameState;
  myPlayerId: string;
  dispatchAction: (action: GameAction) => void;
  onOpenDeckPicker?: (targetPlayerId?: string) => void;
  isSoloMode?: boolean;
  isFitMode?: boolean;
  onUndo?: () => void;
  canUndo?: boolean;
}

export const Board: React.FC<BoardProps> = ({
  gameState,
  myPlayerId,
  dispatchAction,
  onOpenDeckPicker,
  isSoloMode = false,
  isFitMode = true,
  onUndo,
  canUndo = false,
}) => {
  // プレイヤーIDと各プレイヤー状態の決定 (ソロモードでは P1が下・P2が上で固定)
  const playerIds = Object.keys(gameState.players);
  const opponentId = playerIds.find((id) => id !== myPlayerId) || 'player-2';

  const bottomPlayerId = isSoloMode ? 'player-1' : myPlayerId;
  const topPlayerId = isSoloMode ? 'player-2' : opponentId;

  const defaultPlayer = (id: string, name: string) => ({
    id,
    name,
    deck: [],
    hand: [],
    frontLine: [null, null, null, null],
    energyLine: [null, null, null, null],
    life: [],
    graveyard: [],
    removed: [],
    apArea: [],
    apCurrent: 3,
    apMax: 3,
  });

  const bottomPlayer = gameState.players[bottomPlayerId] || defaultPlayer(bottomPlayerId, 'Player 1');
  const topPlayer = gameState.players[topPlayerId] || defaultPlayer(topPlayerId, 'Player 2');

  // 手札からフィールドへ配置するための選択状態 (選択カードと所持プレイヤーID)
  const [selectedHandCard, setSelectedHandCard] = useState<{
    card: Card;
    playerId: string;
  } | null>(null);
  const [inspectCard, setInspectCard] = useState<Card | null>(null);
  const [isCardSearchOpen, setIsCardSearchOpen] = useState(false);
  const [searchPlayerId, setSearchPlayerId] = useState<string>(bottomPlayerId);
  const [isLifeReorderOpen, setIsLifeReorderOpen] = useState(false);
  const [lifeReorderPlayerId, setLifeReorderPlayerId] = useState<string>(bottomPlayerId);
  const [lifeSelectPlayerId, setLifeSelectPlayerId] = useState<string | null>(null);
  const [pendingRaidOrMarker, setPendingRaidOrMarker] = useState<{
    targetPlayerId: string;
    incomingCard: Card;
    existingCard: Card;
    targetZone: 'frontLine' | 'energyLine';
    targetSlotIndex: FieldSlotIndex;
    fromLocation: CardLocation;
  } | null>(null);

  // レイド下敷きカード確認モーダル状態
  const [underCardsTarget, setUnderCardsTarget] = useState<{
    playerId?: string;
    zone: 'frontLine' | 'energyLine';
    slotIndex: FieldSlotIndex;
  } | null>(null);

  // アタックモード状態 (アタッカープレイヤーID、ゾーン、枠)
  const [attackingState, setAttackingState] = useState<{
    attackerPlayerId: string;
    zone: 'frontLine' | 'energyLine';
    slotIndex: FieldSlotIndex;
  } | null>(null);

  // START/MOVEフェイズからのアタック実行確認モーダル状態
  const [pendingPhaseAttack, setPendingPhaseAttack] = useState<{
    attackerPlayerId: string;
    zone: 'frontLine' | 'energyLine';
    slotIndex: FieldSlotIndex;
    isDirect: boolean;
  } | null>(null);

  // アプリ内通知モーダル状態 (alertの代替)
  const [alertNotice, setAlertNotice] = useState<{
    title: string;
    description: string;
  } | null>(null);

  // 相手ライフ直接場外送り確認モーダル状態
  const [pendingTakeLife, setPendingTakeLife] = useState<{
    playerId: string;
    destination: 'hand' | 'graveyard' | 'deckTop' | 'deckBottom';
    lifeIndex?: number;
  } | null>(null);

  const pendingCombat = gameState.pendingCombat;

  // フェイズ順次進行ハンドラ (START -> MOVE -> MAIN -> ATTACK(先攻1TはEND) -> END -> ターン終了)
  const handleAdvancePhase = useCallback(() => {
    setAttackingState(null);
    if (gameState.phase === 'START') {
      dispatchAction({ type: 'SET_PHASE', payload: { phase: 'MOVE' } });
    } else if (gameState.phase === 'MOVE') {
      dispatchAction({ type: 'SET_PHASE', payload: { phase: 'MAIN' } });
    } else if (gameState.phase === 'MAIN') {
      const isFirstTurnFirstPlayer = gameState.turn === 1 && !!gameState.players[gameState.activePlayerId]?.isFirst;
      if (isFirstTurnFirstPlayer) {
        dispatchAction({ type: 'SET_PHASE', payload: { phase: 'END' } });
      } else {
        dispatchAction({ type: 'SET_PHASE', payload: { phase: 'ATTACK' } });
      }
    } else if (gameState.phase === 'ATTACK') {
      dispatchAction({ type: 'SET_PHASE', payload: { phase: 'END' } });
    } else if (gameState.phase === 'END') {
      dispatchAction({ type: 'PASS_TURN', payload: { playerId: gameState.activePlayerId } });
    }
  }, [gameState.phase, gameState.turn, gameState.activePlayerId, gameState.players, dispatchAction, setAttackingState]);

  // アタック取り消し (巻き戻し)
  const handleCancelPendingBlock = useCallback(() => {
    if (!pendingCombat) return;
    dispatchAction({
      type: 'CANCEL_PLAYER_ATTACK',
      payload: { actorPlayerId: pendingCombat.attackerPlayerId },
    });
  }, [pendingCombat, dispatchAction]);

  // キーボードショートカット管理 (Space: 次フェイズ/ターン終了, Escape: 選択・アタックキャンセル, Ctrl+Z/Cmd+Z: Undo)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        handleAdvancePhase();
        return;
      }

      if (e.key === 'Escape') {
        if (attackingState !== null) {
          setAttackingState(null);
        } else if (pendingCombat?.attackerPlayerId === myPlayerId || isSoloMode) {
          handleCancelPendingBlock();
        } else if (selectedHandCard !== null) {
          setSelectedHandCard(null);
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z') && !e.shiftKey) {
        if (onUndo && canUndo) {
          e.preventDefault();
          onUndo();
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleAdvancePhase, attackingState, pendingCombat, myPlayerId, isSoloMode, handleCancelPendingBlock, selectedHandCard, onUndo, canUndo]);

  const COLOR_BADGE_STYLE: Record<CardColor, { label: string; bg: string; text: string; dot: string }> = {
    PURPLE: { label: '紫', bg: 'bg-purple-950/80 border-purple-500/50', text: 'text-purple-300', dot: 'bg-purple-500' },
    RED: { label: '赤', bg: 'bg-red-950/80 border-red-500/50', text: 'text-red-300', dot: 'bg-red-500' },
    BLUE: { label: '青', bg: 'bg-blue-950/80 border-blue-500/50', text: 'text-blue-300', dot: 'bg-blue-500' },
    YELLOW: { label: '黄', bg: 'bg-yellow-950/80 border-yellow-500/50', text: 'text-yellow-300', dot: 'bg-yellow-400' },
    GREEN: { label: '緑', bg: 'bg-emerald-950/80 border-emerald-500/50', text: 'text-emerald-300', dot: 'bg-emerald-500' },
    COLORLESS: { label: '無', bg: 'bg-slate-900/80 border-slate-600/50', text: 'text-slate-300', dot: 'bg-slate-400' },
  };

  const renderEnergyBadge = (slots: (Card | null)[]) => {
    const { total, byColor } = calculateGeneratedEnergy(slots);
    return (
      <div className="flex items-center gap-1.5 bg-slate-950/90 border border-slate-700/80 px-2 py-0.5 rounded-full text-xs font-bold shadow-sm">
        <span className="flex items-center gap-1 text-amber-400">
          ⚡ 発生: <span className="text-white text-sm font-black">{total}</span>
        </span>
        {Object.entries(byColor).map(([color, count]) => {
          const style = COLOR_BADGE_STYLE[color as CardColor] || COLOR_BADGE_STYLE.COLORLESS;
          return (
            <span
              key={color}
              className={`flex items-center gap-1 text-[10px] px-1.5 py-0.2 rounded border ${style.bg} ${style.text}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
              {style.label}{count}
            </span>
          );
        })}
      </div>
    );
  };

  // アタック対象選択モード開始（相手プレイヤー または 相手キャラ【狙い撃ち】）
  const handleDeclareAttack = (
    attackerPlayerId: string,
    zone: 'frontLine' | 'energyLine',
    slotIndex: FieldSlotIndex
  ) => {
    const attackerPlayer = gameState.players[attackerPlayerId];
    if (!attackerPlayer) return;

    if (gameState.status !== 'PLAYING') {
      setAlertNotice({ title: 'アタック不可', description: 'ゲーム開始前はアタックできません。' });
      return;
    }
    if (gameState.activePlayerId !== attackerPlayerId) {
      setAlertNotice({ title: 'アタック不可', description: '自分のターン中のみアタックできます。' });
      return;
    }
    if (gameState.phase !== 'MAIN' && gameState.phase !== 'ATTACK') {
      if (gameState.phase === 'END') {
        setAlertNotice({ title: 'アタック不可', description: 'エンドフェイズ中はアタックできません。' });
        return;
      }
      setPendingPhaseAttack({ attackerPlayerId, zone, slotIndex, isDirect: false });
      return;
    }
    // 公式ルール P10: 先攻第1ターンはアタックできない
    if (gameState.turn === 1 && attackerPlayer.isFirst) {
      setAlertNotice({
        title: '公式ルール制限',
        description: '【公式ルール】先攻第1ターンはアタックフェイズを行えません（アタック不可）。',
      });
      return;
    }
    setAttackingState({ attackerPlayerId, zone, slotIndex });
  };

  // プレイヤーへのアタック共通実行処理 (アタッカーレスト化 ➔ ログ出力 ➔ ブロック選択状態へ)
  const executeAttackPlayer = (
    attackerPlayerId: string,
    zone: 'frontLine' | 'energyLine',
    slotIndex: FieldSlotIndex,
    targetPlayerId: string
  ) => {
    const attackerPlayer = gameState.players[attackerPlayerId];
    const targetPlayer = gameState.players[targetPlayerId];
    if (!attackerPlayer || !targetPlayer) return;

    const attacker = attackerPlayer[zone][slotIndex];
    if (!attacker || attacker.isRested) return;

    if (gameState.status !== 'PLAYING') {
      setAlertNotice({ title: 'アタック不可', description: 'ゲーム開始前はアタックできません。' });
      return;
    }
    if (gameState.activePlayerId !== attackerPlayerId) {
      setAlertNotice({ title: 'アタック不可', description: '自分のターン中のみアタックできます。' });
      return;
    }
    if (gameState.phase !== 'MAIN' && gameState.phase !== 'ATTACK') {
      if (gameState.phase === 'END') {
        setAlertNotice({ title: 'アタック不可', description: 'エンドフェイズ中はアタックできません。' });
        return;
      }
      setPendingPhaseAttack({ attackerPlayerId, zone, slotIndex, isDirect: true });
      return;
    }
    // 公式ルール P10: 先攻第1ターンはアタックできない
    if (gameState.turn === 1 && attackerPlayer.isFirst) {
      setAlertNotice({
        title: '公式ルール制限',
        description: '【公式ルール】先攻第1ターンはアタックフェイズを行えません（アタック不可）。',
      });
      return;
    }

    dispatchAction({
      type: 'DECLARE_PLAYER_ATTACK',
      payload: {
        actorPlayerId: attackerPlayerId,
        attackerZone: zone,
        attackerSlotIndex: slotIndex,
        defenderPlayerId: targetPlayerId,
      },
    });
    setAttackingState(null);
  };

  // フェイズ移行確認モーダルで「アタックへ進む」が選択された際の実行処理
  const handleConfirmPhaseAttack = () => {
    if (!pendingPhaseAttack) return;
    const { attackerPlayerId, zone, slotIndex, isDirect } = pendingPhaseAttack;
    setPendingPhaseAttack(null);

    if (isDirect) {
      const targetPlayerId = Object.keys(gameState.players).find((id) => id !== attackerPlayerId);
      if (targetPlayerId) {
        dispatchAction({
          type: 'DECLARE_PLAYER_ATTACK',
          payload: {
            actorPlayerId: attackerPlayerId,
            attackerZone: zone,
            attackerSlotIndex: slotIndex,
            defenderPlayerId: targetPlayerId,
          },
        });
        setAttackingState(null);
      }
    } else {
      setAttackingState({ attackerPlayerId, zone, slotIndex });
    }
  };

  // 1クリックで相手プレイヤーへ直接アタック宣言
  const handleDirectAttack = (
    attackerPlayerId: string,
    zone: 'frontLine' | 'energyLine',
    slotIndex: FieldSlotIndex
  ) => {
    const targetPlayerId = Object.keys(gameState.players).find((id) => id !== attackerPlayerId);
    if (!targetPlayerId) return;
    executeAttackPlayer(attackerPlayerId, zone, slotIndex, targetPlayerId);
  };

  // プレイヤーへのアタック解決 (通常攻撃 -> 防御側のブロック選択へ移行)
  const handleAttackPlayer = (targetPlayerId: string) => {
    if (attackingState === null) return;
    const { attackerPlayerId, zone, slotIndex } = attackingState;
    if (attackerPlayerId === targetPlayerId) return; // 自分の本体への攻撃は不可
    executeAttackPlayer(attackerPlayerId, zone, slotIndex, targetPlayerId);
  };

  // キャラへのアタック（【狙い撃ち】バトル）解決
  const handleAttackOpponentCard = (targetPlayerId: string, oppSlotIndex: FieldSlotIndex) => {
    if (attackingState === null) return;
    const { attackerPlayerId, zone, slotIndex } = attackingState;
    if (attackerPlayerId === targetPlayerId) return;

    dispatchAction({
      type: 'ATTACK_CHARACTER',
      payload: {
        actorPlayerId: attackerPlayerId,
        attackerZone: zone,
        attackerSlotIndex: slotIndex,
        targetPlayerId,
        targetSlotIndex: oppSlotIndex,
      },
    });

    setAttackingState(null);
  };

  // ブロック宣言 (防御側フロントラインのキャラでブロック)
  const handleDeclareBlock = (blockerPlayerId: string, blockerSlotIndex: FieldSlotIndex) => {
    if (!pendingCombat || blockerPlayerId !== pendingCombat.defenderPlayerId) return;
    dispatchAction({
      type: 'BLOCK_ATTACK',
      payload: { actorPlayerId: blockerPlayerId, blockerSlotIndex },
    });
  };

  // ノーブロック (アタックを通す -> ライフダメージへ)
  const handlePassBlock = () => {
    if (!pendingCombat) return;
    dispatchAction({
      type: 'PASS_BLOCK',
      payload: { actorPlayerId: pendingCombat.defenderPlayerId },
    });
  };

  // 手札カード選択ハンドラ (所持プレイヤーID付き)
  const handleSelectHandCard = (playerId: string, card: Card) => {
    if (selectedHandCard?.card.id === card.id) {
      setSelectedHandCard(null); // 解除
    } else {
      setSelectedHandCard({ card, playerId });
    }
  };

  // フィールド枠クリック時の配置 / レイド
  const handleSlotClick = (
    targetPlayerId: string,
    zone: 'frontLine' | 'energyLine',
    slotIndex: FieldSlotIndex
  ) => {
    if (!selectedHandCard) return;
    if (selectedHandCard.playerId !== targetPlayerId) return; // 自陣枠のみ配置可能

    const targetPlayer = gameState.players[targetPlayerId];
    if (!targetPlayer) return;

    const existingCard = zone === 'frontLine' ? targetPlayer.frontLine[slotIndex] : targetPlayer.energyLine[slotIndex];
    const handIndex = targetPlayer.hand.findIndex((c) => c.id === selectedHandCard.card.id);
    if (handIndex === -1) return;

    if (existingCard) {
      setPendingRaidOrMarker({
        targetPlayerId,
        incomingCard: selectedHandCard.card,
        existingCard,
        targetZone: zone,
        targetSlotIndex: slotIndex,
        fromLocation: { playerId: targetPlayerId, zone: 'hand', index: handIndex },
      });
      setSelectedHandCard(null);
      return;
    }

    if (selectedHandCard.card.cardType === 'EVENT') {
      // イベントカードは空き枠への使用時、場には出ずに場外へ
      dispatchAction({
        type: 'MOVE_CARD',
        payload: {
          cardId: selectedHandCard.card.id,
          from: { playerId: targetPlayerId, zone: 'hand', index: handIndex },
          to: { playerId: targetPlayerId, zone: 'graveyard' },
        },
      });
      setSelectedHandCard(null);
      return;
    } else {
      // 空き枠への通常配置
      dispatchAction({
        type: 'MOVE_CARD',
        payload: {
          cardId: selectedHandCard.card.id,
          from: { playerId: targetPlayerId, zone: 'hand', index: handIndex },
          to: { playerId: targetPlayerId, zone, slotIndex },
        },
      });
    }

    setSelectedHandCard(null);
  };

  // レスト切り替え
  const handleToggleRest = (playerId: string, zone: 'frontLine' | 'energyLine', slotIndex: FieldSlotIndex) => {
    dispatchAction({
      type: 'TOGGLE_REST',
      payload: { playerId, zone, slotIndex },
    });
  };

  // BP修正
  const handleModifyBp = (playerId: string, zone: 'frontLine' | 'energyLine', slotIndex: FieldSlotIndex, delta: number) => {
    dispatchAction({
      type: 'MODIFY_BP',
      payload: { playerId, zone, slotIndex, delta },
    });
  };

  // フリーズ状態の切り替え
  const handleToggleFreeze = (playerId: string, zone: 'frontLine' | 'energyLine', slotIndex: FieldSlotIndex) => {
    dispatchAction({
      type: 'TOGGLE_FREEZE',
      payload: { playerId, zone, slotIndex },
    });
  };

  // マーカー追加（山札の上または手札から）
  const handleAddMarker = (
    playerId: string,
    zone: 'frontLine' | 'energyLine',
    slotIndex: FieldSlotIndex,
    from: 'deckTop' | 'hand' = 'deckTop'
  ) => {
    const player = gameState.players[playerId];
    if (from === 'deckTop' && (!player || player.deck.length === 0)) {
      setAlertNotice({ title: '山札なし', description: '山札がありません。' });
      return;
    }
    dispatchAction({
      type: 'ADD_MARKER',
      payload: {
        playerId,
        targetZone: zone,
        targetSlotIndex: slotIndex,
        from: 'topDeck',
      },
    });
  };

  // フィールドからの移動
  const handleFieldMoveTo = (
    playerId: string,
    fromZone: 'frontLine' | 'energyLine',
    fromSlot: FieldSlotIndex,
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
  ) => {
    const player = gameState.players[playerId];
    if (!player) return;
    const card = fromZone === 'frontLine' ? player.frontLine[fromSlot] : player.energyLine[fromSlot];
    if (!card) return;

    if (destination === 'life' || destination === 'lifeFaceUp') {
      dispatchAction({
        type: 'MOVE_CARD',
        payload: {
          cardId: card.id,
          from: { playerId, zone: fromZone, slotIndex: fromSlot },
          to: { playerId, zone: 'life', isFaceDown: destination === 'life' },
        },
      });
    } else if (destination === 'frontLine' || destination === 'energyLine') {
      const targetSlots = destination === 'frontLine' ? player.frontLine : player.energyLine;
      const emptySlot = targetSlots.findIndex((c) => c === null);
      if (emptySlot !== -1) {
        dispatchAction({
          type: 'MOVE_CARD',
          payload: {
            cardId: card.id,
            from: { playerId, zone: fromZone, slotIndex: fromSlot },
            to: { playerId, zone: destination, slotIndex: emptySlot as FieldSlotIndex },
          },
        });
      } else {
        setAlertNotice({ title: '枠がいっぱいです', description: '移動先に空き枠がありません。' });
      }
    } else if (destination === 'deckTop') {
      dispatchAction({
        type: 'MOVE_CARD',
        payload: {
          cardId: card.id,
          from: { playerId, zone: fromZone, slotIndex: fromSlot },
          to: { playerId, zone: 'deck', index: 0 },
        },
      });
    } else if (destination === 'deckBottom') {
      dispatchAction({
        type: 'MOVE_CARD',
        payload: {
          cardId: card.id,
          from: { playerId, zone: fromZone, slotIndex: fromSlot },
          to: { playerId, zone: 'deck' },
        },
      });
    } else {
      dispatchAction({
        type: 'MOVE_CARD',
        payload: {
          cardId: card.id,
          from: { playerId, zone: fromZone, slotIndex: fromSlot },
          to: { playerId, zone: destination },
        },
      });
    }
  };

  // DnD: フィールドスロットへのドロップハンドラ
  const handleDropCardOnSlot = (
    targetPlayerId: string,
    from: CardLocation,
    targetZone: 'frontLine' | 'energyLine',
    slotIndex: FieldSlotIndex
  ) => {
    const targetPlayer = gameState.players[targetPlayerId];
    if (!targetPlayer) return;
    const existingCard = targetZone === 'frontLine' ? targetPlayer.frontLine[slotIndex] : targetPlayer.energyLine[slotIndex];

    if (from.zone === 'hand') {
      const handIndex = from.index !== undefined ? from.index : 0;
      const card = targetPlayer.hand[handIndex];
      if (!card) return;

      if (existingCard) {
        setPendingRaidOrMarker({
          targetPlayerId,
          incomingCard: card,
          existingCard,
          targetZone,
          targetSlotIndex: slotIndex,
          fromLocation: from,
        });
        return;
      }

      if (card.cardType === 'EVENT') {
        // イベントカードは空き枠へ使用時、場には出ず直接場外へ
        dispatchAction({
          type: 'MOVE_CARD',
          payload: {
            cardId: card.id,
            from,
            to: { playerId: targetPlayerId, zone: 'graveyard' },
          },
        });
        return;
      }

      if (card.cardType === 'FIELD' && targetZone === 'frontLine') {
        setAlertNotice({
          title: '配置不可',
          description: 'フィールドカードはエナジーラインにのみ配置できます。',
        });
        return;
      } else {
        // 通常登場
        dispatchAction({
          type: 'MOVE_CARD',
          payload: {
            cardId: card.id,
            from,
            to: { playerId: targetPlayerId, zone: targetZone, slotIndex },
          },
        });
      }
    } else if (from.zone === 'frontLine' || from.zone === 'energyLine') {
      const fromSlot = (from.slotIndex ?? 0) as FieldSlotIndex;
      if (from.zone === targetZone && fromSlot === slotIndex) return;

      const card = from.zone === 'frontLine' ? targetPlayer.frontLine[fromSlot] : targetPlayer.energyLine[fromSlot];
      if (!card) return;

      if (card.cardType === 'FIELD' && targetZone === 'frontLine') {
        setAlertNotice({
          title: '移動不可',
          description: 'フィールドカードはフロントラインに移動できません。',
        });
        return;
      }

      dispatchAction({
        type: 'MOVE_CARD',
        payload: {
          cardId: card.id,
          from,
          to: { playerId: targetPlayerId, zone: targetZone, slotIndex },
        },
      });
    }
  };

  // DnD: 場外へのドロップ
  const handleDropToGraveyard = (from: CardLocation) => {
    const ownerPlayer = gameState.players[from.playerId] || bottomPlayer;
    let card: Card | null = null;
    if (from.zone === 'hand') {
      card = ownerPlayer.hand[from.index ?? 0];
    } else if (from.zone === 'frontLine') {
      card = ownerPlayer.frontLine[(from.slotIndex ?? 0) as FieldSlotIndex];
    } else if (from.zone === 'energyLine') {
      card = ownerPlayer.energyLine[(from.slotIndex ?? 0) as FieldSlotIndex];
    }
    if (!card) return;

    dispatchAction({
      type: 'MOVE_CARD',
      payload: {
        cardId: card.id,
        from,
        to: { playerId: from.playerId, zone: 'graveyard' },
      },
    });
  };

  // DnD: 手札へのドロップ（フィールドから手札へ戻す）
  const handleDropToHand = (from: CardLocation) => {
    if (from.zone !== 'frontLine' && from.zone !== 'energyLine') return;
    const ownerPlayer = gameState.players[from.playerId] || bottomPlayer;
    const fromSlot = (from.slotIndex ?? 0) as FieldSlotIndex;
    const card = from.zone === 'frontLine' ? ownerPlayer.frontLine[fromSlot] : ownerPlayer.energyLine[fromSlot];
    if (!card) return;

    dispatchAction({
      type: 'MOVE_CARD',
      payload: {
        cardId: card.id,
        from,
        to: { playerId: from.playerId, zone: 'hand' },
      },
    });
  };

  // 手札からの移動（ディスカード・除外・山札戻し・ライフ配置・フィールド登場）
  const handleHandMoveTo = (
    playerId: string,
    cardIndex: number,
    dest: 'graveyard' | 'removed' | 'deckTop' | 'deckBottom' | 'life' | 'lifeFaceUp' | 'frontLine' | 'energyLine'
  ) => {
    const player = gameState.players[playerId];
    if (!player) return;
    const card = player.hand[cardIndex];
    if (!card) return;

    if (dest === 'frontLine' || dest === 'energyLine') {
      if (card.cardType === 'FIELD' && dest === 'frontLine') {
        setAlertNotice({
          title: '配置不可',
          description: 'フィールドカードはエナジーラインにのみ配置できます。',
        });
        return;
      }
      if (card.cardType === 'EVENT') {
        // イベントカードは使用時、場には出ず直接場外へ
        dispatchAction({
          type: 'MOVE_CARD',
          payload: {
            cardId: card.id,
            from: { playerId, zone: 'hand', index: cardIndex },
            to: { playerId, zone: 'graveyard' },
          },
        });
        return;
      }
      const targetSlots = dest === 'frontLine' ? player.frontLine : player.energyLine;
      const emptySlot = targetSlots.findIndex((c) => c === null);
      if (emptySlot === -1) {
        setAlertNotice({
          title: '枠がいっぱいです',
          description: `${dest === 'frontLine' ? 'フロントライン' : 'エナジーライン'}に空き枠がありません。`,
        });
        return;
      }
      dispatchAction({
        type: 'MOVE_CARD',
        payload: {
          cardId: card.id,
          from: { playerId, zone: 'hand', index: cardIndex },
          to: { playerId, zone: dest, slotIndex: emptySlot as FieldSlotIndex },
        },
      });
      return;
    }

    if (dest === 'life' || dest === 'lifeFaceUp') {
      dispatchAction({
        type: 'MOVE_CARD',
        payload: {
          cardId: card.id,
          from: { playerId, zone: 'hand', index: cardIndex },
          to: { playerId, zone: 'life', isFaceDown: dest === 'life' },
        },
      });
    } else if (dest === 'deckTop') {
      dispatchAction({
        type: 'MOVE_CARD',
        payload: {
          cardId: card.id,
          from: { playerId, zone: 'hand', index: cardIndex },
          to: { playerId, zone: 'deck', index: 0 },
        },
      });
    } else if (dest === 'deckBottom') {
      dispatchAction({
        type: 'MOVE_CARD',
        payload: {
          cardId: card.id,
          from: { playerId, zone: 'hand', index: cardIndex },
          to: { playerId, zone: 'deck' },
        },
      });
    } else {
      dispatchAction({
        type: 'MOVE_CARD',
        payload: {
          cardId: card.id,
          from: { playerId, zone: 'hand', index: cardIndex },
          to: { playerId, zone: dest },
        },
      });
    }
  };

  // DnD: ライフエリアへのドロップ
  const handleDropToLife = (from: CardLocation, isFaceDown: boolean = false) => {
    const ownerPlayer = gameState.players[from.playerId] || bottomPlayer;
    let card: Card | null = null;
    if (from.zone === 'hand') {
      card = ownerPlayer.hand[from.index ?? 0];
    } else if (from.zone === 'frontLine') {
      card = ownerPlayer.frontLine[(from.slotIndex ?? 0) as FieldSlotIndex];
    } else if (from.zone === 'energyLine') {
      card = ownerPlayer.energyLine[(from.slotIndex ?? 0) as FieldSlotIndex];
    }
    if (!card) return;

    dispatchAction({
      type: 'MOVE_CARD',
      payload: {
        cardId: card.id,
        from,
        to: { playerId: from.playerId, zone: 'life', isFaceDown },
      },
    });
  };

  // DnD: リムーブエリアへのドロップ
  const handleDropToRemoved = (from: CardLocation) => {
    const ownerPlayer = gameState.players[from.playerId] || bottomPlayer;
    let card: Card | null = null;
    if (from.zone === 'hand') {
      card = ownerPlayer.hand[from.index ?? 0];
    } else if (from.zone === 'frontLine') {
      card = ownerPlayer.frontLine[(from.slotIndex ?? 0) as FieldSlotIndex];
    } else if (from.zone === 'energyLine') {
      card = ownerPlayer.energyLine[(from.slotIndex ?? 0) as FieldSlotIndex];
    } else if (from.zone === 'graveyard') {
      card = ownerPlayer.graveyard[from.index ?? 0];
    }
    if (!card) return;

    dispatchAction({
      type: 'MOVE_CARD',
      payload: {
        cardId: card.id,
        from,
        to: { playerId: from.playerId, zone: 'removed' },
      },
    });
  };

  // DnD: 山札（デッキ）へのドロップ
  const handleDropToDeck = (from: CardLocation, destination: 'deckTop' | 'deckBottom') => {
    const ownerPlayer = gameState.players[from.playerId] || bottomPlayer;
    let card: Card | null = null;
    if (from.zone === 'hand') {
      card = ownerPlayer.hand[from.index ?? 0];
    } else if (from.zone === 'frontLine') {
      card = ownerPlayer.frontLine[(from.slotIndex ?? 0) as FieldSlotIndex];
    } else if (from.zone === 'energyLine') {
      card = ownerPlayer.energyLine[(from.slotIndex ?? 0) as FieldSlotIndex];
    } else if (from.zone === 'graveyard') {
      card = ownerPlayer.graveyard[from.index ?? 0];
    } else if (from.zone === 'removed') {
      card = ownerPlayer.removed[from.index ?? 0];
    }
    if (!card) return;

    dispatchAction({
      type: 'MOVE_CARD',
      payload: {
        cardId: card.id,
        from,
        to: {
          playerId: from.playerId,
          zone: 'deck',
          index: destination === 'deckTop' ? 0 : ownerPlayer.deck.length,
        },
      },
    });
  };

  // 墓地モーダルからのカード移動
  const handleMoveFromGraveyard = (
    playerId: string,
    cardId: string,
    destination: 'hand' | 'deckTop' | 'deckBottom' | 'frontLine' | 'energyLine' | 'removed' | 'life' | 'lifeFaceUp'
  ) => {
    const player = gameState.players[playerId] || bottomPlayer;
    if (destination === 'frontLine' || destination === 'energyLine') {
      const targetSlots = destination === 'frontLine' ? player.frontLine : player.energyLine;
      const emptySlot = targetSlots.findIndex((c) => c === null);
      if (emptySlot === -1) {
        setAlertNotice({ title: '移動不可', description: 'フィールドに空き枠がありません。' });
        return;
      }
      dispatchAction({
        type: 'MOVE_CARD',
        payload: {
          cardId,
          from: { playerId, zone: 'graveyard' },
          to: { playerId, zone: destination, slotIndex: emptySlot as FieldSlotIndex },
        },
      });
    } else if (destination === 'deckTop') {
      dispatchAction({
        type: 'MOVE_CARD',
        payload: {
          cardId,
          from: { playerId, zone: 'graveyard' },
          to: { playerId, zone: 'deck', index: 0 },
        },
      });
    } else if (destination === 'deckBottom') {
      dispatchAction({
        type: 'MOVE_CARD',
        payload: {
          cardId,
          from: { playerId, zone: 'graveyard' },
          to: { playerId, zone: 'deck' },
        },
      });
    } else if (destination === 'life' || destination === 'lifeFaceUp') {
      dispatchAction({
        type: 'MOVE_CARD',
        payload: {
          cardId,
          from: { playerId, zone: 'graveyard' },
          to: { playerId, zone: 'life', isFaceDown: destination === 'life' },
        },
      });
    } else {
      dispatchAction({
        type: 'MOVE_CARD',
        payload: {
          cardId,
          from: { playerId, zone: 'graveyard' },
          to: { playerId, zone: destination },
        },
      });
    }
  };

  // リムーブエリアからのカード移動
  const handleMoveFromRemoved = (
    playerId: string,
    cardId: string,
    destination: 'hand' | 'graveyard' | 'deckTop' | 'deckBottom' | 'frontLine' | 'energyLine' | 'life' | 'lifeFaceUp'
  ) => {
    const player = gameState.players[playerId] || bottomPlayer;
    if (destination === 'frontLine' || destination === 'energyLine') {
      const targetSlots = destination === 'frontLine' ? player.frontLine : player.energyLine;
      const emptySlot = targetSlots.findIndex((c) => c === null);
      if (emptySlot === -1) {
        setAlertNotice({ title: '移動不可', description: 'フィールドに空き枠がありません。' });
        return;
      }
      dispatchAction({
        type: 'MOVE_CARD',
        payload: {
          cardId,
          from: { playerId, zone: 'removed' },
          to: { playerId, zone: destination, slotIndex: emptySlot as FieldSlotIndex },
        },
      });
    } else if (destination === 'deckTop') {
      dispatchAction({
        type: 'MOVE_CARD',
        payload: {
          cardId,
          from: { playerId, zone: 'removed' },
          to: { playerId, zone: 'deck', index: 0 },
        },
      });
    } else if (destination === 'deckBottom') {
      dispatchAction({
        type: 'MOVE_CARD',
        payload: {
          cardId,
          from: { playerId, zone: 'removed' },
          to: { playerId, zone: 'deck' },
        },
      });
    } else if (destination === 'life' || destination === 'lifeFaceUp') {
      dispatchAction({
        type: 'MOVE_CARD',
        payload: {
          cardId,
          from: { playerId, zone: 'removed' },
          to: { playerId, zone: 'life', isFaceDown: destination === 'life' },
        },
      });
    } else {
      dispatchAction({
        type: 'MOVE_CARD',
        payload: {
          cardId,
          from: { playerId, zone: 'removed' },
          to: { playerId, zone: destination },
        },
      });
    }
  };

  // レイド下敷きカードの分離
  const handleSeparateUnderCard = (
    underCardId: string,
    destination: 'hand' | 'graveyard' | 'frontLine' | 'energyLine' | 'removed' | 'life' | 'lifeFaceUp' | 'deckTop' | 'deckBottom'
  ) => {
    if (!underCardsTarget) return;
    const targetPid = underCardsTarget.playerId || myPlayerId;
    dispatchAction({
      type: 'SEPARATE_UNDER_CARD',
      payload: {
        playerId: targetPid,
        zone: underCardsTarget.zone,
        slotIndex: underCardsTarget.slotIndex,
        underCardId,
        destination,
      },
    });
  };

  // 上のカード（親カード）の分離
  const handleSeparateParentCard = (
    destination: 'hand' | 'graveyard' | 'removed' | 'deckTop' | 'deckBottom' | 'life' | 'lifeFaceUp'
  ) => {
    if (!underCardsTarget) return;
    const targetPid = underCardsTarget.playerId || myPlayerId;
    dispatchAction({
      type: 'SEPARATE_PARENT_CARD',
      payload: {
        playerId: targetPid,
        zone: underCardsTarget.zone,
        slotIndex: underCardsTarget.slotIndex,
        destination,
      },
    });
  };

  // ライフカードの並び替え確定
  const handleConfirmLifeReorder = (newLifeCards: Card[]) => {
    dispatchAction({
      type: 'REORDER_LIFE',
      payload: {
        playerId: lifeReorderPlayerId,
        newLifeCards,
      },
    });
    setIsLifeReorderOpen(false);
  };

  const handleExecuteRaid = (moveToFront: boolean) => {
    if (!pendingRaidOrMarker) return;
    dispatchAction({
      type: 'RAID_CARD',
      payload: {
        playerId: pendingRaidOrMarker.targetPlayerId,
        targetZone: pendingRaidOrMarker.targetZone,
        targetSlotIndex: pendingRaidOrMarker.targetSlotIndex,
        raidCard: pendingRaidOrMarker.incomingCard,
        fromLocation: pendingRaidOrMarker.fromLocation,
        moveToFront,
      },
    });
    setPendingRaidOrMarker(null);
  };

  const handleExecuteMarker = () => {
    if (!pendingRaidOrMarker) return;
    const fromLoc = pendingRaidOrMarker.fromLocation;
    dispatchAction({
      type: 'ADD_MARKER',
      payload: {
        playerId: pendingRaidOrMarker.targetPlayerId,
        targetZone: pendingRaidOrMarker.targetZone,
        targetSlotIndex: pendingRaidOrMarker.targetSlotIndex,
        from:
          fromLoc.zone === 'hand'
            ? { zone: 'hand', index: fromLoc.index ?? 0 }
            : 'topDeck',
        isFaceDown: true,
      },
    });
    setPendingRaidOrMarker(null);
  };

  const targetUnderCardsPlayer = underCardsTarget?.playerId
    ? (gameState.players[underCardsTarget.playerId] || bottomPlayer)
    : bottomPlayer;
  const activeUnderCardsParent =
    underCardsTarget && targetUnderCardsPlayer
      ? targetUnderCardsPlayer[underCardsTarget.zone][underCardsTarget.slotIndex]
      : null;
  const underCardsFrontEmpty = (targetUnderCardsPlayer?.frontLine || []).some((c) => c === null);
  const underCardsEnergyEmpty = (targetUnderCardsPlayer?.energyLine || []).some((c) => c === null);
  const pendingTargetPlayer = pendingRaidOrMarker
    ? (gameState.players[pendingRaidOrMarker.targetPlayerId] || bottomPlayer)
    : bottomPlayer;
  const hasEmptyFrontSlot = pendingTargetPlayer.frontLine.some((c) => c === null);
  const hasEmptyEnergySlot = pendingTargetPlayer.energyLine.some((c) => c === null);

  const isTopActive = gameState.activePlayerId === topPlayerId;
  const isBottomActive = gameState.activePlayerId === bottomPlayerId;
  const canActAs = (playerId: string) => isSoloMode || myPlayerId === playerId;
  const canSelectLifeForDamage = (targetPlayerId: string) =>
    pendingCombat?.stage === 'LIFE_SELECTION' &&
    pendingCombat.defenderPlayerId === targetPlayerId &&
    canActAs(pendingCombat.attackerPlayerId);
  const selectLifeForDamage = (lifeIndex: number) => {
    if (!pendingCombat || pendingCombat.stage !== 'LIFE_SELECTION') return;
    dispatchAction({
      type: 'SELECT_LIFE_FOR_DAMAGE',
      payload: { actorPlayerId: pendingCombat.attackerPlayerId, lifeIndex },
    });
  };

  return (
    <div className={`w-full h-full max-w-7xl mx-auto flex flex-col justify-between overflow-y-auto overflow-x-hidden ${
      isFitMode ? 'p-1 gap-1 select-none' : 'p-2 gap-2'
    }`}>
      {/* 相手 / 対面プレイヤーエリア (ソロプレイ時はP2で固定) */}
      <div
        onClick={
          attackingState !== null && attackingState.attackerPlayerId !== topPlayerId
            ? () => handleAttackPlayer(topPlayerId)
            : undefined
        }
        className={`flex flex-col sm:flex-row ${isFitMode ? 'gap-1.5 p-1 shrink-0' : 'gap-3 p-2.5 sm:items-center'} rounded-2xl border transition-all ${
          attackingState !== null && attackingState.attackerPlayerId !== topPlayerId
            ? 'border-rose-500/80 bg-rose-950/20 cursor-crosshair ring-2 ring-rose-500/50 animate-pulse'
            : isTopActive
            ? 'border-amber-500/70 bg-slate-900/70 ring-2 ring-amber-500/30 shadow-xl'
            : 'bg-slate-900/40 border-slate-800/80'
        }`}
      >
        <SideZonesArea
          position="top"
          player={topPlayer}
          isOpponent={!isSoloMode}
          isSoloMode={isSoloMode}
          isCompact={isFitMode}
          onDraw={isSoloMode ? () => dispatchAction({ type: 'DRAW_CARD', payload: { playerId: topPlayerId } }) : undefined}
          onShuffle={() => dispatchAction({ type: 'SHUFFLE_DECK', payload: { playerId: topPlayerId } })}
          onCheckLife={
            canSelectLifeForDamage(topPlayerId)
              ? selectLifeForDamage
              : (index) => dispatchAction({ type: 'CHECK_LIFE_TRIGGER', payload: { playerId: topPlayerId, lifeIndex: index } })
          }
          onTakeLife={(dest, index) => {
            if (isSoloMode) {
              dispatchAction({ type: 'TAKE_LIFE', payload: { playerId: topPlayerId, destination: dest, lifeIndex: index } });
            } else {
              setPendingTakeLife({ playerId: topPlayerId, destination: dest, lifeIndex: index });
            }
          }}
          onFlipLife={isSoloMode ? (index) => dispatchAction({ type: 'FLIP_LIFE', payload: { playerId: topPlayerId, lifeIndex: index } }) : undefined}
          onRecoverLife={(isFaceDown = true) => dispatchAction({ type: 'RECOVER_LIFE', payload: { playerId: topPlayerId, isFaceDown } })}
          onOpenLifeReorder={() => {
            setLifeReorderPlayerId(topPlayerId);
            setIsLifeReorderOpen(true);
          }}
          onOpenLifeSelectModal={() => setLifeSelectPlayerId(topPlayerId)}
          onUseAp={() => dispatchAction({ type: 'USE_AP', payload: { playerId: topPlayerId } })}
          onRecoverAp={() => dispatchAction({ type: 'RECOVER_AP', payload: { playerId: topPlayerId, amount: 1 } })}
          onLookAtTopDeck={(count) => dispatchAction({ type: 'LOOK_AT_TOP_DECK', payload: { playerId: topPlayerId, count } })}
          onOpenSearchDeck={() => {
            setSearchPlayerId(topPlayerId);
            setIsCardSearchOpen(true);
          }}
          onRevealTopDeck={isSoloMode ? (reveal) => dispatchAction({ type: 'REVEAL_TOP_DECK_CARD', payload: { playerId: topPlayerId, reveal } }) : undefined}
          onBottomDeckAction={(action) => dispatchAction({ type: 'BOTTOM_DECK_ACTION', payload: { playerId: topPlayerId, action } })}
          onMillTopDeck={isSoloMode ? () => {
            const topCard = topPlayer.deck[0];
            if (!topCard) return;
            dispatchAction({
              type: 'MOVE_CARD',
              payload: {
                cardId: topCard.id,
                from: { playerId: topPlayerId, zone: 'deck', index: 0 },
                to: { playerId: topPlayerId, zone: 'graveyard' },
              },
            });
          } : undefined}
          onInspectCard={setInspectCard}
          onDropToGraveyard={handleDropToGraveyard}
          onDropToRemoved={handleDropToRemoved}
          onMoveFromGraveyard={(cardId, dest) => handleMoveFromGraveyard(topPlayerId, cardId, dest)}
          onMoveFromRemoved={(cardId, dest) => handleMoveFromRemoved(topPlayerId, cardId, dest)}
          onOpenDeckPicker={() => onOpenDeckPicker?.(topPlayerId)}
          onDropToLife={handleDropToLife}
          onDropToDeck={handleDropToDeck}
        />
        <div className={`flex-1 min-w-0 flex flex-col ${isFitMode ? 'gap-1' : 'gap-2'}`}>
          <HandArea
            cards={topPlayer.hand}
            playerId={topPlayerId}
            isOpponent={!isSoloMode}
            isOpenHand={isSoloMode ? true : undefined}
            canToggleHide={isSoloMode}
            isCompact={isFitMode}
            title={isSoloMode ? `${topPlayer.name} の手札` : undefined}
            selectedCardId={selectedHandCard?.playerId === topPlayerId ? selectedHandCard.card.id : null}
            onSelectCard={(card) => handleSelectHandCard(topPlayerId, card)}
            onMoveTo={(cardIndex, dest) => handleHandMoveTo(topPlayerId, cardIndex, dest)}
            onInspect={setInspectCard}
            onDropToHand={handleDropToHand}
            onDiscardAll={() => dispatchAction({ type: 'DISCARD_ALL_HAND', payload: { playerId: topPlayerId } })}
            onDiscardRandom={() => dispatchAction({ type: 'DISCARD_HAND_CARD', payload: { playerId: topPlayerId } })}
            onDiscardHandIndex={(index) => dispatchAction({ type: 'DISCARD_HAND_CARD', payload: { playerId: topPlayerId, index } })}
          />
          <FieldZone
            title={`${topPlayer.name}: エナジーライン`}
            zone="energyLine"
            slots={topPlayer.energyLine}
            playerId={topPlayerId}
            isOpponent={!isSoloMode}
            isControllable={isSoloMode}
            isCompact={isFitMode}
            selectedCardId={selectedHandCard?.playerId === topPlayerId ? selectedHandCard.card.id : null}
            extraHeaderBadge={renderEnergyBadge(topPlayer.energyLine)}
            onSlotClick={(slotIdx) => handleSlotClick(topPlayerId, 'energyLine', slotIdx)}
            onToggleRest={(slotIdx) => handleToggleRest(topPlayerId, 'energyLine', slotIdx)}
            onModifyBp={(slotIdx, delta) => handleModifyBp(topPlayerId, 'energyLine', slotIdx, delta)}
            onToggleFreeze={(slotIdx) => handleToggleFreeze(topPlayerId, 'energyLine', slotIdx)}
            onAddMarker={(slotIdx, from) => handleAddMarker(topPlayerId, 'energyLine', slotIdx, from)}
            onMoveTo={(slotIdx, dest) => handleFieldMoveTo(topPlayerId, 'energyLine', slotIdx, dest)}
            onInspect={setInspectCard}
            onDropCard={(from, z, slotIdx) => handleDropCardOnSlot(topPlayerId, from, z, slotIdx)}
            onDeclareAttack={(slotIdx) => handleDeclareAttack(topPlayerId, 'energyLine', slotIdx)}
            onOpenUnderCards={(slotIdx) => setUnderCardsTarget({ playerId: topPlayerId, zone: 'energyLine', slotIndex: slotIdx })}
          />
          <FieldZone
            title={`${topPlayer.name}: フロントライン`}
            zone="frontLine"
            slots={topPlayer.frontLine}
            playerId={topPlayerId}
            isOpponent={!isSoloMode}
            isControllable={isSoloMode}
            isCompact={isFitMode}
            selectedCardId={selectedHandCard?.playerId === topPlayerId ? selectedHandCard.card.id : null}
            onSlotClick={(slotIdx) => {
              if (attackingState !== null && attackingState.attackerPlayerId !== topPlayerId) {
                if (topPlayer.frontLine[slotIdx]) {
                  handleAttackOpponentCard(topPlayerId, slotIdx);
                } else {
                  handleAttackPlayer(topPlayerId);
                }
              } else if (pendingCombat?.stage === 'BLOCK_DECISION' && pendingCombat.defenderPlayerId === topPlayerId && canActAs(topPlayerId)) {
                // ブロック選択中: フロントラインのアクティブキャラをクリックでブロック
                const targetCard = topPlayer.frontLine[slotIdx];
                if (targetCard && !targetCard.isRested) {
                  handleDeclareBlock(topPlayerId, slotIdx);
                }
              } else {
                handleSlotClick(topPlayerId, 'frontLine', slotIdx);
              }
            }}
            onToggleRest={(slotIdx) => handleToggleRest(topPlayerId, 'frontLine', slotIdx)}
            onModifyBp={(slotIdx, delta) => handleModifyBp(topPlayerId, 'frontLine', slotIdx, delta)}
            onToggleFreeze={(slotIdx) => handleToggleFreeze(topPlayerId, 'frontLine', slotIdx)}
            onAddMarker={(slotIdx, from) => handleAddMarker(topPlayerId, 'frontLine', slotIdx, from)}
            onMoveTo={(slotIdx, dest) => handleFieldMoveTo(topPlayerId, 'frontLine', slotIdx, dest)}
            onInspect={setInspectCard}
            onDropCard={(from, z, slotIdx) => handleDropCardOnSlot(topPlayerId, from, z, slotIdx)}
            onDeclareAttack={(slotIdx) => handleDeclareAttack(topPlayerId, 'frontLine', slotIdx)}
            onDirectAttack={(slotIdx) => handleDirectAttack(topPlayerId, 'frontLine', slotIdx)}
            onOpenUnderCards={(slotIdx) => setUnderCardsTarget({ playerId: topPlayerId, zone: 'frontLine', slotIndex: slotIdx })}
          />
        </div>
      </div>

      {/* 中央: フェイズ進行バー */}
      <PhaseBar
        currentPhase={gameState.phase}
        turn={gameState.turn}
        isCompact={isFitMode}
        isActivePlayer={isSoloMode ? true : gameState.activePlayerId === myPlayerId}
        activePlayerName={gameState.players[gameState.activePlayerId]?.name || (gameState.activePlayerId === 'player-1' ? 'Player 1' : 'Player 2')}
        isSoloMode={isSoloMode}
        activePlayerId={gameState.activePlayerId}
        canExtraDraw={
          (gameState.players[gameState.activePlayerId]?.apCurrent ?? 0) >= 1 &&
          !gameState.players[gameState.activePlayerId]?.hasExtraDrawn &&
          (gameState.players[gameState.activePlayerId]?.deck.length ?? 0) > 0
        }
        isFirstTurnFirstPlayer={gameState.turn === 1 && !!gameState.players[gameState.activePlayerId]?.isFirst}
        onSetPhase={(phase) => dispatchAction({ type: 'SET_PHASE', payload: { phase } })}
        onPassTurn={() => dispatchAction({ type: 'PASS_TURN', payload: { playerId: gameState.activePlayerId } })}
        onAdvancePhase={handleAdvancePhase}
        onExtraDraw={() => dispatchAction({ type: 'EXTRA_DRAW', payload: { playerId: gameState.activePlayerId } })}
      />

      {/* 自分 / 手前プレイヤーエリア (ソロプレイ時はP1で固定) */}
      <div
        onClick={
          attackingState !== null && attackingState.attackerPlayerId !== bottomPlayerId
            ? () => handleAttackPlayer(bottomPlayerId)
            : undefined
        }
        className={`flex flex-col sm:flex-row ${isFitMode ? 'gap-1.5 p-1 shrink-0' : 'gap-3 p-2.5 sm:items-center'} rounded-2xl border transition-all ${
          attackingState !== null && attackingState.attackerPlayerId !== bottomPlayerId
            ? 'border-rose-500/80 bg-rose-950/20 cursor-crosshair ring-2 ring-rose-500/50 animate-pulse'
            : isBottomActive
            ? 'border-amber-500/70 bg-slate-900/80 ring-2 ring-amber-500/30 shadow-xl'
            : 'bg-slate-900/60 border-indigo-500/20 shadow-xl'
        }`}
      >
        <div className={`flex-1 min-w-0 flex flex-col ${isFitMode ? 'gap-1' : 'gap-2'}`}>
          <FieldZone
            title={`${bottomPlayer.name}: フロントライン`}
            zone="frontLine"
            slots={bottomPlayer.frontLine}
            playerId={bottomPlayerId}
            isOpponent={false}
            isControllable={true}
            isCompact={isFitMode}
            selectedCardId={selectedHandCard?.playerId === bottomPlayerId ? selectedHandCard.card.id : null}
            onSlotClick={(slotIdx) => {
              if (attackingState !== null && attackingState.attackerPlayerId !== bottomPlayerId) {
                if (bottomPlayer.frontLine[slotIdx]) {
                  handleAttackOpponentCard(bottomPlayerId, slotIdx);
                } else {
                  handleAttackPlayer(bottomPlayerId);
                }
              } else if (pendingCombat?.stage === 'BLOCK_DECISION' && pendingCombat.defenderPlayerId === bottomPlayerId && canActAs(bottomPlayerId)) {
                // ブロック選択中: フロントラインのアクティブキャラをクリックでブロック
                const targetCard = bottomPlayer.frontLine[slotIdx];
                if (targetCard && !targetCard.isRested) {
                  handleDeclareBlock(bottomPlayerId, slotIdx);
                }
              } else {
                handleSlotClick(bottomPlayerId, 'frontLine', slotIdx);
              }
            }}
            onToggleRest={(slotIdx) => handleToggleRest(bottomPlayerId, 'frontLine', slotIdx)}
            onModifyBp={(slotIdx, delta) => handleModifyBp(bottomPlayerId, 'frontLine', slotIdx, delta)}
            onToggleFreeze={(slotIdx) => handleToggleFreeze(bottomPlayerId, 'frontLine', slotIdx)}
            onAddMarker={(slotIdx, from) => handleAddMarker(bottomPlayerId, 'frontLine', slotIdx, from)}
            onMoveTo={(slotIdx, dest) => handleFieldMoveTo(bottomPlayerId, 'frontLine', slotIdx, dest)}
            onInspect={setInspectCard}
            onDropCard={(from, z, slotIdx) => handleDropCardOnSlot(bottomPlayerId, from, z, slotIdx)}
            onDeclareAttack={(slotIdx) => handleDeclareAttack(bottomPlayerId, 'frontLine', slotIdx)}
            onDirectAttack={(slotIdx) => handleDirectAttack(bottomPlayerId, 'frontLine', slotIdx)}
            onOpenUnderCards={(slotIdx) => setUnderCardsTarget({ playerId: bottomPlayerId, zone: 'frontLine', slotIndex: slotIdx })}
          />
          <FieldZone
            title={`${bottomPlayer.name}: エナジーライン`}
            zone="energyLine"
            slots={bottomPlayer.energyLine}
            playerId={bottomPlayerId}
            isOpponent={false}
            isControllable={true}
            isCompact={isFitMode}
            selectedCardId={selectedHandCard?.playerId === bottomPlayerId ? selectedHandCard.card.id : null}
            extraHeaderBadge={renderEnergyBadge(bottomPlayer.energyLine)}
            onSlotClick={(slotIdx) => handleSlotClick(bottomPlayerId, 'energyLine', slotIdx)}
            onToggleRest={(slotIdx) => handleToggleRest(bottomPlayerId, 'energyLine', slotIdx)}
            onModifyBp={(slotIdx, delta) => handleModifyBp(bottomPlayerId, 'energyLine', slotIdx, delta)}
            onToggleFreeze={(slotIdx) => handleToggleFreeze(bottomPlayerId, 'energyLine', slotIdx)}
            onAddMarker={(slotIdx, from) => handleAddMarker(bottomPlayerId, 'energyLine', slotIdx, from)}
            onMoveTo={(slotIdx, dest) => handleFieldMoveTo(bottomPlayerId, 'energyLine', slotIdx, dest)}
            onInspect={setInspectCard}
            onDropCard={(from, z, slotIdx) => handleDropCardOnSlot(bottomPlayerId, from, z, slotIdx)}
            onDeclareAttack={(slotIdx) => handleDeclareAttack(bottomPlayerId, 'energyLine', slotIdx)}
            onOpenUnderCards={(slotIdx) => setUnderCardsTarget({ playerId: bottomPlayerId, zone: 'energyLine', slotIndex: slotIdx })}
          />
          <HandArea
            cards={bottomPlayer.hand}
            playerId={bottomPlayerId}
            isOpponent={false}
            isOpenHand={true}
            isCompact={isFitMode}
            title={isSoloMode ? `${bottomPlayer.name} の手札` : undefined}
            selectedCardId={selectedHandCard?.playerId === bottomPlayerId ? selectedHandCard.card.id : null}
            onSelectCard={(card) => handleSelectHandCard(bottomPlayerId, card)}
            onMoveTo={(cardIndex, dest) => handleHandMoveTo(bottomPlayerId, cardIndex, dest)}
            onInspect={setInspectCard}
            onDropToHand={handleDropToHand}
            onDiscardAll={() => dispatchAction({ type: 'DISCARD_ALL_HAND', payload: { playerId: bottomPlayerId } })}
          />
        </div>

        <SideZonesArea
          position="bottom"
          player={bottomPlayer}
          isOpponent={false}
          isSoloMode={isSoloMode}
          isCompact={isFitMode}
          onDraw={() => dispatchAction({ type: 'DRAW_CARD', payload: { playerId: bottomPlayerId } })}
          onShuffle={() => dispatchAction({ type: 'SHUFFLE_DECK', payload: { playerId: bottomPlayerId } })}
          onCheckLife={
            canSelectLifeForDamage(bottomPlayerId)
              ? selectLifeForDamage
              : pendingCombat?.stage === 'LIFE_SELECTION' && pendingCombat.defenderPlayerId === bottomPlayerId
                ? undefined
                : (index) => dispatchAction({ type: 'CHECK_LIFE_TRIGGER', payload: { playerId: bottomPlayerId, lifeIndex: index } })
          }
          onRecoverLife={(isFaceDown = true) => dispatchAction({ type: 'RECOVER_LIFE', payload: { playerId: bottomPlayerId, isFaceDown } })}
          onTakeLife={(dest, index) => dispatchAction({ type: 'TAKE_LIFE', payload: { playerId: bottomPlayerId, destination: dest, lifeIndex: index } })}
          onFlipLife={(index) => dispatchAction({ type: 'FLIP_LIFE', payload: { playerId: bottomPlayerId, lifeIndex: index } })}
          onOpenLifeReorder={() => {
            setLifeReorderPlayerId(bottomPlayerId);
            setIsLifeReorderOpen(true);
          }}
          onOpenLifeSelectModal={
            pendingCombat?.stage === 'LIFE_SELECTION' && pendingCombat.defenderPlayerId === bottomPlayerId && !canSelectLifeForDamage(bottomPlayerId)
              ? undefined
              : () => setLifeSelectPlayerId(bottomPlayerId)
          }
          onUseAp={() => dispatchAction({ type: 'USE_AP', payload: { playerId: bottomPlayerId } })}
          onRecoverAp={() => dispatchAction({ type: 'RECOVER_AP', payload: { playerId: bottomPlayerId, amount: 1 } })}
          onLookAtTopDeck={(count) => dispatchAction({ type: 'LOOK_AT_TOP_DECK', payload: { playerId: bottomPlayerId, count } })}
          onOpenSearchDeck={() => {
            setSearchPlayerId(bottomPlayerId);
            setIsCardSearchOpen(true);
          }}
          onRevealTopDeck={(reveal) => dispatchAction({ type: 'REVEAL_TOP_DECK_CARD', payload: { playerId: bottomPlayerId, reveal } })}
          onBottomDeckAction={(action) => dispatchAction({ type: 'BOTTOM_DECK_ACTION', payload: { playerId: bottomPlayerId, action } })}
          onInspectCard={setInspectCard}
          onDropToGraveyard={handleDropToGraveyard}
          onDropToRemoved={handleDropToRemoved}
          onMoveFromGraveyard={(cardId, dest) => handleMoveFromGraveyard(bottomPlayerId, cardId, dest)}
          onMoveFromRemoved={(cardId, dest) => handleMoveFromRemoved(bottomPlayerId, cardId, dest)}
          onOpenDeckPicker={() => onOpenDeckPicker?.(bottomPlayerId)}
          onDropToLife={handleDropToLife}
          onDropToDeck={handleDropToDeck}
        />
      </div>

      {/* 山札の上からN枚確認モーダル */}
      <TopDeckModal
        revealedDeck={gameState.revealedDeckCards}
        myPlayerId={
          isSoloMode
            ? gameState.revealedDeckCards?.playerId || bottomPlayerId
            : myPlayerId
        }
        hasEmptyFrontSlot={hasEmptyFrontSlot}
        hasEmptyEnergySlot={hasEmptyEnergySlot}
        onResolveCard={(cardId, destination) =>
          dispatchAction({
            type: 'RESOLVE_TOP_DECK_CARD',
            payload: { playerId: gameState.revealedDeckCards?.playerId || bottomPlayerId, cardId, destination },
          })
        }
        onInspectCard={setInspectCard}
        onClose={(shuffleRemaining) =>
          dispatchAction({
            type: 'CLOSE_TOP_DECK',
            payload: { playerId: gameState.revealedDeckCards?.playerId || bottomPlayerId, shuffleRemaining },
          })
        }
      />

      {/* 山札サーチモーダル */}
      <CardSearchModal
        isOpen={isCardSearchOpen}
        cards={gameState.players[searchPlayerId]?.deck || []}
        hasEmptyFrontSlot={gameState.players[searchPlayerId]?.frontLine.some((c) => c === null)}
        hasEmptyEnergySlot={gameState.players[searchPlayerId]?.energyLine.some((c) => c === null)}
        onSelectCard={(cardId, destination) =>
          dispatchAction({
            type: 'SEARCH_DECK_CARD',
            payload: { playerId: searchPlayerId, cardId, destination },
          })
        }
        onInspectCard={setInspectCard}
        onClose={(shuffleDeck) => {
          if (shuffleDeck) {
            dispatchAction({ type: 'SHUFFLE_DECK', payload: { playerId: searchPlayerId } });
          }
          setIsCardSearchOpen(false);
        }}
      />

      {/* レイド下敷きカード確認・分離モーダル */}
      <UnderCardsModal
        isOpen={!!activeUnderCardsParent && (activeUnderCardsParent.underCards?.length ?? 0) > 0}
        parentCard={activeUnderCardsParent}
        isOpponent={!!underCardsTarget?.playerId && underCardsTarget.playerId !== bottomPlayerId && !isSoloMode}
        hasEmptyFrontSlot={underCardsFrontEmpty}
        hasEmptyEnergySlot={underCardsEnergyEmpty}
        onSeparateCard={handleSeparateUnderCard}
        onSeparateParentCard={handleSeparateParentCard}
        onInspectCard={setInspectCard}
        onClose={() => setUnderCardsTarget(null)}
      />

      {/* バトル攻撃線アニメーションオーバーレイ */}
      <AttackLineOverlay
        sourceElement={
          attackingState !== null
            ? document.getElementById(`slot-${attackingState.attackerPlayerId}-${attackingState.zone}-${attackingState.slotIndex}`)
            : null
        }
        targetElement={null}
        isActive={attackingState !== null}
        attackerName={
          attackingState !== null && gameState.players[attackingState.attackerPlayerId]?.[attackingState.zone][attackingState.slotIndex]
            ? gameState.players[attackingState.attackerPlayerId][attackingState.zone][attackingState.slotIndex]!.name
            : 'アタッカー'
        }
        onCancel={() => setAttackingState(null)}
      />

      {/* ブロック選択プロンプトバー */}
      {pendingCombat?.stage === 'BLOCK_DECISION' && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-40 bg-gradient-to-r from-blue-950/95 via-indigo-950/95 to-blue-950/95 border-2 border-blue-500 rounded-2xl px-5 py-3 shadow-2xl flex items-center gap-4 text-white text-xs animate-in slide-in-from-top-4 max-w-[95vw]">
          <div className="bg-blue-600 p-2 rounded-full animate-pulse shrink-0">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-extrabold text-blue-300">【ブロック選択】</span>
              <span className="font-bold text-white">「{pendingCombat.attackerCardName}」(BP{pendingCombat.attackerBp})</span>
              <span className="text-slate-300">のアタック！</span>
            </div>
            <span className="text-slate-300 text-[11px]">
              {canActAs(pendingCombat.defenderPlayerId)
                ? `${gameState.players[pendingCombat.defenderPlayerId]?.name} のフロントラインのアクティブキャラをクリックしてブロック、または通す`
                : `${gameState.players[pendingCombat.defenderPlayerId]?.name} のブロック選択を待っています`}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {canActAs(pendingCombat.defenderPlayerId) && (
              <button
                onClick={handlePassBlock}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold rounded-xl text-xs flex items-center gap-1 shadow-md border border-emerald-400"
              >
                <ShieldAlert className="w-4 h-4" />
                通す (ノーブロック)
              </button>
            )}
            {canActAs(pendingCombat.attackerPlayerId) && (
              <button
                onClick={handleCancelPendingBlock}
                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 hover:text-white rounded-xl text-xs flex items-center gap-1 border border-slate-700"
                title="アタックを取り消し (アタッカーをアクティブに戻す)"
              >
                <X className="w-3.5 h-3.5" />
                取消
              </button>
            )}
          </div>
        </div>
      )}

      {/* ライフダメージ / トリガー案内バー */}
      {pendingCombat?.stage === 'LIFE_SELECTION' && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-40 bg-gradient-to-r from-amber-950/95 via-red-950/95 to-amber-950/95 border-2 border-amber-500 rounded-2xl px-5 py-3 shadow-2xl flex items-center gap-4 text-white text-xs animate-in slide-in-from-top-4 max-w-[95vw]">
          <div className="bg-amber-600 p-2 rounded-full animate-bounce shrink-0">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-extrabold text-amber-300">【ライフダメージ】</span>
              <span className="font-bold text-white">「{pendingCombat.attackerCardName}」</span>
              <span className="text-slate-300">のアタックが通りました！</span>
            </div>
            <span className="text-slate-300 text-[11px]">
              {canActAs(pendingCombat.attackerPlayerId)
                ? `${gameState.players[pendingCombat.defenderPlayerId]?.name} の裏向きライフから1枚選択してください。選択すると即座にトリガーチェックへ進みます。`
                : `${gameState.players[pendingCombat.attackerPlayerId]?.name} がライフを選択するのを待っています。`}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {canActAs(pendingCombat.attackerPlayerId) && (
              <button
                onClick={() => setLifeSelectPlayerId(pendingCombat.defenderPlayerId)}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold rounded-xl text-xs flex items-center gap-1 shadow-md border border-indigo-400"
              >
                ライフを選択
              </button>
            )}
          </div>
        </div>
      )}

      {/* ライフ確認・並び替えモーダル */}
      <LifeReorderModal
        isOpen={isLifeReorderOpen}
        lifeCards={gameState.players[lifeReorderPlayerId]?.life || []}
        playerName={gameState.players[lifeReorderPlayerId]?.name || ''}
        onConfirmReorder={handleConfirmLifeReorder}
        onClose={() => setIsLifeReorderOpen(false)}
      />

      {/* ライフ任意選択・操作モーダル */}
      <LifeSelectModal
        isOpen={lifeSelectPlayerId !== null}
        lifeCards={gameState.players[lifeSelectPlayerId || '']?.life || []}
        playerName={gameState.players[lifeSelectPlayerId || '']?.name || ''}
        isOpponent={lifeSelectPlayerId !== bottomPlayerId && !isSoloMode}
        onCheckLife={(lifeIndex) => {
          if (lifeSelectPlayerId) {
            if (canSelectLifeForDamage(lifeSelectPlayerId)) {
              selectLifeForDamage(lifeIndex);
            } else {
              dispatchAction({
                type: 'CHECK_LIFE_TRIGGER',
                payload: { playerId: lifeSelectPlayerId, lifeIndex },
              });
            }
          }
        }}
        onTakeLife={(dest, lifeIndex) => {
          if (lifeSelectPlayerId) {
            if (lifeSelectPlayerId === bottomPlayerId || isSoloMode) {
              dispatchAction({
                type: 'TAKE_LIFE',
                payload: { playerId: lifeSelectPlayerId, destination: dest, lifeIndex },
              });
            } else {
              setPendingTakeLife({ playerId: lifeSelectPlayerId, destination: dest, lifeIndex });
            }
          }
        }}
        onFlipLife={lifeSelectPlayerId === bottomPlayerId || isSoloMode ? (lifeIndex) => {
          if (lifeSelectPlayerId) {
            dispatchAction({
              type: 'FLIP_LIFE',
              payload: { playerId: lifeSelectPlayerId, lifeIndex },
            });
          }
        } : undefined}
        onInspectCard={setInspectCard}
        onClose={() => setLifeSelectPlayerId(null)}
      />

      {/* レイド登場・マーカー配置モーダル */}
      <RaidOrMarkerModal
        isOpen={pendingRaidOrMarker !== null}
        incomingCard={pendingRaidOrMarker?.incomingCard || null}
        existingCard={pendingRaidOrMarker?.existingCard || null}
        targetZone={pendingRaidOrMarker?.targetZone || 'frontLine'}
        targetSlotIndex={pendingRaidOrMarker?.targetSlotIndex ?? 0}
        hasEmptyFrontSlot={hasEmptyFrontSlot}
        onSelectRaid={handleExecuteRaid}
        onSelectMarker={handleExecuteMarker}
        onClose={() => setPendingRaidOrMarker(null)}
      />

      {/* 公開カード / 詳細モーダル (全モーダルの最前面に表示) */}
      <RevealedCardModal
        revealed={gameState.revealedCard}
        inspectCard={inspectCard}
        canControl={isSoloMode || !gameState.revealedCard?.fromPlayerId || gameState.revealedCard.fromPlayerId === myPlayerId}
        onDismissRevealed={(destination) =>
          dispatchAction({
            type: 'DISMISS_REVEALED_CARD',
            payload: { destination, actorPlayerId: myPlayerId },
          })
        }
        onCloseInspect={() => setInspectCard(null)}
      />

      {/* アタックフェイズ自動移行確認モーダル */}
      <ConfirmModal
        isOpen={pendingPhaseAttack !== null}
        title="アタックフェイズへ移行"
        description={`現在は【${
          gameState.phase === 'START' ? 'スタート' : gameState.phase === 'MOVE' ? '移動' : gameState.phase
        }フェイズ】です。\nアタックフェイズへ進んでアタックを実行しますか？`}
        confirmText="アタックへ進む"
        cancelText="キャンセル"
        variant="primary"
        onConfirm={handleConfirmPhaseAttack}
        onCancel={() => setPendingPhaseAttack(null)}
      />

      {/* アプリ内通知・ルール警告モーダル (alert()代替) */}
      <ConfirmModal
        isOpen={alertNotice !== null}
        title={alertNotice?.title || ''}
        description={alertNotice?.description || ''}
        confirmText="OK"
        cancelText={null}
        variant="warning"
        onConfirm={() => setAlertNotice(null)}
        onCancel={() => setAlertNotice(null)}
      />

      {/* 相手ライフ直接場外送り確認モーダル */}
      <ConfirmModal
        isOpen={pendingTakeLife !== null}
        title="相手ライフの直接場外送り"
        description={`相手（${gameState.players[pendingTakeLife?.playerId || '']?.name || '相手'}）のライフをトリガーチェックを行わずに場外へ送りますか？（効果ダメージやインパクト等）`}
        confirmText="場外へ送る"
        cancelText="キャンセル"
        variant="danger"
        onConfirm={() => {
          if (pendingTakeLife) {
            dispatchAction({
              type: 'TAKE_LIFE',
              payload: {
                playerId: pendingTakeLife.playerId,
                destination: pendingTakeLife.destination,
                lifeIndex: pendingTakeLife.lifeIndex,
              },
            });
          }
          setPendingTakeLife(null);
        }}
        onCancel={() => setPendingTakeLife(null)}
      />

      {/* 手札カード選択中インジケーター */}
      {selectedHandCard && (
        <div className="fixed bottom-2 sm:bottom-4 left-2 sm:left-1/2 sm:-translate-x-1/2 z-30 w-[calc(100vw-3.5rem)] sm:w-auto sm:max-w-[calc(100vw-1rem)] bg-slate-950/95 border-2 border-indigo-500 rounded-xl px-3 sm:px-4 py-2 shadow-2xl flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 text-xs animate-in slide-in-from-bottom-2">
          <div className="w-2.5 h-2.5 rounded-full bg-indigo-400 animate-ping shrink-0" />
          <div className="flex min-w-0 flex-col sm:flex-row items-center gap-1 sm:gap-1.5 text-center sm:text-left text-slate-200">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="text-indigo-300 font-bold shrink-0">手札選択中:</span>
              <span className="font-extrabold text-white truncate">「{selectedHandCard.card.name}」</span>
            </div>
            <span className="text-slate-400 text-[11px]">
              {selectedHandCard.card.cardType === 'EVENT'
                ? '➔ 使用する枠をタップ（場外へ）'
                : '➔ 配置したい枠をタップ'}
            </span>
          </div>
          <button
            onClick={() => setSelectedHandCard(null)}
            className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 hover:text-white rounded text-[11px] font-bold border border-slate-700 flex items-center gap-1"
            title="選択を解除します (ESCキー)"
          >
            解除 [ESC]
          </button>
        </div>
      )}
    </div>
  );
};
