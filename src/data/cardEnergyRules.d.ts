import type { Card, CardColor } from '../types/card';
export function parseRequiredEnergyColors(text: string): CardColor[] | undefined;
export function isRequiredEnergyColors(value: unknown): boolean;
export function getRequiredEnergyColors(card: Pick<Card, 'color' | 'reqEnergyColors'>): CardColor[];
export function formatRequiredEnergyColors(card: Pick<Card, 'color' | 'reqEnergyColors'>): string;
