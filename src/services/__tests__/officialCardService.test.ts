import { afterEach, describe, it, expect, vi } from 'vitest';
import {
  fetchSeriesCardsViaProxy,
  parseCardFromDetailHtml,
  parseCardListHtml,
  parseDeckListText,
} from '../officialCardService';
import { CARD_DATABASE } from '../../data/cardDatabase';

describe('officialCardService Tests', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('should correctly parse card list HTML', () => {
    const mockListHtml = `
      <ul class="cardListCol">
        <li class="cardImgCol">
          <a class="modalCardDataOpen" href="./detail_iframe.php?card_no=UA01BT/CGH-1-001">
            <img data-src="/jp/images/cardlist/card/UA01BT_CGH-1-001.png" alt="UA01BT/CGH-1-001 扇 要">
          </a>
        </li>
        <li class="cardImgCol">
          <a class="modalCardDataOpen" href="./detail_iframe.php?card_no=UA01BT/CGH-1-002">
            <img data-src="/jp/images/cardlist/card/UA01BT_CGH-1-002.png" alt="UA01BT/CGH-1-002 紅月 カレン">
          </a>
        </li>
      </ul>
    `;

    const list = parseCardListHtml(mockListHtml);
    expect(list.length).toBe(2);
    expect(list[0].cardNo).toBe('UA01BT/CGH-1-001');
    expect(list[0].name).toBe('扇 要');
    expect(list[0].imgUrl).toContain('UA01BT_CGH-1-001.png');
  });

  it('should parse detail HTML into full CardMaster', () => {
    const mockDetailHtml = `
      <div class="cardNameNumCol">
        <h2 class="cardNameCol">ルルーシュ・ランペルージ</h2>
      </div>
      <dd class="cardDataTitleCol cgh"><img alt="コードギアス 反逆のルルーシュ"></dd>
      <dl class="cardDataCol needEnergyData"><dd class="cardDataContents"><img alt="紫2"></dd></dl>
      <dl class="cardDataCol apData"><dd class="cardDataContents">1</dd></dl>
      <dl class="cardDataCol categoryData"><dd class="cardDataContents">キャラクター</dd></dl>
      <dl class="cardDataCol bpData"><dd class="cardDataContents">3000</dd></dl>
      <dl class="cardDataCol attributeData"><dd class="cardDataContents">黒の騎士団 / 生徒会</dd></dl>
      <dl class="cardDataCol generatedEnergyData"><dd class="cardDataContents"><img alt="紫+"></dd></dl>
      <dl class="cardDataCol effectData"><dd class="cardDataContents">【登場時】カードを1枚引く。</dd></dl>
      <dl class="cardDataCol triggerData"><dd class="cardDataContents"><img alt="ドロー"></dd></dl>
    `;

    const card = parseCardFromDetailHtml(mockDetailHtml, 'UA01BT/CGH-1-010', 'https://example.com/cgh10.png');
    expect(card.code).toBe('UA01BT/CGH-1-010');
    expect(card.baseCode).toBe('UA01BT/CGH-1-010');
    expect(card.isParallel).toBe(false);
    expect(card.isUnrevealed).toBe(false);
    expect(card.name).toBe('ルルーシュ・ランペルージ');
    expect(card.titleCode).toBe('CGH');
    expect(card.title).toBe('コードギアス 反逆のルルーシュ');
    expect(card.cardType).toBe('CHARACTER');
    expect(card.color).toBe('PURPLE');
    expect(card.reqEnergy).toBe(2);
    expect(card.apCost).toBe(1);
    expect(card.bp).toBe(3000);
    expect(card.traits).toEqual(['黒の騎士団', '生徒会']);
    expect(card.genEnergy).toBe(1);
    expect(card.triggers).toContain('DRAW');
    expect(card.effectText).toBe('【登場時】カードを1枚引く。');
    expect(card.imageUrl).toBe('https://example.com/cgh10.png');
  });

  it('reads trigger icons without treating their effect descriptions as extra triggers', () => {
    const html = `<dl class="cardDataCol triggerData"><dd class="cardDataContents">
      <img alt="カラー">自分の場にアクティブで登場させる。<img alt="アクティブ">
    </dd></dl>`;

    expect(parseCardFromDetailHtml(html, 'UA01BT/CGH-1-003').triggers).toEqual(['COLOR']);
  });

  it('has no multi-trigger entries in synchronized official card data', () => {
    expect(CARD_DATABASE.filter((card) => card.triggers.length > 1).map((card) => card.code)).toEqual([]);
  });

  it.each([
    ['purple1.png', '紫', 1, false],
    ['purple2.png', '紫+', 1, true],
    ['purple3.png', '紫紫', 2, false],
    ['purple4.png', '紫紫+', 2, true],
    ['green2.png', '緑+', 1, true],
  ])('reads base generated energy and plus mark from %s (%s)', (filename, alt, expected, hasPlus) => {
    const html = `
      <dl class="cardDataCol categoryData"><dd class="cardDataContents">キャラクター</dd></dl>
      <dl class="cardDataCol generatedEnergyData"><dd class="cardDataContents">
        <img src="/jp/images/cardlist/icon/resource/ico_resource_energy_${filename}" alt="${alt}">
      </dd></dl>
    `;

    const card = parseCardFromDetailHtml(html, 'UA01BT/CGH-1-001');
    expect(card.genEnergy).toBe(expected);
    expect(card.hasGenEnergyPlus).toBe(hasPlus);
  });

  it('keeps an explicit empty generated energy field at zero', () => {
    const html = `
      <dl class="cardDataCol categoryData"><dd class="cardDataContents">キャラクター</dd></dl>
      <dl class="cardDataCol generatedEnergyData"><dd class="cardDataContents">-</dd></dl>
    `;

    expect(parseCardFromDetailHtml(html, 'UA40BT/REZ-1-043').genEnergy).toBe(0);
    expect(parseCardFromDetailHtml(html, 'UA40BT/REZ-1-043').hasGenEnergyPlus).toBe(false);
  });

  it('keeps synchronized card energy in line with the official printed icons', () => {
    const energy = (code: string) => CARD_DATABASE.find((card) => card.code === code);

    expect(energy('UA01BT/CGH-1-001')).toMatchObject({ genEnergy: 1, hasGenEnergyPlus: true });
    expect(energy('UA42ST/MGS-1-039')).toMatchObject({ genEnergy: 2 });
    expect(energy('UA42ST/MGS-1-039')?.hasGenEnergyPlus).not.toBe(true);
    expect(energy('UA43BT/SMD-1-054')).toMatchObject({ genEnergy: 2, hasGenEnergyPlus: true });
    expect(energy('UA01BT/CGH-1-047')).toMatchObject({ genEnergy: 3 });
    expect(energy('UA01BT/CGH-1-047')?.hasGenEnergyPlus).not.toBe(true);
    expect(energy('UA40BT/REZ-1-043')).toMatchObject({ genEnergy: 0 });
    expect(energy('UA40BT/REZ-1-043')?.hasGenEnergyPlus).not.toBe(true);
  });

  it('should parse rarity and parallel cards correctly', () => {
    const mockParallelDetailHtml = `
      <div class="cardNameNumCol">
        <h2 class="cardNameCol">ルルーシュ・ランペルージ</h2>
      </div>
      <dd class="cardDataTitleCol cgh"><img alt="コードギアス 反逆のルルーシュ"></dd>
      <dl class="cardDataCol rareData"><dd class="cardDataContents">SR★★★</dd></dl>
      <dl class="cardDataCol needEnergyData"><dd class="cardDataContents"><img alt="紫2"></dd></dl>
      <dl class="cardDataCol categoryData"><dd class="cardDataContents">キャラクター</dd></dl>
      <dl class="cardDataCol bpData"><dd class="cardDataContents">3000</dd></dl>
      <dl class="cardDataCol effectData"><dd class="cardDataContents">テキスト</dd></dl>
    `;

    const parallelCard = parseCardFromDetailHtml(
      mockParallelDetailHtml,
      'UA01BT/CGH-1-010_p1',
      'https://example.com/cgh10_p1.png'
    );
    expect(parallelCard.code).toBe('UA01BT/CGH-1-010_p1');
    expect(parallelCard.baseCode).toBe('UA01BT/CGH-1-010');
    expect(parallelCard.isParallel).toBe(true);
    expect(parallelCard.rarity).toBe('SR★★★');
  });

  it('should detect unrevealed (COMING SOON) cards', () => {
    const mockComingSoonHtml = `
      <div class="cardNameNumCol">
        <h2 class="cardNameCol">comingsoon</h2>
      </div>
      <dd class="cardDataTitleCol cgh"><img alt="コードギアス 反逆のルルーシュ"></dd>
      <dl class="cardDataCol categoryData"><dd class="cardDataContents">キャラクター</dd></dl>
      <dl class="cardDataCol bpData"><dd class="cardDataContents">-</dd></dl>
      <dl class="cardDataCol effectData"><dd class="cardDataContents">-</dd></dl>
    `;

    const unrevealedCard = parseCardFromDetailHtml(
      mockComingSoonHtml,
      'UA01BT/CGH-1-099',
      'https://example.com/comingsoon.png'
    );
    expect(unrevealedCard.isUnrevealed).toBe(true);
    expect(unrevealedCard.name).toContain('COMING SOON');
  });

  it('should support includeParallel option in parseCardListHtml', () => {
    const mockListHtml = `
      <ul class="cardListCol">
        <li class="cardImgCol">
          <a class="modalCardDataOpen" href="./detail_iframe.php?card_no=UA01BT/CGH-1-001">
            <img data-src="/jp/images/cardlist/card/UA01BT_CGH-1-001.png" alt="UA01BT/CGH-1-001 扇 要">
          </a>
        </li>
        <li class="cardImgCol">
          <a class="modalCardDataOpen" href="./detail_iframe.php?card_no=UA01BT/CGH-1-001_p1">
            <img data-src="/jp/images/cardlist/card/UA01BT_CGH-1-001_p1.png" alt="UA01BT/CGH-1-001_p1 扇 要">
          </a>
        </li>
      </ul>
    `;

    const withoutParallel = parseCardListHtml(mockListHtml, { includeParallel: false });
    expect(withoutParallel.length).toBe(1);
    expect(withoutParallel[0].cardNo).toBe('UA01BT/CGH-1-001');

    const withParallel = parseCardListHtml(mockListHtml, { includeParallel: true });
    expect(withParallel.length).toBe(2);
    expect(withParallel[1].isParallel).toBe(true);
  });

  it('parses list images regardless of attribute order, supports src, and removes duplicate card entries', () => {
    const html = `
      <a href="/jp/cardlist/detail_iframe.php?card_no=UA01BT/CGH-1-001">
        <img alt="UA01BT/CGH-1-001 扇 要" src="/jp/images/card-1.png">
      </a>
      <a href="./detail_iframe.php?card_no=UA01BT/CGH-1-001">
        <img data-src="/jp/images/card-1-duplicate.png" alt="UA01BT/CGH-1-001 扇 要">
      </a>
      <a href="./detail_iframe.php?card_no=UA01BT/CGH-1-002">
        <img alt="UA01BT/CGH-1-002 紅月 カレン" data-src="https://example.com/card-2.png">
      </a>
    `;

    const cards = parseCardListHtml(html);

    expect(cards).toHaveLength(2);
    expect(cards[0]).toMatchObject({
      cardNo: 'UA01BT/CGH-1-001',
      name: '扇 要',
      imgUrl: 'https://www.unionarena-tcg.com/jp/images/card-1.png',
    });
    expect(cards[1].imgUrl).toBe('https://example.com/card-2.png');
  });

  it('should parse deck list text into DeckItems', () => {
    const deckText = `
      UA01BT/CGH-1-001 x4
      UA01BT/CGH-1-002 3
      # Comment line
      UNKNOWN/XXX-1-001 x2
    `;

    const { items, notFound } = parseDeckListText(deckText, CARD_DATABASE);
    expect(items.length).toBeGreaterThanOrEqual(1);
    expect(notFound).toContain('UNKNOWN/XXX-1-001');
  });

  it('should parse BP with + notation (e.g. 4000+, 2000+) correctly with numeric bp and hasBpPlus flag', () => {
    const mockPlusBpHtml = `
      <div class="cardNameNumCol">
        <h2 class="cardNameCol">紅月 カレン</h2>
      </div>
      <dd class="cardDataTitleCol cgh"><img alt="コードギアス 反逆のルルーシュ"></dd>
      <dl class="cardDataCol needEnergyData"><dd class="cardDataContents"><img alt="赤1"></dd></dl>
      <dl class="cardDataCol apData"><dd class="cardDataContents">1</dd></dl>
      <dl class="cardDataCol categoryData"><dd class="cardDataContents">キャラクター</dd></dl>
      <dl class="cardDataCol bpData"><dd class="cardDataContents">2000+</dd></dl>
      <dl class="cardDataCol effectData"><dd class="cardDataContents">[自分のターン中]BP+1000。</dd></dl>
    `;

    const card = parseCardFromDetailHtml(mockPlusBpHtml, 'UA01BT/CGH-1-003', 'https://example.com/cgh3.png');
    expect(card.bp).toBe(2000);
    expect(card.hasBpPlus).toBe(true);
  });

  it('parses action point cards as colorless and reads a relative image with reordered attributes', () => {
    const html = `
      <h2 class="cardNameCol">アクションポイント</h2>
      <dd class="cardDataImgCol"><img alt="APカード" loading="lazy" src="/jp/images/cardlist/card/AP_CARD.png"></dd>
      <dl class="cardDataCol categoryData"><dd class="cardDataContents">アクションポイント</dd></dl>
      <dl class="cardDataCol bpData"><dd class="cardDataContents">-</dd></dl>
    `;

    const card = parseCardFromDetailHtml(html, 'UA01AP/CGH-1-001');

    expect(card.cardType).toBe('ACTION_POINT');
    expect(card.color).toBe('COLORLESS');
    expect(card.imageUrl).toBe('https://www.unionarena-tcg.com/jp/images/cardlist/card/AP_CARD.png');
  });

  it('merges duplicate deck lines and ignores a zero card count', () => {
    const card = CARD_DATABASE[0];
    const zeroCountCard = CARD_DATABASE.find((candidate) => candidate.code !== card.code)!;
    const text = `${card.code} x2\n${card.code} 1\n${zeroCountCard.code} x0`;

    const { items, notFound } = parseDeckListText(text, [card, zeroCountCard]);

    expect(items).toHaveLength(1);
    expect(items[0].count).toBe(3);
    expect(notFound).toEqual([]);
  });

  it('returns structural fallback cards when detail retrieval fails without live network access', async () => {
    const listHtml = `
      <ul class="cardListCol">
        <a href="./detail_iframe.php?card_no=UA01BT/CGH-1-001">
          <img data-src="/jp/images/card-1.png" alt="UA01BT/CGH-1-001 扇 要">
        </a>
      </ul>
    `;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, text: async () => listHtml })
      .mockResolvedValue({ ok: false });
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const onProgress = vi.fn();

    const cards = await fetchSeriesCardsViaProxy('570101', onProgress);

    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({
      code: 'UA01BT/CGH-1-001',
      name: '扇 要',
      titleCode: 'CGH',
      seriesId: '570101',
      isParallel: false,
      isUnrevealed: false,
    });
    expect(onProgress).toHaveBeenCalledWith(1, 1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
