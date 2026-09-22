import { Card, CardColor } from '../types/card';

/** Printed base energy only; effect increases are handled manually. */
export function calculateGeneratedEnergy(slots: (Card | null)[]) {
  let total = 0;
  const byColor: Partial<Record<CardColor, number>> = {};

  for (const card of slots) {
    if (!card || card.isRested || card.isFaceDown || card.genEnergy <= 0) continue;
    total += card.genEnergy;
    const color = card.color || 'COLORLESS';
    byColor[color] = (byColor[color] || 0) + card.genEnergy;
  }

  return { total, byColor };
}
