// Official Card Synchronizer for Union Arena Simulator
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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

function parseCardFromDetailHtml(detailHtml, cardNo, fallbackImgUrl) {
  const titleCodeMatch = cardNo.match(/\/([A-Z0-9]+)-/);
  const titleCode = titleCodeMatch ? titleCodeMatch[1] : 'OTHER';

  const titleMatch = detailHtml.match(/<dd class="cardDataTitleCol[^"]*"><img[^>]*alt="([^"]+)"/);
  const title = titleMatch ? titleMatch[1].trim() : 'UNION ARENA';

  const nameMatch = detailHtml.match(/<h2 class="cardNameCol">\s*([\s\S]*?)\s*(?:<span class="rubyData">[\s\S]*?<\/span>)?\s*<\/h2>/);
  let name = nameMatch ? nameMatch[1].replace(/<[^>]+>/g, '').trim() : '';
  if (!name) {
    const altNameMatch = detailHtml.match(/<dd class="cardDataImgCol"><img[^>]*alt="[^"]*\s+([^"]+)"/);
    name = altNameMatch ? altNameMatch[1] : cardNo;
  }

  const catMatch = detailHtml.match(/<dl class="cardDataCol categoryData">[\s\S]*?<dd class="cardDataContents">\s*([^<]+)\s*<\/dd>/);
  const catRaw = catMatch ? catMatch[1].trim() : '';
  let cardType = 'CHARACTER';
  if (catRaw.includes('イベント') || catRaw.includes('EVENT')) {
    cardType = 'EVENT';
  } else if (catRaw.includes('フィールド') || catRaw.includes('FIELD')) {
    cardType = 'FIELD';
  } else if (catRaw.includes('アクションポイント') || catRaw.includes('AP') || cardNo.includes('AP')) {
    cardType = 'ACTION_POINT';
  }

  const needMatch = detailHtml.match(/<dl class="cardDataCol needEnergyData">[\s\S]*?<dd class="cardDataContents">([\s\S]*?)<\/dd>/);
  let color = 'PURPLE';
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
      hasBpPlus = /[+＋]/.test(rawBp);
    }
  }

  const traitMatch = detailHtml.match(/<dl class="cardDataCol attributeData">[\s\S]*?<dd class="cardDataContents">\s*([\s\S]*?)\s*<\/dd>/);
  let traits = [];
  if (traitMatch) {
    const rawTraits = traitMatch[1].replace(/<[^>]+>/g, '').trim();
    if (rawTraits && rawTraits !== '-') {
      traits = rawTraits.split(/[/／・]/).map(t => t.trim()).filter(Boolean);
    }
  }

  const genMatch = detailHtml.match(/<dl class="cardDataCol generatedEnergyData">[\s\S]*?<dd class="cardDataContents">([\s\S]*?)<\/dd>/);
  let genEnergy = 1;
  if (cardType === 'EVENT') {
    genEnergy = 0;
  } else if (genMatch) {
    const imgs = genMatch[1].match(/<img[^>]*>/g);
    if (!imgs || imgs.length === 0) {
      genEnergy = 0;
    } else {
      const hasTwo = /purple2|green2|red2|blue2|yellow2|2\.png/.test(genMatch[1]);
      genEnergy = hasTwo ? 2 : imgs.length;
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

  const imgMatch = detailHtml.match(/<dd class="cardDataImgCol"><img[^>]*src="([^"]+)"/);
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
    traits,
    triggers,
    effectText,
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
    console.warn('Could not fetch latest series list dynamically, falling back to local list:', err.message);
    return [];
  }
}

async function syncSeries(series, includeParallel = false, existingCardMap = new Map()) {
  const seriesId = series.id || series.seriesId;
  console.log(`\n=== Checking series: ${series.name} (${seriesId}) ===`);
  const listUrl = `https://www.unionarena-tcg.com/jp/cardlist/?search=true&series=${seriesId}`;
  const res = await fetchWithRetry(listUrl);
  const html = await res.text();

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

  // 既に取得済みのカードをフィルタリング（増分同期で高速化）
  const needsFetch = cardsSummary.filter(({ cardNo }) => {
    const existing = existingCardMap.get(cardNo);
    return (
      !existing ||
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
          const detailRes = await fetchWithRetry(detailUrl);
          const detailHtml = await detailRes.text();
          const card = parseCardFromDetailHtml(detailHtml, cardNo, imgUrl);
          card.seriesId = seriesId;
          card.seriesName = series.name;
          return card;
        } catch (err) {
          console.error(`Error fetching ${cardNo}:`, err.message);
          return null;
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

async function main() {
  const args = process.argv.slice(2);
  const syncAll = args.includes('--all');
  const includeParallel = args.includes('--include-parallel');

  const outputPath = path.resolve(__dirname, '../src/data/officialCards.json');
  let existingCards = [];
  if (fs.existsSync(outputPath)) {
    try {
      existingCards = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
    } catch (e) {
      console.warn('Could not read existing officialCards.json:', e.message);
    }
  }

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
      // フォールバック: officialSeriesData.ts から全117シリーズ読み込み
      const seriesDataFile = fs.readFileSync(path.resolve(__dirname, '../src/data/officialSeriesData.ts'), 'utf-8');
      const matches = Array.from(seriesDataFile.matchAll(/\{\s*seriesId:\s*"([^"]+)",\s*name:\s*"([^"]+)"\s*\}/g));
      seriesList = matches.map((m) => ({ id: m[1], name: m[2] }));
    }
    console.log(`Ready to sync ${seriesList.length} total series.`);
  }

  let totalAdded = 0;
  for (let idx = 0; idx < seriesList.length; idx++) {
    const series = seriesList[idx];
    try {
      const { newCards } = await syncSeries(series, includeParallel, cardMap);
      for (const card of newCards) {
        cardMap.set(card.code, card);
        totalAdded++;
      }

      // 中間セーブ（シリーズごとに定期保存し、途中で中断されても進捗を保護）
      if (newCards.length > 0) {
        const allCards = Array.from(cardMap.values());
        fs.writeFileSync(outputPath, JSON.stringify(allCards, null, 2), 'utf-8');
      }
    } catch (err) {
      console.error(`Failed to sync series ${series.id || series.seriesId}:`, err.message);
    }
  }

  const allCards = Array.from(cardMap.values());
  console.log(`\n========================================`);
  console.log(`Sync completed!`);
  console.log(`New cards added: ${totalAdded}`);
  console.log(`Total database size: ${allCards.length} cards.`);
  console.log(`Saved to: ${outputPath}`);
  console.log(`========================================`);
}

main().catch(console.error);
