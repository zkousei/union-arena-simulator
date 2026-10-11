import { parseRequiredEnergyColors, isRequiredEnergyColors } from './cardEnergyRules.js';
import { inferCardType, isActionPointCardNumber, parseCardCategory, hasReviewedOfficialBpDash } from './cardTypeRules.js';
import { decodeCardText } from './officialCardText.js';
import { KNOWN_PRINTING_DIFFERENCES } from './officialCardReviewBaseline.js';

const types = new Set(['CHARACTER', 'EVENT', 'FIELD', 'ACTION_POINT']);
const colors = new Set(['YELLOW', 'GREEN', 'RED', 'BLUE', 'PURPLE', 'COLORLESS']);
const triggers = new Set(['DRAW', 'ACTIVE', 'RAID', 'GET', 'BOUNCE', 'COLOR', 'SPECIAL', 'FINAL']);
const plain = html => decodeCardText(html.replace(/<[^>]+>/g, '').trim());

export function validateOfficialCardDetail(html, code, parsed) {
  const fail = field => { throw new Error(`Unverified official ${field}: ${code}`); };
  const section = name => html.match(new RegExp(`<dl class="cardDataCol ${name}">[\\s\\S]*?<dd class="cardDataContents">([\\s\\S]*?)<\\/dd>`))?.[1];
  const attribute = (tag, name) => tag?.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, 'i'))?.[2];
  const imageTag = html.match(/<dd class="cardDataImgCol(?: [^"]*)?">\s*(<img\b[^>]*>)/)?.[1];
  const image = attribute(imageTag, 'src');
  const number = html.match(/<span class="cardNumData(?: [^"]*)?">\s*([^<]+)\s*<\/span>/)?.[1].trim();
  const base = code.replace(/_p\d+$/i, '');
  // Official starred AP printings use _s, while the displayed number keeps ★.
  const imageCode = isActionPointCardNumber(code) ? code.replace(/★(?=_p\d+$|$)/i, '_s') : code;
  const unpublished = /comingsoon/i.test(image || '');
  if (number !== code && (number !== base || !/_p\d+$/i.test(code))) fail('identity');
  if (!image || (!unpublished && image.split('/').pop().split('?')[0] !== `${imageCode.replace('/', '_')}.png`)) fail('printing image');
  const nameHtml = html.match(/<h2 class="cardNameCol">([\s\S]*?)<\/h2>/)?.[1];
  if (nameHtml === undefined || !plain(nameHtml.replace(/<span class="rubyData">[\s\S]*?<\/span>/g, '')) || !html.match(/<dd class="cardDataTitleCol[^"\n]*">\s*<img[^>]*alt="[^"]+"/)) fail('name/title');
  if (parsed && !unpublished) {
    const expectedName = plain(nameHtml.replace(/<span class="rubyData">[\s\S]*?<\/span>/g, ''));
    const titleIcon = html.match(/<dd class="cardDataTitleCol[^"\n]*">\s*(<img\b[^>]*>)/)?.[1];
    if (parsed.name !== expectedName) fail('parsed name');
    if (parsed.title !== decodeCardText(attribute(titleIcon, 'alt').trim())) fail('parsed title');
  }
  // AP details and explicitly unpublished artwork may omit gameplay sections.
  const rawCategory = section('categoryData') ?? (isActionPointCardNumber(code) ? html.match(/<dl class="cardDataCol categoryData isFull">[\s\S]*?<dd class="cardDataContents">([\s\S]*?)<\/dd>/)?.[1] : undefined);
  if (isActionPointCardNumber(code)) {
    if (rawCategory !== undefined && parseCardCategory(plain(rawCategory)) !== 'ACTION_POINT') fail('AP category');
    if (parsed && parsed.cardType !== 'ACTION_POINT') fail('parsed AP category');
    return;
  }
  if (unpublished) return;
  if (rawCategory === undefined || !/^(?:キャラクター|イベント|フィールド|アクションポイント|CHARACTER|EVENT|FIELD|ACTION[ _]?POINT|AP)$/i.test(plain(rawCategory))) fail('category');
  const type = inferCardType(plain(rawCategory), code);
  if (type === 'ACTION_POINT') fail('AP number');
  const bp = section('bpData');
  if (type === 'CHARACTER' ? bp === undefined || (!/^\d+[+＋±-]?$/.test(plain(bp)) && !(hasReviewedOfficialBpDash(code) && plain(bp) === '-')) : bp !== undefined && plain(bp) !== '-') fail('BP');
  if (!/^\d+$/.test(plain(section('apData') || ''))) fail('AP cost');
  const need = attribute(section('needEnergyData')?.match(/<img\b[^>]*>/)?.[0], 'alt');
  if (!/^[紫緑赤青黄](?:[／/][紫緑赤青黄])*(?:\d+|-)$/.test(need || '')) fail('required energy');
  const energy = section('generatedEnergyData');
  if (energy === undefined) fail('generated energy');
  const energyIcons = energy.match(/<img\b[^>]*>/g) || [];
  if (energyIcons.some(icon => !/^[紫緑赤青黄]+[+＋]?$/.test(attribute(icon, 'alt') || '')) || (!energyIcons.length && !['', '-'].includes(plain(energy)))) fail('energy icon');
  for (const field of ['attributeData', 'effectData', 'triggerData']) if (section(field) === undefined) fail(field);
  const triggerHtml = section('triggerData');
  const triggerIcon = triggerHtml.match(/<img\b[^>]*>/)?.[0];
  if (triggerIcon ? !/^(?:ドロー|ゲット|アクティブ|レイド|カラー|スペシャル|ファイナル|バウンス|DRAW|GET|ACTIVE|RAID|COLOR|SPECIAL|FINAL|BOUNCE)$/i.test(attribute(triggerIcon, 'alt') || '') : !['', '-'].includes(plain(triggerHtml))) fail('trigger');
  if (!html.match(/<span[^>]*class="[^"]*rareData[^"]*"[^>]*>\s*[^<\s]/)) fail('rarity');
  if (parsed) {
    const colorNames = { 紫: 'PURPLE', 緑: 'GREEN', 赤: 'RED', 青: 'BLUE', 黄: 'YELLOW' };
    const expected = { code, cardType: type, reqEnergyColors: parseRequiredEnergyColors(need),
      bp: type === 'CHARACTER' && plain(bp) !== '-' ? Number(plain(bp).match(/^\d+/)[0]) : null,
      hasBpPlus: bp !== undefined && /[+＋]/.test(plain(bp)),
      apCost: Number(plain(section('apData'))), reqEnergy: Number(need.match(/\d+/)?.[0] || 0),
      genEnergy: type === 'EVENT' ? 0 : energyIcons.reduce((sum, icon) => sum + (attribute(icon, 'alt').match(/[紫緑赤青黄]/g)?.length || 0), 0),
      hasGenEnergyPlus: type !== 'EVENT' && energyIcons.some(icon => /[+＋]/.test(attribute(icon, 'alt'))),
      ...(!/[／/]/.test(need) ? { color: colorNames[need[0]] } : {}),
    };
    const traitText = plain(section('attributeData'));
    expected.traits = !traitText || traitText === '-' ? [] : traitText.split(/[/／]/).map(value => value.trim()).filter(Boolean);
    const effect = section('effectData').replace(/<img\b[^>]*>/gi, icon => {
      const alt = attribute(icon, 'alt');
      if (!alt) fail('effect icon text');
      return `[${alt}]`;
    }).replace(/<br\s*\/?>/gi, '\n');
    expected.effectText = plain(effect);
    const triggerNames = { ドロー: 'DRAW', ゲット: 'GET', アクティブ: 'ACTIVE', レイド: 'RAID', カラー: 'COLOR', スペシャル: 'SPECIAL', ファイナル: 'FINAL', バウンス: 'BOUNCE' };
    const trigger = triggerIcon ? attribute(triggerIcon, 'alt') : '';
    expected.triggers = trigger ? [triggerNames[trigger] || trigger.toUpperCase()] : [];
    for (const [field, value] of Object.entries(expected)) if (JSON.stringify(parsed[field]) !== JSON.stringify(value)) fail(`parsed ${field}`);
  }
}

export function validateOfficialCardDataset(cards, previous = []) {
  if (!Array.isArray(cards) || !cards.length) throw new Error('Empty official card dataset');
  const codes = new Set();
  for (const card of cards) {
    const fail = field => { throw new Error(`Invalid official ${field}: ${card?.code || '(missing code)'}`); };
    if (!card || typeof card.code !== 'string' || !/^[A-Z0-9_]+\/[A-Z0-9_★☆-]+$/i.test(card.code) || codes.has(card.code.toUpperCase())) fail('code/duplicate');
    codes.add(card.code.toUpperCase());
    for (const field of ['name', 'title', 'titleCode', 'effectText']) {
      if (typeof card[field] !== 'string' || (field !== 'effectText' && !card[field].trim()) || /&(?:#\w+|amp|quot|apos|lt|gt|nbsp);/.test(card[field])) fail(field);
    }
    if (!/^[A-Z0-9_]+$/.test(card.titleCode) || !types.has(card.cardType) || !colors.has(card.color)) fail('type/color/title code');
    if (!isRequiredEnergyColors(card.reqEnergyColors) || (card.reqEnergyColors && !card.reqEnergyColors.includes(card.color))) fail('required energy colors');
    if ((card.cardType === 'ACTION_POINT') !== isActionPointCardNumber(card.code)) fail('AP classification');
    for (const field of ['apCost', 'reqEnergy', 'genEnergy']) if (!Number.isSafeInteger(card[field]) || card[field] < 0) fail(field);
    if (card.bp !== null && (!Number.isSafeInteger(card.bp) || card.bp < 0)) fail('BP');
    if (!card.isUnrevealed && ((card.cardType === 'CHARACTER' && card.bp === null && !hasReviewedOfficialBpDash(card.code)) || (card.cardType !== 'CHARACTER' && card.bp !== null))) fail('BP/category');
    for (const field of ['hasBpPlus', 'hasGenEnergyPlus', 'isParallel', 'isUnrevealed']) if (card[field] !== undefined && typeof card[field] !== 'boolean') fail(field);
    if (card.hasBpPlus && card.bp === null) fail('BP plus');
    if (!Array.isArray(card.traits) || card.traits.some(trait => typeof trait !== 'string' || !trait.trim())) fail('traits');
    if (!Array.isArray(card.triggers) || card.triggers.length > 1 || card.triggers.some(trigger => !triggers.has(trigger))) fail('triggers');
    if (typeof card.imageUrl !== 'string' || !card.imageUrl.startsWith('https://www.unionarena-tcg.com/jp/images/')) fail('image URL');
    if (Boolean(card.isUnrevealed) !== /comingsoon/i.test(card.imageUrl + card.name + card.code)) fail('unpublished status');
    if (card.baseCode !== undefined && card.baseCode !== card.code.replace(/_p\d+$/i, '')) fail('base code');
  }
  const byCode = new Map(cards.map(card => [card.code.toUpperCase(), card]));
  for (const old of previous) {
    const updated = byCode.get(old.code.toUpperCase());
    if (!updated) throw new Error(`Existing card removed: ${old.code}`);
    if (!old.isUnrevealed && updated.isUnrevealed) throw new Error(`Published card regressed: ${old.code}`);
  }
  const known = new Set(KNOWN_PRINTING_DIFFERENCES.map(value => JSON.stringify(value)));
  const conflicts = findOfficialCardConflicts(cards);
  for (const conflict of conflicts) if (!known.has(JSON.stringify(conflict))) throw new Error(`New printing difference needs review: ${conflict.number} (${conflict.fields.join(', ')})`);
}

export function findOfficialCardConflicts(cards) {
  const groups = new Map();
  for (const card of cards) {
    if (card.cardType === 'ACTION_POINT' || card.isUnrevealed) continue;
    const number = card.code.split('/')[1].replace(/_p\d+$/i, '');
    const group = groups.get(number) || [];
    group.push(card);
    groups.set(number, group);
  }
  const fields = ['name', 'cardType', 'color', 'bp', 'hasBpPlus', 'apCost', 'reqEnergy', 'reqEnergyColors', 'genEnergy', 'hasGenEnergyPlus', 'traits', 'triggers', 'effectText'];
  const normalize = (card, field) => field.startsWith('has') ? Boolean(card[field]) : typeof card[field] === 'string' ? decodeCardText(card[field]).replace(/\s+/g, '') : card[field];
  const result = [];
  for (const [number, group] of groups) {
    const differing = fields.filter(field => new Set(group.map(card => JSON.stringify(normalize(card, field)))).size > 1);
    if (differing.length) result.push({ number, fields: differing, variants: group.sort((a, b) => a.code.localeCompare(b.code)).map(card => ({ code: card.code, ...Object.fromEntries(differing.map(field => [field, normalize(card, field)])) })) });
  }
  return result.sort((a, b) => a.number.localeCompare(b.number));
}
