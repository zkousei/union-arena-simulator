// Unit tests use the checked-in asset; never fetch from a live server.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadCardDatabase } from './src/data/cardDatabase';

const raw = readFileSync(resolve('src/data/officialCards.json'), 'utf8');
await loadCardDatabase(async () => new Response(raw));
