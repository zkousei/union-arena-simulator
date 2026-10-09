import type { CardMaster } from './cardDatabase';

const cardTypes = new Set(['CHARACTER', 'EVENT', 'FIELD', 'ACTION_POINT']);
const colors = new Set(['YELLOW', 'GREEN', 'RED', 'BLUE', 'PURPLE', 'COLORLESS']);
const triggers = new Set(['DRAW', 'ACTIVE', 'RAID', 'GET', 'BOUNCE', 'COLOR', 'SPECIAL', 'FINAL']);

function isCardMaster(value: unknown): value is CardMaster {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const card = value as Record<string, unknown>;
  const strings = ['code', 'name', 'title', 'titleCode', 'effectText'];
  const optionalStrings = ['imageUrl', 'rarity', 'baseCode', 'seriesId', 'seriesName'];
  const optionalBooleans = ['hasBpPlus', 'hasGenEnergyPlus', 'isParallel', 'isUnrevealed'];
  return strings.every((key) => typeof card[key] === 'string') &&
    ['code', 'name', 'titleCode'].every((key) => (card[key] as string).length > 0) &&
    cardTypes.has(card.cardType as string) && colors.has(card.color as string) &&
    (card.bp === null || (typeof card.bp === 'number' && Number.isFinite(card.bp))) &&
    ['apCost', 'reqEnergy', 'genEnergy'].every((key) => typeof card[key] === 'number' && Number.isFinite(card[key])) &&
    Array.isArray(card.traits) && card.traits.every((trait) => typeof trait === 'string') &&
    Array.isArray(card.triggers) && card.triggers.every((trigger) => typeof trigger === 'string' && triggers.has(trigger)) &&
    optionalStrings.every((key) => card[key] === undefined || typeof card[key] === 'string') &&
    optionalBooleans.every((key) => card[key] === undefined || typeof card[key] === 'boolean');
}

/** Publish only a fully validated asset; share requests and allow retries on failure. */
export function createCardAssetLoader(url: string, apply: (cards: CardMaster[]) => void) {
  let pending: Promise<void> | undefined;
  return function load(fetcher: typeof fetch = fetch): Promise<void> {
    if (!pending) {
      pending = (async () => {
        const response = await fetcher(url);
        if (!response.ok) throw new Error(`Card asset request failed: ${response.status}`);
        const data: unknown = await response.json();
        if (!Array.isArray(data) || data.length === 0 || !data.every(isCardMaster)) {
          throw new Error('Invalid official card asset');
        }
        apply(data);
      })().catch((error: unknown) => {
        pending = undefined;
        throw error;
      });
    }
    return pending;
  };
}
