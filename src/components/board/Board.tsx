import React, { useState } from 'react';
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
import { OpponentHandModal } from '../modals/OpponentHandModal';
import { AttackLineOverlay } from './AttackLineOverlay';

interface BoardProps {
  gameState: GameState;
  myPlayerId: string;
  dispatchAction: (action: GameAction) => void;
}

export const Board: React.FC<BoardProps> = ({
  gameState,
  myPlayerId,
  dispatchAction,
}) => {
  // 相手IDを判定
  const playerIds = Object.keys(gameState.players);
  const opponentId = playerIds.find((id) => id !== myPlayerId) || 'player-2';

  const myPlayer = gameState.players[myPlayerId] || {
    id: myPlayerId,
    name: '自分',
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
  };

  const opponentPlayer = gameState.players[opponentId] || {
    id: opponentId,
    name: '相手',
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
  };

  // 手札からフィールドへ配置するための選択状態
  const [selectedHandCard, setSelectedHandCard] = useState<Card | null>(null);
  const [inspectCard, setInspectCard] = useState<Card | null>(null);
  const [isCardSearchOpen, setIsCardSearchOpen] = useState(false);
  const [isOpponentHandOpen, setIsOpponentHandOpen] = useState(false);

  // レイド下敷きカード確認モーダル状態
  const [underCardsTarget, setUnderCardsTarget] = useState<{
    zone: 'frontLine' | 'energyLine';
    slotIndex: FieldSlotIndex;
  } | null>(null);

  // アタックモード状態
  const [attackingState, setAttackingState] = useState<{
    zone: 'frontLine' | 'energyLine';
    slotIndex: FieldSlotIndex;
  } | null>(null);

  // レイドカード判定ヘルパー
  const isRaidCard = (card: Card): boolean => {
    if (card.triggers && card.triggers.includes('RAID')) return true;
    if (card.effectText && (card.effectText.includes('【レイド】') || card.effectText.includes('[レイド]'))) return true;
    return false;
  };

  // 発生エナジー計算ヘルパー (公式ルール: エナジーラインのアクティブ状態のキャラから発生)
  const calculateGeneratedEnergy = (slots: (Card | null)[]) => {
    let total = 0;
    const byColor: Partial<Record<CardColor, number>> = {};

    slots.forEach((card) => {
      if (card && !card.isRested && !card.isFaceDown) {
        // カードデータ上の発生エナジー（未定義や0の場合はキャラなら最低1）
        const gen = card.genEnergy > 0 ? card.genEnergy : (card.cardType === 'CHARACTER' ? 1 : 0);
        total += gen;
        const col = card.color || 'COLORLESS';
        byColor[col] = (byColor[col] || 0) + gen;
      }
    });

    return { total, byColor };
  };

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

  // アタック宣言
  const handleDeclareAttack = (zone: 'frontLine' | 'energyLine', slotIndex: FieldSlotIndex) => {
    // 公式ルール P10: 先攻第1ターンはアタックできない
    if (gameState.turn === 1 && myPlayer.isFirst) {
      alert('【公式ルール】先攻第1ターンはアタックフェイズを行えません（アタック不可）。');
      return;
    }
    setAttackingState({ zone, slotIndex });
  };

  // 相手プレイヤーへのアタック解決
  const handleAttackPlayer = () => {
    if (attackingState === null) return;
    const { zone, slotIndex } = attackingState;
    const attacker = myPlayer[zone][slotIndex];
    if (!attacker) return;

    // アタッカーをレストに
    dispatchAction({
      type: 'TOGGLE_REST',
      payload: { playerId: myPlayerId, zone, slotIndex },
    });

    dispatchAction({
      type: 'ADD_LOG',
      payload: {
        message: `⚔️【プレイヤーアタック】「${attacker.name}」が相手プレイヤーにアタックしました！相手ライフのトリガーチェックを行ってください。`,
        playerId: myPlayerId,
        type: 'action',
      },
    });

    setAttackingState(null);
  };

  // 相手キャラへのアタック（バトル）解決
  const handleAttackOpponentCard = (oppSlotIndex: FieldSlotIndex) => {
    if (attackingState === null) return;
    const { zone, slotIndex } = attackingState;
    const attacker = myPlayer[zone][slotIndex];
    const defender = opponentPlayer.frontLine[oppSlotIndex];
    if (!attacker || !defender) return;

    // アタッカーをレストに
    dispatchAction({
      type: 'TOGGLE_REST',
      payload: { playerId: myPlayerId, zone, slotIndex },
    });

    const attackerBp = (attacker.bp ?? 0) + attacker.bpModifier;
    const defenderBp = (defender.bp ?? 0) + defender.bpModifier;

    // 公式ルール P12: アタック側BP >= 防御側BP ならアタック側勝利
    const isAttackerWin = attackerBp >= defenderBp;

    dispatchAction({
      type: 'ADD_LOG',
      payload: {
        message: `⚔️【バトル解決】「${attacker.name}」(BP${attackerBp}) VS 「${defender.name}」(BP${defenderBp}) ➔ ${
          isAttackerWin
            ? `勝者: 「${attacker.name}」！「${defender.name}」は退場（場外）です。`
            : `勝者: 「${defender.name}」！「${attacker.name}」は防御を突破できませんでした。`
        }`,
        playerId: myPlayerId,
        type: 'action',
      },
    });

    if (isAttackerWin) {
      if (window.confirm(`「${defender.name}」を場外へ送りますか？`)) {
        dispatchAction({
          type: 'MOVE_CARD',
          payload: {
            cardId: defender.id,
            from: { playerId: opponentId, zone: 'frontLine', slotIndex: oppSlotIndex },
            to: { playerId: opponentId, zone: 'graveyard' },
          },
        });
      }
    }

    setAttackingState(null);
  };

  // 手札カード選択ハンドラ
  const handleSelectHandCard = (card: Card) => {
    if (selectedHandCard?.id === card.id) {
      setSelectedHandCard(null); // 解除
    } else {
      setSelectedHandCard(card);
    }
  };

  // フィールド枠クリック時の配置 / レイド
  const handleSlotClick = (zone: 'frontLine' | 'energyLine', slotIndex: FieldSlotIndex) => {
    if (!selectedHandCard) return;

    const existingCard = zone === 'frontLine' ? myPlayer.frontLine[slotIndex] : myPlayer.energyLine[slotIndex];
    const handIndex = myPlayer.hand.findIndex((c) => c.id === selectedHandCard.id);
    if (handIndex === -1) return;

    if (existingCard) {
      // レイド能力チェック
      if (!isRaidCard(selectedHandCard)) {
        alert(
          `「${selectedHandCard.name}」はレイド能力を持たない通常カードです。\n既存のキャラの上に重ねることはできません。空いている枠に配置してください。\n（配置したい場合は、元のキャラを別の枠へ移動するか、場外へ送ってください）`
        );
        setSelectedHandCard(null);
        return;
      }

      const confirmRaid = window.confirm(
        `【レイド登場】「${selectedHandCard.name}」を「${existingCard.name}」の上にレイドさせますか？`
      );
      if (!confirmRaid) {
        setSelectedHandCard(null);
        return;
      }

      // エナジーラインの場合はフロントライン移動または残留の選択
      let moveToFront = false;
      if (zone === 'energyLine') {
        const hasEmptyFront = myPlayer.frontLine.some((c) => c === null);
        if (!hasEmptyFront) {
          alert('フロントラインに空き枠がないため、エナジーラインにとどまります（アクティブ状態になります）。');
          moveToFront = false;
        } else {
          const choice = window.prompt(
            '【レイド配置の選択】\nエナジーラインのキャラにレイドしました。\n配置場所を選択してください:\n1: フロントラインの空き枠へ移動する\n2: エナジーラインにとどまる（アクティブ化）\n（キャンセルを押すとレイドを中止します）',
            '1'
          );
          if (choice === null) {
            setSelectedHandCard(null);
            return;
          }
          moveToFront = choice.trim() === '1';
        }
      }

      dispatchAction({
        type: 'RAID_CARD',
        payload: {
          playerId: myPlayerId,
          targetZone: zone,
          targetSlotIndex: slotIndex,
          raidCard: selectedHandCard,
          fromLocation: { playerId: myPlayerId, zone: 'hand', index: handIndex },
          moveToFront,
        },
      });
    } else {
      // 空き枠への通常配置
      dispatchAction({
        type: 'MOVE_CARD',
        payload: {
          cardId: selectedHandCard.id,
          from: { playerId: myPlayerId, zone: 'hand', index: handIndex },
          to: { playerId: myPlayerId, zone, slotIndex },
        },
      });
    }

    setSelectedHandCard(null);
  };

  // レスト切り替え
  const handleToggleRest = (zone: 'frontLine' | 'energyLine', slotIndex: FieldSlotIndex) => {
    dispatchAction({
      type: 'TOGGLE_REST',
      payload: { playerId: myPlayerId, zone, slotIndex },
    });
  };

  // BP修正
  const handleModifyBp = (zone: 'frontLine' | 'energyLine', slotIndex: FieldSlotIndex, delta: number) => {
    dispatchAction({
      type: 'MODIFY_BP',
      payload: { playerId: myPlayerId, zone, slotIndex, delta },
    });
  };

  // フリーズ状態の切り替え
  const handleToggleFreeze = (zone: 'frontLine' | 'energyLine', slotIndex: FieldSlotIndex) => {
    dispatchAction({
      type: 'TOGGLE_FREEZE',
      payload: { playerId: myPlayerId, zone, slotIndex },
    });
  };

  // マーカー追加（山札の上または手札から）
  const handleAddMarker = (
    zone: 'frontLine' | 'energyLine',
    slotIndex: FieldSlotIndex,
    from: 'deckTop' | 'hand' = 'deckTop'
  ) => {
    if (from === 'deckTop' && myPlayer.deck.length === 0) {
      alert('山札がありません。');
      return;
    }
    dispatchAction({
      type: 'ADD_MARKER',
      payload: {
        playerId: myPlayerId,
        targetZone: zone,
        targetSlotIndex: slotIndex,
        from: 'topDeck',
      },
    });
  };

  // フィールドからの移動
  const handleFieldMoveTo = (
    fromZone: 'frontLine' | 'energyLine',
    fromSlot: FieldSlotIndex,
    destination: 'frontLine' | 'energyLine' | 'graveyard' | 'hand' | 'removed' | 'deckTop' | 'deckBottom'
  ) => {
    const card = fromZone === 'frontLine' ? myPlayer.frontLine[fromSlot] : myPlayer.energyLine[fromSlot];
    if (!card) return;

    if (destination === 'frontLine' || destination === 'energyLine') {
      const targetSlots = destination === 'frontLine' ? myPlayer.frontLine : myPlayer.energyLine;
      const emptySlot = targetSlots.findIndex((c) => c === null);
      if (emptySlot !== -1) {
        dispatchAction({
          type: 'MOVE_CARD',
          payload: {
            cardId: card.id,
            from: { playerId: myPlayerId, zone: fromZone, slotIndex: fromSlot },
            to: { playerId: myPlayerId, zone: destination, slotIndex: emptySlot as FieldSlotIndex },
          },
        });
      } else {
        alert('移動先に空き枠がありません。');
      }
    } else if (destination === 'deckTop') {
      dispatchAction({
        type: 'MOVE_CARD',
        payload: {
          cardId: card.id,
          from: { playerId: myPlayerId, zone: fromZone, slotIndex: fromSlot },
          to: { playerId: myPlayerId, zone: 'deck', index: 0 },
        },
      });
    } else if (destination === 'deckBottom') {
      dispatchAction({
        type: 'MOVE_CARD',
        payload: {
          cardId: card.id,
          from: { playerId: myPlayerId, zone: fromZone, slotIndex: fromSlot },
          to: { playerId: myPlayerId, zone: 'deck' },
        },
      });
    } else {
      dispatchAction({
        type: 'MOVE_CARD',
        payload: {
          cardId: card.id,
          from: { playerId: myPlayerId, zone: fromZone, slotIndex: fromSlot },
          to: { playerId: myPlayerId, zone: destination },
        },
      });
    }
  };

  // 相手フィールド操作ハンドラ
  const handleOpponentToggleRest = (zone: 'frontLine' | 'energyLine', slotIndex: FieldSlotIndex) => {
    dispatchAction({
      type: 'TOGGLE_REST',
      payload: { playerId: opponentId, zone, slotIndex },
    });
  };

  const handleOpponentModifyBp = (zone: 'frontLine' | 'energyLine', slotIndex: FieldSlotIndex, delta: number) => {
    dispatchAction({
      type: 'MODIFY_BP',
      payload: { playerId: opponentId, zone, slotIndex, delta },
    });
  };

  const handleOpponentToggleFreeze = (zone: 'frontLine' | 'energyLine', slotIndex: FieldSlotIndex) => {
    dispatchAction({
      type: 'TOGGLE_FREEZE',
      payload: { playerId: opponentId, zone, slotIndex },
    });
  };

  const handleOpponentFieldMoveTo = (
    fromZone: 'frontLine' | 'energyLine',
    fromSlot: FieldSlotIndex,
    destination: 'frontLine' | 'energyLine' | 'graveyard' | 'hand' | 'removed' | 'deckTop' | 'deckBottom'
  ) => {
    const card = fromZone === 'frontLine' ? opponentPlayer.frontLine[fromSlot] : opponentPlayer.energyLine[fromSlot];
    if (!card) return;

    if (destination === 'frontLine' || destination === 'energyLine') {
      const targetSlots = destination === 'frontLine' ? opponentPlayer.frontLine : opponentPlayer.energyLine;
      const emptySlot = targetSlots.findIndex((c) => c === null);
      if (emptySlot !== -1) {
        dispatchAction({
          type: 'MOVE_CARD',
          payload: {
            cardId: card.id,
            from: { playerId: opponentId, zone: fromZone, slotIndex: fromSlot },
            to: { playerId: opponentId, zone: destination, slotIndex: emptySlot as FieldSlotIndex },
          },
        });
      } else {
        alert('相手フィールドの移動先に空き枠がありません。');
      }
    } else if (destination === 'deckTop') {
      dispatchAction({
        type: 'MOVE_CARD',
        payload: {
          cardId: card.id,
          from: { playerId: opponentId, zone: fromZone, slotIndex: fromSlot },
          to: { playerId: opponentId, zone: 'deck', index: 0 },
        },
      });
    } else if (destination === 'deckBottom') {
      dispatchAction({
        type: 'MOVE_CARD',
        payload: {
          cardId: card.id,
          from: { playerId: opponentId, zone: fromZone, slotIndex: fromSlot },
          to: { playerId: opponentId, zone: 'deck' },
        },
      });
    } else {
      dispatchAction({
        type: 'MOVE_CARD',
        payload: {
          cardId: card.id,
          from: { playerId: opponentId, zone: fromZone, slotIndex: fromSlot },
          to: { playerId: opponentId, zone: destination },
        },
      });
    }
  };

  // DnD: フィールドスロットへのドロップハンドラ
  const handleDropCardOnSlot = (
    from: CardLocation,
    targetZone: 'frontLine' | 'energyLine',
    slotIndex: FieldSlotIndex
  ) => {
    const existingCard = targetZone === 'frontLine' ? myPlayer.frontLine[slotIndex] : myPlayer.energyLine[slotIndex];

    if (from.zone === 'hand') {
      const handIndex = from.index !== undefined ? from.index : 0;
      const card = myPlayer.hand[handIndex];
      if (!card) return;

      if (existingCard) {
        // レイドカードの場合
        if (isRaidCard(card)) {
          const actionChoice = window.prompt(
            `「${card.name}」を「${existingCard.name}」の上にドロップしました。\n操作を選択してください:\n1: レイド登場させる\n2: 裏向きでマーカーとして下に置く\n（キャンセルを押すと中止します）`,
            '1'
          );
          if (actionChoice === '1') {
            let moveToFront = false;
            if (targetZone === 'energyLine') {
              const hasEmptyFront = myPlayer.frontLine.some((c) => c === null);
              if (!hasEmptyFront) {
                alert('フロントラインに空き枠がないため、エナジーラインにとどまります（アクティブ状態になります）。');
                moveToFront = false;
              } else {
                const choice = window.prompt(
                  '【レイド配置の選択】\nエナジーラインのキャラにレイドしました。\n配置場所を選択してください:\n1: フロントラインの空き枠へ移動する\n2: エナジーラインにとどまる（アクティブ化）\n（キャンセルを押すとレイドを中止します）',
                  '1'
                );
                if (choice === null) return;
                moveToFront = choice.trim() === '1';
              }
            }
            dispatchAction({
              type: 'RAID_CARD',
              payload: {
                playerId: myPlayerId,
                targetZone,
                targetSlotIndex: slotIndex,
                raidCard: card,
                fromLocation: from,
                moveToFront,
              },
            });
          } else if (actionChoice === '2') {
            dispatchAction({
              type: 'ADD_MARKER',
              payload: {
                playerId: myPlayerId,
                targetZone,
                targetSlotIndex: slotIndex,
                from: { zone: 'hand', index: handIndex },
                isFaceDown: true,
              },
            });
          }
          return;
        } else {
          // 通常キャラカードの場合: マーカー配置の確認
          const confirmMarker = window.confirm(
            `「${card.name}」を「${existingCard.name}」の下に裏向きでマーカーとして置きますか？\n（ファットガム、ホークス、天喰環等のカード効果）`
          );
          if (confirmMarker) {
            dispatchAction({
              type: 'ADD_MARKER',
              payload: {
                playerId: myPlayerId,
                targetZone,
                targetSlotIndex: slotIndex,
                from: { zone: 'hand', index: handIndex },
                isFaceDown: true,
              },
            });
          }
          return;
        }
      } else {
        // 通常登場
        dispatchAction({
          type: 'MOVE_CARD',
          payload: {
            cardId: card.id,
            from,
            to: { playerId: myPlayerId, zone: targetZone, slotIndex },
          },
        });
      }
    } else if (from.zone === 'frontLine' || from.zone === 'energyLine') {
      const fromSlot = (from.slotIndex ?? 0) as FieldSlotIndex;
      if (from.zone === targetZone && fromSlot === slotIndex) return;

      const card = from.zone === 'frontLine' ? myPlayer.frontLine[fromSlot] : myPlayer.energyLine[fromSlot];
      if (!card) return;

      dispatchAction({
        type: 'MOVE_CARD',
        payload: {
          cardId: card.id,
          from,
          to: { playerId: myPlayerId, zone: targetZone, slotIndex },
        },
      });
    }
  };

  // DnD: 場外へのドロップ
  const handleDropToGraveyard = (from: CardLocation) => {
    let card: Card | null = null;
    if (from.zone === 'hand') {
      card = myPlayer.hand[from.index ?? 0];
    } else if (from.zone === 'frontLine') {
      card = myPlayer.frontLine[(from.slotIndex ?? 0) as FieldSlotIndex];
    } else if (from.zone === 'energyLine') {
      card = myPlayer.energyLine[(from.slotIndex ?? 0) as FieldSlotIndex];
    }
    if (!card) return;

    dispatchAction({
      type: 'MOVE_CARD',
      payload: {
        cardId: card.id,
        from,
        to: { playerId: myPlayerId, zone: 'graveyard' },
      },
    });
  };

  // DnD: 手札へのドロップ（フィールドから手札へ戻す）
  const handleDropToHand = (from: CardLocation) => {
    if (from.zone !== 'frontLine' && from.zone !== 'energyLine') return;
    const fromSlot = (from.slotIndex ?? 0) as FieldSlotIndex;
    const card = from.zone === 'frontLine' ? myPlayer.frontLine[fromSlot] : myPlayer.energyLine[fromSlot];
    if (!card) return;

    dispatchAction({
      type: 'MOVE_CARD',
      payload: {
        cardId: card.id,
        from,
        to: { playerId: myPlayerId, zone: 'hand' },
      },
    });
  };

  // 手札からの移動（ディスカード・除外・山札戻し）
  const handleHandMoveTo = (
    cardIndex: number,
    dest: 'graveyard' | 'removed' | 'deckTop' | 'deckBottom'
  ) => {
    const card = myPlayer.hand[cardIndex];
    if (!card) return;

    if (dest === 'deckTop') {
      dispatchAction({
        type: 'MOVE_CARD',
        payload: {
          cardId: card.id,
          from: { playerId: myPlayerId, zone: 'hand', index: cardIndex },
          to: { playerId: myPlayerId, zone: 'deck', index: 0 },
        },
      });
    } else if (dest === 'deckBottom') {
      dispatchAction({
        type: 'MOVE_CARD',
        payload: {
          cardId: card.id,
          from: { playerId: myPlayerId, zone: 'hand', index: cardIndex },
          to: { playerId: myPlayerId, zone: 'deck' },
        },
      });
    } else {
      dispatchAction({
        type: 'MOVE_CARD',
        payload: {
          cardId: card.id,
          from: { playerId: myPlayerId, zone: 'hand', index: cardIndex },
          to: { playerId: myPlayerId, zone: dest },
        },
      });
    }
  };

  // DnD: リムーブエリアへのドロップ
  const handleDropToRemoved = (from: CardLocation) => {
    let card: Card | null = null;
    if (from.zone === 'hand') {
      card = myPlayer.hand[from.index ?? 0];
    } else if (from.zone === 'frontLine') {
      card = myPlayer.frontLine[(from.slotIndex ?? 0) as FieldSlotIndex];
    } else if (from.zone === 'energyLine') {
      card = myPlayer.energyLine[(from.slotIndex ?? 0) as FieldSlotIndex];
    } else if (from.zone === 'graveyard') {
      card = myPlayer.graveyard[from.index ?? 0];
    }
    if (!card) return;

    dispatchAction({
      type: 'MOVE_CARD',
      payload: {
        cardId: card.id,
        from,
        to: { playerId: myPlayerId, zone: 'removed' },
      },
    });
  };

  // 墓地モーダルからのカード移動
  const handleMoveFromGraveyard = (
    cardId: string,
    destination: 'hand' | 'deckTop' | 'deckBottom' | 'frontLine' | 'energyLine' | 'removed'
  ) => {
    if (destination === 'frontLine' || destination === 'energyLine') {
      const targetSlots = destination === 'frontLine' ? myPlayer.frontLine : myPlayer.energyLine;
      const emptySlot = targetSlots.findIndex((c) => c === null);
      if (emptySlot === -1) {
        alert('フィールドに空き枠がありません。');
        return;
      }
      dispatchAction({
        type: 'MOVE_CARD',
        payload: {
          cardId,
          from: { playerId: myPlayerId, zone: 'graveyard' },
          to: { playerId: myPlayerId, zone: destination, slotIndex: emptySlot as FieldSlotIndex },
        },
      });
    } else if (destination === 'deckTop') {
      dispatchAction({
        type: 'MOVE_CARD',
        payload: {
          cardId,
          from: { playerId: myPlayerId, zone: 'graveyard' },
          to: { playerId: myPlayerId, zone: 'deck', index: 0 },
        },
      });
    } else if (destination === 'deckBottom') {
      dispatchAction({
        type: 'MOVE_CARD',
        payload: {
          cardId,
          from: { playerId: myPlayerId, zone: 'graveyard' },
          to: { playerId: myPlayerId, zone: 'deck' },
        },
      });
    } else {
      dispatchAction({
        type: 'MOVE_CARD',
        payload: {
          cardId,
          from: { playerId: myPlayerId, zone: 'graveyard' },
          to: { playerId: myPlayerId, zone: destination },
        },
      });
    }
  };

  // リムーブエリアからのカード移動
  const handleMoveFromRemoved = (
    cardId: string,
    destination: 'hand' | 'graveyard' | 'deckBottom' | 'frontLine' | 'energyLine'
  ) => {
    if (destination === 'frontLine' || destination === 'energyLine') {
      const targetSlots = destination === 'frontLine' ? myPlayer.frontLine : myPlayer.energyLine;
      const emptySlot = targetSlots.findIndex((c) => c === null);
      if (emptySlot === -1) {
        alert('フィールドに空き枠がありません。');
        return;
      }
      dispatchAction({
        type: 'MOVE_CARD',
        payload: {
          cardId,
          from: { playerId: myPlayerId, zone: 'removed' },
          to: { playerId: myPlayerId, zone: destination, slotIndex: emptySlot as FieldSlotIndex },
        },
      });
    } else if (destination === 'deckBottom') {
      dispatchAction({
        type: 'MOVE_CARD',
        payload: {
          cardId,
          from: { playerId: myPlayerId, zone: 'removed' },
          to: { playerId: myPlayerId, zone: 'deck' },
        },
      });
    } else {
      dispatchAction({
        type: 'MOVE_CARD',
        payload: {
          cardId,
          from: { playerId: myPlayerId, zone: 'removed' },
          to: { playerId: myPlayerId, zone: destination },
        },
      });
    }
  };

  // レイド下敷きカードの分離
  const handleSeparateUnderCard = (
    underCardId: string,
    destination: 'hand' | 'graveyard' | 'frontLine' | 'energyLine' | 'removed'
  ) => {
    if (!underCardsTarget) return;
    dispatchAction({
      type: 'SEPARATE_UNDER_CARD',
      payload: {
        playerId: myPlayerId,
        zone: underCardsTarget.zone,
        slotIndex: underCardsTarget.slotIndex,
        underCardId,
        destination,
      },
    });
  };

  // 上のカード（親カード）の分離
  const handleSeparateParentCard = (
    destination: 'hand' | 'graveyard' | 'removed' | 'deckTop' | 'deckBottom'
  ) => {
    if (!underCardsTarget) return;
    dispatchAction({
      type: 'SEPARATE_PARENT_CARD',
      payload: {
        playerId: myPlayerId,
        zone: underCardsTarget.zone,
        slotIndex: underCardsTarget.slotIndex,
        destination,
      },
    });
  };

  const activeUnderCardsParent =
    underCardsTarget ? myPlayer[underCardsTarget.zone][underCardsTarget.slotIndex] : null;
  const hasEmptyFrontSlot = myPlayer.frontLine.some((c) => c === null);
  const hasEmptyEnergySlot = myPlayer.energyLine.some((c) => c === null);

  return (
    <div className="flex flex-col gap-2 w-full h-full p-2 max-w-7xl mx-auto overflow-y-auto">
      {/* 相手プレイヤーエリア */}
      <div
        onClick={attackingState !== null ? handleAttackPlayer : undefined}
        className={`flex gap-3 items-center bg-slate-900/40 p-2.5 rounded-2xl border transition-all ${
          attackingState !== null
            ? 'border-rose-500/80 bg-rose-950/20 cursor-crosshair ring-2 ring-rose-500/50 animate-pulse'
            : 'border-slate-800/80'
        }`}
      >
        <SideZonesArea
          player={opponentPlayer}
          isOpponent={true}
          onDraw={() => dispatchAction({ type: 'DRAW_CARD', payload: { playerId: opponentId } })}
          onCheckLife={(index) => dispatchAction({ type: 'CHECK_LIFE_TRIGGER', payload: { playerId: opponentId, lifeIndex: index } })}
          onTakeLife={(dest, index) => dispatchAction({ type: 'TAKE_LIFE', payload: { playerId: opponentId, destination: dest, lifeIndex: index } })}
          onFlipLife={(index) => dispatchAction({ type: 'FLIP_LIFE', payload: { playerId: opponentId, lifeIndex: index } })}
          onRevealTopDeck={(reveal) => dispatchAction({ type: 'REVEAL_TOP_DECK_CARD', payload: { playerId: opponentId, reveal } })}
          onBottomDeckAction={(action) => dispatchAction({ type: 'BOTTOM_DECK_ACTION', payload: { playerId: opponentId, action } })}
          onMillTopDeck={() => {
            const topCard = opponentPlayer.deck[0];
            if (!topCard) return;
            dispatchAction({
              type: 'MOVE_CARD',
              payload: {
                cardId: topCard.id,
                from: { playerId: opponentId, zone: 'deck', index: 0 },
                to: { playerId: opponentId, zone: 'graveyard' },
              },
            });
          }}
          onInspectCard={setInspectCard}
          onMoveFromGraveyard={handleMoveFromGraveyard}
          onMoveFromRemoved={handleMoveFromRemoved}
        />
        <div className="flex-1 flex flex-col gap-2">
          <HandArea
            cards={opponentPlayer.hand}
            playerId={opponentId}
            isOpponent={true}
            onDiscardRandom={() => dispatchAction({ type: 'DISCARD_HAND_CARD', payload: { playerId: opponentId } })}
            onDiscardHandIndex={(index) => dispatchAction({ type: 'DISCARD_HAND_CARD', payload: { playerId: opponentId, index } })}
            onOpenOpponentHandModal={() => setIsOpponentHandOpen(true)}
          />
          <FieldZone
            title="相手: エナジーライン"
            zone="energyLine"
            slots={opponentPlayer.energyLine}
            playerId={opponentId}
            isOpponent={true}
            extraHeaderBadge={renderEnergyBadge(opponentPlayer.energyLine)}
            onToggleRest={(slotIdx) => handleOpponentToggleRest('energyLine', slotIdx)}
            onModifyBp={(slotIdx, delta) => handleOpponentModifyBp('energyLine', slotIdx, delta)}
            onToggleFreeze={(slotIdx) => handleOpponentToggleFreeze('energyLine', slotIdx)}
            onMoveTo={(slotIdx, dest) => handleOpponentFieldMoveTo('energyLine', slotIdx, dest)}
            onInspect={setInspectCard}
          />
          <FieldZone
            title="相手: フロントライン"
            zone="frontLine"
            slots={opponentPlayer.frontLine}
            playerId={opponentId}
            isOpponent={true}
            onToggleRest={(slotIdx) => handleOpponentToggleRest('frontLine', slotIdx)}
            onModifyBp={(slotIdx, delta) => handleOpponentModifyBp('frontLine', slotIdx, delta)}
            onToggleFreeze={(slotIdx) => handleOpponentToggleFreeze('frontLine', slotIdx)}
            onMoveTo={(slotIdx, dest) => handleOpponentFieldMoveTo('frontLine', slotIdx, dest)}
            onInspect={setInspectCard}
            onSlotClick={(slotIdx) => {
              if (attackingState !== null) {
                if (opponentPlayer.frontLine[slotIdx]) {
                  handleAttackOpponentCard(slotIdx);
                } else {
                  handleAttackPlayer();
                }
              }
            }}
          />
        </div>
      </div>

      {/* 中央: フェイズ進行バー */}
      <PhaseBar
        currentPhase={gameState.phase}
        turn={gameState.turn}
        isActivePlayer={gameState.activePlayerId === myPlayerId}
        activePlayerName={gameState.players[gameState.activePlayerId]?.name || '相手'}
        canExtraDraw={myPlayer.apCurrent >= 1 && !myPlayer.hasExtraDrawn && myPlayer.deck.length > 0}
        isFirstTurnFirstPlayer={gameState.turn === 1 && !!gameState.players[gameState.activePlayerId]?.isFirst}
        onSetPhase={(phase) => dispatchAction({ type: 'SET_PHASE', payload: { phase } })}
        onPassTurn={() => dispatchAction({ type: 'PASS_TURN', payload: { playerId: myPlayerId } })}
        onExtraDraw={() => dispatchAction({ type: 'EXTRA_DRAW', payload: { playerId: myPlayerId } })}
      />

      {/* 自分プレイヤーエリア */}
      <div className="flex gap-3 items-center bg-slate-900/60 p-2.5 rounded-2xl border border-indigo-500/20 shadow-xl">
        <div className="flex-1 flex flex-col gap-2">
          <FieldZone
            title="自分: フロントライン"
            zone="frontLine"
            slots={myPlayer.frontLine}
            playerId={myPlayerId}
            selectedCardId={selectedHandCard?.id}
            onSlotClick={(slotIdx) => handleSlotClick('frontLine', slotIdx)}
            onToggleRest={(slotIdx) => handleToggleRest('frontLine', slotIdx)}
            onModifyBp={(slotIdx, delta) => handleModifyBp('frontLine', slotIdx, delta)}
            onToggleFreeze={(slotIdx) => handleToggleFreeze('frontLine', slotIdx)}
            onAddMarker={(slotIdx, from) => handleAddMarker('frontLine', slotIdx, from)}
            onMoveTo={(slotIdx, dest) => handleFieldMoveTo('frontLine', slotIdx, dest)}
            onInspect={setInspectCard}
            onDropCard={handleDropCardOnSlot}
            onDeclareAttack={(slotIdx) => handleDeclareAttack('frontLine', slotIdx)}
            onOpenUnderCards={(slotIdx) => setUnderCardsTarget({ zone: 'frontLine', slotIndex: slotIdx })}
          />
          <FieldZone
            title="自分: エナジーライン"
            zone="energyLine"
            slots={myPlayer.energyLine}
            playerId={myPlayerId}
            selectedCardId={selectedHandCard?.id}
            extraHeaderBadge={renderEnergyBadge(myPlayer.energyLine)}
            onSlotClick={(slotIdx) => handleSlotClick('energyLine', slotIdx)}
            onToggleRest={(slotIdx) => handleToggleRest('energyLine', slotIdx)}
            onModifyBp={(slotIdx, delta) => handleModifyBp('energyLine', slotIdx, delta)}
            onToggleFreeze={(slotIdx) => handleToggleFreeze('energyLine', slotIdx)}
            onAddMarker={(slotIdx, from) => handleAddMarker('energyLine', slotIdx, from)}
            onMoveTo={(slotIdx, dest) => handleFieldMoveTo('energyLine', slotIdx, dest)}
            onInspect={setInspectCard}
            onDropCard={handleDropCardOnSlot}
            onDeclareAttack={(slotIdx) => handleDeclareAttack('energyLine', slotIdx)}
            onOpenUnderCards={(slotIdx) => setUnderCardsTarget({ zone: 'energyLine', slotIndex: slotIdx })}
          />
          <HandArea
            cards={myPlayer.hand}
            playerId={myPlayerId}
            selectedCardId={selectedHandCard?.id}
            onSelectCard={handleSelectHandCard}
            onMoveTo={handleHandMoveTo}
            onInspect={setInspectCard}
            onDropToHand={handleDropToHand}
            onDiscardAll={() => dispatchAction({ type: 'DISCARD_ALL_HAND', payload: { playerId: myPlayerId } })}
          />
        </div>

        <SideZonesArea
          player={myPlayer}
          isOpponent={false}
          onDraw={() => dispatchAction({ type: 'DRAW_CARD', payload: { playerId: myPlayerId } })}
          onShuffle={() => dispatchAction({ type: 'SHUFFLE_DECK', payload: { playerId: myPlayerId } })}
          onCheckLife={(index) => dispatchAction({ type: 'CHECK_LIFE_TRIGGER', payload: { playerId: myPlayerId, lifeIndex: index } })}
          onRecoverLife={() => dispatchAction({ type: 'RECOVER_LIFE', payload: { playerId: myPlayerId } })}
          onTakeLife={(dest, index) => dispatchAction({ type: 'TAKE_LIFE', payload: { playerId: myPlayerId, destination: dest, lifeIndex: index } })}
          onFlipLife={(index) => dispatchAction({ type: 'FLIP_LIFE', payload: { playerId: myPlayerId, lifeIndex: index } })}
          onUseAp={() => dispatchAction({ type: 'USE_AP', payload: { playerId: myPlayerId } })}
          onRecoverAp={() => dispatchAction({ type: 'RECOVER_AP', payload: { playerId: myPlayerId, amount: 1 } })}
          onLookAtTopDeck={(count) => dispatchAction({ type: 'LOOK_AT_TOP_DECK', payload: { playerId: myPlayerId, count } })}
          onOpenSearchDeck={() => setIsCardSearchOpen(true)}
          onRevealTopDeck={(reveal) => dispatchAction({ type: 'REVEAL_TOP_DECK_CARD', payload: { playerId: myPlayerId, reveal } })}
          onBottomDeckAction={(action) => dispatchAction({ type: 'BOTTOM_DECK_ACTION', payload: { playerId: myPlayerId, action } })}
          onInspectCard={setInspectCard}
          onDropToGraveyard={handleDropToGraveyard}
          onDropToRemoved={handleDropToRemoved}
          onMoveFromGraveyard={handleMoveFromGraveyard}
          onMoveFromRemoved={handleMoveFromRemoved}
        />
      </div>

      {/* 公開カード / 詳細モーダル */}
      <RevealedCardModal
        revealed={gameState.revealedCard}
        inspectCard={inspectCard}
        onDismissRevealed={(destination) =>
          dispatchAction({ type: 'DISMISS_REVEALED_CARD', payload: { destination } })
        }
        onCloseInspect={() => setInspectCard(null)}
      />

      {/* 山札の上からN枚確認モーダル */}
      <TopDeckModal
        revealedDeck={gameState.revealedDeckCards}
        myPlayerId={myPlayerId}
        onResolveCard={(cardId, destination) =>
          dispatchAction({
            type: 'RESOLVE_TOP_DECK_CARD',
            payload: { playerId: myPlayerId, cardId, destination },
          })
        }
        onClose={(shuffleRemaining) =>
          dispatchAction({
            type: 'CLOSE_TOP_DECK',
            payload: { playerId: myPlayerId, shuffleRemaining },
          })
        }
      />

      {/* 山札サーチモーダル */}
      <CardSearchModal
        isOpen={isCardSearchOpen}
        cards={myPlayer.deck}
        onSelectCard={(cardId, destination) =>
          dispatchAction({
            type: 'SEARCH_DECK_CARD',
            payload: { playerId: myPlayerId, cardId, destination },
          })
        }
        onClose={(shuffleDeck) => {
          if (shuffleDeck) {
            dispatchAction({ type: 'SHUFFLE_DECK', payload: { playerId: myPlayerId } });
          }
          setIsCardSearchOpen(false);
        }}
      />

      {/* レイド下敷きカード確認・分離モーダル */}
      <UnderCardsModal
        isOpen={!!activeUnderCardsParent && (activeUnderCardsParent.underCards?.length ?? 0) > 0}
        parentCard={activeUnderCardsParent}
        hasEmptyFrontSlot={hasEmptyFrontSlot}
        hasEmptyEnergySlot={hasEmptyEnergySlot}
        onSeparateCard={handleSeparateUnderCard}
        onSeparateParentCard={handleSeparateParentCard}
        onClose={() => setUnderCardsTarget(null)}
      />

      {/* バトル攻撃線アニメーションオーバーレイ */}
      <AttackLineOverlay
        sourceElement={
          attackingState !== null
            ? document.getElementById(`slot-${myPlayerId}-${attackingState.zone}-${attackingState.slotIndex}`)
            : null
        }
        targetElement={null}
        isActive={attackingState !== null}
        attackerName={
          attackingState !== null && myPlayer[attackingState.zone][attackingState.slotIndex]
            ? myPlayer[attackingState.zone][attackingState.slotIndex]!.name
            : 'アタッカー'
        }
        onCancel={() => setAttackingState(null)}
      />

      {/* 相手手札確認・ハンデスモーダル */}
      <OpponentHandModal
        isOpen={isOpponentHandOpen}
        cards={opponentPlayer.hand}
        opponentName={opponentPlayer.name}
        onDiscardCard={(cardIndex: number) => {
          dispatchAction({
            type: 'DISCARD_HAND_CARD',
            payload: { playerId: opponentId, index: cardIndex },
          });
        }}
        onClose={() => setIsOpponentHandOpen(false)}
      />
    </div>
  );
};
