import type { CardType } from '../types/card';
export function isActionPointCardNumber(code: string): boolean;
export function parseCardCategory(category: string): CardType | null;
export function inferCardType(category: string, code: string): CardType;
export function hasReviewedOfficialBpDash(code: string): boolean;
