import axios from 'axios';

const BASE = `${import.meta.env.VITE_API_URL ?? ''}/api/tags`;

export type TagCategory = 'label' | 'dietary' | 'allergen';

export interface Tag {
  id: string;
  slug: string;
  label: string;
  emoji: string;
  sortOrder: number;
  category: TagCategory;
}

/** Tailwind classes for a tag pill based on its category. */
export function tagPillCls(category: TagCategory | undefined, active = false): string {
  if (category === 'dietary') return active ? 'bg-green-600 text-white' : 'bg-green-100 text-green-700';
  if (category === 'allergen') return active ? 'bg-amber-500 text-white' : 'bg-amber-100 text-amber-700';
  return active ? 'bg-gray-600 text-white' : 'bg-gray-100 text-gray-600';
}

export const tagService = {
  getTagsPublic: (restaurantId: string) =>
    axios.get<Tag[]>(`${BASE}?restaurantId=${restaurantId}`).then((r) => r.data),

  getTagsAdmin: () =>
    axios.get<Tag[]>(BASE, { withCredentials: true }).then((r) => r.data),

  createTag: (label: string, emoji: string, category?: TagCategory) =>
    axios.post<Tag>(BASE, { label, emoji, category }, { withCredentials: true }).then((r) => r.data),

  updateTag: (id: string, label: string, emoji: string, category?: TagCategory) =>
    axios.put<Tag>(`${BASE}/${id}`, { label, emoji, category }, { withCredentials: true }).then((r) => r.data),

  deleteTag: (id: string) =>
    axios
      .delete<{ ok: boolean; slug: string }>(`${BASE}/${id}`, { withCredentials: true })
      .then((r) => r.data),
};


