import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { validateOfficialCardDataset, findOfficialCardConflicts } from '../src/data/officialCardValidation.js';

export function publishCardData(outputPath, cards, previous, { dryRun = false } = {}) {
  validateOfficialCardDataset(cards, previous);
  const oldByCode = new Map(previous.map(card => [card.code, card]));
  const changes = [];
  let added = 0;
  for (const card of cards) {
    const old = oldByCode.get(card.code);
    if (!old) { added++; changes.push({ code: card.code, fields: ['new'] }); continue; }
    const fields = [...new Set([...Object.keys(old), ...Object.keys(card)])].filter(field => JSON.stringify(old[field]) !== JSON.stringify(card[field]));
    if (fields.length) changes.push({ code: card.code, fields });
  }
  const report = { total: cards.length, added, updated: changes.length - added, changes, pendingPrintingReviews: findOfficialCardConflicts(cards) };
  // A long-running fetch must not overwrite edits made since it started.
  if (fs.existsSync(outputPath) && JSON.stringify(JSON.parse(fs.readFileSync(outputPath, 'utf8'))) !== JSON.stringify(previous)) {
    throw new Error('Card source changed during update; no data saved.');
  }
  if (!dryRun) {
    const temporaryPath = `${outputPath}.${randomUUID()}.tmp`;
    try {
      fs.writeFileSync(temporaryPath, JSON.stringify(cards, null, 2), { encoding: 'utf8', flag: 'wx' });
      fs.renameSync(temporaryPath, outputPath);
    } finally { if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath); }
  }
  return report;
}
