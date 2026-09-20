import { CardMaster } from '../data/cardDatabase';
import { CardColor, CardType, getBaseCardCode } from '../types/card';
import { DeckItem } from '../domain/deckValidation';

export interface BandaiDeckCardRaw {
  id: number;
  code: string;
  card_number: string;
  card_name: string;
  card_count: number;
  image_url: string;
  cost: string;
  color: string;
  type: string;
  level?: string;
}

export interface BandaiDeckRecipe {
  deckCode: string;
  gameTitleId: number;
  mainDeck: BandaiDeckCardRaw[];
}

/**
 * URL または入力文字列から BANDAI TCG+ のデッキコードを抽出
 */
export function extractDeckCode(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // パターン1: フルURL https://www.bandai-tcg-plus.com/deck_code_recipe/:deckCode...
  const urlMatch = trimmed.match(/\/deck_code_recipe\/([a-zA-Z0-9_-]+)/i);
  if (urlMatch) {
    return urlMatch[1];
  }

  // パターン2: クエリパラメータ ?deck_code=...
  const paramMatch = trimmed.match(/[?&]deck_code=([a-zA-Z0-9_-]+)/i);
  if (paramMatch) {
    return paramMatch[1];
  }

  // パターン3: コード直接入力 (英数字、ハイフン、アンダースコア 6文字以上)
  if (/^[a-zA-Z0-9_-]{6,64}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

/**
 * BANDAI TCG+ API からデータを取得（Viteローカルプロキシ優先、外部プロキシへのフェイルオーバー）
 */
async function fetchBandaiApi<T>(path: string, timeoutMs: number = 8000): Promise<T> {
  const isBrowser = typeof window !== 'undefined';
  const fullTargetUrl = `https://api.bandai-tcg-plus.com${path}`;

  // 1. ローカル開発環境 (Viteプロキシ: /api/tcg-plus)
  if (isBrowser) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(`/api/tcg-plus${path}`, { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) {
        return (await res.json()) as T;
      }
    } catch {
      // 外部プロキシへフォールバック
    }
  }

  // 2. allorigins raw プロキシ
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(fullTargetUrl)}`;
    const res = await fetch(proxyUrl, { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      return (await res.json()) as T;
    }
  } catch {
    // 失敗時は次へ
  }

  // 3. allorigins get (JSON) プロキシ
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const jsonProxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(fullTargetUrl)}`;
    const res = await fetch(jsonProxyUrl, { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      const json = await res.json();
      if (json?.contents) {
        return JSON.parse(json.contents) as T;
      }
    }
  } catch {
    // 失敗時はエラー
  }

  throw new Error('BANDAI TCG+ との通信に失敗しました。デッキコードが正しいかご確認ください。');
}

/**
 * デッキコードから BANDAI TCG+ のレシピ詳細を取得
 */
export async function fetchBandaiDeckRecipe(deckCode: string): Promise<BandaiDeckRecipe> {
  // Step 1: deck_code から url_code と game_title_id を取得
  const urlCodePath = `/api/user/deck/url_code?deck_code=${encodeURIComponent(deckCode)}`;
  const step1 = await fetchBandaiApi<{
    success?: {
      code: number;
      game_title_id: number;
      url_code: string;
    };
  }>(urlCodePath);

  if (!step1?.success || !step1.success.url_code) {
    throw new Error(`デッキレシピが見つかりませんでした (コード: ${deckCode})`);
  }

  const { game_title_id, url_code } = step1.success;
  // url_code 末尾の "!" 記号を除去
  const cleanUrlCode = url_code.replace(/!+$/, '');

  // Step 2: url_code からレシピ詳細を取得
  const recipePath = `/api/user/deck/recipe?url_code=${encodeURIComponent(
    cleanUrlCode
  )}&game_title_id=${game_title_id}&encode=0&app_version=9.9.9`;

  const step2 = await fetchBandaiApi<{
    success?: {
      code: number;
      main_deck: BandaiDeckCardRaw[];
      side_deck?: BandaiDeckCardRaw[];
    };
  }>(recipePath);

  if (!step2?.success || !Array.isArray(step2.success.main_deck)) {
    throw new Error('デッキレシピの詳細を取得できませんでした。');
  }

  return {
    deckCode,
    gameTitleId: game_title_id,
    mainDeck: step2.success.main_deck,
  };
}

/**
 * 日本語の色文字列を CardColor にマッピング
 */
function mapColor(colorStr: string): CardColor {
  if (colorStr.includes('青')) return 'BLUE';
  if (colorStr.includes('緑')) return 'GREEN';
  if (colorStr.includes('赤')) return 'RED';
  if (colorStr.includes('黄')) return 'YELLOW';
  return 'PURPLE';
}

/**
 * 日本語の種別文字列を CardType にマッピング
 */
function mapCardType(typeStr: string, cardNo: string): CardType {
  if (typeStr.includes('イベント') || typeStr.includes('EVENT')) return 'EVENT';
  if (typeStr.includes('フィールド') || typeStr.includes('FIELD')) return 'FIELD';
  if (typeStr.includes('アクションポイント') || typeStr.includes('AP') || cardNo.includes('AP')) {
    return 'ACTION_POINT';
  }
  return 'CHARACTER';
}

/**
 * BANDAI TCG+ の生カードデータをシミュレータの DeckItem[] に照合・変換
 */
export function mapBandaiDeckToDeckItems(
  rawCards: BandaiDeckCardRaw[],
  cardPool: CardMaster[]
): { items: DeckItem[]; newCards: CardMaster[] } {
  const items: DeckItem[] = [];
  const newCards: CardMaster[] = [];

  for (const raw of rawCards) {
    const rawNo = raw.card_number.trim().toUpperCase();

    // 1. 完全一致 または 末尾一致で既存プールを検索 (例: "UA08BT/BLC-2-016" は "BLC-2-016" に一致)
    let matchedCard = cardPool.find(
      (c) =>
        c.code.toUpperCase() === rawNo ||
        c.code.toUpperCase().endsWith(`/${rawNo}`) ||
        c.code.toUpperCase().endsWith(`-${rawNo}`) ||
        c.code.toUpperCase().includes(rawNo)
    );

    // 2. プールにない場合、API情報からフォールバックカードを動的生成
    if (!matchedCard) {
      const titleCodeMatch = rawNo.match(/^([A-Z0-9]+)-/);
      const titleCode = titleCodeMatch ? titleCodeMatch[1] : 'OTHER';
      const costNum = parseInt(raw.cost, 10);

      matchedCard = {
        code: raw.card_number,
        baseCode: getBaseCardCode(raw.card_number),
        name: raw.card_name,
        title: 'BANDAI TCG+ IMPORT',
        titleCode,
        cardType: mapCardType(raw.type, raw.card_number),
        color: mapColor(raw.color),
        bp: null,
        apCost: 1,
        reqEnergy: isNaN(costNum) ? 0 : costNum,
        genEnergy: 1,
        traits: [],
        triggers: [],
        effectText: '',
        imageUrl: raw.image_url,
        isParallel: false,
        isUnrevealed: false,
      };
      newCards.push(matchedCard);
    }

    const count = raw.card_count || 1;
    const existingItem = items.find((it) => it.card.code === matchedCard!.code);
    if (existingItem) {
      existingItem.count += count;
    } else {
      items.push({ card: matchedCard, count });
    }
  }

  return { items, newCards };
}
