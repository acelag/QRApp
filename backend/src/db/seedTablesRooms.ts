import 'dotenv/config';
import { randomUUID } from 'crypto';
import { pool } from './database';

const RESTAURANT_ID = 'c563dcc6-2b94-496b-916b-549a5951d02b';
const now = new Date().toISOString();

const TABLES = [
  { number: 1,  seats: 2 }, { number: 2,  seats: 2 }, { number: 3,  seats: 4 },
  { number: 4,  seats: 4 }, { number: 5,  seats: 4 }, { number: 6,  seats: 4 },
  { number: 7,  seats: 6 }, { number: 8,  seats: 6 }, { number: 9,  seats: 6 },
  { number: 10, seats: 8 }, { number: 11, seats: 8 }, { number: 12, seats: 8 },
  { number: 13, seats: 10 }, { number: 14, seats: 10 }, { number: 15, seats: 12 },
];

const ROOMS = [
  { number: 101, name: 'Standard Room 101' }, { number: 102, name: 'Standard Room 102' },
  { number: 103, name: 'Standard Room 103' }, { number: 104, name: 'Deluxe Room 104' },
  { number: 105, name: 'Deluxe Room 105' },   { number: 201, name: 'Suite 201' },
  { number: 202, name: 'Suite 202' },          { number: 203, name: 'Family Room 203' },
  { number: 204, name: 'Family Room 204' },    { number: 301, name: 'Penthouse 301' },
];

async function main() {
  let tCreated = 0;
  for (const t of TABLES) {
    const exists = await pool.query(
      'SELECT id FROM tables WHERE restaurant_id = $1 AND number = $2',
      [RESTAURANT_ID, t.number],
    );
    if (exists.rows.length === 0) {
      await pool.query(
        'INSERT INTO tables (id, restaurant_id, number, seats, active) VALUES ($1,$2,$3,$4,TRUE)',
        [randomUUID(), RESTAURANT_ID, t.number, t.seats],
      );
      tCreated++;
    }
  }

  let rCreated = 0;
  for (const r of ROOMS) {
    const exists = await pool.query(
      'SELECT id FROM rooms WHERE restaurant_id = $1 AND number = $2',
      [RESTAURANT_ID, r.number],
    );
    if (exists.rows.length === 0) {
      await pool.query(
        'INSERT INTO rooms (id, restaurant_id, number, name, created_at) VALUES ($1,$2,$3,$4,$5)',
        [randomUUID(), RESTAURANT_ID, r.number, r.name, now],
      );
      rCreated++;
    }
  }

  console.log(`✓ Tables created: ${tCreated}`);
  console.log(`✓ Rooms created:  ${rCreated}`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => pool.end());
