import { CardMaster } from '../data/cardDatabase';
import { CardType, CardColor, TriggerType, getBaseCardCode } from '../types/card';
import { DeckItem } from '../domain/deckValidation';
import { ALL_OFFICIAL_SERIES, OFFICIAL_TITLES } from '../data/officialSeriesData';

// 主要な公式シリーズ一覧 (商品コードと名称・作品コード)
export interface OfficialSeriesInfo {
  seriesId: string;
  name: string;
  titleCode: string;
  title: string;
}

// 全117シリーズの完全マスターリスト
export const OFFICIAL_SERIES_LIST: OfficialSeriesInfo[] = ALL_OFFICIAL_SERIES.map((s) => {
  const cleanTitle = s.name.replace(/【[^】]+】/g, '').replace(/Vol\.\d+/g, '').trim();
  const titleMatch = s.name.match(/【([^】]+)】/);
  const productCode = titleMatch ? titleMatch[1] : '';

  // 既知の公式作品名との完全・部分一致
  const matchedTitle = OFFICIAL_TITLES.find((t) => s.name.includes(t)) || cleanTitle;

  return {
    seriesId: s.seriesId,
    name: s.name,
    titleCode: productCode,
    title: matchedTitle,
  };
});

function getHtmlAttribute(tag: string, attribute: string): string | undefined {
  const match = tag.match(new RegExp(`\\b${attribute}\\s*=\\s*(["'])(.*?)\\1`, 'i'));
  return match?.[2];
}

/**
 * 公式カード詳細HTMLからCardMasterオブジェクトを抽出・パース
 */
export function parseCardFromDetailHtml(
  detailHtml: string,
  cardNo: string,
  fallbackImgUrl?: string,
  extraMeta?: { seriesId?: string; seriesName?: string }
): CardMaster {
  // 作品コード (UA01BT/CGH-1-001 -> CGH)
  const titleCodeMatch = cardNo.match(/\/([A-Z0-9]+)-/);
  const titleCode = titleCodeMatch ? titleCodeMatch[1] : 'OTHER';

  // 作品タイトル
  const titleMatch = detailHtml.match(/<dd class="cardDataTitleCol[^"]*"><img[^>]*alt="([^"]+)"/);
  const seriesInfo = OFFICIAL_SERIES_LIST.find((s) => s.titleCode === titleCode);
  const title = titleMatch ? titleMatch[1].trim() : seriesInfo?.title || 'UNION ARENA';

  // カード名
  const nameMatch = detailHtml.match(
    /<h2 class="cardNameCol">\s*([\s\S]*?)\s*(?:<span class="rubyData">[\s\S]*?<\/span>)?\s*<\/h2>/
  );
  let name = nameMatch ? nameMatch[1].replace(/<[^>]+>/g, '').trim() : '';
  if (!name) {
    const altNameMatch = detailHtml.match(/<dd class="cardDataImgCol"><img[^>]*alt="[^"]*\s+([^"]+)"/);
    name = altNameMatch ? altNameMatch[1] : cardNo;
  }

  // カード種別 (CHARACTER / EVENT / FIELD / ACTION_POINT)
  const catMatch = detailHtml.match(
    /<dl class="cardDataCol categoryData">[\s\S]*?<dd class="cardDataContents">\s*([^<]+)\s*<\/dd>/
  );
  const catRaw = catMatch ? catMatch[1].trim() : '';
  let cardType: CardType = 'CHARACTER';
  if (catRaw.includes('イベント') || catRaw.includes('EVENT')) {
    cardType = 'EVENT';
  } else if (catRaw.includes('フィールド') || catRaw.includes('FIELD')) {
    cardType = 'FIELD';
  } else if (catRaw.includes('アクションポイント') || catRaw.includes('AP') || cardNo.includes('AP')) {
    cardType = 'ACTION_POINT';
  }

  // 色 & 必要エナジー
  const needMatch = detailHtml.match(
    /<dl class="cardDataCol needEnergyData">[\s\S]*?<dd class="cardDataContents">([\s\S]*?)<\/dd>/
  );
  let color: CardColor = 'PURPLE';
  let reqEnergy = 0;
  if (needMatch) {
    const altMatch = needMatch[1].match(/alt="([^"]+)"/);
    if (altMatch) {
      const altText = altMatch[1];
      if (altText.includes('紫')) color = 'PURPLE';
      else if (altText.includes('緑')) color = 'GREEN';
      else if (altText.includes('赤')) color = 'RED';
      else if (altText.includes('青')) color = 'BLUE';
      else if (altText.includes('黄')) color = 'YELLOW';

      const numMatch = altText.match(/\d+/);
      reqEnergy = numMatch ? parseInt(numMatch[0], 10) : 0;
    }
  }
  if (cardType === 'ACTION_POINT') {
    color = 'COLORLESS';
  }

  // 消費AP
  const apMatch = detailHtml.match(
    /<dl class="cardDataCol apData">[\s\S]*?<dd class="cardDataContents">\s*(\d+)\s*<\/dd>/
  );
  const apCost = apMatch ? parseInt(apMatch[1], 10) : 1;

  // BP (4000, 2000+, 1500+ 等の表記に対応)
  const bpMatch = detailHtml.match(
    /<dl class="cardDataCol bpData">[\s\S]*?<dd class="cardDataContents">([\s\S]*?)<\/dd>/i
  );
  let bp: number | null = null;
  let hasBpPlus = false;
  if (bpMatch) {
    const rawBp = bpMatch[1].replace(/<[^>]+>/g, '').trim();
    if (rawBp && rawBp !== '-') {
      const numMatch = rawBp.match(/\d+/);
      if (numMatch) {
        bp = parseInt(numMatch[0], 10);
      }
      hasBpPlus = /[+＋]/.test(rawBp);
    }
  }

  // 特徴
  const traitMatch = detailHtml.match(
    /<dl class="cardDataCol attributeData">[\s\S]*?<dd class="cardDataContents">\s*([\s\S]*?)\s*<\/dd>/
  );
  let traits: string[] = [];
  if (traitMatch) {
    const rawTraits = traitMatch[1].replace(/<[^>]+>/g, '').trim();
    if (rawTraits && rawTraits !== '-') {
      traits = rawTraits
        .split(/[/／・]/)
        .map((t) => t.trim())
        .filter(Boolean);
    }
  }

  // 発生エナジー
  const genMatch = detailHtml.match(
    /<dl class="cardDataCol generatedEnergyData">[\s\S]*?<dd class="cardDataContents">([\s\S]*?)<\/dd>/
  );
  let genEnergy = 1;
  let hasGenEnergyPlus = false;
  if (cardType === 'EVENT') {
    genEnergy = 0;
  } else if (genMatch) {
    const imgs = genMatch[1].match(/<img[^>]*>/g);
    if (!imgs || imgs.length === 0) {
      genEnergy = 0;
    } else {
      // The official "+" icon marks a possible effect increase, not another energy.
      // Its filename ends in 2 (or 4 for two base energy), so read the visible icons.
      genEnergy = imgs.reduce((sum, img) => {
        const alt = getHtmlAttribute(img, 'alt') || '';
        if (/[+＋]/.test(alt)) hasGenEnergyPlus = true;
        return sum + (alt.match(/[紫緑赤青黄]/g)?.length || 0);
      }, 0);
    }
  }

  // 効果テキスト
  const effectMatch = detailHtml.match(
    /<dl class="cardDataCol effectData">[\s\S]*?<dd class="cardDataContents">\s*([\s\S]*?)\s*<\/dd>/
  );
  let effectText = '';
  if (effectMatch) {
    effectText = effectMatch[1]
      .replace(/<img[^>]*alt="([^"]+)"[^>]*>/g, '[$1]')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .trim();
  }

  // トリガー
  const triggerMatch = detailHtml.match(
    /<dl class="cardDataCol triggerData">[\s\S]*?<dd class="cardDataContents">\s*([\s\S]*?)\s*<\/dd>/
  );
  const triggers: TriggerType[] = [];
  if (triggerMatch) {
    const trg = triggerMatch[1];
    if (/ドロー|draw/i.test(trg)) triggers.push('DRAW');
    if (/ゲット|get/i.test(trg)) triggers.push('GET');
    if (/アクティブ|active/i.test(trg)) triggers.push('ACTIVE');
    if (/レイド|raid/i.test(trg)) triggers.push('RAID');
    if (/カラー|color/i.test(trg)) triggers.push('COLOR');
    if (/スペシャル|special/i.test(trg)) triggers.push('SPECIAL');
    if (/ファイナル|final/i.test(trg)) triggers.push('FINAL');
    if (/バウンス|bounce/i.test(trg)) triggers.push('BOUNCE');
  }

  // 画像URL (例: https://www.unionarena-tcg.com/jp/images/cardlist/card/UA01BT_CGH-1-001.png)
  const imgColumnMatch = detailHtml.match(
    /<dd[^>]*class=["'][^"']*cardDataImgCol[^"']*["'][^>]*>([\s\S]*?)<\/dd>/i
  );
  const imgTagMatch = imgColumnMatch?.[1].match(/<img\b[^>]*>/i);
  const detailImageSrc = imgTagMatch ? getHtmlAttribute(imgTagMatch[0], 'src') : undefined;
  let imageUrl = fallbackImgUrl;
  if (detailImageSrc) {
    imageUrl = detailImageSrc.startsWith('http')
      ? detailImageSrc
      : `https://www.unionarena-tcg.com${detailImageSrc.startsWith('/') ? '' : '/'}${detailImageSrc}`;
  } else if (!imageUrl) {
    imageUrl = `https://www.unionarena-tcg.com/jp/images/cardlist/card/${cardNo.replace('/', '_')}.png`;
  }

  // レアリティ (C, U, R, SR, ★, ★★, ★★★, AP, PR, UR, SP等)
  let rarity: string | undefined;
  const rareColMatch = detailHtml.match(
    /<(?:dl|div)[^>]*class="[^"]*rareData[^"]*"[^>]*>[\s\S]*?<dd[^>]*class="[^"]*cardDataContents[^"]*"[^>]*>\s*([\s\S]*?)\s*<\/dd>/i
  );
  if (rareColMatch) {
    rarity = rareColMatch[1].replace(/<[^>]+>/g, '').trim();
  } else {
    const rareSpanMatch = detailHtml.match(/<span[^>]*class="[^"]*rareData[^"]*"[^>]*>\s*([\s\S]*?)\s*<\/span>/i);
    if (rareSpanMatch) {
      rarity = rareSpanMatch[1].replace(/<[^>]+>/g, '').trim();
    }
  }

  // パラレル版判定 (_p1, _p2 等)
  const isParallel = /_p\d+$/i.test(cardNo);
  const baseCode = getBaseCardCode(cardNo);

  if (!rarity && isParallel) {
    rarity = '★ (Parallel)';
  }

  // 未公開カード判定 (COMING SOON)
  const isUnrevealed =
    /comingsoon/i.test(cardNo) ||
    /comingsoon/i.test(name) ||
    /comingsoon/i.test(detailHtml) ||
    Boolean(imageUrl && /comingsoon/i.test(imageUrl)) ||
    (cardType === 'CHARACTER' && bp === null && (!effectText || effectText === '-') && !name);

  if (isUnrevealed && (!name || /comingsoon/i.test(name))) {
    name = 'COMING SOON (未公開)';
  }

  return {
    code: cardNo,
    baseCode,
    name,
    title,
    titleCode,
    cardType,
    color,
    bp,
    hasBpPlus,
    apCost,
    reqEnergy,
    genEnergy,
    hasGenEnergyPlus,
    traits,
    triggers,
    effectText,
    imageUrl,
    rarity,
    isParallel,
    isUnrevealed,
    seriesId: extraMeta?.seriesId,
    seriesName: extraMeta?.seriesName || seriesInfo?.name,
  };
}

/**
 * 検索結果一覧HTMLからカード概要リストを抽出
 */
export function parseCardListHtml(
  html: string,
  options?: { includeParallel?: boolean }
): Array<{ cardNo: string; name: string; imgUrl: string; isParallel: boolean; isUnrevealed: boolean }> {
  const anchorRegex = /<a\b[^>]*>[\s\S]*?<\/a>/gi;
  const cards: Array<{ cardNo: string; name: string; imgUrl: string; isParallel: boolean; isUnrevealed: boolean }> = [];
  const seenCardNumbers = new Set<string>();
  let anchorMatch: RegExpExecArray | null;

  while ((anchorMatch = anchorRegex.exec(html)) !== null) {
    const anchorTag = anchorMatch[0].match(/^<a\b[^>]*>/i)?.[0];
    const href = anchorTag ? getHtmlAttribute(anchorTag, 'href') : undefined;
    const encodedCardNo = href?.match(/detail_iframe\.php\?[^#"']*\bcard_no=([^&#"']+)/i)?.[1];
    const imgTag = anchorMatch[0].match(/<img\b[^>]*>/i)?.[0];
    const rawImg = imgTag
      ? getHtmlAttribute(imgTag, 'data-src') || getHtmlAttribute(imgTag, 'src')
      : undefined;
    const alt = imgTag ? getHtmlAttribute(imgTag, 'alt') : undefined;
    if (!encodedCardNo || !rawImg || !alt) continue;

    let cardNo = encodedCardNo;
    try {
      cardNo = decodeURIComponent(encodedCardNo);
    } catch {
      // 不正なURLエンコードの場合は取得できた文字列をそのまま使う
    }
    const name = alt.replace(cardNo, '').trim();

    const isParallel = /_p\d+$/i.test(cardNo);
    const isUnrevealed =
      /comingsoon/i.test(cardNo) ||
      /comingsoon/i.test(alt) ||
      /comingsoon/i.test(rawImg);

    if (options?.includeParallel === false && isParallel) {
      continue;
    }
    if (seenCardNumbers.has(cardNo)) continue;
    seenCardNumbers.add(cardNo);

    const imgUrl = rawImg.startsWith('http')
      ? rawImg
      : `https://www.unionarena-tcg.com${rawImg.startsWith('/') ? '' : '/'}${rawImg}`;

    cards.push({
      cardNo,
      name: name || cardNo,
      imgUrl,
      isParallel,
      isUnrevealed,
    });
  }

  return cards;
}

/**
 * デッキテキスト（公式コードやデッキリストテキスト）からDeckItem[]を解析
 * 例:
 * UA01BT/CGH-1-001 x4
 * UA01BT/CGH-1-002 4
 * など
 */
export function parseDeckListText(
  text: string,
  cardPool: CardMaster[]
): { items: DeckItem[]; notFound: string[] } {
  const lines = text.split('\n');
  const items: DeckItem[] = [];
  const notFound: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith('//')) continue;

    // パターン1: "UA01BT/CGH-1-001 x4" や "UNKNOWN/XXX-1-001 4"
    const codeMatch = line.match(/([A-Za-z0-9_]+\/[A-Za-z0-9_]+-[0-9]+-[0-9A-Za-z_]+)/i);
    if (!codeMatch) continue;

    const code = codeMatch[1].toUpperCase();
    // 枚数抽出 (デフォルト4枚、指定があればその数値)
    const countMatch = line.slice(codeMatch.index! + code.length).match(/[\s*x×]+(\d+)/i);
    const count = countMatch ? parseInt(countMatch[1], 10) : 4;
    if (count <= 0) continue;

    const foundCard = cardPool.find(
      (c) => c.code.toUpperCase() === code || c.code.toUpperCase().startsWith(code)
    );

    if (foundCard) {
      const existing = items.find((it) => it.card.code === foundCard.code);
      if (existing) {
        existing.count += count;
      } else {
        items.push({ card: foundCard, count });
      }
    } else {
      notFound.push(code);
    }
  }

  return { items, notFound };
}

/**
 * 公式サイトのパスからHTMLを取得（ローカルViteプロキシ優先、外部プロキシへのフェイルオーバー対応）
 */
async function fetchOfficialHtml(targetPath: string, timeoutMs: number = 8000): Promise<string> {
  const isBrowser = typeof window !== 'undefined';
  const fullTargetUrl = `https://www.unionarena-tcg.com${targetPath}`;

  // 1. ローカル開発環境のViteプロキシ (/api/ua-proxy) を最優先
  if (isBrowser) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(`/api/ua-proxy${targetPath}`, { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) {
        const text = await res.text();
        if (text && (text.includes('<html') || text.includes('<!DOCTYPE') || text.includes('cardData') || text.includes('cardListCol'))) {
          return text;
        }
      }
    } catch {
      // ローカルプロキシが使えない環境（静的デプロイ等）は外部プロキシへフォールバック
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
      const text = await res.text();
      if (text && (text.includes('<html') || text.includes('cardData') || text.includes('cardListCol'))) {
        return text;
      }
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
      const data = await res.json();
      if (data?.contents) {
        return data.contents;
      }
    }
  } catch {
    // 失敗時はエラー
  }

  throw new Error(
    `公式サイトとの通信に失敗しました。Vite開発サーバー(npm run dev)が起動中かご確認ください。またはターミナルで npm run sync-cards を実行すると確実に一括同期できます。`
  );
}

/**
 * CORSプロキシを使って公式サイトからシリーズカード一覧を取得
 */
export async function fetchSeriesCardsViaProxy(
  seriesId: string,
  onProgress?: (current: number, total: number) => void,
  options?: { includeParallel?: boolean }
): Promise<CardMaster[]> {
  const listPath = `/jp/cardlist/?search=true&series=${seriesId}`;
  const html = await fetchOfficialHtml(listPath, 10000);
  const summaryList = parseCardListHtml(html, { includeParallel: options?.includeParallel ?? false });

  if (summaryList.length === 0) {
    throw new Error('カードが見つかりませんでした。');
  }

  const seriesInfo = OFFICIAL_SERIES_LIST.find((s) => s.seriesId === seriesId);
  const results: CardMaster[] = [];

  // 並列取得 (Concurrency: 5)
  const concurrency = 5;
  for (let i = 0; i < summaryList.length; i += concurrency) {
    const chunk = summaryList.slice(i, i + concurrency);
    const chunkPromises = chunk.map(async (item) => {
      try {
        const detailPath = `/jp/cardlist/detail_iframe.php?card_no=${encodeURIComponent(item.cardNo)}`;
        const detailHtml = await fetchOfficialHtml(detailPath, 6000);
        return parseCardFromDetailHtml(detailHtml, item.cardNo, item.imgUrl, {
          seriesId,
          seriesName: seriesInfo?.name,
        });
      } catch (err) {
        console.warn(`Card detail fallback for ${item.cardNo}:`, err);
        const titleCodeMatch = item.cardNo.match(/\/([A-Z0-9]+)-/);
        const titleCode = titleCodeMatch ? titleCodeMatch[1] : 'OTHER';
        const fallbackCard: CardMaster = {
          code: item.cardNo,
          baseCode: getBaseCardCode(item.cardNo),
          name: item.name,
          title: seriesInfo?.title || 'UNION ARENA',
          titleCode,
          cardType: item.cardNo.includes('AP') ? 'ACTION_POINT' : 'CHARACTER',
          color: 'PURPLE',
          bp: null,
          apCost: 1,
          reqEnergy: 0,
          genEnergy: 1,
          traits: [],
          triggers: [],
          effectText: '',
          imageUrl: item.imgUrl,
          isParallel: item.isParallel,
          isUnrevealed: item.isUnrevealed,
          seriesId,
          seriesName: seriesInfo?.name,
        };
        return fallbackCard;
      }
    });

    const chunkResults = await Promise.all(chunkPromises);
    results.push(...chunkResults);

    if (onProgress) {
      onProgress(results.length, summaryList.length);
    }
  }

  return results;
}
