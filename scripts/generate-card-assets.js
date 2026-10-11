import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { validateOfficialCardDataset } from '../src/data/officialCardValidation.js';

export function splitCardAssets(cards) {
  validateOfficialCardDataset(cards);
  if (!Array.isArray(cards) || cards.length === 0) throw new Error('Empty card source');
  const groups = new Map();
  const codes = new Set();
  for (const card of cards) {
    if (!card || typeof card.code !== 'string' || !/^[A-Z0-9_]+$/.test(card.titleCode) || typeof card.title !== 'string' || codes.has(card.code.toUpperCase())) {
      throw new Error('Invalid or duplicate card source');
    }
    codes.add(card.code.toUpperCase());
    const group = groups.get(card.titleCode) || [];
    group.push(card);
    groups.set(card.titleCode, group);
  }
  const version = createHash('sha256').update(JSON.stringify(cards)).digest('hex');
  const index = { version, shards: Array.from(groups, ([id, group]) => ({
    id, titles: [...new Set(group.map((card) => card.title))], codes: group.map((card) => card.code),
  })) };
  return { index, groups };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const cards = JSON.parse(fs.readFileSync(path.join(root, 'src/data/officialCards.json'), 'utf8'));
  const { index, groups } = splitCardAssets(cards);
  const output = path.join(root, 'src/data/generated');
  fs.mkdirSync(output, { recursive: true });
  const files = new Map([['index.json', JSON.stringify(index)], ...Array.from(groups, ([id, group]) => [`${id}.json`, JSON.stringify(group)])]);
  for (const filename of fs.readdirSync(output)) {
    if (filename.endsWith('.json') && !files.has(filename)) fs.unlinkSync(path.join(output, filename));
  }
  for (const [filename, contents] of files) {
    const destination = path.join(output, filename);
    if (!fs.existsSync(destination) || fs.readFileSync(destination, 'utf8') !== contents) fs.writeFileSync(destination, contents);
  }
  console.log(`Generated ${groups.size} card shards (${cards.length} cards), without network access.`);
}
