import { Card } from '../types/card';

/**
 * フィッシャー・イェーツ法による配列シャッフル (非破壊)
 */
export function shuffleCards<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * カードの状態をリセット（レスト解除、BP補正クリア、重ねカードクリア）
 */
export function resetCardState(card: Card): Card {
  return {
    ...card,
    isRested: false,
    bpModifier: 0,
    underCards: [],
    isFaceDown: false,
    isFrozen: false,
    isMarker: undefined,
  };
}

/**
 * デフォルトのAPカード（3枚）を生成
 */
export function createDefaultApCards(playerId: string): Card[] {
  return [1, 2, 3].map((num) => ({
    id: `ap-${playerId}-${num}`,
    code: `AP-00${num}`,
    name: 'ACTION POINT',
    cardType: 'ACTION_POINT',
    color: 'COLORLESS',
    bp: null,
    apCost: 0,
    reqEnergy: 0,
    genEnergy: 0,
    traits: [],
    triggers: [],
    effectText: 'ターン開始時にアクティブになり、カードの使用等でレスト/消費されます。',
    isRested: false,
    bpModifier: 0,
    underCards: [],
  }));
}

/**
 * ターン数および先攻/後攻に応じた最大AP枚数を算出 (Ver 1.1 公式ルール準拠)
 * - 先攻1T: 1枚
 * - 後攻1T: 2枚
 * - 先攻2T: 2枚
 * - 後攻2T: 2枚
 * - 3ターン目以降: 3枚
 */
export function calculateMaxAp(roundNumber: number, isFirst: boolean): number {
  if (roundNumber === 1) {
    return isFirst ? 1 : 2;
  }
  if (roundNumber === 2) {
    return 2;
  }
  return 3;
}

/**
 * デッキ初期化セットアップ (Ver 1.1 公式ルール「3. 対戦の準備」準拠)
 * 1. デッキ50枚をシャッフル
 * 2. 初手7枚を手札として引く（公式ルール: マリガンの前に手札7枚のみを引く）
 * 3. 残り43枚を山札とする（※ライフはこの時点では配置しない！）
 */
export function setupInitialDeck(deckCards: Card[]) {
  const cleanDeck = deckCards.map(resetCardState);
  const shuffled = shuffleCards(cleanDeck);

  // 手札7枚
  const hand = shuffled.slice(0, 7);
  // 残り山札 (50 - 7 = 43枚)
  const deck = shuffled.slice(7);
  // ライフはマリガン終了後に配置するため初期は空
  const life: Card[] = [];

  return { life, hand, deck };
}

/**
 * マリガン（手札の入れ替え）処理 (Ver 1.1 公式ルール「3. 対戦の準備」準拠)
 * 「手札をすべて横に置き、新たに山札からカードを7枚引き直したあと、横に置いたカードを山札に加え、山札をシャッフルします」
 * ※山札43枚から7枚引き直したあと、横に置いた7枚を山札に戻してシャッフルするため、山札は43枚を維持します。
 */
export function executeMulligan(currentHand: Card[], currentDeck: Card[]) {
  // 1. 新たに山札から7枚引く
  const newHand = currentDeck.slice(0, 7).map(resetCardState);
  const remainingDeck = currentDeck.slice(7);

  // 2. 元の手札を山札に加えてシャッフル
  const combinedDeck = [...remainingDeck, ...currentHand.map(resetCardState)];
  const newDeck = shuffleCards(combinedDeck);

  return { newHand, newDeck };
}

/**
 * ライフ初期配置処理 (Ver 1.1 公式ルール「3. 対戦の準備」準拠)
 * 「マリガン終了後、山札の上から7枚を、内容を見ずに裏向きのままライフエリアに置きます」
 * 山札43枚 - ライフ7枚 = 残り山札36枚
 */
export function placeInitialLife(currentDeck: Card[], count: number = 7) {
  const actualCount = Math.min(count, currentDeck.length);
  const life = currentDeck.slice(0, actualCount).map((c) => ({ ...resetCardState(c), isFaceDown: true }));
  const deck = currentDeck.slice(actualCount);
  return { life, deck };
}
