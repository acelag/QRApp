import 'dotenv/config';
import { pool } from './database';

const FIXES: Array<[string, string]> = [
  ['Margherita',     'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=600&q=80'],
  ['Pepperoni',      'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&q=80'],
  ['Veggie Supreme', 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&q=80'],
  ['Mushroom Swiss', 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=600&q=80'],
];

(async () => {
  for (const [name, url] of FIXES) {
    const r = await pool.query('UPDATE menu_items SET image = $1 WHERE name = $2', [url, name]);
    console.log(`${(r.rowCount ?? 0) > 0 ? '✓' : '⚠ not found'} ${name}`);
  }
  await pool.end();
})();
