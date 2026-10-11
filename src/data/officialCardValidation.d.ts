export function validateOfficialCardDetail(html: string, code: string, parsed?: import('./cardDatabase').CardMaster): void;
export function validateOfficialCardDataset(cards: unknown, previous?: readonly { code: string; isUnrevealed?: boolean }[]): void;
export function findOfficialCardConflicts(cards: readonly import('./cardDatabase').CardMaster[]): { number: string; fields: string[]; variants: Record<string, unknown>[] }[];
