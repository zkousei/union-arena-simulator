/**
 * ユニオンアリーナ バトル計算ドメインロジック
 */

export type BattleOutcome = 'ATTACKER_WIN' | 'DEFENDER_WIN';

export interface BattleResult {
  outcome: BattleOutcome;
  shouldRetireAttacker: boolean;
  shouldRetireDefender: boolean;
  logMessage: string;
}

/**
 * ユニオンアリーナ公式ルール (Ver 1.1): バトル解決の計算
 * - アタッカーBP >= ディフェンダーBP: アタッカー勝利。ディフェンダー退場（アタッカーは場に残る）
 * - アタッカーBP < ディフェンダーBP: ディフェンダー勝利（防御成功）。両者とも無傷で場に残る
 */
export function calculateBattleResult(
  attackerBp: number,
  defenderBp: number,
  attackerName: string = 'アタッカー',
  defenderName: string = 'ディフェンダー'
): BattleResult {
  if (attackerBp > defenderBp) {
    return {
      outcome: 'ATTACKER_WIN',
      shouldRetireAttacker: false,
      shouldRetireDefender: true,
      logMessage: `勝者: 「${attackerName}」！「${defenderName}」は退場（場外）です。`,
    };
  }

  if (attackerBp === defenderBp) {
    return {
      outcome: 'ATTACKER_WIN',
      shouldRetireAttacker: false,
      shouldRetireDefender: true,
      logMessage: `アタッカー「${attackerName}」の勝利！（BP同値のためアタック側勝利）「${defenderName}」は退場（場外）です。`,
    };
  }

  return {
    outcome: 'DEFENDER_WIN',
    shouldRetireAttacker: false,
    shouldRetireDefender: false,
    logMessage: `勝者: 「${defenderName}」！「${attackerName}」は防御を突破できませんでした（両者とも場に残ります）。`,
  };
}
