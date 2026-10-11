import { parseRequiredEnergyColors } from '../src/data/cardEnergyRules.js';
import { decodeCardText } from '../src/data/officialCardText.js';
import { validateOfficialCardDetail, validateOfficialCardDataset } from '../src/data/officialCardValidation.js';
import { publishCardData } from './card-data-quality.js';
// Official Card Synchronizer for Union Arena Simulator
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { inferCardType, isActionPointCardNumber, parseCardCategory, hasReviewedOfficialBpDash } from '../src/data/cardTypeRules.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Series to synchronize (popular booster packs & starter decks)
const DEFAULT_SERIES = [
  { id: '570001', name: 'コードギアス 反逆のルルーシュ 【UA01ST】', code: 'CGH-ST' },
  { id: '570101', name: 'コードギアス 反逆のルルーシュ 【UA01BT】', code: 'CGH-BT' },
  { id: '570002', name: '呪術廻戦 【UA02ST】', code: 'JJK-ST' },
  { id: '570102', name: '呪術廻戦 【UA02BT】', code: 'JJK-BT' },
  { id: '570003', name: 'HUNTER×HUNTER 【UA03ST】', code: 'HTR-ST' },
  { id: '570103', name: 'HUNTER×HUNTER 【UA03BT】', code: 'HTR-BT' },
  { id: '570104', name: 'アイドルマスター シャイニーカラーズ 【UA04BT】', code: 'IMS-BT' },
  { id: '570005', name: '鬼滅の刃 【UA05ST】', code: 'KMY-ST' },
  { id: '570105', name: '鬼滅の刃 【UA05BT】', code: 'KMY-BT' },
  { id: '570107', name: '転生したらスライムだった件 【UA07BT】', code: 'TSK-BT' },
  { id: '570108', name: 'BLEACH 千年血戦篇 【UA08BT】', code: 'BLC-BT' },
  { id: '570110', name: '僕のヒーローアカデミア 【UA10BT】', code: 'MHA-BT' },
  { id: '570115', name: 'ソードアート・オンライン 【UA15BT】', code: 'SAO-BT' },
  { id: '570118', name: '勝利の女神：NIKKE 【UA18BT】', code: 'NIK-BT' },
  { id: '570123', name: '進撃の巨人 【UA23BT】', code: 'AOT-BT' },
];

export function parseCardFromDetailHtml(detailHtml, cardNo, fallbackImgUrl) {
  const titleCodeMatch = cardNo.match(/\/([A-Z0-9]+)-/);
  const titleCode = titleCodeMatch ? titleCodeMatch[1] : 'OTHER';

  const titleMatch = detailHtml.match(/<dd class="cardDataTitleCol[^"]*"><img[^>]*alt="([^"]+)"/);
  const title = titleMatch ? titleMatch[1].trim() : 'UNION ARENA';

  const nameMatch = detailHtml.match(/<h2 class="cardNameCol">\s*([\s\S]*?)\s*(?:<span class="rubyData">[\s\S]*?<\/span>)?\s*<\/h2>/);
  let name = nameMatch ? nameMatch[1].replace(/<[^>]+>/g, '').trim() : '';
  if (!name) {
    const altNameMatch = detailHtml.match(/<dd class="cardDataImgCol(?: [^"]*)?">\s*<img[^>]*alt="[^"]*\s+([^"]+)"/);
    name = altNameMatch ? altNameMatch[1] : cardNo;
  }

  const catMatch = detailHtml.match(/<dl class="cardDataCol categoryData">[\s\S]*?<dd class="cardDataContents">\s*([^<]+)\s*<\/dd>/);
  const catRaw = catMatch ? catMatch[1].trim() : '';
  const cardType = inferCardType(catRaw, cardNo);

  const needMatch = detailHtml.match(/<dl class="cardDataCol needEnergyData">[\s\S]*?<dd class="cardDataContents">([\s\S]*?)<\/dd>/);
  let color = 'PURPLE';
  let reqEnergy = 0;
  let reqEnergyColors;
  if (needMatch) {
    const altMatch = needMatch[1].match(/alt="([^"]+)"/);
    if (altMatch) {
      const altText = altMatch[1];
      reqEnergyColors = parseRequiredEnergyColors(altText);
      if (altText.includes('紫')) color = 'PURPLE';
      else if (altText.includes('緑')) color = 'GREEN';
      else if (altText.includes('赤')) color = 'RED';
      else if (altText.includes('青')) color = 'BLUE';
      else if (altText.includes('黄')) color = 'YELLOW';

      const numMatch = altText.match(/\d+/);
      reqEnergy = numMatch ? parseInt(numMatch[0], 10) : 0;
    }
  }

  const apMatch = detailHtml.match(/<dl class="cardDataCol apData">[\s\S]*?<dd class="cardDataContents">\s*(\d+)\s*<\/dd>/);
  const apCost = apMatch ? parseInt(apMatch[1], 10) : 1;

  const bpMatch = detailHtml.match(/<dl class="cardDataCol bpData">[\s\S]*?<dd class="cardDataContents">([\s\S]*?)<\/dd>/i);
  let bp = null;
  let hasBpPlus = false;
  if (bpMatch) {
    const rawBp = bpMatch[1].replace(/<[^>]+>/g, '').trim();
    if (rawBp && rawBp !== '-') {
      const numMatch = rawBp.match(/\d+/);
      if (numMatch) {
        bp = parseInt(numMatch[0], 10);
      }
      hasBpPlus = /[+＋]|&#(?:43|x2b);|&plus;/i.test(rawBp);
    }
  }

  const traitMatch = detailHtml.match(/<dl class="cardDataCol attributeData">[\s\S]*?<dd class="cardDataContents">\s*([\s\S]*?)\s*<\/dd>/);
  let traits = [];
  if (traitMatch) {
    const rawTraits = decodeCardText(traitMatch[1].replace(/<[^>]+>/g, '').trim());
    if (rawTraits && rawTraits !== '-') {
      traits = rawTraits.split(/[/／]/).map(t => t.trim()).filter(Boolean);
    }
  }

  const genMatch = detailHtml.match(/<dl class="cardDataCol generatedEnergyData">[\s\S]*?<dd class="cardDataContents">([\s\S]*?)<\/dd>/);
  let genEnergy = 1;
  let hasGenEnergyPlus = false;
  if (cardType === 'EVENT') {
    genEnergy = 0;
  } else if (genMatch) {
    const imgs = genMatch[1].match(/<img[^>]*>/g);
    if (!imgs || imgs.length === 0) {
      genEnergy = 0;
    } else {
      // "+" denotes a possible effect increase, not an additional base energy.
      genEnergy = imgs.reduce((sum, img) => {
        const alt = img.match(/\balt\s*=\s*(["'])(.*?)\1/i)?.[2] || '';
        if (/[+＋]/.test(alt)) hasGenEnergyPlus = true;
        return sum + (alt.match(/[紫緑赤青黄]/g)?.length || 0);
      }, 0);
    }
  }

  const effectMatch = detailHtml.match(/<dl class="cardDataCol effectData">[\s\S]*?<dd class="cardDataContents">\s*([\s\S]*?)\s*<\/dd>/);
  let effectText = '';
  if (effectMatch) {
    effectText = effectMatch[1]
      .replace(/<img[^>]*alt="([^"]+)"[^>]*>/g, '[$1]')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .trim();
  }

  const triggerMatch = detailHtml.match(/<dl class="cardDataCol triggerData">[\s\S]*?<dd class="cardDataContents">\s*([\s\S]*?)\s*<\/dd>/);
  const triggers = [];
  if (triggerMatch) {
    const icon = triggerMatch[1].match(/<img\b[^>]*>/i)?.[0];
    const trg = icon?.match(/\balt\s*=\s*(["'])(.*?)\1/i)?.[2] || '';
    if (/ドロー|draw/i.test(trg)) triggers.push('DRAW');
    if (/ゲット|get/i.test(trg)) triggers.push('GET');
    if (/アクティブ|active/i.test(trg)) triggers.push('ACTIVE');
    if (/レイド|raid/i.test(trg)) triggers.push('RAID');
    if (/カラー|color/i.test(trg)) triggers.push('COLOR');
    if (/スペシャル|special/i.test(trg)) triggers.push('SPECIAL');
    if (/ファイナル|final/i.test(trg)) triggers.push('FINAL');
    if (/バウンス|bounce/i.test(trg)) triggers.push('BOUNCE');
  }

  const imgMatch = detailHtml.match(/<dd class="cardDataImgCol(?: [^"]*)?">\s*<img[^>]*src="([^"]+)"/);
  let imageUrl = fallbackImgUrl;
  if (imgMatch) {
    imageUrl = imgMatch[1].startsWith('http') ? imgMatch[1] : `https://www.unionarena-tcg.com${imgMatch[1]}`;
  }

  // レアリティ
  let rarity = undefined;
  const rareColMatch = detailHtml.match(/<(?:dl|div)[^>]*class="[^"]*rareData[^"]*"[^>]*>[\s\S]*?<dd[^>]*class="[^"]*cardDataContents[^"]*"[^>]*>\s*([\s\S]*?)\s*<\/dd>/i);
  if (rareColMatch) {
    rarity = rareColMatch[1].replace(/<[^>]+>/g, '').trim();
  } else {
    const rareSpanMatch = detailHtml.match(/<span[^>]*class="[^"]*rareData[^"]*"[^>]*>\s*([\s\S]*?)\s*<\/span>/i);
    if (rareSpanMatch) {
      rarity = rareSpanMatch[1].replace(/<[^>]+>/g, '').trim();
    }
  }

  const isParallel = /_p\d+$/i.test(cardNo);
  const baseCode = cardNo.replace(/_p\d+$/i, '');
  if (!rarity && isParallel) {
    rarity = '★ (Parallel)';
  }

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
    name: decodeCardText(name),
    title: decodeCardText(title),
    titleCode,
    cardType,
    color,
    bp,
    hasBpPlus,
    apCost,
    reqEnergy,
    ...(reqEnergyColors ? { reqEnergyColors } : {}),
    genEnergy,
    hasGenEnergyPlus,
    traits,
    triggers,
    effectText: decodeCardText(effectText),
    imageUrl,
    rarity,
    isParallel,
    isUnrevealed,
  };
}

async function fetchWithRetry(url, options = {}, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        ...options,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          ...(options.headers || {}),
        }
      });
      if (res.ok) return res;
    } catch (e) {
      if (i === retries - 1) throw e;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw new Error(`Failed to fetch: ${url}`);
}

/**
 * 公式サイトから最新のシリーズ一覧を動的スクレイピング
 */
async function fetchLatestOfficialSeriesList() {
  console.log('Fetching latest official series list from unionarena-tcg.com...');
  try {
    const res = await fetchWithRetry('https://www.unionarena-tcg.com/jp/cardlist/');
    const html = await res.text();
    const seriesMatch = html.match(/<select[^>]*name="series"[^>]*>([\s\S]*?)<\/select>/i);
    if (!seriesMatch) return [];

    const optionsRegex = /<option\s+value="(\d+)"[^>]*>\s*([^<]+)\s*<\/option>/g;
    let m;
    const seriesList = [];
    while ((m = optionsRegex.exec(seriesMatch[1])) !== null) {
      const id = m[1];
      const name = m[2].trim();
      if (id && name) {
        seriesList.push({ id, name });
      }
    }
    console.log(`Discovered ${seriesList.length} total series from official website.`);
    return seriesList;
  } catch (err) {
    console.warn('Could not verify the complete official series list:', err.message);
    return [];
  }
}

export async function syncSeries(series, includeParallel = false, existingCardMap = new Map(), fetchHtml = async url => (await fetchWithRetry(url, { signal: AbortSignal.timeout(20_000) })).text(), refreshExisting = false) {
  const seriesId = series.id || series.seriesId;
  console.log(`\n=== Checking series: ${series.name} (${seriesId}) ===`);
  const listUrl = `https://www.unionarena-tcg.com/jp/cardlist/?search=true&series=${seriesId}`;
  const html = await fetchHtml(listUrl);

  const regex = /href="\.\/detail_iframe\.php\?card_no=([^"]+)"[^>]*>[\s\S]*?<img[^>]*data-src="([^"]+)"[^>]*alt="([^"]+)"/g;
  let match;
  const cardsSummary = [];
  while ((match = regex.exec(html)) !== null) {
    const cardNo = match[1];
    if (!includeParallel && cardNo.includes('_p')) continue;

    const rawImg = match[2];
    const imgUrl = rawImg.startsWith('http') ? rawImg : `https://www.unionarena-tcg.com${rawImg}`;
    cardsSummary.push({ cardNo, imgUrl });
  }
  if (!cardsSummary.length) throw new Error(`No verified card list for series ${seriesId}`);
  const expectedCodes = new Set(Array.from(html.matchAll(/href=["'][^"']*detail_iframe\.php\?card_no=([^"'&]+)/g), match => match[1]).filter(code => includeParallel || !/_p\d+$/i.test(code)));
  const parsedCodes = new Set(cardsSummary.map(card => card.cardNo));
  if (expectedCodes.size !== parsedCodes.size || [...expectedCodes].some(code => !parsedCodes.has(code))) {
    throw new Error(`Incomplete card list parsing for series ${seriesId}`);
  }

  // 既に取得済みのカードをフィルタリング（増分同期で高速化）
  const needsFetch = cardsSummary.filter(({ cardNo }) => {
    const existing = existingCardMap.get(cardNo);
    return (
      refreshExisting || !existing ||
      !existing.rarity ||
      !existing.name ||
      (existing.cardType === 'CHARACTER' && existing.bp === null)
    );
  });

  console.log(
    `Series ${series.name}: total ${cardsSummary.length} cards (${cardsSummary.length - needsFetch.length} already cached, ${needsFetch.length} to fetch)`
  );

  const newCards = [];
  if (needsFetch.length > 0) {
    // Concurrency limit: 8
    const concurrency = 8;
    for (let i = 0; i < needsFetch.length; i += concurrency) {
      const chunk = needsFetch.slice(i, i + concurrency);
      const promises = chunk.map(async ({ cardNo, imgUrl }) => {
        try {
          const detailUrl = `https://www.unionarena-tcg.com/jp/cardlist/detail_iframe.php?card_no=${encodeURIComponent(cardNo)}`;
          const detailHtml = await fetchHtml(detailUrl);
          validateOfficialCardDetail(detailHtml, cardNo);
          const card = parseCardFromDetailHtml(detailHtml, cardNo, imgUrl);
          validateOfficialCardDetail(detailHtml, cardNo, card);
          card.seriesId = seriesId;
          card.seriesName = series.name;
          return card;
        } catch (err) {
          console.error(`Error fetching ${cardNo}:`, err.message);
          throw err;
        }
      });

      const results = await Promise.all(promises);
      newCards.push(...results.filter(Boolean));
      process.stdout.write(`\rFetching progress: ${newCards.length}/${needsFetch.length}`);
    }
    console.log(`\nFetched ${newCards.length} new cards.`);
  }

  return { allInSeries: cardsSummary, newCards };
}

export function repairSynchronizedTriggers(cards) {
  return cards.map((card) =>
    card.triggers?.length === 2 && card.triggers.includes('ACTIVE') && card.triggers.includes('COLOR')
      ? { ...card, triggers: ['COLOR'] }
      : card
  );
}

// Build a complete result before writing. Unknown categories or network failures
// abort the repair; never infer a stored card's type from BP or its name.
export async function repairSynchronizedCardTypes(cards, fetchDetail) {
  const updates = new Map();
  const targets = cards.filter((card) => card.cardType === 'ACTION_POINT' && !isActionPointCardNumber(card.code));
  for (let offset = 0; offset < targets.length; offset += 8) {
    const results = await Promise.all(targets.slice(offset, offset + 8).map(async (card) => {
      const html = await fetchDetail(card.code);
      const category = html.match(/<dl class="cardDataCol categoryData">[\s\S]*?<dd class="cardDataContents">\s*([^<]+)\s*<\/dd>/)?.[1] || '';
      if (!parseCardCategory(category)) throw new Error(`Missing card category for ${card.code}`);
      const number = html.match(/<span class="cardNumData(?: [^"]*)?">\s*([^<]+)\s*<\/span>/)?.[1].trim();
      const base = card.code.replace(/_p\d+$/i, '');
      const image = html.match(/<dd class="cardDataImgCol(?: [^"]*)?">\s*<img[^>]*src="([^"]+)"/)?.[1];
      if (number !== card.code && (number !== base || !/_p\d+$/i.test(card.code) || image?.split('/').pop()?.split('?')[0] !== `${card.code.replace('/', '_')}.png`)) {
        throw new Error(`Unverified official identity: ${card.code}`);
      }
      const cardType = inferCardType(category, card.code);
      return [card.code, cardType === card.cardType ? card : { ...card, cardType }];
    }));
    results.forEach(([code, card]) => updates.set(code, card));
  }
  return cards.map((card) => updates.get(card.code) || card);
}

// Repair numeric stats from official text; preserve effects, identity and AP assets.
// A response for another card or an unknown HTML value must never become data.
export async function repairSynchronizedCardStats(cards, fetchDetail) {
  const updates = new Map();
  const targets = cards.filter(card => card.cardType !== 'ACTION_POINT' && !card.isUnrevealed);
  for (let offset = 0; offset < targets.length; offset += 8) {
    const results = await Promise.all(targets.slice(offset, offset + 8).map(async card => {
      const html = await fetchDetail(card.code);
      const fail = () => { throw new Error(`Unverified printed stats for ${card.code}`); };
      const number = html.match(/<span class="cardNumData">\s*([^<]+)\s*<\/span>/)?.[1].trim();
      const baseCode = card.code.replace(/_p\d+$/i, '');
      if (number !== card.code) {
        const image = html.match(/<dd class="cardDataImgCol(?: [^"]*)?">\s*<img[^>]*src="([^"]+)"/)?.[1];
        // Parallel detail headings use the base number; the image identifies the printing.
        if (number !== baseCode || !/_p\d+$/i.test(card.code) || image?.split('/').pop()?.split('?')[0] !== `${card.code.replace('/', '_')}.png`) fail();
      }
      const section = name => html.match(new RegExp(`<dl class="cardDataCol ${name}">[\\s\\S]*?<dd class="cardDataContents">([\\s\\S]*?)<\\/dd>`))?.[1];
      const plain = value => value?.replace(/<[^>]+>/g, '').trim();
      const category = plain(section('categoryData')) || '';
      if (!parseCardCategory(category)) fail();
      const type = inferCardType(category, card.code);
      if (type === 'ACTION_POINT') fail();
      const bp = plain(section('bpData'))?.replace(/&#xB1;|&#177;|&plusmn;/gi, '±').replace(/&#x2B;|&#43;|&plus;/gi, '+');
      if (type === 'CHARACTER' ? !/^\d+[+＋±-]?$/.test(bp || '') && !(hasReviewedOfficialBpDash(card.code) && bp === '-') : bp !== undefined && bp !== '-') fail();
      if (!/^\d+$/.test(plain(section('apData')) || '')) fail();
      const need = section('needEnergyData')?.match(/alt="([^"]+)"/)?.[1];
      if (!/^[紫緑赤青黄](?:[／/][紫緑赤青黄])*(?:\d+|-)$/.test(need || '')) fail();
      const energy = section('generatedEnergyData');
      if (energy === undefined) fail();
      const icons = energy.match(/<img\b[^>]*>/g) || [];
      if (icons.some(icon => !/^[紫緑赤青黄]+[+＋]?$/.test(icon.match(/alt="([^"]+)"/)?.[1] || ''))) fail();
      if (!icons.length && !['', '-'].includes(plain(energy))) fail();
      const parsed = parseCardFromDetailHtml(html, card.code, card.imageUrl);
      const fields = ['cardType', 'bp', 'hasBpPlus', 'reqEnergy', 'apCost', 'genEnergy', 'hasGenEnergyPlus', 'reqEnergyColors'];
      // The current color model cannot represent a choice of colors. Preserve it
      // rather than turning a multi-color requirement into a guessed single color.
      if (!/[／/]/.test(need)) fields.push('color');
      const stats = Object.fromEntries(fields.map(field => [field, parsed[field]]));
      return [card.code, fields.every(field => (field.startsWith('has') ? card[field] ?? false : card[field]) === stats[field]) ? card : { ...card, ...stats }];
    }));
    results.forEach(([code, card]) => updates.set(code, card));
  }
  return cards.map(card => updates.get(card.code) || card);
}

export async function repairSynchronizedCardText(cards, fetchDetail) {
  const updates = new Map();
  const targets = cards.filter(card => card.cardType !== 'ACTION_POINT' && !card.isUnrevealed);
  for (let offset = 0; offset < targets.length; offset += 8) {
    await Promise.all(targets.slice(offset, offset + 8).map(async card => {
      const html = await fetchDetail(card.code);
      validateOfficialCardDetail(html, card.code);
      const parsed = parseCardFromDetailHtml(html, card.code, card.imageUrl);
      const fields = ['name', 'title', 'traits', 'effectText'];
      validateOfficialCardDetail(html, card.code, parsed);
      const text = Object.fromEntries(fields.map(field => [field, parsed[field]]));
      updates.set(card.code, fields.every(field => JSON.stringify(card[field]) === JSON.stringify(parsed[field])) ? card : { ...card, ...text });
    }));
  }
  return cards.map(card => updates.get(card.code) || card);
}

// Validate source and parsed values before a numeric-only repair can be published.
export async function repairSynchronizedCardEnergy(cards, fetchDetail) {
  const updates = new Map();
  const targets = cards.filter(card => card.cardType !== 'EVENT' && card.cardType !== 'ACTION_POINT' && !card.isUnrevealed);
  for (let offset = 0; offset < targets.length; offset += 8) {
    const batch = await Promise.all(targets.slice(offset, offset + 8).map(async card => {
      const html = await fetchDetail(card.code);
      validateOfficialCardDetail(html, card.code);
      const parsed = parseCardFromDetailHtml(html, card.code, card.imageUrl);
      validateOfficialCardDetail(html, card.code, parsed);
      return [card.code, { ...card, genEnergy: parsed.genEnergy, hasGenEnergyPlus: parsed.hasGenEnergyPlus }];
    }));
    batch.forEach(([code, updated]) => updates.set(code, updated));
  }
  return cards.map(card => updates.get(card.code) || card);
}

async function main() {
  const args = process.argv.slice(2);
  const syncAll = args.includes('--all');
  const includeParallel = args.includes('--include-parallel');
  const refreshEnergy = args.includes('--refresh-energy');
  const repairTriggers = args.includes('--repair-triggers');
  const repairCardTypes = args.includes('--repair-card-types');
  const repairCardStats = args.includes('--repair-card-stats');
  const repairCardText = args.includes('--repair-card-text');
  const dryRun = args.includes('--dry-run');
  const refreshExisting = args.includes('--refresh');

  const outputPath = path.resolve(__dirname, '../src/data/officialCards.json');
  let existingCards = [];
  if (fs.existsSync(outputPath)) {
    try {
      existingCards = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
    } catch (e) {
      throw new Error(`Could not read existing officialCards.json: ${e.message}`, { cause: e });
    }
  }

  if (!Array.isArray(existingCards)) throw new Error('Invalid existing card dataset');
  const publish = cards => {
    const report = publishCardData(outputPath, cards, existingCards, { dryRun });
    console.log(`${dryRun ? 'Dry run (not saved)' : 'Validated update'}: ${report.total} cards, ${report.added} added, ${report.updated} changed.`);
    console.log(`Existing official text differences requiring official-text/errata review: ${report.pendingPrintingReviews.length}`);
    for (const change of report.changes) console.log(`${change.code}: ${change.fields.join(', ')}`);
    return report;
  };

  if (repairCardText) {
    const repaired = await repairSynchronizedCardText(existingCards, async code => {
      const response = await fetchWithRetry(`https://www.unionarena-tcg.com/jp/cardlist/detail_iframe.php?card_no=${encodeURIComponent(code)}`, { signal: AbortSignal.timeout(20_000) });
      return response.text();
    });
    publish(repaired);
    return;
  }

  if (repairCardStats) {
    if (!Array.isArray(existingCards) || !existingCards.length) throw new Error('No existing cards to verify');
    let fetched = 0;
    const repaired = await repairSynchronizedCardStats(existingCards, async code => {
      const response = await fetchWithRetry(`https://www.unionarena-tcg.com/jp/cardlist/detail_iframe.php?card_no=${encodeURIComponent(code)}`, { signal: AbortSignal.timeout(20_000) });
      const html = await response.text();
      if (++fetched % 256 === 0) console.log(`Verified ${fetched} official details...`);
      return html;
    });
    publish(repaired);
    console.log(`Repaired printed stats for ${repaired.filter((card, index) => card !== existingCards[index]).length} cards; AP and unpublished cards preserved.`);
    return;
  }

  if (repairCardTypes) {
    const repaired = await repairSynchronizedCardTypes(existingCards, async (code) => {
      const url = `https://www.unionarena-tcg.com/jp/cardlist/detail_iframe.php?card_no=${encodeURIComponent(code)}`;
      const response = await fetchWithRetry(url, { signal: AbortSignal.timeout(20_000) });
      return response.text();
    });
    const changed = repaired.filter((card, index) => card !== existingCards[index]).length;
    publish(repaired);
    console.log(`Repaired ${changed} card types from official categories; all other fields preserved.`);
    return;
  }

  if (repairTriggers) {
    const repaired = repairSynchronizedTriggers(existingCards);
    const changed = repaired.filter((card, index) => card !== existingCards[index]).length;
    publish(repaired);
    console.log(`Repaired ${changed} synchronized trigger entries without network access.`);
    return;
  }

  if (refreshEnergy) {
    const refreshed = await repairSynchronizedCardEnergy(existingCards, async code => {
      const detailUrl = `https://www.unionarena-tcg.com/jp/cardlist/detail_iframe.php?card_no=${encodeURIComponent(code)}`;
      return (await fetchWithRetry(detailUrl, { signal: AbortSignal.timeout(20_000) })).text();
    });
    publish(refreshed);
    console.log(`Processed ${refreshed.length} cards for generated-energy refresh; AP, events and unpublished cards preserved.`);
    return;
  }

  if (existingCards.length) validateOfficialCardDataset(existingCards);
  const cardMap = new Map();
  existingCards.forEach((c) => cardMap.set(c.code, c));
  console.log(`Existing database has ${cardMap.size} cards.`);

  let seriesList = DEFAULT_SERIES;
  if (syncAll) {
    // 公式サイトから動的に最新のシリーズリストを直接取得
    const latestList = await fetchLatestOfficialSeriesList();
    if (latestList.length > 0) {
      seriesList = latestList;
    } else {
      throw new Error('Cannot verify the complete official series list; no data saved.');
    }
    console.log(`Ready to sync ${seriesList.length} total series.`);
  }

  for (let idx = 0; idx < seriesList.length; idx++) {
    const series = seriesList[idx];
    const { newCards } = await syncSeries(series, includeParallel, cardMap, undefined, refreshExisting);
    for (const card of newCards) {
      cardMap.set(card.code, card);
    }
  }

  const allCards = Array.from(cardMap.values());
  const report = publish(allCards);
  console.log(`\n========================================`);
  console.log(`Sync completed!`);
  console.log(`New cards added: ${report.added}; existing cards updated: ${report.updated}`);
  console.log(`Total database size: ${allCards.length} cards.`);
  console.log(`${dryRun ? 'Output not written (dry run)' : 'Saved to'}: ${outputPath}`);
  console.log(`========================================`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
