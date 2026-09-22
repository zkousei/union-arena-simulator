import { Card, getBaseCardCode } from '../types/card';
import { CardMaster, CARD_DATABASE } from '../data/cardDatabase';

export interface DeckItem {
  card: CardMaster;
  count: number;
}

export interface UserDeck {
  id: string;
  name: string;
  titleCode: string;
  items: DeckItem[];
  apCards?: CardMaster[];
  updatedAt: number;
}

export interface DeckValidationError {
  type: 'TOTAL_COUNT' | 'SAME_CARD_LIMIT' | 'TITLE_CODE_MISMATCH' | 'SPECIAL_LIMIT' | 'COLOR_LIMIT' | 'FINAL_LIMIT' | 'UNREVEALED_CARD';
  message: string;
}

export interface DeckValidationResult {
  isValid: boolean;
  totalCards: number;
  specialCount: number;
  colorCount: number;
  finalCount: number;
  unrevealedCount: number;
  errors: DeckValidationError[];
}

/**
 * ユニオンアリーナ公式ルール (Ver 1.1) デッキバリデーション
 */
export function validateDeck(deck: UserDeck): DeckValidationResult {
  const errors: DeckValidationError[] = [];

  let totalCards = 0;
  let specialCount = 0;
  let colorCount = 0;
  let finalCount = 0;
  let unrevealedCount = 0;

  const cardCodeCounts: Record<string, number> = {};
  let detectedTitleCode: string | null = null;

  for (const item of deck.items) {
    totalCards += item.count;

    // 未公開カードチェック
    if (item.card.isUnrevealed) {
      unrevealedCount += item.count;
    }

    // 同名カード（同一カード番号・通常版＋パラレル版合算）上限チェック (4枚)
    const baseCode = item.card.baseCode || getBaseCardCode(item.card.code);
    cardCodeCounts[baseCode] = (cardCodeCounts[baseCode] || 0) + item.count;
    if (cardCodeCounts[baseCode] > 4) {
      errors.push({
        type: 'SAME_CARD_LIMIT',
        message: `カード「${item.card.name} (${baseCode})」が通常版・パラレル版合算で4枚を超えています（現在: ${cardCodeCounts[baseCode]}枚）。`,
      });
    }

    // 作品コード統一チェック
    if (!detectedTitleCode) {
      detectedTitleCode = item.card.titleCode;
    } else if (item.card.titleCode !== detectedTitleCode) {
      errors.push({
        type: 'TITLE_CODE_MISMATCH',
        message: `異なる作品のカード「${item.card.name} (${item.card.titleCode})」が含まれています（作品コード: ${detectedTitleCode} 統一が必要です）。`,
      });
    }

    // 特別トリガー合計チェック
    if (item.card.triggers.includes('SPECIAL')) {
      specialCount += item.count;
    }
    if (item.card.triggers.includes('COLOR')) {
      colorCount += item.count;
    }
    if (item.card.triggers.includes('FINAL')) {
      finalCount += item.count;
    }
  }

  // デッキ枚数ちょうど50枚チェック
  if (totalCards !== 50) {
    errors.push({
      type: 'TOTAL_COUNT',
      message: `デッキはちょうど50枚である必要があります（現在: ${totalCards}枚）。`,
    });
  }

  // 特別トリガー上限 (各4枚まで)
  if (specialCount > 4) {
    errors.push({
      type: 'SPECIAL_LIMIT',
      message: `SPECIALトリガーを持つカードは合計4枚までです（現在: ${specialCount}枚）。`,
    });
  }
  if (colorCount > 4) {
    errors.push({
      type: 'COLOR_LIMIT',
      message: `COLORトリガーを持つカードは合計4枚までです（現在: ${colorCount}枚）。`,
    });
  }
  if (finalCount > 4) {
    errors.push({
      type: 'FINAL_LIMIT',
      message: `FINALトリガーを持つカードは合計4枚までです（現在: ${finalCount}枚）。`,
    });
  }

  // 未公開カードが含まれている場合はエラー
  if (unrevealedCount > 0) {
    errors.push({
      type: 'UNREVEALED_CARD',
      message: `未公開（COMING SOON）のカードが ${unrevealedCount} 枚含まれています。効果公開後にご利用いただけます。`,
    });
  }

  return {
    isValid: errors.length === 0,
    totalCards,
    specialCount,
    colorCount,
    finalCount,
    unrevealedCount,
    errors,
  };
}

/**
 * UserDeck から GameBoard 用の 50枚 Card[] を展開生成
 */
export function flattenDeckToCards(deck: UserDeck, playerId: string = 'player-1'): Card[] {
  const cards: Card[] = [];
  let idCount = 1;

  for (const item of deck.items) {
    const master = CARD_DATABASE.find((c) => c.code === item.card.code);
    const cardData = master
      ? {
          ...item.card,
          bp: master.bp ?? item.card.bp,
          hasBpPlus: master.hasBpPlus ?? item.card.hasBpPlus,
          genEnergy: master.genEnergy,
        }
      : item.card;

    for (let i = 0; i < item.count; i++) {
      cards.push({
        ...cardData,
        id: `${playerId}-${cardData.code}-${idCount++}`,
        isRested: false,
        bpModifier: 0,
        underCards: [],
      });
    }
  }

  return cards;
}
