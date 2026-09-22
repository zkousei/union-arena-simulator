import { describe, expect, it } from 'vitest';
import { parseCardFromDetailHtml } from './sync-official-cards.js';

describe('sync-official-cards generated energy', () => {
  it.each([
    ['purple1.png', '紫', 1],
    ['purple2.png', '紫+', 1],
    ['purple3.png', '紫紫', 2],
    ['purple4.png', '紫紫+', 2],
    ['green5.png', '緑緑緑', 3],
  ])('preserves only base energy for %s', (filename, alt, expected) => {
    const html = `
      <dl class="cardDataCol categoryData"><dd class="cardDataContents">キャラクター</dd></dl>
      <dl class="cardDataCol generatedEnergyData"><dd class="cardDataContents">
        <img src="/jp/images/cardlist/icon/resource/ico_resource_energy_${filename}" alt="${alt}">
      </dd></dl>
    `;

    expect(parseCardFromDetailHtml(html, 'UA01BT/CGH-1-001').genEnergy).toBe(expected);
  });
});
