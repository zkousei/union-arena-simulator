import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validateOfficialCardDataset, findOfficialCardConflicts } from '../src/data/officialCardValidation.js';

const source = new URL('../src/data/officialCards.json', import.meta.url);
const cards = JSON.parse(fs.readFileSync(source, 'utf8'));
const baselineRef = process.argv.slice(2).find(arg => arg.startsWith('--baseline-ref='))?.slice('--baseline-ref='.length);
let previous = [];
if (baselineRef) {
  if (!/^[\w/^.~-]+$/.test(baselineRef) || baselineRef.startsWith('-')) throw new Error('Invalid baseline ref');
  previous = JSON.parse(execFileSync('git', ['show', `${baselineRef}:src/data/officialCards.json`], { cwd: fileURLToPath(new URL('..', import.meta.url)), maxBuffer: 32 * 1024 * 1024, encoding: 'utf8' }));
}
validateOfficialCardDataset(cards, previous);
console.log(`Validated ${cards.length} official cards${baselineRef ? ` against ${baselineRef}` : ''}, without network access.`);
const conflicts = findOfficialCardConflicts(cards);
console.log(`Known official printing differences still requiring review: ${conflicts.length}`);
for (const conflict of conflicts) console.log(`${conflict.number}: ${conflict.fields.join(', ')}`);
const reportPath = process.argv.slice(2).find(arg => arg.startsWith('--report='))?.slice('--report='.length);
if (reportPath) {
  const report = conflicts.map(conflict => ({ ...conflict, variants: conflict.variants.map(variant => ({ ...variant,
    detailUrl: `https://www.unionarena-tcg.com/jp/cardlist/detail.php?card_no=${encodeURIComponent(variant.code)}`,
    imageUrl: cards.find(card => card.code === variant.code).imageUrl,
  })) }));
  fs.writeFileSync(reportPath, JSON.stringify({ status: 'needs-official-text-or-errata-review', conflicts: report }, null, 2) + '\n');
}
