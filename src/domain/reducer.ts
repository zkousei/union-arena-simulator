import { produce } from 'immer';
import { GameAction } from '../types/actions';
import { Card } from '../types/card';
import { CardLocation, FieldSlotIndex, GameState, PlayerState } from '../types/game';
import {
  calculateMaxAp,
  createDefaultApCards,
  executeMulligan,
  placeInitialLife,
  resetCardState,
  setupInitialDeck,
  shuffleCards,
} from './deck';
import { createInitialGameState } from './initialState';
import { calculateBattleResult } from './battle';

function getCardAtLocation(player: PlayerState, loc: CardLocation, cardId?: string): Card | null {
  if (loc.zone === 'frontLine' || loc.zone === 'energyLine') {
    const slot = (loc.slotIndex ?? 0) as FieldSlotIndex;
    const card = loc.zone === 'frontLine' ? player.frontLine[slot] : player.energyLine[slot];
    return card && (!cardId || card.id === cardId) ? card : null;
  }

  const cards =
    loc.zone === 'hand'
      ? player.hand
      : loc.zone === 'deck'
        ? player.deck
        : loc.zone === 'life'
          ? player.life
          : loc.zone === 'graveyard'
            ? player.graveyard
            : loc.zone === 'removed'
              ? player.removed
              : null;
  if (!cards) return null;
  if (loc.index !== undefined) {
    const card = cards[loc.index];
    return card && (!cardId || card.id === cardId) ? card : null;
  }
  if (cardId) return cards.find((card) => card.id === cardId) ?? null;
  return loc.zone === 'deck' || loc.zone === 'life' ? cards[0] ?? null : null;
}

function isHiddenSource(loc: CardLocation, card: Card): boolean {
  return (
    loc.zone === 'hand' ||
    loc.zone === 'deck' ||
    (loc.zone === 'life' && card.isFaceDown !== false) ||
    ((loc.zone === 'frontLine' || loc.zone === 'energyLine') && card.isFaceDown === true)
  );
}

function isHiddenDestination(loc: CardLocation): boolean {
  return (
    loc.zone === 'hand' ||
    loc.zone === 'deck' ||
    (loc.zone === 'life' && loc.isFaceDown !== false)
  );
}

function cardLogLabel(card: Card, disclose: boolean): string {
  return disclose ? `「${card.name}」` : '非公開カード';
}

/**
 * 補助関数: カードのアクティブ化（フリーズ状態を考慮）
 * フリーズ状態の場合、アクティブ化されずにフリーズのみ解除される
 * @returns フリーズ状態によりアクティブ化が阻止されフリーズが解除された場合は true
 */
function activateCard(card: Card | null): boolean {
  if (!card) return false;
  if (card.isFrozen) {
    card.isFrozen = false;
    return true;
  }
  card.isRested = false;
  return false;
}

/**
 * 補助関数: プレイヤーの特定ゾーンからカードを取り出す
 */
function removeCardFromLocation(player: PlayerState, loc: CardLocation, cardId?: string): Card | null {
  const resolveIndex = (cards: Card[], fallbackToTop = false): number => {
    if (loc.index !== undefined) {
      const indexedCard = cards[loc.index];
      return indexedCard && (!cardId || indexedCard.id === cardId) ? loc.index : -1;
    }
    if (cardId) return cards.findIndex((card) => card.id === cardId);
    return fallbackToTop && cards.length > 0 ? 0 : -1;
  };

  if (loc.zone === 'frontLine') {
    const slot = (loc.slotIndex ?? 0) as FieldSlotIndex;
    const card = player.frontLine[slot];
    if (!card || (cardId && card.id !== cardId)) return null;
    player.frontLine[slot] = null;
    return card;
  }
  if (loc.zone === 'energyLine') {
    const slot = (loc.slotIndex ?? 0) as FieldSlotIndex;
    const card = player.energyLine[slot];
    if (!card || (cardId && card.id !== cardId)) return null;
    player.energyLine[slot] = null;
    return card;
  }
  if (loc.zone === 'hand') {
    const idx = resolveIndex(player.hand);
    if (idx >= 0) {
      return player.hand.splice(idx, 1)[0];
    }
  }
  if (loc.zone === 'deck') {
    const idx = resolveIndex(player.deck, true);
    if (idx >= 0) {
      return player.deck.splice(idx, 1)[0];
    }
  }
  if (loc.zone === 'life') {
    const idx = resolveIndex(player.life, true);
    if (idx >= 0) {
      return player.life.splice(idx, 1)[0];
    }
  }
  if (loc.zone === 'graveyard') {
    const idx = resolveIndex(player.graveyard);
    if (idx >= 0) {
      return player.graveyard.splice(idx, 1)[0];
    }
  }
  if (loc.zone === 'removed') {
    const idx = resolveIndex(player.removed);
    if (idx >= 0) {
      return player.removed.splice(idx, 1)[0];
    }
  }
  return null;
}

/**
 * 補助関数: プレイヤーの特定ゾーンにカードを追加する
 */
function addCardToLocation(player: PlayerState, loc: CardLocation, card: Card): void {
  if (loc.zone === 'frontLine') {
    const slot = (loc.slotIndex ?? 0) as FieldSlotIndex;
    player.frontLine[slot] = card;
  } else if (loc.zone === 'energyLine') {
    const slot = (loc.slotIndex ?? 0) as FieldSlotIndex;
    player.energyLine[slot] = card;
  } else if (loc.zone === 'hand') {
    player.hand.push(resetCardState(card));
  } else if (loc.zone === 'deck') {
    if (loc.index !== undefined) {
      player.deck.splice(loc.index, 0, resetCardState(card));
    } else {
      player.deck.push(resetCardState(card));
    }
  } else if (loc.zone === 'life') {
    const isFaceDown = loc.isFaceDown !== undefined ? loc.isFaceDown : true;
    if (loc.index !== undefined) {
      player.life.splice(loc.index, 0, { ...resetCardState(card), isFaceDown });
    } else {
      player.life.unshift({ ...resetCardState(card), isFaceDown });
    }
  } else if (loc.zone === 'graveyard') {
    player.graveyard.push(resetCardState(card));
  } else if (loc.zone === 'removed') {
    player.removed.push(resetCardState(card));
  }
}

/**
 * 補助関数: ログの追加ヘルパー
 */
function appendLog(
  draft: GameState,
  message: string,
  playerId?: string,
  type: 'action' | 'phase' | 'system' | 'chat' = 'action'
) {
  const playerName = playerId ? draft.players[playerId]?.name : undefined;
  draft.logs.push({
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: Date.now(),
    playerId,
    playerName,
    message,
    type,
  });
}

/**
 * 補助関数: ゲーム状態に存在する全カードIDを高速に収集する（カード保存則検証用）
 */
function collectAllCardIds(state: GameState): string[] {
  const ids: string[] = [];
  const collect = (card: Card | null) => {
    if (!card) return;
    ids.push(card.id);
    if (card.underCards && card.underCards.length > 0) {
      card.underCards.forEach(collect);
    }
  };

  const players = Object.values(state.players);
  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    p.deck.forEach(collect);
    p.hand.forEach(collect);
    p.frontLine.forEach(collect);
    p.energyLine.forEach(collect);
    p.life.forEach(collect);
    p.graveyard.forEach(collect);
    p.removed.forEach(collect);
    p.apArea.forEach(collect);
  }

  // isTrigger !== false の場合のみ、元のゾーンから切り離された実体カードとして集計（view の場合は元ゾーンに存在）
  if (state.revealedCard?.card && state.revealedCard.isTrigger !== false) {
    collect(state.revealedCard.card);
  }
  if (state.revealedDeckCards?.cards) {
    state.revealedDeckCards.cards.forEach(collect);
  }

  return ids;
}

function areCardIdMultisetsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const countMap = new Map<string, number>();
  for (let i = 0; i < a.length; i++) {
    const id = a[i];
    countMap.set(id, (countMap.get(id) || 0) + 1);
  }
  for (let i = 0; i < b.length; i++) {
    const id = b[i];
    const count = countMap.get(id);
    if (!count) return false;
    if (count === 1) {
      countMap.delete(id);
    } else {
      countMap.set(id, count - 1);
    }
  }
  return countMap.size === 0;
}

const CONSERVATION_EXEMPT_ACTIONS = new Set<string>([
  'INIT_GAME',
  'SETUP_GAME',
  'SYNC_STATE',
]);

/**
 * 内部ゲームリデューサー
 */
function internalGameReducer(state: GameState, action: GameAction): GameState {
  return produce(state, (draft) => {
    switch (action.type) {
      case 'INIT_GAME': {
        const { player1Id, player1Name, player2Id, player2Name, activePlayerId } = action.payload;
        return createInitialGameState(player1Id, player1Name, player2Id, player2Name, activePlayerId);
      }

      case 'SET_FIRST_PLAYER': {
        const { firstPlayerId } = action.payload;
        draft.firstPlayerId = firstPlayerId;
        draft.activePlayerId = firstPlayerId;

        Object.values(draft.players).forEach((p) => {
          p.isFirst = p.id === firstPlayerId;
          p.apMax = calculateMaxAp(1, p.isFirst);
          p.apCurrent = p.apMax;
        });

        const firstPlayerName = draft.players[firstPlayerId]?.name || firstPlayerId;
        appendLog(draft, `先攻が「${firstPlayerName}」に決定しました。`, firstPlayerId, 'system');
        break;
      }

      case 'SETUP_GAME': {
        const { playerId, deckCards, apCards } = action.payload;
        const player = draft.players[playerId];
        if (!player) return;

        // 公式ルール P3: デッキ50枚から手札7枚のみをドロー（山札43枚、ライフはマリガン後に配置するため0枚）
        const { life, hand, deck } = setupInitialDeck(deckCards);
        player.deck = deck;
        player.hand = hand;
        player.life = life;
        player.apArea = apCards.length > 0 ? apCards : createDefaultApCards(playerId);
        player.apMax = calculateMaxAp(1, player.isFirst);
        player.apCurrent = player.apMax;
        player.frontLine = [null, null, null, null];
        player.energyLine = [null, null, null, null];
        player.graveyard = [];
        player.removed = [];
        player.hasMulliganed = false;
        player.isHandKept = false;
        player.isReady = false;

        appendLog(
          draft,
          `${player.name} がデッキをセットアップし、初手7枚をドローしました（山札: ${player.deck.length}枚。先攻から順にマリガン判定を行います）。`,
          playerId,
          'system'
        );
        break;
      }

      case 'DRAW_INITIAL_HAND': {
        const { playerId } = action.payload;
        const player = draft.players[playerId];
        if (!player || player.deck.length < 7) return;

        // 手札7枚をドロー
        const handCards = player.deck.splice(0, 7).map(resetCardState);
        player.hand = handCards;
        appendLog(draft, `${player.name} が初手7枚をドローしました（山札残り: ${player.deck.length}枚）。`, playerId, 'system');
        break;
      }

      case 'MULLIGAN': {
        const { playerId } = action.payload;
        const player = draft.players[playerId];
        if (!player || player.hasMulliganed || player.isHandKept || player.hand.length === 0) return;

        // 公式ルール P3: 手札7枚を横に置き、山札(43枚)の上から7枚引く。その後横に置いた7枚を山札に戻してシャッフル
        const { newHand, newDeck } = executeMulligan(player.hand, player.deck);
        player.hand = newHand;
        player.deck = newDeck;
        player.hasMulliganed = true;
        player.isHandKept = true;

        appendLog(
          draft,
          `🔄【マリガン】${player.name} が手札7枚を引き直しました（元の手札は山札に戻してシャッフル。山札: ${player.deck.length}枚）。`,
          playerId,
          'action'
        );
        break;
      }

      case 'KEEP_HAND': {
        const { playerId } = action.payload;
        const player = draft.players[playerId];
        if (!player || player.hasMulliganed || player.isHandKept) return;

        player.isHandKept = true;
        appendLog(draft, `✨【キープ】${player.name} が初手7枚をキープしました。`, playerId, 'action');
        break;
      }

      case 'PLACE_INITIAL_LIFE': {
        const { playerId, count = 7 } = action.payload;
        const player = draft.players[playerId];
        if (
          !player ||
          !Number.isInteger(count) ||
          count <= 0 ||
          !player.isHandKept ||
          player.life.length > 0 ||
          player.deck.length < count
        ) return;

        // 公式ルール P3: マリガン終了後、山札の上から7枚を裏向きでライフエリアへ配置
        const { life, deck } = placeInitialLife(player.deck, count);
        player.life = life;
        player.deck = deck;

        appendLog(
          draft,
          `🛡️【ライフ配置】${player.name} がマリガン完了に伴い、山札の上からライフ7枚を裏向きで配置しました（山札残り: ${player.deck.length}枚）。`,
          playerId,
          'system'
        );
        break;
      }

      case 'SET_READY': {
        const { playerId, isReady } = action.payload;
        const player = draft.players[playerId];
        if (!player) return;
        if (isReady && (!player.isHandKept || player.life.length === 0)) return;
        player.isReady = isReady;
        appendLog(draft, `${player.name} が準備${isReady ? '完了' : '未完了'}になりました。`, playerId, 'system');
        break;
      }

      case 'START_GAME': {
        // UI以外からの操作やP2P同期でも、両者の初期準備完了前は開始させない。
        const hasIncompletePlayer = Object.values(draft.players).some(
          (player) => player.hand.length === 0 || !player.isHandKept || player.life.length === 0
        );
        if (draft.status !== 'PREPARING' || hasIncompletePlayer) {
          return;
        }

        draft.status = 'PLAYING';
        draft.turn = 1;
        draft.phase = 'START';
        draft.activePlayerId = draft.firstPlayerId || Object.keys(draft.players)[0];

        // 各プレイヤーのAP初期化
        Object.values(draft.players).forEach((p) => {
          p.apMax = calculateMaxAp(1, p.isFirst);
          p.apCurrent = p.apMax;
          p.hasExtraDrawn = false;
        });

        const activePlayer = draft.players[draft.activePlayerId];
        appendLog(
          draft,
          `⚔️ ゲームが開始されました！ 第1ターン（先攻: ${activePlayer?.name || draft.activePlayerId}）です。\n※公式ルール: 先攻第1ターンは【通常ドローなし】【アタックフェイズなし（アタック不可）】です。`,
          draft.activePlayerId,
          'system'
        );
        break;
      }

      case 'MOVE_CARD': {
        const { from, to, cardId } = action.payload;
        const fromPlayer = draft.players[from.playerId];
        const toPlayer = draft.players[to.playerId];
        if (!fromPlayer || !toPlayer) return;

        const isFromField = from.zone === 'frontLine' || from.zone === 'energyLine';
        const isToField = to.zone === 'frontLine' || to.zone === 'energyLine';
        const sourceCard = getCardAtLocation(fromPlayer, from, cardId);
        if (!sourceCard) return;
        const redactCardName = isHiddenSource(from, sourceCard) && isHiddenDestination(to);

        // 公式ルール: フィールドカードはエナジーラインにのみ配置でき、フロントラインには登場・移動できない
        if (sourceCard.cardType === 'FIELD' && to.zone === 'frontLine') return;

        // 盤面スロット間の移動で、移動先に既にカードが存在する場合は「位置のスワップ（入れ替え）」を実行
        if (isFromField && isToField && from.slotIndex !== undefined && to.slotIndex !== undefined) {
          const fromSlot = from.slotIndex as FieldSlotIndex;
          const toSlot = to.slotIndex as FieldSlotIndex;
          const fromCard = from.zone === 'frontLine' ? fromPlayer.frontLine[fromSlot] : fromPlayer.energyLine[fromSlot];
          const toCard = to.zone === 'frontLine' ? toPlayer.frontLine[toSlot] : toPlayer.energyLine[toSlot];

          if (fromCard && fromCard.id === cardId && toCard) {
            // フィールドカードがフロントラインにスワップされるのを防止
            if ((fromCard.cardType === 'FIELD' && to.zone === 'frontLine') || (toCard.cardType === 'FIELD' && from.zone === 'frontLine')) {
              return;
            }

            // スワップ
            if (from.zone === 'frontLine') {
              fromPlayer.frontLine[fromSlot] = to.zone === 'frontLine' ? toCard : { ...toCard, frontLineGeneratedEnergy: 0 };
            } else {
              fromPlayer.energyLine[fromSlot] = to.zone === 'frontLine' ? { ...toCard, frontLineGeneratedEnergy: 0 } : toCard;
            }

            if (to.zone === 'frontLine') {
              toPlayer.frontLine[toSlot] = from.zone === 'energyLine' ? { ...fromCard, frontLineGeneratedEnergy: 0 } : fromCard;
            } else {
              toPlayer.energyLine[toSlot] = from.zone === 'frontLine' ? { ...fromCard, frontLineGeneratedEnergy: 0 } : fromCard;
            }

            appendLog(
              draft,
              `${fromPlayer.name} が「${fromCard.name}」と「${toCard.name}」の位置を入れ替えました。`,
              from.playerId
            );
            return;
          }
        }

        if (isToField && sourceCard.cardType !== 'EVENT') {
          const toSlot = (to.slotIndex ?? 0) as FieldSlotIndex;
          const destinationCard =
            to.zone === 'frontLine' ? toPlayer.frontLine[toSlot] : toPlayer.energyLine[toSlot];
          if (destinationCard) return;
        }

        const card = removeCardFromLocation(fromPlayer, from, cardId);
        if (!card) return;

        const isEnteringField = isToField;
        const isLeavingField = isFromField && !isEnteringField;

        // 公式ルール: イベントカードは使用時、場には出ずに場外へ置かれる
        if (card.cardType === 'EVENT' && isEnteringField) {
          toPlayer.graveyard.push(resetCardState(card));
          appendLog(
            draft,
            `📜【イベント使用】${fromPlayer.name} がイベントカード「${card.name}」を使用しました（イベントカードは場に出ず場外に置かれます）。`,
            from.playerId,
            'action'
          );
          return;
        }

        // レイド下敷きカード群の退場処理
        const underCards = card.underCards || [];

        let cardToAdd = isLeavingField ? resetCardState(card) : card;
        if ((from.zone === 'frontLine' && to.zone !== 'frontLine') || (from.zone === 'energyLine' && to.zone === 'frontLine')) {
          cardToAdd = { ...cardToAdd, frontLineGeneratedEnergy: 0 };
        }

        // 公式ルール P1: キャラクターやフィールドは手札からの「登場時はレスト（横向き）」で置く
        if (from.zone === 'hand' && isEnteringField) {
          cardToAdd = { ...cardToAdd, isRested: true };
        }

        addCardToLocation(toPlayer, to, cardToAdd);

        // 公式ルール P12: レイドキャラがフィールドを離れる時、下敷きのレイド元カードはすべて場外へ送る
        if (isLeavingField && underCards.length > 0) {
          underCards.forEach((underCard) => {
            fromPlayer.graveyard.push(resetCardState(underCard));
          });
          appendLog(
            draft,
            `「${card.name}」の退場に伴い、下敷きのレイド元カード ${underCards.length} 枚（${underCards.map((c) => c.name).join(', ')}）が場外へ移動しました。`,
            from.playerId,
            'system'
          );
        }

        if (to.zone === 'life') {
          const isFaceDown = to.isFaceDown !== undefined ? to.isFaceDown : true;
          const fromDesc = from.zone === 'hand' ? '手札' : from.zone === 'frontLine' ? 'フロントライン' : from.zone === 'energyLine' ? 'エナジーライン' : from.zone;
          appendLog(
            draft,
            `🛡️【ライフ追加】${fromPlayer.name} が${cardLogLabel(card, !redactCardName)}を${fromDesc}からライフに${isFaceDown ? '裏向き' : '表向き'}で置きました。`,
            from.playerId
          );
        } else if (to.zone === 'deck') {
          const isTop = to.index === 0;
          appendLog(
            draft,
            `📚 ${fromPlayer.name} が${cardLogLabel(card, !redactCardName)}を山札の${isTop ? '一番上' : '一番下'}へ戻しました。`,
            from.playerId
          );
        } else if (from.zone === 'hand' && to.zone === 'graveyard' && card.cardType === 'EVENT') {
          appendLog(
            draft,
            `📜【イベント使用】${fromPlayer.name} がイベントカード「${card.name}」を使用し、場外へ置きました。`,
            from.playerId,
            'action'
          );
        } else {
          const fromDesc = `${from.zone}${from.slotIndex !== undefined ? `[枠${from.slotIndex + 1}]` : ''}`;
          const toDesc = `${to.zone}${to.slotIndex !== undefined ? `[枠${to.slotIndex + 1}]` : ''}`;
          appendLog(draft, `${fromPlayer.name} が${cardLogLabel(card, !redactCardName)}を ${fromDesc} から ${toDesc} へ移動しました。`, from.playerId);
        }
        break;
      }

      case 'SEPARATE_UNDER_CARD': {
        const { playerId, zone, slotIndex, underCardId, destination, destSlotIndex } = action.payload;
        const player = draft.players[playerId];
        if (!player) return;

        const hostCard = zone === 'frontLine' ? player.frontLine[slotIndex] : player.energyLine[slotIndex];
        if (!hostCard || !hostCard.underCards || hostCard.underCards.length === 0) return;

        const underIndex = hostCard.underCards.findIndex((c) => c.id === underCardId);
        if (underIndex === -1) return;

        const validDestinations = [
          'hand',
          'graveyard',
          'removed',
          'life',
          'lifeFaceUp',
          'deckTop',
          'deckBottom',
          'frontLine',
          'energyLine',
        ];
        if (!validDestinations.includes(destination)) return;

        if (destination === 'frontLine' || destination === 'energyLine') {
          const targetSlots = destination === 'frontLine' ? player.frontLine : player.energyLine;
          const targetIndex =
            destSlotIndex !== undefined ? destSlotIndex : targetSlots.findIndex((c) => c === null);
          if (targetIndex === -1 || targetSlots[targetIndex] !== null) return;
        }

        const [separated] = hostCard.underCards.splice(underIndex, 1);
        const restored = resetCardState(separated);
        const hiddenUnderCard = separated.isFaceDown === true;

        if (destination === 'hand') {
          player.hand.push(restored);
          appendLog(draft, `${player.name} が「${hostCard.name}」の下から${cardLogLabel(restored, !hiddenUnderCard)}を手札に戻しました。`, playerId);
        } else if (destination === 'graveyard') {
          player.graveyard.push(restored);
          appendLog(draft, `${player.name} が「${hostCard.name}」の下から「${restored.name}」を場外へ送りました。`, playerId);
        } else if (destination === 'removed') {
          player.removed.push(restored);
          appendLog(draft, `${player.name} が「${hostCard.name}」の下から「${restored.name}」を除外（リムーブエリア）しました。`, playerId);
        } else if (destination === 'life' || destination === 'lifeFaceUp') {
          const isFaceDown = destination === 'life';
          player.life.unshift({ ...restored, isFaceDown });
          appendLog(
            draft,
            `${player.name} が「${hostCard.name}」の下から${cardLogLabel(restored, !hiddenUnderCard || !isFaceDown)}をライフに${isFaceDown ? '裏向き' : '表向き'}で置きました。`,
            playerId
          );
        } else if (destination === 'deckTop') {
          player.deck.unshift(restored);
          appendLog(draft, `${player.name} が「${hostCard.name}」の下から${cardLogLabel(restored, !hiddenUnderCard)}を山札の上へ置きました。`, playerId);
        } else if (destination === 'deckBottom') {
          player.deck.push(restored);
          appendLog(draft, `${player.name} が「${hostCard.name}」の下から${cardLogLabel(restored, !hiddenUnderCard)}を山札の下へ置きました。`, playerId);
        } else if (destination === 'frontLine' || destination === 'energyLine') {
          const targetSlots = destination === 'frontLine' ? player.frontLine : player.energyLine;
          const targetIndex =
            destSlotIndex !== undefined ? destSlotIndex : targetSlots.findIndex((c) => c === null);

          if (targetIndex !== -1 && targetSlots[targetIndex] === null) {
            targetSlots[targetIndex] = { ...restored, isRested: true };
            appendLog(
              draft,
              `${player.name} が「${hostCard.name}」の下から「${restored.name}」を${
                destination === 'frontLine' ? 'フロント' : 'エナジー'
              }ライン枠${targetIndex + 1}に登場させました。`,
              playerId
            );
          }
        }
        break;
      }

      case 'SEPARATE_PARENT_CARD': {
        const { playerId, zone, slotIndex, destination } = action.payload;
        const player = draft.players[playerId];
        if (!player) return;

        const hostCard = zone === 'frontLine' ? player.frontLine[slotIndex] : player.energyLine[slotIndex];
        if (!hostCard || !hostCard.underCards || hostCard.underCards.length === 0) return;

        const validDestinations = [
          'hand',
          'graveyard',
          'removed',
          'deckTop',
          'deckBottom',
          'life',
          'lifeFaceUp',
        ];
        if (!validDestinations.includes(destination)) return;

        const underCards = [...hostCard.underCards];
        // 直下にあったカード（末尾の1枚）を新たなフィールド上のカードとして昇格させる
        const newTopCard = underCards.pop()!;
        newTopCard.underCards = underCards;
        newTopCard.isRested = hostCard.isRested; // 状態（レスト/アクティブ）を引き継ぐ
        newTopCard.isFrozen = hostCard.isFrozen;
        newTopCard.isMarker = undefined;

        if (zone === 'frontLine') {
          player.frontLine[slotIndex] = newTopCard;
        } else {
          player.energyLine[slotIndex] = newTopCard;
        }

        // 親カードを分離して指定先へ送る
        const separatedCard = { ...hostCard, underCards: [] };
        const restored = resetCardState(separatedCard);

        let destName = '';
        if (destination === 'hand') {
          player.hand.push(restored);
          destName = '手札';
        } else if (destination === 'graveyard') {
          player.graveyard.push(restored);
          destName = '場外';
        } else if (destination === 'removed') {
          player.removed.push(restored);
          destName = 'リムーブエリア（除外）';
        } else if (destination === 'deckTop') {
          player.deck.unshift(restored);
          destName = '山札の上';
        } else if (destination === 'deckBottom') {
          player.deck.push(restored);
          destName = '山札の下';
        } else if (destination === 'life' || destination === 'lifeFaceUp') {
          const isFaceDown = destination === 'life';
          player.life.unshift({ ...restored, isFaceDown });
          destName = `ライフ（${isFaceDown ? '裏向き' : '表向き'}）`;
        }

        appendLog(
          draft,
          `${player.name} が上のカード「${hostCard.name}」を分離して${destName}へ移動しました。下の${cardLogLabel(newTopCard, newTopCard.isFaceDown !== true)}がフィールドに残ります。`,
          playerId,
          'action'
        );
        break;
      }

      case 'TOGGLE_REST': {
        const { playerId, zone, slotIndex } = action.payload;
        const player = draft.players[playerId];
        if (!player) return;

        const card = zone === 'frontLine' ? player.frontLine[slotIndex] : player.energyLine[slotIndex];
        if (card) {
          card.isRested = !card.isRested;
          const status = card.isRested ? 'レスト' : 'アクティブ';
          appendLog(draft, `${player.name} が「${card.name}」を${status}にしました。`, playerId);
        }
        break;
      }

      case 'TOGGLE_FREEZE': {
        const { playerId, zone, slotIndex } = action.payload;
        const player = draft.players[playerId];
        if (!player) return;

        const card = zone === 'frontLine' ? player.frontLine[slotIndex] : player.energyLine[slotIndex];
        if (card) {
          card.isFrozen = !card.isFrozen;
          const status = card.isFrozen ? 'フリーズ（次回アクティブ不可）' : 'フリーズ解除';
          appendLog(draft, `${player.name} が「${card.name}」を ${status} に設定しました。`, playerId);
        }
        break;
      }

      case 'SET_ALL_ACTIVE': {
        const { playerId } = action.payload;
        const player = draft.players[playerId];
        if (!player) return;

        player.frontLine.forEach((card) => {
          if (card && activateCard(card)) {
            appendLog(draft, `「${card.name}」はフリーズ状態のためアクティブになりませんでした（フリーズ解除）。`, playerId, 'system');
          }
        });
        player.energyLine.forEach((card) => {
          if (card && activateCard(card)) {
            appendLog(draft, `「${card.name}」はフリーズ状態のためアクティブになりませんでした（フリーズ解除）。`, playerId, 'system');
          }
        });
        player.apArea.forEach((card) => {
          card.isRested = false;
        });

        appendLog(
          draft,
          `🔄【リロール】${player.name} が自陣のカード・APをアクティブにしました。`,
          playerId
        );
        break;
      }

      case 'ADD_MARKER': {
        const { playerId, targetZone, targetSlotIndex, from, isFaceDown = true } = action.payload;
        const player = draft.players[playerId];
        if (!player) return;

        const hostCard = targetZone === 'frontLine' ? player.frontLine[targetSlotIndex] : player.energyLine[targetSlotIndex];
        if (!hostCard) return;

        let markerCard: Card | null = null;
        if (from === 'topDeck') {
          if (player.deck.length > 0) {
            markerCard = player.deck.shift()!;
          }
        } else if (typeof from === 'object' && from.zone === 'hand') {
          if (from.index >= 0 && from.index < player.hand.length) {
            markerCard = player.hand.splice(from.index, 1)[0];
          }
        }

        if (markerCard) {
          if (!hostCard.underCards) hostCard.underCards = [];
          hostCard.underCards.push({
            ...resetCardState(markerCard),
            isFaceDown,
            isMarker: true,
          });
          appendLog(
            draft,
            `${player.name} が「${hostCard.name}」の下にカードを1枚マーカーとして置きました（現在 ${hostCard.underCards.length} 枚）。`,
            playerId
          );
        }
        break;
      }

      case 'RECOVER_LIFE': {
        const { playerId, count = 1, isFaceDown = true } = action.payload;
        const player = draft.players[playerId];
        if (!player || !Number.isInteger(count) || count <= 0 || player.deck.length === 0) return;

        const addCount = Math.min(count, player.deck.length);
        for (let i = 0; i < addCount; i++) {
          const card = player.deck.shift()!;
          player.life.unshift({ ...resetCardState(card), isFaceDown });
        }
        appendLog(
          draft,
          `${player.name} が山札の上からライフに${isFaceDown ? '裏向き' : '表向き'}で ${addCount} 枚置きました（現在ライフ: ${player.life.length}）。`,
          playerId
        );
        break;
      }

      case 'TAKE_LIFE': {
        const { playerId, destination, lifeIndex = 0 } = action.payload;
        const player = draft.players[playerId];
        if (
          !player ||
          !Number.isInteger(lifeIndex) ||
          lifeIndex < 0 ||
          lifeIndex >= player.life.length
        ) return;

        const card = player.life.splice(lifeIndex, 1)[0];
        const wasFaceDown = card.isFaceDown !== false;
        const restored = resetCardState(card);

        if (destination === 'hand') {
          player.hand.push(restored);
          appendLog(draft, `${player.name} がライフから${cardLogLabel(restored, !wasFaceDown)}を手札に加えました（現在ライフ: ${player.life.length}）。`, playerId);
        } else if (destination === 'graveyard') {
          player.graveyard.push(restored);
          appendLog(draft, `${player.name} がライフから「${restored.name}」を場外へ置きました（現在ライフ: ${player.life.length}）。`, playerId);
        } else if (destination === 'deckTop') {
          player.deck.unshift(restored);
          appendLog(draft, `${player.name} がライフから${cardLogLabel(restored, !wasFaceDown)}を山札の上へ置きました（現在ライフ: ${player.life.length}）。`, playerId);
        } else if (destination === 'deckBottom') {
          player.deck.push(restored);
          appendLog(draft, `${player.name} がライフから${cardLogLabel(restored, !wasFaceDown)}を山札の下へ置きました（現在ライフ: ${player.life.length}）。`, playerId);
        }

        if (player.life.length === 0) {
          appendLog(
            draft,
            `👑【ライフ0】${player.name} のライフが 0 枚になりました（公式ルール上は敗北条件を満たします）。※ファイナルトリガー解決や手動でのライフ回復・リセットが可能です。`,
            playerId,
            'system'
          );
        }
        break;
      }

      case 'REORDER_LIFE': {
        const { playerId, newLifeCards } = action.payload;
        const player = draft.players[playerId];
        if (!player || !Array.isArray(newLifeCards) || newLifeCards.length !== player.life.length) return;

        const currentIds = player.life.map((c) => c.id).sort();
        const newIds = newLifeCards.map((c) => c.id).sort();
        if (!currentIds.every((id, idx) => id === newIds[idx])) return;

        player.life = newLifeCards;
        appendLog(draft, `${player.name} がライフエリアのカード（${newLifeCards.length}枚）を並び替えました。`, playerId);
        break;
      }

      case 'FLIP_LIFE': {
        const { playerId } = action.payload;
        const lifeIndex = action.payload.lifeIndex ?? (action.payload as { index?: number }).index ?? 0;
        const player = draft.players[playerId];
        if (!player || player.life.length === 0) return;

        const idx = Math.min(Math.max(0, lifeIndex), player.life.length - 1);
        const targetLife = player.life[idx];
        const currentFaceDown = targetLife.isFaceDown !== false; // デフォルトは裏向き
        targetLife.isFaceDown = !currentFaceDown;
        const stateStr = targetLife.isFaceDown ? '裏向き' : '表向き';
        appendLog(
          draft,
          `${player.name} がライフのカード（${targetLife.isFaceDown ? '非公開' : targetLife.name}）を${stateStr}にしました。`,
          playerId
        );
        break;
      }

      case 'DISCARD_ALL_HAND': {
        const { playerId } = action.payload;
        const player = draft.players[playerId];
        if (!player || player.hand.length === 0) return;

        const count = player.hand.length;
        const discarded = player.hand.splice(0, count);
        discarded.forEach((c) => player.graveyard.push(resetCardState(c)));
        appendLog(draft, `${player.name} が手札すべて（${count}枚）を場外に置きました。`, playerId);
        break;
      }

      case 'DISCARD_HAND_CARD': {
        const { playerId, index } = action.payload;
        const player = draft.players[playerId];
        if (!player || player.hand.length === 0) return;

        const targetIdx = index !== undefined ? index : Math.floor(Math.random() * player.hand.length);
        if (targetIdx < 0 || targetIdx >= player.hand.length) return;

        const discarded = player.hand.splice(targetIdx, 1)[0];
        player.graveyard.push(resetCardState(discarded));
        appendLog(
          draft,
          `${player.name} の手札から「${discarded.name}」が場外に置かれました（残り手札: ${player.hand.length}枚）。`,
          playerId
        );
        break;
      }

      case 'REVEAL_TOP_DECK_CARD': {
        const { playerId, reveal } = action.payload;
        const player = draft.players[playerId];
        if (!player || player.deck.length === 0) return;

        const shouldReveal = reveal !== undefined ? reveal : !player.revealedTopDeckCard;
        if (shouldReveal) {
          player.revealedTopDeckCard = { ...resetCardState(player.deck[0]), isFaceDown: false };
          appendLog(draft, `${player.name} の山札の一番上「${player.deck[0].name}」が表向きになりました。`, playerId);
        } else {
          player.revealedTopDeckCard = null;
          appendLog(draft, `${player.name} の山札の一番上が裏向きに戻りました。`, playerId);
        }
        break;
      }

      case 'BOTTOM_DECK_ACTION': {
        const { playerId, action: bottomAction } = action.payload;
        const player = draft.players[playerId];
        if (!player || player.deck.length === 0) return;

        if (bottomAction === 'view') {
          const bottomCard = player.deck[player.deck.length - 1];
          draft.revealedCard = {
            card: { ...resetCardState(bottomCard), isFaceDown: false },
            source: '山札の下（公開・確認）',
            fromPlayerId: playerId,
            isTrigger: false,
          };
          appendLog(draft, `${player.name} が山札の一番下のカード「${bottomCard.name}」を確認・公開しました。`, playerId);
        } else if (bottomAction === 'mill') {
          const bottomCard = player.deck.pop()!;
          player.graveyard.push(resetCardState(bottomCard));
          appendLog(draft, `${player.name} が山札の一番下のカード「${bottomCard.name}」を場外に置きました。`, playerId);
        } else if (bottomAction === 'toHand') {
          const bottomCard = player.deck.pop()!;
          player.hand.push(resetCardState(bottomCard));
          appendLog(draft, `${player.name} が山札の一番下のカードを手札に加えました（非公開）。`, playerId);
        }
        break;
      }

      case 'MODIFY_BP': {
        const { playerId, zone, slotIndex, delta } = action.payload;
        const player = draft.players[playerId];
        if (!player || !Number.isInteger(delta)) return;

        const card = zone === 'frontLine' ? player.frontLine[slotIndex] : player.energyLine[slotIndex];
        if (card) {
          card.bpModifier = (card.bpModifier || 0) + delta;
          const sign = delta >= 0 ? `+${delta}` : `${delta}`;
          appendLog(draft, `${player.name} が「${card.name}」のBPを ${sign} しました（現在BP: ${(card.bp || 0) + card.bpModifier}）。`, playerId);
        }
        break;
      }

      case 'MODIFY_ENERGY': {
        const { playerId, zone, slotIndex, delta } = action.payload;
        const player = draft.players[playerId];
        if (!player || zone !== 'energyLine' || !Number.isInteger(delta) || delta === 0) return;
        const card = player.energyLine[slotIndex];
        if (!card || card.isFaceDown || card.genEnergy + (card.genEnergyModifier || 0) + delta < 0) return;
        card.genEnergyModifier = (card.genEnergyModifier || 0) + delta;
        const sign = delta > 0 ? `+${delta}` : `${delta}`;
        appendLog(draft, `${player.name} が「${card.name}」の発生エナジーを ${sign} しました（現在: ${card.genEnergy + card.genEnergyModifier}）。`, playerId);
        break;
      }

      case 'MODIFY_FRONT_ENERGY': {
        const { playerId, slotIndex, delta } = action.payload;
        const player = draft.players[playerId];
        if (!player || !Number.isInteger(delta) || delta === 0) return;
        const card = player.frontLine[slotIndex];
        if (!card || card.isFaceDown || (card.frontLineGeneratedEnergy || 0) + delta < 0) return;
        card.frontLineGeneratedEnergy = (card.frontLineGeneratedEnergy || 0) + delta;
        const sign = delta > 0 ? `+${delta}` : `${delta}`;
        appendLog(draft, `${player.name} が「${card.name}」のフロントラインでの発生エナジーを ${sign} しました（現在: ${card.frontLineGeneratedEnergy}）。`, playerId);
        break;
      }

      case 'RAID_CARD': {
        const { playerId, targetZone, targetSlotIndex, raidCard, fromLocation, moveToFront } = action.payload;
        const player = draft.players[playerId];
        if (!player) return;

        const targetCard = targetZone === 'frontLine' ? player.frontLine[targetSlotIndex] : player.energyLine[targetSlotIndex];
        // 公式ルール: レイドはキャラクターカードの上に重ねて登場させる（フィールドの上にレイド不可、フィールドやイベントのレイド不可）
        if (!targetCard || targetCard.cardType !== 'CHARACTER' || raidCard.cardType !== 'CHARACTER') return;

        // レイド元から引っこ抜く（カード実在性・ID一致を保証）
        const removedRaidCard = removeCardFromLocation(
          draft.players[fromLocation.playerId],
          fromLocation,
          raidCard.id
        );
        if (!removedRaidCard) return;

        const cleanTargetCard: Card = { ...targetCard, underCards: [], isMarker: false, frontLineGeneratedEnergy: 0 };
        // 下敷きカードのすべての要素も確実に underCards: [] にフラット化
        const flattenedExistingUnders = (targetCard.underCards || []).map((c) => ({
          ...c,
          underCards: [],
          frontLineGeneratedEnergy: 0,
        }));
        // 公式ルール P12: 「レストの場合、アクティブにする」「エナジーLにある場合、フロントLへ移動できる」
        const newRaidCard: Card = {
          ...raidCard,
          isRested: false, // レイド登場時は強制アクティブ化！
          frontLineGeneratedEnergy: 0,
          underCards: [...flattenedExistingUnders, cleanTargetCard],
        };

        if (targetZone === 'energyLine' && moveToFront) {
          // エナジーLからフロントLの空き枠へ移動
          const emptyFrontIndex = player.frontLine.findIndex((c) => c === null);
          if (emptyFrontIndex !== -1) {
            player.energyLine[targetSlotIndex] = null;
            player.frontLine[emptyFrontIndex] = newRaidCard;
            appendLog(draft, `${player.name} が「${targetCard.name}」の上に「${raidCard.name}」をレイドし、アクティブ状態でフロントL枠${emptyFrontIndex + 1}へ移動させました！`, playerId);
            return;
          }
        }

        if (targetZone === 'frontLine') {
          player.frontLine[targetSlotIndex] = newRaidCard;
        } else {
          player.energyLine[targetSlotIndex] = newRaidCard;
        }

        appendLog(draft, `${player.name} が「${targetCard.name}」の上に「${raidCard.name}」を【レイド】しました！（アクティブ状態）`, playerId);
        break;
      }

      case 'DRAW_CARD': {
        const { playerId, count = 1 } = action.payload;
        const player = draft.players[playerId];
        if (!player || !Number.isInteger(count) || count <= 0) return;

        if (player.deck.length === 0) {
          appendLog(
            draft,
            `👑【山札0枚】${player.name} は山札が 0 枚のためカードを引けませんでした（公式ルール上は敗北条件を満たします）。※手動での山札回復・リセットが可能です。`,
            playerId,
            'system'
          );
          return;
        }

        let drawnCount = 0;
        let deckRanOut = false;
        for (let i = 0; i < count; i++) {
          if (player.deck.length > 0) {
            const card = player.deck.shift()!;
            player.hand.push(resetCardState(card));
            drawnCount++;
          } else {
            deckRanOut = true;
          }
        }
        player.revealedTopDeckCard = null;

        if (drawnCount > 0) {
          appendLog(draft, `${player.name} が山札から ${drawnCount} 枚引きました（手札: ${player.hand.length}枚、山札: ${player.deck.length}枚）。`, playerId);
        }
        if (deckRanOut) {
          appendLog(
            draft,
            `👑【山札0枚】${player.name} はドロー中に山札が 0 枚になり、指定された枚数を引ききれませんでした（公式ルール上は敗北条件を満たします）。※手動での山札回復・リセットが可能です。`,
            playerId,
            'system'
          );
        }
        break;
      }

      case 'EXTRA_DRAW': {
        const { playerId } = action.payload;
        const player = draft.players[playerId];
        if (!player || player.apCurrent < 1 || player.hasExtraDrawn) return;

        if (player.deck.length === 0) {
          appendLog(
            draft,
            `👑【山札0枚】${player.name} は山札が 0 枚のためエクストラドローを行えませんでした（公式ルール上は敗北条件を満たします）。※手動での山札回復・リセットが可能です。`,
            playerId,
            'system'
          );
          return;
        }

        player.apCurrent -= 1;
        player.hasExtraDrawn = true;
        const card = player.deck.shift()!;
        player.hand.push(resetCardState(card));

        appendLog(draft, `${player.name} が1APを支払い、エクストラドローを行いました（手札: ${player.hand.length}枚、残りAP: ${player.apCurrent}）。`, playerId, 'action');
        break;
      }

      case 'CHECK_LIFE_TRIGGER': {
        const { playerId, lifeIndex } = action.payload;
        const player = draft.players[playerId];
        if (!player || player.life.length === 0 || draft.revealedCard) return;

        const idx = Math.min(Math.max(0, lifeIndex ?? 0), player.life.length - 1);
        const [selectedLife] = player.life.splice(idx, 1);
        selectedLife.isFaceDown = false;
        draft.revealedCard = {
          card: selectedLife,
          source: `ライフ${idx + 1}枚目（トリガーチェック）`,
          fromPlayerId: playerId,
          isTrigger: true,
        };

        const triggerStr = selectedLife.triggers.length > 0 ? `【トリガー: ${selectedLife.triggers.join(', ')}】` : '（トリガーなし）';
        appendLog(draft, `${player.name} がライフ（${idx + 1}枚目）から「${selectedLife.name}」をトリガーチェックしました！ ${triggerStr}`, playerId, 'system');
        break;
      }

      case 'DECLARE_PLAYER_ATTACK': {
        const {
          actorPlayerId,
          attackerZone,
          attackerSlotIndex,
          defenderPlayerId,
        } = action.payload;
        const attackerPlayer = draft.players[actorPlayerId];
        const defenderPlayer = draft.players[defenderPlayerId];
        const attacker = attackerPlayer?.[attackerZone][attackerSlotIndex];
        if (
          draft.pendingCombat ||
          draft.status !== 'PLAYING' ||
          draft.phase === 'END' ||
          draft.activePlayerId !== actorPlayerId ||
          actorPlayerId === defenderPlayerId ||
          !attackerPlayer ||
          !defenderPlayer ||
          !attacker ||
          attacker.cardType !== 'CHARACTER' ||
          attacker.isRested ||
          (draft.turn === 1 && attackerPlayer.isFirst)
        ) return;

        draft.phase = 'ATTACK';
        attacker.isRested = true;
        const attackerBp = (attacker.bp ?? 0) + attacker.bpModifier;
        draft.pendingCombat = {
          stage: 'BLOCK_DECISION',
          attackerPlayerId: actorPlayerId,
          attackerZone,
          attackerSlotIndex,
          defenderPlayerId,
          attackerCardName: attacker.name,
          attackerBp,
        };
        appendLog(
          draft,
          `⚔️【アタック宣言】${attackerPlayer.name}の「${attacker.name}」(BP${attackerBp}) が ${defenderPlayer.name} にアタックしました！相手はブロックするか選択してください。`,
          actorPlayerId
        );
        break;
      }

      case 'ATTACK_CHARACTER': {
        const {
          actorPlayerId,
          attackerZone,
          attackerSlotIndex,
          targetPlayerId,
          targetSlotIndex,
        } = action.payload;
        const attackerPlayer = draft.players[actorPlayerId];
        const targetPlayer = draft.players[targetPlayerId];
        const attacker = attackerPlayer?.[attackerZone][attackerSlotIndex];
        const defender = targetPlayer?.frontLine[targetSlotIndex];
        if (
          draft.pendingCombat ||
          draft.status !== 'PLAYING' ||
          draft.phase === 'END' ||
          draft.activePlayerId !== actorPlayerId ||
          actorPlayerId === targetPlayerId ||
          !attackerPlayer ||
          !targetPlayer ||
          !attacker ||
          !defender ||
          attacker.cardType !== 'CHARACTER' ||
          defender.cardType !== 'CHARACTER' ||
          attacker.isRested ||
          (draft.turn === 1 && attackerPlayer.isFirst)
        ) return;

        attacker.isRested = true;
        const attackerBp = (attacker.bp ?? 0) + attacker.bpModifier;
        const defenderBp = (defender.bp ?? 0) + defender.bpModifier;
        const battle = calculateBattleResult(attackerBp, defenderBp, attacker.name, defender.name);

        appendLog(
          draft,
          `⚔️【狙い撃ち / バトル解決】${attackerPlayer.name}の「${attacker.name}」(BP${attackerBp}) VS ${targetPlayer.name}の「${defender.name}」(BP${defenderBp}) ➔ ${battle.logMessage}`,
          actorPlayerId,
          'action'
        );

        if (battle.shouldRetireDefender) {
          const [retired] = targetPlayer.frontLine.splice(targetSlotIndex, 1, null);
          if (retired) {
            const underCards = retired.underCards || [];
            targetPlayer.graveyard.push(resetCardState(retired));
            underCards.forEach((underCard) => {
              targetPlayer.graveyard.push(resetCardState(underCard));
            });
            if (underCards.length > 0) {
              appendLog(
                draft,
                `「${retired.name}」の退場に伴い、下敷きのレイド元カード ${underCards.length} 枚（${underCards.map((c) => c.name).join(', ')}）が場外へ移動しました。`,
                targetPlayerId,
                'system'
              );
            }
          }
        }

        if (battle.shouldRetireAttacker) {
          const [retired] = attackerPlayer[attackerZone].splice(attackerSlotIndex, 1, null);
          if (retired) {
            const underCards = retired.underCards || [];
            attackerPlayer.graveyard.push(resetCardState(retired));
            underCards.forEach((underCard) => {
              attackerPlayer.graveyard.push(resetCardState(underCard));
            });
            if (underCards.length > 0) {
              appendLog(
                draft,
                `「${retired.name}」の退場に伴い、下敷きのレイド元カード ${underCards.length} 枚（${underCards.map((c) => c.name).join(', ')}）が場外へ移動しました。`,
                actorPlayerId,
                'system'
              );
            }
          }
        }
        break;
      }

      case 'PASS_BLOCK': {
        const combat = draft.pendingCombat;
        if (
          !combat ||
          combat.stage !== 'BLOCK_DECISION' ||
          action.payload.actorPlayerId !== combat.defenderPlayerId
        ) return;

        const defender = draft.players[combat.defenderPlayerId];
        if (!defender) return;

        // 相手ライフが0枚の場合、ライフ選択には移行せず戦闘を解除し、敗北通知を出力（手動リセット/回復可能）
        if (defender.life.length === 0) {
          draft.pendingCombat = null;
          appendLog(
            draft,
            `🛡️【ノーブロック】${defender.name} はアタックを通しました（現在ライフ 0 枚）。公式ルール上は既に敗北条件を満たしています。（※ファイナルトリガー等の解決や手動でのライフ回復・リセットが可能です）`,
            combat.defenderPlayerId,
            'system'
          );
          break;
        }

        combat.stage = 'LIFE_SELECTION';
        appendLog(
          draft,
          `🛡️【ノーブロック】${defender.name} はブロックせずアタックを通しました。攻撃側がライフを選択します。`,
          combat.defenderPlayerId
        );
        break;
      }

      case 'BLOCK_ATTACK': {
        const combat = draft.pendingCombat;
        if (
          !combat ||
          combat.stage !== 'BLOCK_DECISION' ||
          action.payload.actorPlayerId !== combat.defenderPlayerId
        ) return;

        const attackerPlayer = draft.players[combat.attackerPlayerId];
        const blockerPlayer = draft.players[combat.defenderPlayerId];
        const attacker = attackerPlayer?.[combat.attackerZone][combat.attackerSlotIndex];
        const blocker = blockerPlayer?.frontLine[action.payload.blockerSlotIndex];
        if (!attackerPlayer || !blockerPlayer || !attacker || !blocker || blocker.cardType !== 'CHARACTER' || blocker.isRested) return;

        blocker.isRested = true;
        const blockerBp = (blocker.bp ?? 0) + blocker.bpModifier;
        const battle = calculateBattleResult(
          combat.attackerBp,
          blockerBp,
          combat.attackerCardName,
          blocker.name
        );
        appendLog(
          draft,
          `🛡️【ブロック解決】${blockerPlayer.name}の「${blocker.name}」(BP${blockerBp}) がブロック！ VS ${attackerPlayer.name}の「${combat.attackerCardName}」(BP${combat.attackerBp}) ➔ ${battle.logMessage}`,
          combat.defenderPlayerId
        );
        if (battle.shouldRetireDefender) {
          const [retired] = blockerPlayer.frontLine.splice(action.payload.blockerSlotIndex, 1, null);
          if (retired) {
            const underCards = retired.underCards || [];
            blockerPlayer.graveyard.push(resetCardState(retired));
            underCards.forEach((underCard) => {
              blockerPlayer.graveyard.push(resetCardState(underCard));
            });
            if (underCards.length > 0) {
              appendLog(
                draft,
                `「${retired.name}」の退場に伴い、下敷きのレイド元カード ${underCards.length} 枚（${underCards.map((c) => c.name).join(', ')}）が場外へ移動しました。`,
                combat.defenderPlayerId,
                'system'
              );
            }
          }
        }
        if (battle.shouldRetireAttacker) {
          const [retired] = attackerPlayer[combat.attackerZone].splice(combat.attackerSlotIndex, 1, null);
          if (retired) {
            const underCards = retired.underCards || [];
            attackerPlayer.graveyard.push(resetCardState(retired));
            underCards.forEach((underCard) => {
              attackerPlayer.graveyard.push(resetCardState(underCard));
            });
            if (underCards.length > 0) {
              appendLog(
                draft,
                `「${retired.name}」の退場に伴い、下敷きのレイド元カード ${underCards.length} 枚（${underCards.map((c) => c.name).join(', ')}）が場外へ移動しました。`,
                combat.attackerPlayerId,
                'system'
              );
            }
          }
        }
        draft.pendingCombat = null;
        break;
      }

      case 'CANCEL_PLAYER_ATTACK': {
        const combat = draft.pendingCombat;
        if (!combat || action.payload.actorPlayerId !== combat.attackerPlayerId) return;
        const attacker = draft.players[combat.attackerPlayerId]?.[combat.attackerZone][combat.attackerSlotIndex];
        if (attacker) attacker.isRested = false;
        draft.pendingCombat = null;
        appendLog(draft, 'アタックを取り消しました。', combat.attackerPlayerId);
        break;
      }

      case 'SELECT_LIFE_FOR_DAMAGE': {
        const combat = draft.pendingCombat;
        if (
          !combat ||
          combat.stage !== 'LIFE_SELECTION' ||
          action.payload.actorPlayerId !== combat.attackerPlayerId ||
          !Number.isInteger(action.payload.lifeIndex) ||
          draft.revealedCard
        ) return;
        const defender = draft.players[combat.defenderPlayerId];
        if (
          !defender ||
          action.payload.lifeIndex < 0 ||
          action.payload.lifeIndex >= defender.life.length
        ) return;

        const [selectedLife] = defender.life.splice(action.payload.lifeIndex, 1);
        selectedLife.isFaceDown = false;
        draft.revealedCard = {
          card: selectedLife,
          source: `ライフ${action.payload.lifeIndex + 1}枚目（トリガーチェック）`,
          fromPlayerId: combat.defenderPlayerId,
          isTrigger: true,
        };
        draft.pendingCombat = null;
        const triggerStr = selectedLife.triggers.length > 0
          ? `【トリガー: ${selectedLife.triggers.join(', ')}】`
          : '（トリガーなし）';
        appendLog(
          draft,
          `${draft.players[combat.attackerPlayerId]?.name ?? combat.attackerPlayerId} が ${defender.name} のライフ（${action.payload.lifeIndex + 1}枚目）を選択し、「${selectedLife.name}」をトリガーチェックしました！ ${triggerStr}`,
          combat.attackerPlayerId,
          'system'
        );
        break;
      }

      case 'DISMISS_REVEALED_CARD': {
        const { destination, actorPlayerId } = action.payload;
        if (!draft.revealedCard) return;

        const { card, fromPlayerId, isTrigger } = draft.revealedCard;
        if (actorPlayerId && fromPlayerId && actorPlayerId !== fromPlayerId && destination !== 'life') return;
        const player = draft.players[fromPlayerId];

        // isTrigger === false の場合（山札下の公開・確認など）、カードは元のゾーンに存在するため複製・移動を行わない
        if (isTrigger === false) {
          draft.revealedCard = null;
          break;
        }

        if (player) {
          if (destination === 'graveyard') {
            // 公式ルール P12: トリガー処理後は原則「場外」
            player.graveyard.push(resetCardState(card));
            appendLog(draft, `${player.name} はトリガーカードを場外へ送りました。`, fromPlayerId);
          } else if (destination === 'hand') {
            // ゲットトリガー等による手札回収
            player.hand.push(resetCardState(card));
            appendLog(draft, `${player.name} はカードを手札に加えました。`, fromPlayerId);
          } else if (destination === 'life') {
            player.life.unshift({ ...card, isFaceDown: true });
            const actorName = actorPlayerId && draft.players[actorPlayerId] ? draft.players[actorPlayerId].name : player.name;
            appendLog(draft, `${actorName} はカードをライフトップに戻しました。`, actorPlayerId ?? fromPlayerId);
          }

          if (player.life.length === 0) {
            appendLog(
              draft,
              `👑【ライフ0】${player.name} のライフが 0 枚になりました（公式ルール上は敗北条件を満たします）。※ファイナルトリガー解決や手動でのライフ回復・リセットが可能です。`,
              fromPlayerId,
              'system'
            );
          }
        }

        draft.revealedCard = null;
        break;
      }

      case 'USE_AP': {
        const { playerId, amount = 1 } = action.payload;
        const player = draft.players[playerId];
        if (!player || !Number.isInteger(amount) || amount <= 0 || amount > player.apCurrent) return;

        const prev = player.apCurrent;
        player.apCurrent -= amount;
        appendLog(draft, `${player.name} が AP を ${amount} 消費しました (${prev} → ${player.apCurrent})。`, playerId);
        break;
      }

      case 'RECOVER_AP': {
        const { playerId, amount } = action.payload;
        const player = draft.players[playerId];
        if (!player || (amount !== undefined && (!Number.isInteger(amount) || amount <= 0))) return;

        const prev = player.apCurrent;
        if (amount !== undefined) {
          player.apCurrent = Math.min(player.apMax, player.apCurrent + amount);
        } else {
          player.apCurrent = player.apMax;
        }
        appendLog(draft, `${player.name} が AP を回復しました (${prev} → ${player.apCurrent})。`, playerId);
        break;
      }

      case 'SHUFFLE_DECK': {
        const { playerId } = action.payload;
        const player = draft.players[playerId];
        if (!player) return;

        player.deck = shuffleCards(player.deck);
        player.revealedTopDeckCard = null;
        appendLog(draft, `${player.name} が山札をシャッフルしました。`, playerId);
        break;
      }

      case 'SET_PHASE': {
        if (draft.pendingCombat) return;
        const { phase, actorPlayerId } = action.payload;
        if (actorPlayerId && actorPlayerId !== draft.activePlayerId) return;
        draft.phase = phase;

        // 公式ルール P13: エンドフェイズ突入時、自陣の全カード（キャラ・フィールド）をアクティブ化し一時BP補正を解除
        if (phase === 'END') {
          const activePlayer = draft.players[draft.activePlayerId];
          if (activePlayer) {
            activePlayer.frontLine.forEach((c) => {
              if (c) {
                if (activateCard(c)) {
                  appendLog(draft, `「${c.name}」はフリーズ状態のためアクティブになりませんでした（フリーズ解除）。`, draft.activePlayerId, 'system');
                }
                c.bpModifier = 0;
              }
            });
            activePlayer.energyLine.forEach((c) => {
              if (c) {
                if (activateCard(c)) {
                  appendLog(draft, `「${c.name}」はフリーズ状態のためアクティブになりませんでした（フリーズ解除）。`, draft.activePlayerId, 'system');
                }
                c.bpModifier = 0;
              }
            });
          }
        }

        appendLog(draft, `フェイズが「${phase}」に移行しました。`, draft.activePlayerId, 'phase');

        // 公式ルール Ver 1.1 8.5.1: エンドフェイズ突入時、手札が9枚以上の場合は8枚になるよう選んで場外に置く
        if (phase === 'END') {
          const activePlayer = draft.players[draft.activePlayerId];
          if (activePlayer && activePlayer.hand.length > 8) {
            const excess = activePlayer.hand.length - 8;
            appendLog(
              draft,
              `⚠️【手札上限超過】${activePlayer.name} の手札は現在 ${activePlayer.hand.length} 枚です。公式ルール（手札上限8枚）に従い、手札から ${excess} 枚選んで場外に置いてください。`,
              draft.activePlayerId,
              'system'
            );
          }
        }
        break;
      }

      case 'PASS_TURN': {
        const { playerId } = action.payload;
        if (draft.pendingCombat || playerId !== draft.activePlayerId || !draft.players[playerId]) return;
        const playerIds = Object.keys(draft.players);
        const nextPlayerId = playerIds.find((id) => id !== playerId) || playerId;
        const prevPlayer = draft.players[playerId] || draft.players[draft.activePlayerId];
        const nextPlayer = draft.players[nextPlayerId];

        // 公式ルール P13: エンドフェイズ処理（押し忘れ対応）
        // 手札上限超過チェック（エンドフェイズ押し忘れ時にも通知）
        if (prevPlayer && prevPlayer.hand.length > 8) {
          const excess = prevPlayer.hand.length - 8;
          appendLog(
            draft,
            `⚠️【手札上限超過】${prevPlayer.name} の手札は現在 ${prevPlayer.hand.length} 枚です。公式ルール（手札上限8枚）に従い、手札から ${excess} 枚選んで場外に置いてください。`,
            playerId,
            'system'
          );
        }

        // ターンを終えるプレイヤーの全カード（フロント・エナジー・AP）をすべてアクティブ化し、一時BP補正をリセット
        if (prevPlayer) {
          prevPlayer.frontLine.forEach((c) => {
            if (c) {
              if (activateCard(c)) {
                appendLog(draft, `「${c.name}」はフリーズ状態のためアクティブになりませんでした（フリーズ解除）。`, playerId, 'system');
              }
              c.bpModifier = 0;
            }
          });
          prevPlayer.energyLine.forEach((c) => {
            if (c) {
              if (activateCard(c)) {
                appendLog(draft, `「${c.name}」はフリーズ状態のためアクティブになりませんでした（フリーズ解除）。`, playerId, 'system');
              }
              c.bpModifier = 0;
            }
          });
          prevPlayer.apArea.forEach((c) => { c.isRested = false; });
        }

        // 両プレイヤーの残余BP補正もクリーンアップ
        Object.values(draft.players).forEach((p) => {
          p.frontLine.forEach((c) => { if (c) c.bpModifier = 0; });
          p.energyLine.forEach((c) => { if (c) c.bpModifier = 0; });
        });

        draft.turn += 1;
        draft.activePlayerId = nextPlayerId;
        draft.phase = 'START';

        if (nextPlayer) {
          // ラウンド数の計算 (turn 1,2 = round 1; turn 3,4 = round 2; turn 5+ = round 3+)
          const roundNumber = Math.ceil(draft.turn / 2);
          nextPlayer.apMax = calculateMaxAp(roundNumber, nextPlayer.isFirst);
          nextPlayer.apCurrent = nextPlayer.apMax;
          nextPlayer.hasExtraDrawn = false;

          // リロール: 全カードアクティブ化
          nextPlayer.frontLine.forEach((c) => {
            if (c && activateCard(c)) {
              appendLog(draft, `「${c.name}」はフリーズ状態のためアクティブになりませんでした（フリーズ解除）。`, nextPlayerId, 'system');
            }
          });
          nextPlayer.energyLine.forEach((c) => {
            if (c && activateCard(c)) {
              appendLog(draft, `「${c.name}」はフリーズ状態のためアクティブになりませんでした（フリーズ解除）。`, nextPlayerId, 'system');
            }
          });
          nextPlayer.apArea.forEach((c) => { c.isRested = false; });

          // 公式ルール P10: スタートフェイズのドロー（※先攻の1ターン目はドローなし）
          const isFirstTurnForFirstPlayer = draft.turn === 1 && nextPlayer.isFirst;
          if (!isFirstTurnForFirstPlayer) {
            if (nextPlayer.deck.length > 0) {
              const card = nextPlayer.deck.shift()!;
              nextPlayer.hand.push(resetCardState(card));
            } else {
              appendLog(
                draft,
                `👑【山札0枚】${nextPlayer.name} は山札が 0 枚のためスタートフェイズのドローができませんでした（公式ルール上は敗北条件を満たします）。※手動での山札回復・リセットが可能です。`,
                nextPlayerId,
                'system'
              );
            }
          }
        }

        appendLog(
          draft,
          `ターン ${draft.turn} 開始: ${nextPlayer?.name || nextPlayerId} のターン（リロール・AP${nextPlayer?.apMax}セット完了）。`,
          nextPlayerId,
          'phase'
        );
        break;
      }

      case 'LOOK_AT_TOP_DECK': {
        const { playerId, count } = action.payload;
        const player = draft.players[playerId];
        if (
          !player ||
          !Number.isInteger(count) ||
          count <= 0 ||
          player.deck.length === 0 ||
          draft.revealedDeckCards
        ) return;

        const actualCount = Math.min(count, player.deck.length);
        const cards = player.deck.splice(0, actualCount);
        draft.revealedDeckCards = {
          playerId,
          cards,
        };

        appendLog(draft, `${player.name} が山札の上から ${actualCount} 枚を確認しています。`, playerId, 'action');
        break;
      }

      case 'RESOLVE_TOP_DECK_CARD': {
        const { playerId, cardId, destination } = action.payload;
        if (!draft.revealedDeckCards || draft.revealedDeckCards.playerId !== playerId) return;

        const player = draft.players[playerId];
        if (!player) return;

        const cardIndex = draft.revealedDeckCards.cards.findIndex((c) => c.id === cardId);
        if (cardIndex === -1) return;

        const card = draft.revealedDeckCards.cards.splice(cardIndex, 1)[0];
        const cleanCard = resetCardState(card);

        if (destination === 'hand') {
          player.hand.push(cleanCard);
          appendLog(draft, `${player.name} は確認した「${card.name}」を手札に加えました。`, playerId);
        } else if (destination === 'handSecret') {
          player.hand.push(cleanCard);
          appendLog(draft, `${player.name} は確認したカードを手札に加えました（非公開）。`, playerId);
        } else if (destination === 'graveyard') {
          player.graveyard.push(cleanCard);
          appendLog(draft, `${player.name} は確認した「${card.name}」を場外に置きました。`, playerId);
        } else if (destination === 'top') {
          player.deck.unshift(cleanCard);
          appendLog(draft, `${player.name} は確認した非公開カードを山札の上に戻しました。`, playerId);
        } else if (destination === 'bottom') {
          player.deck.push(cleanCard);
          appendLog(draft, `${player.name} は確認した非公開カードを山札の下に置きました。`, playerId);
        } else if (destination === 'life' || destination === 'lifeFaceUp') {
          const isFaceDown = destination === 'life';
          player.life.unshift({ ...cleanCard, isFaceDown });
          appendLog(
            draft,
            `${player.name} は確認した${cardLogLabel(card, !isFaceDown)}をライフに${isFaceDown ? '裏向き' : '表向き'}で置きました。`,
            playerId
          );
        } else if (destination === 'frontLine' || destination === 'energyLine') {
          if (destination === 'frontLine' && cleanCard.cardType === 'FIELD') {
            player.hand.push(cleanCard);
            appendLog(draft, `${player.name} はフィールドカードのため「${card.name}」を手札に加えました（フロントL配置不可）。`, playerId);
            if (draft.revealedDeckCards.cards.length === 0) {
              draft.revealedDeckCards = null;
            }
            break;
          }
          const targetSlots = destination === 'frontLine' ? player.frontLine : player.energyLine;
          const targetIndex =
            action.payload.slotIndex !== undefined ? action.payload.slotIndex : targetSlots.findIndex((c) => c === null);
          if (targetIndex !== -1 && targetSlots[targetIndex] === null) {
            targetSlots[targetIndex] = { ...cleanCard, isRested: true };
            appendLog(
              draft,
              `${player.name} は確認した「${card.name}」を${
                destination === 'frontLine' ? 'フロント' : 'エナジー'
              }ライン枠${targetIndex + 1}に登場させました。`,
              playerId
            );
          } else {
            player.hand.push(cleanCard);
            appendLog(draft, `${player.name} は空き枠がないため「${card.name}」を手札に加えました。`, playerId);
          }
        }

        // 全て処理し終えたらモーダルを閉じる
        if (draft.revealedDeckCards.cards.length === 0) {
          draft.revealedDeckCards = null;
        }
        break;
      }

      case 'CLOSE_TOP_DECK': {
        const { playerId, shuffleRemaining } = action.payload;
        if (!draft.revealedDeckCards || draft.revealedDeckCards.playerId !== playerId) return;

        const player = draft.players[playerId];
        if (player && draft.revealedDeckCards.cards.length > 0) {
          // 残りのカードを山札の上に戻す
          const remainingCards = draft.revealedDeckCards.cards.map(resetCardState);
          player.deck.unshift(...remainingCards);
          if (shuffleRemaining) {
            player.deck = shuffleCards(player.deck);
            appendLog(draft, `${player.name} が山札をシャッフルしました。`, playerId);
          }
        }
        draft.revealedDeckCards = null;
        break;
      }

      case 'SEARCH_DECK_CARD': {
        const { playerId, cardId, destination, slotIndex } = action.payload;
        const player = draft.players[playerId];
        if (!player) return;

        const cardIdx = player.deck.findIndex((c) => c.id === cardId);
        if (cardIdx === -1) return;

        const card = player.deck.splice(cardIdx, 1)[0];
        const cleanCard = resetCardState(card);

        if (destination === 'hand') {
          player.hand.push(cleanCard);
          appendLog(draft, `${player.name} は山札から「${card.name}」を手札に加えました。`, playerId);
        } else if (destination === 'handSecret') {
          player.hand.push(cleanCard);
          appendLog(draft, `${player.name} は山札からカードを手札に加えました（非公開）。`, playerId);
        } else if (destination === 'graveyard') {
          player.graveyard.push(cleanCard);
          appendLog(draft, `${player.name} は山札から「${card.name}」を場外に送りました。`, playerId);
        } else if (destination === 'removed') {
          player.removed.push(cleanCard);
          appendLog(draft, `${player.name} は山札から「${card.name}」を除外（リムーブ）しました。`, playerId);
        } else if (destination === 'life') {
          player.life.unshift({ ...cleanCard, isFaceDown: true });
          appendLog(draft, `${player.name} は山札から非公開カードをライフに裏向きで置きました。`, playerId);
        } else if (destination === 'lifeFaceUp') {
          player.life.unshift({ ...cleanCard, isFaceDown: false });
          appendLog(draft, `${player.name} は山札から「${card.name}」をライフに表向きで置きました。`, playerId);
        } else if (destination === 'frontLine') {
          if (cleanCard.cardType === 'FIELD') {
            player.hand.push(cleanCard);
            appendLog(draft, `${player.name} はフィールドカードのため「${card.name}」を手札に加えました（フロントL配置不可）。`, playerId);
            break;
          }
          const emptyIndex = player.frontLine.findIndex((s) => s === null);
          const targetSlot = slotIndex !== undefined ? slotIndex : (emptyIndex >= 0 ? (emptyIndex as FieldSlotIndex) : null);
          if (targetSlot !== null && player.frontLine[targetSlot] === null) {
            player.frontLine[targetSlot] = { ...cleanCard, isRested: true };
            appendLog(draft, `${player.name} は山札から「${card.name}」をフロントL枠${targetSlot + 1}に登場させました。`, playerId);
          } else {
            player.hand.push(cleanCard);
            appendLog(draft, `${player.name} はフロントLに空きがないため「${card.name}」を手札に加えました。`, playerId);
          }
        } else if (destination === 'energyLine') {
          const emptyIndex = player.energyLine.findIndex((s) => s === null);
          const targetSlot = slotIndex !== undefined ? slotIndex : (emptyIndex >= 0 ? (emptyIndex as FieldSlotIndex) : null);
          if (targetSlot !== null && player.energyLine[targetSlot] === null) {
            player.energyLine[targetSlot] = { ...cleanCard, isRested: true };
            appendLog(draft, `${player.name} は山札から「${card.name}」をエナジーL枠${targetSlot + 1}に登場させました。`, playerId);
          } else {
            player.hand.push(cleanCard);
            appendLog(draft, `${player.name} はエナジーLに空きがないため「${card.name}」を手札に加えました。`, playerId);
          }
        }
        break;
      }

      case 'ROLL_DICE': {
        const { playerId } = action.payload;
        const player = draft.players[playerId];
        const val = Math.floor(Math.random() * 6) + 1;
        appendLog(draft, `🎲 ${player?.name || playerId} がダイスを振りました: 【 ${val} 】`, playerId, 'system');
        break;
      }

      case 'ADD_LOG': {
        const { message, playerId, type } = action.payload;
        appendLog(draft, message, playerId, type);
        break;
      }

      case 'CHAT_MESSAGE': {
        const { senderId, senderName, text } = action.payload;
        draft.logs.push({
          id: `chat-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          timestamp: Date.now(),
          playerId: senderId,
          playerName: senderName,
          message: text,
          type: 'chat',
        });
        break;
      }

      case 'SYNC_STATE': {
        return action.payload.state;
      }

      default:
        break;
    }
  });
}

/**
 * 公式ルール (Ver 1.1) 準拠ゲームリデューサー
 * カード保存則の不変条件ガード（Invariant Guard）を備え、カードの消失・増殖を伴う不正な遷移を自動ロールバックします。
 */
export function gameReducer(state: GameState, action: GameAction): GameState {
  const isGuarded = !CONSERVATION_EXEMPT_ACTIONS.has(action.type);
  const beforeIds = isGuarded ? collectAllCardIds(state) : null;

  const nextState = internalGameReducer(state, action);

  if (beforeIds && beforeIds.length > 0 && nextState !== state) {
    const afterIds = collectAllCardIds(nextState);
    if (!areCardIdMultisetsEqual(beforeIds, afterIds)) {
      console.error(
        `[CRITICAL: Card Conservation Guard] Action "${action.type}" corrupted card conservation! Automatically rolled back.`,
        { beforeCount: beforeIds.length, afterCount: afterIds.length }
      );
      return state;
    }
  }

  return nextState;
}
