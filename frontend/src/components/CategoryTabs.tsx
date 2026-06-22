import { useEffect, useRef, useState } from 'react';
import type { Category } from '../types';

interface Props {
  categories: Category[];
  active: string;
  onChange: (id: string) => void;
}

export function CategoryTabs({ categories, active, onChange }: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [fade, setFade] = useState({ left: false, right: false });

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const update = () => {
      setFade({
        left: el.scrollLeft > 4,
        right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
      });
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      el.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [categories.length]);

  const pill = (id: string, label: string) => (
    <button
      key={id}
      onClick={() => onChange(id)}
      aria-pressed={active === id}
      className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
        active === id ? 'bg-orange-500 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-orange-300'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="relative">
      <div
        ref={scrollerRef}
        role="group"
        aria-label="Menu categories"
        className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide"
      >
        {pill('all', 'All')}
        {categories.map((cat) => pill(cat.id, cat.name))}
      </div>

      {/* Edge fades — signal that the row scrolls horizontally */}
      {fade.left && (
        <div className="pointer-events-none absolute left-0 top-0 bottom-2 w-8 bg-gradient-to-r from-white to-transparent" />
      )}
      {fade.right && (
        <div className="pointer-events-none absolute right-0 top-0 bottom-2 w-8 bg-gradient-to-l from-white to-transparent" />
      )}
    </div>
  );
}
