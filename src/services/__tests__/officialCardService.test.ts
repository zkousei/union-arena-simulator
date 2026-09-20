import { describe, it, expect } from 'vitest';
import {
  parseCardFromDetailHtml,
  parseCardListHtml,
  parseDeckListText,
} from '../officialCardService';
import { CARD_DATABASE } from '../../data/cardDatabase';

describe('officialCardService Tests', () => {
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
});
