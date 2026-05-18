import 'dotenv/config';
import { pool } from './database';

// Keyword → Unsplash photo URL mapping (ordered: most specific first)
const IMAGE_MAP: Array<{ keywords: string[]; url: string }> = [
  { keywords: ['bbq burger', 'bbq-burger'],           url: 'https://images.unsplash.com/photo-1606755962773-d324e0a13086?w=600&q=80' },
  { keywords: ['double stack', 'double-stack'],        url: 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=600&q=80' },
  { keywords: ['cheese burger', 'cheeseburger'],       url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&q=80' },
  { keywords: ['classic burger'],                      url: 'https://images.unsplash.com/photo-1553979459-d2229ba7433b?w=600&q=80' },
  { keywords: ['burger', 'smash'],                     url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&q=80' },
  { keywords: ['bbq chicken', 'grilled chicken'],      url: 'https://images.unsplash.com/photo-1598103442097-8b74394b95c3?w=600&q=80' },
  { keywords: ['chicken'],                             url: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=600&q=80' },
  { keywords: ['french fries', 'fries', 'chips'],      url: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=600&q=80' },
  { keywords: ['onion ring'],                          url: 'https://images.unsplash.com/photo-1639024471283-03518883512d?w=600&q=80' },
  { keywords: ['apple pie'],                           url: 'https://images.unsplash.com/photo-1621743478914-cc8a86d7e7b5?w=600&q=80' },
  { keywords: ['cheesecake', 'cheese cake'],           url: 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=600&q=80' },
  { keywords: ['chocolate brownie', 'brownie'],        url: 'https://images.unsplash.com/photo-1607101756515-23a6610a536e?w=600&q=80' },
  { keywords: ['chocolate cake', 'choco cake'],        url: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=600&q=80' },
  { keywords: ['ice cream', 'icecream'],               url: 'https://images.unsplash.com/photo-1501443762994-82bd5dace89a?w=600&q=80' },
  { keywords: ['waffle'],                              url: 'https://images.unsplash.com/photo-1562376552-0d160a2f238d?w=600&q=80' },
  { keywords: ['pancake'],                             url: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=600&q=80' },
  { keywords: ['garlic bread', 'garlic toast'],        url: 'https://images.unsplash.com/photo-1619531040576-f9416740661a?w=600&q=80' },
  { keywords: ['bread', 'toast', 'bun'],               url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&q=80' },
  { keywords: ['coleslaw', 'slaw'],                    url: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&q=80' },
  { keywords: ['salad'],                               url: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&q=80' },
  { keywords: ['pizza'],                               url: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&q=80' },
  { keywords: ['pasta', 'spaghetti', 'noodle'],        url: 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=600&q=80' },
  { keywords: ['sandwich', 'sub', 'wrap'],             url: 'https://images.unsplash.com/photo-1553909489-cd47e0907980?w=600&q=80' },
  { keywords: ['steak', 'beef', 'ribeye'],             url: 'https://images.unsplash.com/photo-1432139555190-58524dae6a55?w=600&q=80' },
  { keywords: ['soup'],                                url: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=600&q=80' },
  { keywords: ['sushi', 'roll'],                       url: 'https://images.unsplash.com/photo-1617196034183-421b4040ed20?w=600&q=80' },
  { keywords: ['rice', 'fried rice', 'biryani'],       url: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=600&q=80' },
  { keywords: ['curry'],                               url: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=600&q=80' },
  { keywords: ['fish', 'seafood', 'prawn', 'shrimp'],  url: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=600&q=80' },
  { keywords: ['coca cola', 'coke', 'cola'],           url: 'https://images.unsplash.com/photo-1629203851122-3726ecdf080e?w=600&q=80' },
  { keywords: ['pepsi'],                               url: 'https://images.unsplash.com/photo-1629203851122-3726ecdf080e?w=600&q=80' },
  { keywords: ['orange juice', 'fresh juice', 'juice'], url: 'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=600&q=80' },
  { keywords: ['lemonade', 'lime'],                    url: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=600&q=80' },
  { keywords: ['milkshake', 'shake'],                  url: 'https://images.unsplash.com/photo-1572490122747-3e92e5a8b417?w=600&q=80' },
  { keywords: ['smoothie'],                            url: 'https://images.unsplash.com/photo-1553530666-ba11a90bb0c2?w=600&q=80' },
  { keywords: ['coffee', 'latte', 'cappuccino', 'espresso'], url: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600&q=80' },
  { keywords: ['tea'],                                 url: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=600&q=80' },
  { keywords: ['water', 'mineral'],                    url: 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=600&q=80' },
];

function matchImage(name: string): string | null {
  const lower = name.toLowerCase();
  for (const entry of IMAGE_MAP) {
    if (entry.keywords.some((kw) => lower.includes(kw))) {
      return entry.url;
    }
  }
  return null;
}

async function run() {
  const res = await pool.query<{ id: string; name: string; image: string | null }>(
    'SELECT id, name, image FROM menu_items ORDER BY name',
  );

  let updated = 0;
  let skipped = 0;

  for (const row of res.rows) {
    const url = matchImage(row.name);
    if (!url) {
      console.log(`  ⚠  No match for: ${row.name}`);
      skipped++;
      continue;
    }
    await pool.query('UPDATE menu_items SET image = $1 WHERE id = $2', [url, row.id]);
    console.log(`  ✓  ${row.name}  →  image set`);
    updated++;
  }

  console.log(`\nDone — ${updated} updated, ${skipped} skipped (no keyword match)`);
  await pool.end();
}

run().catch((err) => { console.error(err); process.exit(1); });
