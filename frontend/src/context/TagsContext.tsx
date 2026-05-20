import { createContext, useContext, useState } from 'react';
import type { Tag } from '../services/tagService';
import { tagService } from '../services/tagService';

interface TagsCtx {
  tags: Tag[];
  loadTags: (restaurantId: string) => void;
  setTags: React.Dispatch<React.SetStateAction<Tag[]>>;
}

const TagsContext = createContext<TagsCtx>({
  tags: [],
  loadTags: () => {},
  setTags: () => {},
});

export function TagsProvider({ children }: { children: React.ReactNode }) {
  const [tags, setTags] = useState<Tag[]>([]);

  function loadTags(restaurantId: string) {
    tagService.getTagsPublic(restaurantId).then(setTags).catch(() => {});
  }

  return (
    <TagsContext.Provider value={{ tags, loadTags, setTags }}>
      {children}
    </TagsContext.Provider>
  );
}

export const useTags = () => useContext(TagsContext);
