import type { CardMaster } from './cardDatabase';
import { getBaseCardCode } from '../types/card';
import { isCardMaster } from './officialCardAsset';

interface Shard { id: string; titles: string[]; codes: string[] }
interface CatalogIndex { version: string; shards: Shard[] }

function parseIndex(value: unknown, urls: Record<string, string>): CatalogIndex {
  if (!value || typeof value !== 'object') throw new Error('Invalid card index');
  const index = value as CatalogIndex;
  if (typeof index.version !== 'string' || !index.version || !Array.isArray(index.shards) || !index.shards.length) throw new Error('Invalid card index');
  const ids = new Set<string>();
  const codes = new Set<string>();
  for (const shard of index.shards) {
    if (!shard || typeof shard.id !== 'string' || typeof urls[shard.id] !== 'string' || ids.has(shard.id) ||
      !Array.isArray(shard.titles) || !shard.titles.length || !shard.titles.every((t) => typeof t === 'string') ||
      !Array.isArray(shard.codes) || !shard.codes.length) throw new Error('Invalid card index');
    ids.add(shard.id);
    for (const code of shard.codes) {
      if (typeof code !== 'string' || !code || codes.has(code.toUpperCase())) throw new Error('Invalid card index');
      codes.add(code.toUpperCase());
    }
  }
  return index;
}

async function fetchJson(url: string, fetcher: typeof fetch): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetcher(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`Card asset request failed: ${response.status}`);
    return await response.json();
  } finally { clearTimeout(timer); }
}

function normalize(card: CardMaster): CardMaster {
  return { ...card, baseCode: card.baseCode || getBaseCardCode(card.code),
    isParallel: card.isParallel ?? /_p\d+$/i.test(card.code),
    isUnrevealed: card.isUnrevealed ?? (/comingsoon/i.test(card.code) || /comingsoon/i.test(card.name) || Boolean(card.imageUrl && /comingsoon/i.test(card.imageUrl))),
  };
}

export function createCardCatalog(indexUrl: string, urls: Record<string, string>, fallback: CardMaster[]) {
  let index: CatalogIndex | undefined;
  let indexRequest: Promise<void> | undefined;
  const requests = new Map<string, Promise<void>>();
  const loaded = new Map<string, CardMaster[]>();
  const byCode = new Map<string, CardMaster>();
  const officialCodes = new Set<string>();
  const aliases = new Map<string, Set<string>>();
  let cards: CardMaster[] = [];
  const listeners = new Set<() => void>();

  const loadIndex = (fetcher: typeof fetch = fetch): Promise<void> => {
    if (!indexRequest) {
      indexRequest = fetchJson(indexUrl, fetcher).then((raw) => {
        const valid = parseIndex(raw, urls);
        for (const shard of valid.shards) for (const code of shard.codes) {
          officialCodes.add(code.toUpperCase());
          for (const alias of [code.toUpperCase(), code.split('/').pop()!.toUpperCase()]) {
            const ids = aliases.get(alias) || new Set<string>();
            ids.add(shard.id); aliases.set(alias, ids);
          }
        }
        index = valid;
      }).catch((error: unknown) => { indexRequest = undefined; throw error; });
    }
    return indexRequest;
  };
  const loadShard = (id: string, fetcher: typeof fetch): Promise<void> => {
    let request = requests.get(id);
    if (!request) {
      const shard = index!.shards.find((s) => s.id === id)!;
      request = fetchJson(urls[id], fetcher).then((raw) => {
        if (!Array.isArray(raw) || raw.length !== shard.codes.length || !raw.every(isCardMaster) ||
          raw.some((c, i) => c.code !== shard.codes[i] || c.titleCode !== id || !shard.titles.includes(c.title))) {
          throw new Error('Card shard does not match index');
        }
        loaded.set(id, raw.map(normalize));
        const all = index!.shards.flatMap((s) => loaded.get(s.id) || []);
        for (const card of fallback) {
          if (!aliases.has(card.code.toUpperCase()) && index!.shards.some((s) => loaded.has(s.id) && (s.id === card.titleCode || s.titles.includes(card.title)))) all.push(normalize(card));
        }
        cards = all;
        byCode.clear();
        for (const card of all) byCode.set(card.code.toUpperCase(), card);
        listeners.forEach((listener) => listener());
      }).catch((error: unknown) => { requests.delete(id); throw error; });
      requests.set(id, request);
    }
    return request;
  };
  const loadShards = async (ids: string[], fetcher: typeof fetch) => {
    const queue = [...new Set(ids)];
    await Promise.all(Array.from({ length: Math.min(4, queue.length) }, async () => {
      let id: string | undefined;
      while ((id = queue.shift()) !== undefined) await loadShard(id, fetcher);
    }));
  };
  const ensureCodes = async (codes: string[], fetcher: typeof fetch = fetch) => {
    await loadIndex(fetcher);
    const ids = new Set<string>();
    for (const code of codes) {
      for (const id of aliases.get(code.toUpperCase()) || []) ids.add(id);
      const base = fallback.find((card) => card.code.toUpperCase() === code.toUpperCase());
      if (base) for (const shard of index!.shards) if (shard.id === base.titleCode) ids.add(shard.id);
    }
    await loadShards([...ids], fetcher);
  };
  return {
    loadIndex, ensureCodes,
    async loadTitle(title: string, fetcher: typeof fetch = fetch) {
      await loadIndex(fetcher);
      const matches = index!.shards.filter((s) => s.id === title || s.titles.includes(title));
      if (!matches.length) throw new Error('Unknown card title');
      await loadShards(matches.map((s) => s.id), fetcher);
    },
    async loadAll(fetcher: typeof fetch = fetch) {
      await loadIndex(fetcher);
      await loadShards(index!.shards.map((s) => s.id), fetcher);
    },
    getCards: () => cards,
    getCard: (code: string) => byCode.get(code.toUpperCase()),
    isOfficialCode: (code: string) => officialCodes.has(code.toUpperCase()) || fallback.some((c) => c.code.toUpperCase() === code.toUpperCase()),
    requireCard(code: string) {
      const card = byCode.get(code.toUpperCase());
      if (!card && (officialCodes.has(code.toUpperCase()) || fallback.some((c) => c.code.toUpperCase() === code.toUpperCase()))) throw new Error('公式カードデータが未取得です。再試行してください。');
      return card;
    },
    getTitles: () => [...new Set(index?.shards.flatMap((s) => s.titles) || [])],
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  };
}
