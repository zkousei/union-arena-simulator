import { describe, expect, it } from 'vitest';
import { calculateGeneratedEnergy } from '../energy';
import { Card } from '../../types/card';

const card = (genEnergy: number, isRested = false): Card => ({
  id: 'energy-card',
  code: 'UA40BT/REZ-1-043',
  name: 'フェリス',
  cardType: 'CHARACTER',
  color: 'BLUE',
  bp: 2500,
  apCost: 1,
  reqEnergy: 2,
  genEnergy,
  traits: [],
  triggers: [],
  effectText: '',
  isRested,
  bpModifier: 0,
  underCards: [],
});

describe('calculateGeneratedEnergy', () => {
  it('counts the printed base energy, including an explicit zero', () => {
    expect(calculateGeneratedEnergy([card(0), card(1), card(2)]))
      .toEqual({ total: 3, byColor: { BLUE: 3 } });
  });

  it('counts rested cards but not face-down cards', () => {
    expect(calculateGeneratedEnergy([card(1, true), { ...card(2), isFaceDown: true }]))
      .toEqual({ total: 1, byColor: { BLUE: 1 } });
  });

  it('uses manual adjustments, including on a zero-energy card, without going below zero', () => {
    expect(calculateGeneratedEnergy([
      { ...card(1), genEnergyModifier: 1 },
      { ...card(0), genEnergyModifier: 1 },
      { ...card(1), genEnergyModifier: -1 },
    ])).toEqual({ total: 3, byColor: { BLUE: 3 } });
  });

  it('counts only manually enabled front-line energy in addition to the energy line', () => {
    expect(calculateGeneratedEnergy(
      [card(1, true)],
      [card(2), { ...card(1, true), frontLineGeneratedEnergy: 2 }, { ...card(1), frontLineGeneratedEnergy: 1, isFaceDown: true }],
    )).toEqual({ total: 3, byColor: { BLUE: 3 } });
  });
});
