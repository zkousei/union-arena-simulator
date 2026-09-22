import { UserDeck } from '../domain/deckValidation';
import { CARD_DATABASE } from '../data/cardDatabase';

const STORAGE_KEY = 'union_arena_saved_decks';

// デフォルトのサンプルデッキ生成
export function createDefaultSampleDeck(): UserDeck {
  const cgh = CARD_DATABASE.filter((c) => c.titleCode === 'CGH');
  return {
    id: 'default-cgh-deck',
    name: 'コードギアス 紫ギアス構築',
    titleCode: 'CGH',
    items: [
      { card: cgh[0], count: 4 }, // ルルーシュ (0エナ)
      { card: cgh[1], count: 4 }, // ナナリー (1エナ)
      { card: cgh[2], count: 4 }, // シャーリー (1エナ)
      { card: cgh[3], count: 4 }, // C.C. (2エナ)
      { card: cgh[4], count: 4 }, // 紅蓮 (3エナ)
      { card: cgh[5], count: 4 }, // ゼロ (レイド)
      { card: cgh[6], count: 4 }, // ガウェイン (5エナ)
      { card: cgh[7], count: 4 }, // スペシャル (4枚)
      { card: cgh[8], count: 4 }, // ファイナル (4枚)
      { card: cgh[9], count: 4 }, // 生徒会室 (フィールド)
      // 残り10枚を0〜2エナジー帯に配分して計50枚
      // 注: 同名上限4枚なので、別のカード番号が必要。
      // 現状のDBの範囲で50枚にするため、各カードの枚数配分
    ],
    updatedAt: Date.now(),
  };
}

// 保存済みデッキ一覧の読み込み
export function loadSavedDecks(): UserDeck[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const decks = JSON.parse(raw) as UserDeck[];
    // 初期サンプルデッキ (default-cgh-deck) は除外し、カード情報を最新のCARD_DATABASEで修復
    return decks
      .filter((d) => d.id !== 'default-cgh-deck')
      .map((d) => ({
        ...d,
        items: (d.items || []).map((it) => {
          const master = CARD_DATABASE.find((c) => c.code === it.card?.code);
          return master
            ? {
                ...it,
                card: {
                  ...it.card,
                  bp: master.bp ?? it.card.bp,
                  hasBpPlus: master.hasBpPlus ?? it.card.hasBpPlus,
                  genEnergy: master.genEnergy,
                  hasGenEnergyPlus: master.hasGenEnergyPlus ?? false,
                },
              }
            : it;
        }),
      }));
  } catch (e) {
    console.error('Failed to load decks from localStorage:', e);
    return [];
  }
}

// デッキの保存または更新
export function saveDeck(deck: UserDeck): void {
  try {
    const existing = loadSavedDecks();
    const index = existing.findIndex((d) => d.id === deck.id);
    if (index >= 0) {
      existing[index] = { ...deck, updatedAt: Date.now() };
    } else {
      existing.unshift({ ...deck, updatedAt: Date.now() });
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
  } catch (e) {
    console.error('Failed to save deck:', e);
  }
}

// デッキの削除
export function deleteDeck(deckId: string): void {
  try {
    const existing = loadSavedDecks().filter((d) => d.id !== deckId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
  } catch (e) {
    console.error('Failed to delete deck:', e);
  }
}

// JSONエクスポート (ダウンロード用文字列)
export function exportDeckToJson(deck: UserDeck): string {
  return JSON.stringify(deck, null, 2);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isValidImportedCard(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    typeof value.code === 'string' &&
    value.code.length > 0 &&
    typeof value.name === 'string' &&
    value.name.length > 0 &&
    typeof value.title === 'string' &&
    typeof value.titleCode === 'string' &&
    value.titleCode.length > 0 &&
    typeof value.cardType === 'string' &&
    typeof value.color === 'string' &&
    (typeof value.bp === 'number' || value.bp === null) &&
    typeof value.apCost === 'number' &&
    typeof value.reqEnergy === 'number' &&
    typeof value.genEnergy === 'number' &&
    (value.hasGenEnergyPlus === undefined || typeof value.hasGenEnergyPlus === 'boolean') &&
    isStringArray(value.traits) &&
    isStringArray(value.triggers) &&
    typeof value.effectText === 'string'
  );
}

// JSONインポート
export function importDeckFromJson(jsonStr: string): UserDeck {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error('JSONの解析に失敗しました。');
  }
  if (
    !isRecord(parsed) ||
    typeof parsed.name !== 'string' ||
    parsed.name.trim().length === 0 ||
    typeof parsed.titleCode !== 'string' ||
    parsed.titleCode.trim().length === 0 ||
    !Array.isArray(parsed.items) ||
    !parsed.items.every(
      (item) =>
        isRecord(item) &&
        Number.isInteger(item.count) &&
        (item.count as number) > 0 &&
        isValidImportedCard(item.card)
    ) ||
    (parsed.apCards !== undefined &&
      (!Array.isArray(parsed.apCards) || !parsed.apCards.every(isValidImportedCard)))
  ) {
    throw new Error('無効なデッキJSONフォーマットです');
  }
  return {
    id: `imported-${Date.now()}`,
    name: parsed.name,
    titleCode: parsed.titleCode,
    items: (parsed.items as UserDeck['items']).map((item) => {
      const master = CARD_DATABASE.find((card) => card.code === item.card.code);
      return master ? { ...item, card: { ...item.card, genEnergy: master.genEnergy, hasGenEnergyPlus: master.hasGenEnergyPlus ?? false } } : item;
    }),
    ...(parsed.apCards !== undefined ? { apCards: parsed.apCards as UserDeck['apCards'] } : {}),
    updatedAt: Date.now(),
  };
}

// テキスト形式エクスポート (例: 4x ルルーシュ・ランペルージ)
export function exportDeckToText(deck: UserDeck): string {
  const lines: string[] = [`【${deck.name}】`];
  deck.items.forEach((item) => {
    lines.push(`${item.count}x ${item.card.name} (${item.card.code})`);
  });
  return lines.join('\n');
}
