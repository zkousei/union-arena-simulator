import { describe, it, expect } from 'vitest';
import { calculateBattleResult } from '../battle';

describe('calculateBattleResult (Official Rule Ver 1.1)', () => {
  it('should declare attacker victory when attacker BP > defender BP and retire defender only', () => {
    const result = calculateBattleResult(4000, 3000);
    expect(result.outcome).toBe('ATTACKER_WIN');
    expect(result.shouldRetireAttacker).toBe(false);
    expect(result.shouldRetireDefender).toBe(true);
  });

  it('should declare attacker victory when attacker BP == defender BP and retire defender only (attacker wins ties in UA)', () => {
    const result = calculateBattleResult(3500, 3500);
    expect(result.outcome).toBe('ATTACKER_WIN');
    expect(result.shouldRetireAttacker).toBe(false);
    expect(result.shouldRetireDefender).toBe(true);
  });

  it('should declare defender victory when attacker BP < defender BP and retire neither character (both stay on field)', () => {
    const result = calculateBattleResult(2500, 4000);
    expect(result.outcome).toBe('DEFENDER_WIN');
    expect(result.shouldRetireAttacker).toBe(false);
    expect(result.shouldRetireDefender).toBe(false);
  });
});
