import { Card, CardColor } from '../types/card';

/** Current energy including manual effect adjustments. */
export function getEffectiveGeneratedEnergy(card: Card): number {
  return Math.max(0, card.genEnergy + (card.genEnergyModifier || 0));
}

export function calculateGeneratedEnergy(slots: (Card | null)[]) {
  let total = 0;
  const byColor: Partial<Record<CardColor, number>> = {};

  for (const card of slots) {
    if (!card || card.isFaceDown) continue;
    const energy = getEffectiveGeneratedEnergy(card);
    if (energy <= 0) continue;
    total += energy;
    const color = card.color || 'COLORLESS';
    byColor[color] = (byColor[color] || 0) + energy;
  }

  return { total, byColor };
}
