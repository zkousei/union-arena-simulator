import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { validateOfficialCardDetail, validateOfficialCardDataset, findOfficialCardConflicts } from '../src/data/officialCardValidation.js';
import { publishCardData } from './card-data-quality.js';
import { parseCardFromDetailHtml, syncSeries, repairSynchronizedCardText, repairSynchronizedCardEnergy } from './sync-official-cards.js';

const html = fs.readFileSync(new URL('../src/services/__tests__/fixtures/official-nikke-traits.html', import.meta.url), 'utf8');
const code = 'UA18BT/NIK-1-071';
const master = () => parseCardFromDetailHtml(html, code);
describe('official data quality gates', () => {
  it('validates real published details before parsing defaults can conceal missing fields', () => {
    expect(() => validateOfficialCardDetail(html, code)).not.toThrow();
    expect(() => validateOfficialCardDataset([master()])).not.toThrow();
  });
  it('preserves the reviewed official category and BP dash without permitting missing BP', () => {
    const source = fs.readFileSync(new URL('../src/services/__tests__/fixtures/official-htr-text.html', import.meta.url), 'utf8');
    const card = parseCardFromDetailHtml(source, 'UAPR/HTR-1-026');
    expect(card).toMatchObject({ cardType: 'CHARACTER', bp: null });
    expect(() => validateOfficialCardDetail(source, card.code, card)).not.toThrow();
    expect(() => validateOfficialCardDataset([card])).not.toThrow();
    expect(() => validateOfficialCardDetail(source.replace(/<dl class="cardDataCol bpData">[\s\S]*?<\/dl>/, ''), card.code)).toThrow();
    expect(() => validateOfficialCardDataset([{ ...card, code: 'UAPR/HTR-1-027', baseCode: 'UAPR/HTR-1-027' }])).toThrow();
  });
  it('validates multi-color metadata against the official source and rejects invalid color arrays', () => {
    const source = html.replace('alt="緑3"', 'alt="赤／青3"');
    const parsed = parseCardFromDetailHtml(source, code);
    expect(() => validateOfficialCardDetail(source, code, parsed)).not.toThrow();
    expect(() => validateOfficialCardDetail(source, code, { ...parsed, reqEnergyColors: undefined })).toThrow(/parsed reqEnergyColors/);
    for (const reqEnergyColors of [['RED', 'RED'], ['RED', 'UNKNOWN'], [], 'RED']) {
      expect(() => validateOfficialCardDataset([{ ...master(), reqEnergyColors }])).toThrow(/required energy colors/);
    }
  });
  it('accepts real AP metadata with additional class names but rejects an unexpected category', () => {
    const apHtml = fs.readFileSync(new URL('../src/services/__tests__/fixtures/official-action-point.html', import.meta.url), 'utf8');
    expect(() => validateOfficialCardDetail(apHtml, 'UA01BT/CGH-1-AP01')).not.toThrow();
    expect(() => validateOfficialCardDetail(apHtml.replace('アクションポイント</dd>', '不明</dd>'), 'UA01BT/CGH-1-AP01')).toThrow();
  });
  it('accepts official horizontal AP markup while still rejecting a different printing image', () => {
    const source = fs.readFileSync(new URL('../src/services/__tests__/fixtures/official-action-point-horizontal.html', import.meta.url), 'utf8');
    const code = 'EX14BT/MCR-2-AP07';
    const parsed = parseCardFromDetailHtml(source, code);
    expect(parsed.imageUrl).toBe('https://www.unionarena-tcg.com/jp/images/cardlist/card/EX14BT_MCR-2-AP07.png?v9');
    expect(() => validateOfficialCardDetail(source, code, parsed)).not.toThrow();
    expect(() => validateOfficialCardDetail(source.replace('EX14BT_MCR-2-AP07.png', 'EX14BT_MCR-2-AP06.png'), code)).toThrow(/printing image/i);
  });
  it('verifies the official _s image mapping for starred AP printings without accepting another image', () => {
    const source = fs.readFileSync(new URL('../src/services/__tests__/fixtures/official-action-point-parallel.html', import.meta.url), 'utf8');
    expect(() => validateOfficialCardDetail(source, 'UA15BT/SAO-1-AP02★')).not.toThrow();
    expect(() => validateOfficialCardDetail(source.replace('SAO-1-AP02_s.png', 'SAO-1-AP01_s.png'), 'UA15BT/SAO-1-AP02★')).toThrow();
  });
  it('verifies starred AP printings which also have a numbered parallel suffix', () => {
    const source = fs.readFileSync(new URL('../src/services/__tests__/fixtures/official-action-point-star-parallel.html', import.meta.url), 'utf8');
    expect(() => validateOfficialCardDetail(source, 'EX06BT/MHA-2-AP01★_p1')).not.toThrow();
  });
  it.each([
    '', html.replace('キャラクター', '未知の種類'),
    html.replace(/<dl class="cardDataCol bpData">[\s\S]*?<\/dl>/, ''),
    html.replace(/<dl class="cardDataCol apData">[\s\S]*?<\/dl>/, ''),
    html.replace(/<dl class="cardDataCol effectData">[\s\S]*?<\/dl>/, ''),
    html.replace(/<dl class="cardDataCol generatedEnergyData">[\s\S]*?<\/dl>/, ''),
    html.replace(/(triggerData">[\s\S]*?<dd class="cardDataContents">)[\s\S]*?(<\/dd>)/, '$1<img alt="未知トリガー">$2'),
  ])('rejects incomplete or unsupported source HTML', source => {
    expect(() => validateOfficialCardDetail(source, code)).toThrow();
  });
  it('rejects a response for a different card', () => {
    expect(() => validateOfficialCardDetail(html, 'UA18BT/NIK-1-072')).toThrow();
  });
  it('aborts normal synchronization on invalid details or a missing list rather than returning partial success', async () => {
    const list = `<a href="./detail_iframe.php?card_no=${code}"><img data-src="/jp/images/cardlist/card/UA18BT_NIK-1-071.png" alt="シュガー"></a>`;
    const series = { id: '570118', name: 'NIKKE' };
    await expect(syncSeries(series, false, new Map(), async () => '')).rejects.toThrow();
    await expect(syncSeries(series, false, new Map(), async url => url.includes('detail_iframe') ? '' : list)).rejects.toThrow();
    const result = await syncSeries(series, false, new Map(), async url => url.includes('detail_iframe') ? html : list);
    expect(result.newCards[0].traits).toEqual(['テトラライン', 'カフェ・スウィーティー']);
  });
  it('rejects a partially parsed list so changed image markup cannot silently omit new cards', async () => {
    const list = `<a href="./detail_iframe.php?card_no=${code}"><img data-src="/jp/images/cardlist/card/UA18BT_NIK-1-071.png" alt="シュガー"></a>
      <a href="./detail_iframe.php?card_no=UA18BT/NIK-1-072"><img alt="次のカード" src="/jp/images/cardlist/card/UA18BT_NIK-1-072.png"></a>`;
    await expect(syncSeries({ id: '570118', name: 'NIKKE' }, false, new Map(), async url => url.includes('detail_iframe') ? html : list)).rejects.toThrow(/card list/i);
  });
  it('rejects a parser default that disagrees with the independently read official energy value', async () => {
    const changedMarkup = html.replace('alt="緑3"', "alt='緑3'");
    const list = `<a href="./detail_iframe.php?card_no=${code}"><img data-src="/jp/images/cardlist/card/UA18BT_NIK-1-071.png" alt="シュガー"></a>`;
    await expect(syncSeries({ id: '570118', name: 'NIKKE' }, false, new Map(), async url => url.includes('detail_iframe') ? changedMarkup : list)).rejects.toThrow(/parsed/i);
  });
  it.each([
    { name: '別の名前' }, { title: '別の作品' }, { traits: ['誤った特徴'] },
    { effectText: '欠落した効果' }, { triggers: ['DRAW'] },
  ])('rejects parsed text or trigger values that disagree with official metadata: %j', override => {
    expect(() => validateOfficialCardDetail(html, code, { ...master(), ...override })).toThrow(/parsed/i);
  });
  it('rejects an effect icon lost by the parser after an HTML attribute change', () => {
    const changed = html.replace(/(<dl class="cardDataCol effectData">[\s\S]*?<dd class="cardDataContents">)/, "$1<img alt='起動メイン'>");
    const parsed = parseCardFromDetailHtml(changed, code);
    expect(() => validateOfficialCardDetail(changed, code, parsed)).toThrow(/parsed effectText/i);
  });
  it('validates parsed energy in the dedicated repair and preserves all unrelated fields and AP cards', async () => {
    const old = { ...master(), genEnergy: 0, hasGenEnergyPlus: true };
    const ap = { ...old, code: 'UAPR/IMS_AP04', cardType: 'ACTION_POINT', bp: null };
    const result = await repairSynchronizedCardEnergy([old, ap], async () => html);
    expect(result[0]).toEqual({ ...old, genEnergy: 2, hasGenEnergyPlus: false });
    expect(result[1]).toBe(ap);
    const changed = html.replace('alt="緑×1"', "alt='緑×1'");
    await expect(repairSynchronizedCardEnergy([old], async () => changed)).rejects.toThrow(/parsed effectText/);
    expect(old.genEnergy).toBe(0);
  });
  it('repairs confirmed text without altering numeric fields or AP records', async () => {
    const old = { ...master(), traits: ['テトラライン', 'カフェ', 'スウィーティー'] };
    const ap = { ...old, code: 'UAPR/IMS_AP04', cardType: 'ACTION_POINT', bp: null };
    const result = await repairSynchronizedCardText([old, ap], async () => html);
    expect(result[0]).toEqual({ ...old, traits: ['テトラライン', 'カフェ・スウィーティー'] });
    expect(result[1]).toBe(ap);
    expect(old.traits).toHaveLength(3);
  });
  it.each([
    { bp: null }, { bp: -1000 }, { apCost: -1 }, { genEnergy: 1.5 },
    { cardType: 'ACTION_POINT' }, { triggers: ['UNKNOWN'] }, { name: '未解析&quot;' },
  ])('rejects semantically invalid published records: %j', override => {
    expect(() => validateOfficialCardDataset([{ ...master(), ...override }])).toThrow();
  });
  it('rejects duplicates, missing old cards and published-to-unpublished regressions', () => {
    const card = master();
    expect(() => validateOfficialCardDataset([card, card])).toThrow();
    expect(() => validateOfficialCardDataset([{ ...card, code: 'UA18BT/NIK-1-072' }], [card])).toThrow();
    expect(() => validateOfficialCardDataset([{ ...card, isUnrevealed: true }], [card])).toThrow();
  });
  it('rejects new differences in gameplay between printings instead of silently accepting them', () => {
    const card = master();
    const promo = { ...card, code: 'UAPR/NIK-1-071', baseCode: 'UAPR/NIK-1-071', imageUrl: card.imageUrl.replace('UA18BT_', 'UAPR_'), bp: 5000 };
    expect(findOfficialCardConflicts([card, promo])[0]).toMatchObject({ number: 'NIK-1-071', fields: ['bp'] });
    expect(() => validateOfficialCardDataset([card, promo])).toThrow(/printing/i);
  });
  it('preserves the source on validation failure and dry run, then atomically publishes a valid change', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'union-card-quality-'));
    try {
      const output = path.join(directory, 'cards.json');
      const previous = [master()];
      const original = JSON.stringify(previous);
      fs.writeFileSync(output, original);
      expect(() => publishCardData(output, [{ ...previous[0], bp: null }], previous)).toThrow();
      expect(fs.readFileSync(output, 'utf8')).toBe(original);
      const updated = [{ ...previous[0], bp: 5000 }];
      const report = publishCardData(output, updated, previous, { dryRun: true });
      expect(report.updated).toBe(1);
      expect(report.changes[0].fields).toContain('bp');
      expect(fs.readFileSync(output, 'utf8')).toBe(original);
      publishCardData(output, updated, previous);
      expect(JSON.parse(fs.readFileSync(output, 'utf8'))).toEqual(updated);
      expect(fs.existsSync(`${output}.tmp`)).toBe(false);
      expect(fs.readdirSync(directory)).toEqual(['cards.json']);
      expect(() => publishCardData(output, previous, previous)).toThrow(/source changed/);
      expect(JSON.parse(fs.readFileSync(output, 'utf8'))).toEqual(updated);
    } finally { fs.rmSync(directory, { recursive: true, force: true }); }
  });
});
