import { useSyncExternalStore } from 'react';
import { cardCatalog } from '../data/cardDatabase';
export function useCardCatalog() {
  return useSyncExternalStore(cardCatalog.subscribe, cardCatalog.getCards, cardCatalog.getCards);
}
