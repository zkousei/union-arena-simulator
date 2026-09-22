import { Card, CardColor } from '../types/card';

/** Current energy including manual effect adjustments. */
export function getEffectiveGeneratedEnergy(card: Card): number {
  return Math.max(0, card.genEnergy + (card.genEnergyModifier || 0));
}

/** Energy-line values plus explicitly assigned front-line effect energy. */
export function calculateGeneratedEnergy(energyLine: (Card | null)[], frontLine: (Card | null)[] = []) {
  let total = 0;
  const byColor: Partial<Record<CardColor, number>> = {};

  const addEnergy = (card: Card, energy: number) => {
    if (energy <= 0) return;
    total += energy;
    const color = card.color || 'COLORLESS';
    byColor[color] = (byColor[color] || 0) + energy;
  };

  for (const card of energyLine) {
    if (!card || card.isFaceDown) continue;
    addEnergy(card, getEffectiveGeneratedEnergy(card));
  }

  for (const card of frontLine) {
    if (!card || card.isFaceDown) continue;
    addEnergy(card, card.frontLineGeneratedEnergy || 0);
  }

  return { total, byColor };
}
