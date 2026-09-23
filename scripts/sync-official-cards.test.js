import { describe, expect, it } from 'vitest';
import { parseCardFromDetailHtml, repairSynchronizedTriggers } from './sync-official-cards.js';

describe('sync-official-cards generated energy', () => {
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
