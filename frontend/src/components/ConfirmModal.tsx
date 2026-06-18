import { useState, useCallback } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  danger?: boolean;
}

interface ConfirmState extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

export function useConfirm() {
  const [state, setState] = useState<ConfirmState | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setState({ ...options, resolve });
    });
  }, []);

  const handleConfirm = () => { state?.resolve(true);  setState(null); };
  const handleCancel  = () => { state?.resolve(false); setState(null); };

  const isDanger = state?.danger !== false;

  const modal = state ? (
    <div
      className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) handleCancel(); }}
    >
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isDanger ? 'bg-red-100' : 'bg-orange-100'}`}>
            {isDanger
              ? <Trash2 size={18} className="text-red-500" />
              : <AlertTriangle size={18} className="text-orange-500" />
            }
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 leading-snug">{state.title}</h3>
            {state.message && <p className="text-sm text-gray-500 mt-1 leading-relaxed">{state.message}</p>}
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleCancel}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            autoFocus
            onClick={handleConfirm}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors ${
              isDanger ? 'bg-red-500 hover:bg-red-600' : 'bg-orange-500 hover:bg-orange-600'
            }`}
          >
            {state.confirmLabel ?? 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { confirm, modal };
}
