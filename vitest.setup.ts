// Existing rule tests use all local shards. Cold-loading tests create isolated catalogs.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadCardDatabase } from './src/data/cardDatabase';
await loadCardDatabase(async (url) => {
  const filename = String(url).split('/').pop()!.split('?')[0];
  return new Response(readFileSync(resolve('src/data/generated', filename), 'utf8'));
});
