import { Loader2 } from 'lucide-react';
interface Props {
  onCancel: () => void;
  saving?: boolean;
  saveLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}
export function FormActions({ onCancel, saving, saveLabel = 'Save', cancelLabel = 'Cancel', danger }: Props) {
  return (
    <div className="flex gap-2 justify-end pt-1">
      <button
        type="button"
        onClick={onCancel}
        className="px-4 py-2 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
      >
        {cancelLabel}
      </button>
      <button
        type="submit"
        disabled={saving}
        className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-60 ${danger ? 'bg-red-500 hover:bg-red-600' : 'bg-orange-500 hover:bg-orange-600'}`}
      >
        {saving && <Loader2 size={14} className="animate-spin" />}
        {saving ? 'Saving…' : saveLabel}
      </button>
    </div>
  );
}
