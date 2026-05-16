import type { Category } from '../types';

interface Props {
  categories: Category[];
  active: string;
  onChange: (id: string) => void;
}

export function CategoryTabs({ categories, active, onChange }: Props) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      <button
        onClick={() => onChange('all')}
        className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
          active === 'all' ? 'bg-orange-500 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-orange-300'
        }`}
      >
        All
      </button>
      {categories.map((cat) => (
        <button
          key={cat.id}
          onClick={() => onChange(cat.id)}
          className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            active === cat.id ? 'bg-orange-500 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-orange-300'
          }`}
        >
          {cat.name}
        </button>
      ))}
    </div>
  );
}
