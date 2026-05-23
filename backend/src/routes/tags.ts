import { Router } from 'express';
import { pool } from '../db/database';
import { authenticate, optionalAuthenticate, requireRole } from '../middleware/auth';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

interface AuthReq extends Express.Request {
  user?: { restaurantId: string; role: string };
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50) || 'tag';
}

function rowToTag(row: Record<string, unknown>) {
  return {
    id:         row.id as string,
    slug:       row.slug as string,
    label:      row.label as string,
    emoji:      row.emoji as string,
    sortOrder:  Number(row.sort_order ?? 0),
    category:   (row.category as string | undefined) ?? 'label',
  };
}

// GET /api/tags?restaurantId=xxx  (public — used by customer menus)
// GET /api/tags                   (authenticated admin — uses token restaurantId)
router.get('/', optionalAuthenticate, async (req, res) => {
  try {
    const restaurantId =
      (req.query.restaurantId as string | undefined) ||
      ((req as unknown as AuthReq).user?.restaurantId);
    if (!restaurantId) return res.status(400).json({ error: 'restaurantId required' });

    const r = await pool.query(
      'SELECT * FROM tags WHERE restaurant_id=$1 ORDER BY sort_order ASC, label ASC',
      [restaurantId],
    );
    res.json(r.rows.map(rowToTag));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch tags' });
  }
});

// POST /api/tags  — create a new tag
router.post('/', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { label, emoji, category } = req.body as { label?: string; emoji?: string; category?: string };
    if (!label?.trim()) return res.status(400).json({ error: 'label required' });

    const restaurantId = (req as unknown as AuthReq).user!.restaurantId;
    let slug = slugify(label.trim());
    const cat = ['dietary', 'allergen'].includes(category ?? '') ? category! : 'label';

    // Ensure slug is unique within the restaurant
    const existing = await pool.query(
      'SELECT slug FROM tags WHERE restaurant_id=$1 AND slug LIKE $2',
      [restaurantId, `${slug}%`],
    );
    const taken = new Set((existing.rows as { slug: string }[]).map((r) => r.slug));
    if (taken.has(slug)) {
      let i = 2;
      while (taken.has(`${slug}-${i}`)) i++;
      slug = `${slug}-${i}`;
    }

    const maxRes = await pool.query(
      'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM tags WHERE restaurant_id=$1',
      [restaurantId],
    );
    const sortOrder = Number((maxRes.rows[0] as { next: number }).next);

    const r = await pool.query(
      `INSERT INTO tags (id, restaurant_id, slug, label, emoji, sort_order, category)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [uuidv4(), restaurantId, slug, label.trim(), (emoji ?? '').trim() || '🏷️', sortOrder, cat],
    );
    res.status(201).json(rowToTag(r.rows[0] as Record<string, unknown>));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create tag' });
  }
});

// PUT /api/tags/:id  — update label / emoji / category  (slug stays fixed so menu item refs still work)
router.put('/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { label, emoji, category } = req.body as { label?: string; emoji?: string; category?: string };
    if (!label?.trim()) return res.status(400).json({ error: 'label required' });

    const restaurantId = (req as unknown as AuthReq).user!.restaurantId;
    const cat = ['dietary', 'allergen'].includes(category ?? '') ? category! : 'label';
    const r = await pool.query(
      `UPDATE tags SET label=$1, emoji=$2, category=$3
       WHERE id=$4 AND restaurant_id=$5 RETURNING *`,
      [label.trim(), (emoji ?? '').trim() || '🏷️', cat, req.params.id, restaurantId],
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rowToTag(r.rows[0] as Record<string, unknown>));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update tag' });
  }
});

// DELETE /api/tags/:id  — remove tag and strip it from all menu items
router.delete('/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const restaurantId = (req as unknown as AuthReq).user!.restaurantId;

    const tagRes = await pool.query(
      'SELECT slug FROM tags WHERE id=$1 AND restaurant_id=$2',
      [req.params.id, restaurantId],
    );
    if (!tagRes.rows.length) return res.status(404).json({ error: 'Not found' });
    const slug = (tagRes.rows[0] as { slug: string }).slug;

    await pool.query('DELETE FROM tags WHERE id=$1 AND restaurant_id=$2', [req.params.id, restaurantId]);

    // Strip the deleted slug from all menu items in this restaurant
    await pool.query(
      `UPDATE menu_items
       SET tags = (
         SELECT COALESCE(json_agg(elem ORDER BY ord), '[]'::json)::text
         FROM   json_array_elements_text(tags::json) WITH ORDINALITY AS t(elem, ord)
         WHERE  elem <> $1
       )
       WHERE restaurant_id = $2 AND tags LIKE $3`,
      [slug, restaurantId, `%${slug}%`],
    );

    res.json({ ok: true, slug });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete tag' });
  }
});

export default router;
