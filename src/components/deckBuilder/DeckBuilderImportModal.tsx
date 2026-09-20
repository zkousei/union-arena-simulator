import React, { useState } from 'react';
import { UserDeck } from '../../domain/deckValidation';
import { importDeckFromJson } from '../../utils/deckStorage';
import { Upload, X, AlertCircle } from 'lucide-react';

interface DeckBuilderImportModalProps {
  isOpen: boolean;
  onImportSuccess: (deck: UserDeck) => void;
  onClose: () => void;
}

export const DeckBuilderImportModal: React.FC<DeckBuilderImportModalProps> = ({
  isOpen,
  onImportSuccess,
  onClose,
}) => {
  const [jsonText, setJsonText] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleClose = () => {
    setJsonText('');
    setError(null);
    onClose();
  };

  const handleImport = () => {
    try {
      setError(null);
      const deck = importDeckFromJson(jsonText);
      onImportSuccess(deck);
      handleClose();
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'JSONの解析に失敗しました。');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4 text-xs overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="デッキJSONインポート"
        className="bg-slate-900 border-2 border-indigo-500/80 rounded-2xl max-w-md w-full max-h-[calc(100dvh-1.5rem)] p-4 shadow-2xl space-y-3 overflow-y-auto animate-in fade-in zoom-in-95 duration-200 my-auto"
      >
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-base text-white">デッキJSONインポート</h3>
          </div>
          <button onClick={handleClose} className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white" title="閉じる">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-slate-400 text-[11px]">
          エクスポートされたデッキのJSON文字列を貼り付けてください：
        </p>

        <textarea
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          placeholder='{"name": "...", "items": [...]}'
          rows={8}
          className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 font-mono text-[11px] text-slate-200 focus:outline-none focus:border-indigo-500"
        />

        {error && (
          <div role="alert" className="flex items-center gap-1.5 text-rose-400 bg-rose-950/40 p-2 rounded-lg text-[11px] border border-rose-800/40">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
          <button
            onClick={handleClose}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-semibold"
          >
            キャンセル
          </button>
          <button
            onClick={handleImport}
            disabled={!jsonText.trim()}
            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg font-bold shadow"
          >
            インポート
          </button>
        </div>
      </div>
    </div>
  );
};
