import React, { useEffect } from 'react';
import { HelpCircle, AlertTriangle, AlertCircle, X } from 'lucide-react';

export interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string | null;
  variant?: 'primary' | 'danger' | 'warning';
  icon?: React.ReactNode;
  onConfirm: () => void;
  onCancel?: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  description,
  confirmText = 'OK',
  cancelText = 'キャンセル',
  variant = 'primary',
  icon,
  onConfirm,
  onCancel,
}) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onCancel) {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const getVariantStyles = () => {
    switch (variant) {
      case 'danger':
        return {
          iconBg: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
          headerGradient: 'from-rose-950/80 to-slate-900',
          confirmBtn: 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30',
          defaultIcon: <AlertCircle className="w-5 h-5" />,
        };
      case 'warning':
        return {
          iconBg: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
          headerGradient: 'from-amber-950/80 to-slate-900',
          confirmBtn: 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/30',
          defaultIcon: <AlertTriangle className="w-5 h-5" />,
        };
      case 'primary':
      default:
        return {
          iconBg: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
          headerGradient: 'from-indigo-950/80 to-slate-900',
          confirmBtn: 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30',
          defaultIcon: <HelpCircle className="w-5 h-5" />,
        };
    }
  };

  const styles = getVariantStyles();

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      onClick={() => onCancel?.()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm sm:max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
      >
        {/* ヘッダー */}
        <div className={`px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r ${styles.headerGradient}`}>
          <div className="flex items-center gap-2.5">
            <div className={`p-1.5 rounded-xl border ${styles.iconBg}`}>
              {icon || styles.defaultIcon}
            </div>
            <h2 id="confirm-modal-title" className="text-sm sm:text-base font-bold text-white">
              {title}
            </h2>
          </div>
          {onCancel && (
            <button
              onClick={onCancel}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="閉じる"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* 本文 */}
        <div className="p-5">
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed whitespace-pre-line">
            {description}
          </p>
        </div>

        {/* アクションボタン */}
        <div className="px-5 py-3.5 bg-slate-950/80 border-t border-slate-800/80 flex items-center justify-end gap-2.5">
          {cancelText && onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 transition border border-slate-700"
            >
              {cancelText}
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 rounded-xl text-xs font-bold shadow-lg transition active:scale-95 ${styles.confirmBtn}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
