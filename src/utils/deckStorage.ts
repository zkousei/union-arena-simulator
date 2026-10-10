import { UserDeck } from '../domain/deckValidation';
import { isCardMaster } from '../data/officialCardAsset';
import { ensureCardData } from '../data/cardData';
import { CARD_DATABASE, CardMaster, requireCardMaster, isOfficialCardCode } from '../data/cardDatabase';

const STORAGE_KEY = 'union_arena_saved_decks';


export interface SavedDeckLoadResult {
  decks: UserDeck[];
  skippedCount: number;
  backupJson: string | null;
  unreadable: boolean;
}

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

export interface SavedDeckSummary {
  id: string; name: string; titleCode: string; totalCards: number; updatedAt: number;
}
export interface SavedDeckSummaryResult extends Omit<SavedDeckLoadResult, 'decks'> { decks: SavedDeckSummary[] }

function summarizeStoredDeck(value: unknown): SavedDeckSummary | null {
  if (!isRecord(value) || typeof value.id !== 'string' || !value.id || typeof value.name !== 'string' ||
    typeof value.titleCode !== 'string' || !Array.isArray(value.items)) return null;
  const validCard = (card: unknown) => isRecord(card) && typeof card.code === 'string' &&
    (isOfficialCardCode(card.code) || isValidImportedCard(card));
  if (!value.items.every((item) => isRecord(item) && Number.isInteger(item.count) && (item.count as number) > 0 && validCard(item.card)) ||
    (value.apCards !== undefined && (!Array.isArray(value.apCards) || !value.apCards.every(validCard)))) return null;
  return { id: value.id, name: value.name, titleCode: value.titleCode,
    totalCards: value.items.reduce((total, item) => total + item.count, 0),
    updatedAt: typeof value.updatedAt === 'number' && Number.isFinite(value.updatedAt) ? value.updatedAt : 0 };
}

export function loadSavedDeckSummaries(): SavedDeckSummaryResult {
  const { entries, raw } = readStoredDecks();
  if (!entries) return { decks: [], skippedCount: 0, backupJson: raw, unreadable: true };
  const decks: SavedDeckSummary[] = [];
  let skippedCount = 0;
  for (const entry of entries) {
    if (isRecord(entry) && entry.id === 'default-cgh-deck') continue;
    const summary = summarizeStoredDeck(entry);
    if (summary) decks.push(summary); else skippedCount++;
  }
  return { decks, skippedCount, backupJson: skippedCount ? raw : null, unreadable: false };
}

export async function loadSavedDeckById(id: string): Promise<UserDeck | null> {
  const { entries } = readStoredDecks();
  const entry = entries?.find((value) => isRecord(value) && value.id === id && summarizeStoredDeck(value));
  if (!entry) return null;
  await ensureCardData(entry);
  return repairStoredDeck(entry);
}

// 保存済みデッキ一覧の読み込み
function readStoredDecks(): { entries: unknown[] | null; raw: string | null } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { entries: [], raw: null };
    const entries: unknown = JSON.parse(raw);
    if (!Array.isArray(entries)) return { entries: null, raw };
    return { entries, raw };
  } catch (e) {
    console.error('Failed to load decks from localStorage:', e);
    let raw: string | null = null;
    try { raw = localStorage.getItem(STORAGE_KEY); } catch { /* storage unavailable */ }
    return { entries: null, raw };
  }
}

function repairStoredCard(value: unknown): CardMaster | null {
  if (!isRecord(value) || typeof value.code !== 'string') return null;
  const master = requireCardMaster(value.code);
  const card = master ? { ...value, ...master } : value;
  return isValidImportedCard(card) ? card as unknown as CardMaster : null;
}

function repairStoredDeck(value: unknown): UserDeck | null {
  if (!isRecord(value) ||
      typeof value.id !== 'string' || !value.id ||
      typeof value.name !== 'string' ||
      typeof value.titleCode !== 'string' ||
      !Array.isArray(value.items)) return null;
  const items: UserDeck['items'] = [];
  for (const item of value.items) {
    if (!isRecord(item) || !Number.isInteger(item.count) || (item.count as number) <= 0) return null;
    const card = repairStoredCard(item.card);
    if (!card) return null;
    items.push({ card, count: item.count as number });
  }
  let apCards: CardMaster[] | undefined;
  if (value.apCards !== undefined) {
    if (!Array.isArray(value.apCards)) return null;
    apCards = [];
    for (const rawCard of value.apCards) {
      const card = repairStoredCard(rawCard);
      if (!card) return null;
      apCards.push(card);
    }
  }
  return {
    id: value.id,
    name: value.name,
    titleCode: value.titleCode,
    items,
    ...(apCards ? { apCards } : {}),
    updatedAt: typeof value.updatedAt === 'number' && Number.isFinite(value.updatedAt) ? value.updatedAt : 0,
  };
}

export function loadSavedDecksWithIssues(): SavedDeckLoadResult {
  const { entries, raw } = readStoredDecks();
  if (!entries) return { decks: [], skippedCount: 0, backupJson: raw, unreadable: true };
  const decks: UserDeck[] = [];
  let skippedCount = 0;
  for (const entry of entries) {
    if (isRecord(entry) && entry.id === 'default-cgh-deck') continue;
    const deck = repairStoredDeck(entry);
    if (deck) decks.push(deck);
    else skippedCount++;
  }
  return { decks, skippedCount, backupJson: skippedCount > 0 ? raw : null, unreadable: false };
}

export function loadSavedDecks(): UserDeck[] {
  return loadSavedDecksWithIssues().decks;
}

// デッキの保存または更新。不正な元データは削除せず保持する。
export function saveDeck(deck: UserDeck): boolean {
  try {
    const { entries } = readStoredDecks();
    if (!entries) return false;
    const index = entries.findIndex((entry) => isRecord(entry) && entry.id === deck.id && summarizeStoredDeck(entry) !== null);
    if (index >= 0) {
      entries[index] = { ...deck, updatedAt: Date.now() };
    } else {
      entries.unshift({ ...deck, updatedAt: Date.now() });
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    return true;
  } catch (e) {
    console.error('Failed to save deck:', e);
    return false;
  }
}

// デッキの削除
export function deleteDeck(deckId: string): void {
  try {
    const { entries } = readStoredDecks();
    if (!entries) return;
    const retained = entries.filter((entry) => !isRecord(entry) || entry.id !== deckId || summarizeStoredDeck(entry) === null);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(retained));
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

function isValidImportedCard(value: unknown): boolean {
  return isCardMaster(value);
}

// JSONインポート
function parseImportedDeck(jsonStr: string): Pick<UserDeck, 'name' | 'titleCode' | 'items' | 'apCards'> {
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
  return parsed as unknown as Pick<UserDeck, 'name' | 'titleCode' | 'items' | 'apCards'>;
}

export async function importDeckFromJsonAsync(jsonStr: string): Promise<UserDeck> {
  const parsed = parseImportedDeck(jsonStr);
  await ensureCardData(parsed);
  return importDeckFromJson(jsonStr);
}

export function importDeckFromJson(jsonStr: string): UserDeck {
  const parsed = parseImportedDeck(jsonStr);
  return {
    id: `imported-${Date.now()}`,
    name: parsed.name,
    titleCode: parsed.titleCode,
    items: (parsed.items as UserDeck['items']).map((item) => {
      const master = requireCardMaster(item.card.code);
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
