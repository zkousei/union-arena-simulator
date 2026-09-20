import React from 'react';
import { Phase } from '../../types/game';
import { ArrowRight, RotateCw, ArrowRightLeft, Play, Swords, CheckCircle2, PlusCircle } from 'lucide-react';

interface PhaseBarProps {
  currentPhase: Phase;
  turn: number;
  isActivePlayer: boolean;
  activePlayerName: string;
  canExtraDraw: boolean;
  isFirstTurnFirstPlayer?: boolean;
  onSetPhase: (phase: Phase) => void;
  onPassTurn: () => void;
  onExtraDraw?: () => void;
}

// 公式5フェイズ定義
const PHASES: Array<{ id: Phase; label: string; icon: React.ReactNode }> = [
  { id: 'START', label: 'スタート', icon: <RotateCw className="w-3.5 h-3.5" /> },
  { id: 'MOVE', label: '移動', icon: <ArrowRightLeft className="w-3.5 h-3.5" /> },
  { id: 'MAIN', label: 'メイン', icon: <Play className="w-3.5 h-3.5" /> },
  { id: 'ATTACK', label: 'アタック', icon: <Swords className="w-3.5 h-3.5" /> },
  { id: 'END', label: 'エンド', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
];

export const PhaseBar: React.FC<PhaseBarProps> = ({
  currentPhase,
  turn,
  isActivePlayer,
  activePlayerName,
  canExtraDraw,
  isFirstTurnFirstPlayer = false,
  onSetPhase,
  onPassTurn,
  onExtraDraw,
}) => {
  return (
    <div className="flex items-center justify-between bg-slate-900/90 border-y border-slate-800 px-4 py-2 shadow-md w-full flex-wrap gap-2">
      {/* ターン情報 */}
      <div className="flex items-center gap-3">
        <div className="bg-indigo-950 border border-indigo-500/50 px-3 py-1 rounded-lg">
          <span className="text-xs text-indigo-300 font-bold tracking-wider">TURN {turn}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div
            className={`w-2.5 h-2.5 rounded-full ${
              isActivePlayer ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'
            }`}
          />
          <span className="text-xs font-bold text-slate-200">
            {isActivePlayer ? 'あなたの手番' : `${activePlayerName} の手番`}
          </span>
        </div>
      </div>

      {/* 公式5フェイズ切り替えタブ */}
      <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 gap-0.5">
        {PHASES.map((p) => {
          const isActive = currentPhase === p.id;
          const isAttackBlocked = p.id === 'ATTACK' && isFirstTurnFirstPlayer;

          return (
            <button
              key={p.id}
              onClick={() => {
                if (isAttackBlocked) {
                  alert('【公式ルール】先攻第1ターンはアタックフェイズを行えません（アタック不可）。');
                  return;
                }
                onSetPhase(p.id);
              }}
              disabled={isAttackBlocked}
              title={isAttackBlocked ? '公式ルール: 先攻1ターン目はアタック不可' : undefined}
              className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                isAttackBlocked
                  ? 'opacity-30 cursor-not-allowed text-slate-500 bg-slate-900/50 line-through'
                  : isActive
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 scale-105'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              {p.icon}
              <span>{p.label}{isAttackBlocked ? ' (不可)' : ''}</span>
            </button>
          );
        })}
      </div>

      {/* スタートフェイズのエクストラドロー & ターン終了ボタン */}
      <div className="flex items-center gap-2">
        {currentPhase === 'START' && isActivePlayer && onExtraDraw && (
          <button
            onClick={onExtraDraw}
            disabled={!canExtraDraw}
            className="flex items-center gap-1 px-3 py-1.5 bg-amber-600/90 hover:bg-amber-500 disabled:opacity-40 text-white text-xs font-bold rounded-lg shadow transition"
            title="スタートフェイズ中、1APを支払って追加で1枚カードを引きます（各ターン1回まで）"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>エクストラドロー (1AP)</span>
          </button>
        )}

        <button
          onClick={onPassTurn}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white text-xs font-extrabold rounded-lg shadow-lg shadow-amber-600/20 transition-transform active:scale-95"
        >
          <span>ターン終了</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
