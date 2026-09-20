import React, { useEffect, useState } from 'react';
import { Swords, X } from 'lucide-react';

interface AttackLineOverlayProps {
  sourceElement: HTMLElement | null;
  targetElement: HTMLElement | null;
  isActive: boolean;
  attackerName: string;
  onCancel: () => void;
}

export const AttackLineOverlay: React.FC<AttackLineOverlayProps> = ({
  sourceElement,
  targetElement,
  isActive,
  attackerName,
  onCancel,
}) => {
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    if (!isActive) return;
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [isActive]);

  if (!isActive || !sourceElement) return null;

  const sourceRect = sourceElement.getBoundingClientRect();
  const startX = sourceRect.left + sourceRect.width / 2;
  const startY = sourceRect.top + sourceRect.height / 2;

  let endX = mousePos.x;
  let endY = mousePos.y;

  if (targetElement) {
    const targetRect = targetElement.getBoundingClientRect();
    endX = targetRect.left + targetRect.width / 2;
    endY = targetRect.top + targetRect.height / 2;
  }

  return (
    <div className="fixed inset-0 pointer-events-none z-40">
      {/* SVG アタック線 */}
      <svg className="w-full h-full">
        <defs>
          <linearGradient id="attackGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="1" />
          </linearGradient>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="6"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#ef4444" />
          </marker>
        </defs>

        <line
          x1={startX}
          y1={startY}
          x2={endX}
          y2={endY}
          stroke="url(#attackGrad)"
          strokeWidth="4"
          strokeDasharray="6 4"
          markerEnd="url(#arrowhead)"
          className="animate-pulse"
        />
        <circle cx={startX} cy={startY} r="6" fill="#ef4444" className="animate-ping" />
        <circle cx={startX} cy={startY} r="4" fill="#fbbf24" />
      </svg>

      {/* トップのアタック宣言バナー */}
      <div className="absolute top-14 left-1/2 -translate-x-1/2 pointer-events-auto bg-gradient-to-r from-rose-900/90 via-red-950/90 to-rose-900/90 border-2 border-rose-500 rounded-2xl px-5 py-2.5 shadow-2xl flex items-center gap-3 text-white text-xs animate-in slide-in-from-top-4">
        <div className="bg-rose-600 p-1.5 rounded-full animate-bounce">
          <Swords className="w-4 h-4" />
        </div>
        <div>
          <span className="font-extrabold text-amber-300 mr-1">【アタック宣言】</span>
          <span className="font-bold text-white">「{attackerName}」</span>
          <span className="text-slate-300 ml-1.5 text-[11px]">
            攻撃対象（相手プレイヤーまたは相手キャラ）をクリックしてください
          </span>
        </div>
        <button
          onClick={onCancel}
          className="ml-2 px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 flex items-center gap-1 text-[11px]"
        >
          <X className="w-3.5 h-3.5" />
          キャンセル
        </button>
      </div>
    </div>
  );
};
