import axios from 'axios';

const BASE = `${import.meta.env.VITE_API_URL ?? ''}/api/tags`;

export interface Tag {
  id: string;
  slug: string;
  label: string;
  emoji: string;
  sortOrder: number;
}

export const tagService = {
  getTagsPublic: (restaurantId: string) =>
    axios.get<Tag[]>(`${BASE}?restaurantId=${restaurantId}`).then((r) => r.data),

  getTagsAdmin: () =>
    axios.get<Tag[]>(BASE, { withCredentials: true }).then((r) => r.data),

  createTag: (label: string, emoji: string) =>
    axios.post<Tag>(BASE, { label, emoji }, { withCredentials: true }).then((r) => r.data),

  updateTag: (id: string, label: string, emoji: string) =>
    axios.put<Tag>(`${BASE}/${id}`, { label, emoji }, { withCredentials: true }).then((r) => r.data),

  deleteTag: (id: string) =>
    axios
      .delete<{ ok: boolean; slug: string }>(`${BASE}/${id}`, { withCredentials: true })
      .then((r) => r.data),
};
