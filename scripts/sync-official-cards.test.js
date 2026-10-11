import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseCardFromDetailHtml, repairSynchronizedTriggers, repairSynchronizedCardTypes, repairSynchronizedCardStats } from './sync-official-cards.js';
describe('official text integrity', () => {
  it.each([
    ['UA40BT/REZ-1-086', '-', 0, false],
    ['UA40BT/REZ-1-090', '-', 0, false],
    ['UA40BT/REZ-1-090_p1', '-', 0, false],
    ['UAPR/NGR-1-003', '<img alt="黄">', 1, false],
  ])('uses official text energy even when artwork differs: %s', (code, energy, genEnergy, hasGenEnergyPlus) => {
    const html = `<dl class="cardDataCol generatedEnergyData"><dd class="cardDataContents">${energy}</dd></dl>`;
    expect(parseCardFromDetailHtml(html, code)).toMatchObject({ genEnergy, hasGenEnergyPlus });
  });
  it('preserves every color of the official multi-color requirement without changing generated energy', () => {
    const html = '<dl class="cardDataCol categoryData"><dd class="cardDataContents">イベント</dd></dl><dl class="cardDataCol needEnergyData"><dd class="cardDataContents"><img alt="赤／青／黄／緑／紫4"></dd></dl>';
    expect(parseCardFromDetailHtml(html, 'UAPR/KJ8-P-001')).toMatchObject({ reqEnergy: 4, reqEnergyColors: ['RED', 'BLUE', 'YELLOW', 'GREEN', 'PURPLE'], genEnergy: 0 });
    expect(parseCardFromDetailHtml(html.replace('赤／青／黄／緑／紫4', '紫4'), 'UAPR/KJ8-P-001').reqEnergyColors).toBeUndefined();
  });
  it('preserves middle dots in trait names and decodes printed HTML text', () => {
    const html = `<h2 class="cardNameCol">名前&quot;別名&quot;</h2>
      <dl class="cardDataCol attributeData"><dd class="cardDataContents">テトラライン／カフェ・スウィーティー</dd></dl>
      <dl class="cardDataCol effectData"><dd class="cardDataContents">A&amp;B&lt;条件&gt;&#43;1000</dd></dl>`;
    expect(parseCardFromDetailHtml(html, 'UA18BT/NIK-1-071')).toMatchObject({ name: '名前"別名"', traits: ['テトラライン', 'カフェ・スウィーティー'], effectText: 'A&B<条件>+1000' });
  });
});

describe('official printed stat repair', () => {
  it('repairs the missing BP from a real official promo fixture without relying on another printing', async () => {
    const html = readFileSync(new URL('../src/services/__tests__/fixtures/official-gim-promo.html', import.meta.url), 'utf8');
    const repaired = await repairSynchronizedCardStats([{ code: 'UAPB/GIM-2-004', cardType: 'CHARACTER', bp: null }], async () => html);
    expect(repaired[0]).toMatchObject({ bp: 1000, hasBpPlus: true, color: 'YELLOW', apCost: 1, reqEnergy: 0, genEnergy: 1 });
  });
  const detail = (bp = '1000+') => `<span class="cardNumData">UAPB/GIM-2-004</span>
    <dl class="cardDataCol categoryData"><dd class="cardDataContents">キャラクター</dd></dl>
    <dl class="cardDataCol bpData"><dd class="cardDataContents">${bp}</dd></dl>
    <dl class="cardDataCol needEnergyData"><dd class="cardDataContents"><img alt="黄-"></dd></dl>
    <dl class="cardDataCol apData"><dd class="cardDataContents">1</dd></dl>
    <dl class="cardDataCol generatedEnergyData"><dd class="cardDataContents"><img alt="黄"></dd></dl>`;
  it('repairs confirmed printed stats while preserving identity, effects, AP and unpublished cards', async () => {
    const cards = [
      { code: 'UAPB/GIM-2-004', cardType: 'CHARACTER', bp: null, color: 'PURPLE', reqEnergy: 9, apCost: 3, genEnergy: 0, effectText: 'preserved' },
      { code: 'UAPR/2023-AP01', cardType: 'ACTION_POINT', bp: null },
      { code: 'UA99BT/NEW-1-001', cardType: 'CHARACTER', isUnrevealed: true, bp: null },
    ];
    const visited = [];
    const repaired = await repairSynchronizedCardStats(cards, async (code) => { visited.push(code); return detail(); });
    expect(visited).toEqual(['UAPB/GIM-2-004']);
    expect(repaired[0]).toEqual({ ...cards[0], bp: 1000, hasBpPlus: true, color: 'YELLOW', reqEnergy: 0, apCost: 1, genEnergy: 1, hasGenEnergyPlus: false });
    expect(repaired[1]).toBe(cards[1]);
    expect(repaired[2]).toBe(cards[2]);
    expect(cards[0].bp).toBeNull();
    expect((await repairSynchronizedCardStats([repaired[0]], async () => detail('0')))[0]).toMatchObject({ bp: 0, hasBpPlus: false });
    expect((await repairSynchronizedCardStats([repaired[0]], async () => detail('3500±')))[0]).toMatchObject({ bp: 3500, hasBpPlus: false });
  });
  it.each([
    '', detail('不明'), detail('-'), detail().replace('UAPB/GIM-2-004', 'UA01BT/CGH-1-001'),
    detail().replace('キャラクター', '不明'), detail().replace('alt="黄-"', 'alt="不明"'),
    detail().replace('alt="黄"', 'alt="不明"'), detail().replace('>1</dd>', '>不明</dd>'),
  ])('rejects unverified stats without modifying input', async (html) => {
    const cards = [{ code: 'UAPB/GIM-2-004', cardType: 'CHARACTER', bp: null }];
    await expect(repairSynchronizedCardStats(cards, async () => html)).rejects.toThrow();
    expect(cards[0].bp).toBeNull();
  });
  it('accepts non-character cards without BP and aborts failed fetches without changing cards', async () => {
    const cards = [{ code: 'UAPB/GIM-2-004', cardType: 'EVENT', bp: 9999, hasBpPlus: true }];
    const html = detail('-').replace('キャラクター', 'イベント').replace('<img alt="黄">', '-');
    expect((await repairSynchronizedCardStats(cards, async () => html))[0]).toMatchObject({ cardType: 'EVENT', bp: null, hasBpPlus: false, genEnergy: 0 });
    await expect(repairSynchronizedCardStats(cards, async () => { throw new Error('offline'); })).rejects.toThrow('offline');
    expect(cards[0].bp).toBe(9999);
  });
  it('verifies parallel printing identity through its image and does not guess a multi-color requirement', async () => {
    const parallel = { code: 'UAPB/GIM-2-004_p1', cardType: 'CHARACTER', bp: null, color: 'RED' };
    const image = '<dd class="cardDataImgCol"><img src="/jp/images/cardlist/card/UAPB_GIM-2-004_p1.png?v9"></dd>';
    await expect(repairSynchronizedCardStats([parallel], async () => detail())).rejects.toThrow();
    expect((await repairSynchronizedCardStats([parallel], async () => detail() + image))[0].bp).toBe(1000);
    const html = detail().replace('alt="黄-"', 'alt="赤／青／黄／緑／紫4"');
    expect((await repairSynchronizedCardStats([{ ...parallel, code: 'UAPB/GIM-2-004' }], async () => html))[0]).toMatchObject({ color: 'RED', reqEnergy: 4, bp: 1000 });
  });
  it('preserves the official CHARACTER category and explicit BP dash for the HTR promo', async () => {
    const html = detail('-').replaceAll('UAPB/GIM-2-004', 'UAPR/HTR-1-026');
    const [card] = await repairSynchronizedCardStats([{ code: 'UAPR/HTR-1-026', cardType: 'CHARACTER', bp: null }], async () => html);
    expect(card).toMatchObject({ cardType: 'CHARACTER', bp: null, hasBpPlus: false });
    expect(parseCardFromDetailHtml(html, 'UAPR/HTR-1-026').cardType).toBe('CHARACTER');
  });
});

describe('sync-official-cards card types', () => {
  it('repairs only confirmed card types and preserves AP cards and all other fields', async () => {
    const cards = [
      { code: 'UAPR/MMM-1-002', cardType: 'ACTION_POINT', bp: 5000, color: 'YELLOW' },
      { code: 'UAPR/IMS_AP04', cardType: 'ACTION_POINT', bp: null },
      { code: 'UA31BT/MMM-1-002', cardType: 'CHARACTER', bp: 5000 },
    ];
    const visited = [];
    const repaired = await repairSynchronizedCardTypes(cards, async (code) => {
      visited.push(code);
      return `<span class="cardNumData">${code}</span><dl class="cardDataCol categoryData"><dd class="cardDataContents">キャラクター</dd></dl>`;
    });
    expect(visited).toEqual(['UAPR/MMM-1-002']);
    expect(repaired[0]).toEqual({ ...cards[0], cardType: 'CHARACTER' });
    expect(repaired[1]).toBe(cards[1]);
    expect(repaired[2]).toBe(cards[2]);
    expect(cards[0].cardType).toBe('ACTION_POINT');
  });
  it('rejects a category response for another card without mutating the original', async () => {
    const cards = [{ code: 'UAPR/MMM-1-002', cardType: 'ACTION_POINT' }];
    const html = '<span class="cardNumData">UAPR/MMM-1-003</span><dl class="cardDataCol categoryData"><dd class="cardDataContents">キャラクター</dd></dl>';
    await expect(repairSynchronizedCardTypes(cards, async () => html)).rejects.toThrow(/identity/);
    expect(cards[0].cardType).toBe('ACTION_POINT');
  });
  it('rejects missing or unknown official categories without mutating the input', async () => {
    const cards = [{ code: 'UAPR/MMM-1-002', cardType: 'ACTION_POINT' }];
    for (const html of ['', '<dl class="cardDataCol categoryData"><dd class="cardDataContents">不明</dd></dl>']) {
      await expect(repairSynchronizedCardTypes(cards, async () => html)).rejects.toThrow(/Missing card category/);
    }
    await expect(repairSynchronizedCardTypes(cards, async () => { throw new Error('offline'); })).rejects.toThrow('offline');
    expect(cards[0].cardType).toBe('ACTION_POINT');
  });
  it.each([
    ['UAPR/MMM-1-002', 'キャラクター', 'CHARACTER'],
    ['UAPB/GIM-2-004', 'キャラクター', 'CHARACTER'],
    ['UAPR/MMM-1-030', 'イベント', 'EVENT'],
    ['UAPR/CGH-1-050', 'フィールド', 'FIELD'],
    ['UAPR/2023-AP01', 'アクションポイント', 'ACTION_POINT'],
    ['UAPR/IMS_AP04', '', 'ACTION_POINT'],
    ['UAPR/MMM-P-001', '', 'CHARACTER'],
    ['UA01AP/CGH-1-001', 'キャラクター', 'CHARACTER'],
  ])('classifies %s independently of the product prefix', (code, category, type) => {
    const html = `<dl class="cardDataCol categoryData"><dd class="cardDataContents">${category}</dd></dl>`;
    expect(parseCardFromDetailHtml(html, code).cardType).toBe(type);
  });
});

describe('sync-official-cards generated energy', () => {
  it.each(['1000+', '1000＋', '1000&#43;', '1000&#x2B;', '1000&plus;'])('reads printed BP plus markers: %s', bp => {
    const html = `<dl class="cardDataCol bpData"><dd class="cardDataContents">${bp}</dd></dl>`;
    expect(parseCardFromDetailHtml(html, 'UAPB/GIM-2-004')).toMatchObject({ bp: 1000, hasBpPlus: true });
  });
  it.each([
    ['purple1.png', '紫', 1, false],
    ['purple2.png', '紫+', 1, true],
    ['purple3.png', '紫紫', 2, false],
    ['purple4.png', '紫紫+', 2, true],
    ['green5.png', '緑緑緑', 3, false],
  ])('preserves base energy and the plus mark for %s', (filename, alt, expected, hasPlus) => {
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
});

describe('sync-official-cards trigger parsing', () => {
  it('ignores trigger names mentioned in the effect description', () => {
    const html = `<dl class="cardDataCol triggerData"><dd class="cardDataContents">
      <img alt="カラー">自分の場にアクティブで登場させる。<img alt="アクティブ">
    </dd></dl>`;

    expect(parseCardFromDetailHtml(html, 'UA01BT/CGH-1-003').triggers).toEqual(['COLOR']);
  });

  it('repairs the known false ACTIVE plus COLOR pair without changing other cards', () => {
    const cards = [
      { code: 'A', triggers: ['ACTIVE', 'COLOR'] },
      { code: 'B', triggers: ['DRAW'] },
    ];

    expect(repairSynchronizedTriggers(cards)).toEqual([
      { code: 'A', triggers: ['COLOR'] },
      { code: 'B', triggers: ['DRAW'] },
    ]);
    expect(cards[0].triggers).toEqual(['ACTIVE', 'COLOR']);
  });
});
