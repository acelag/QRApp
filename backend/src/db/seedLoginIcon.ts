/**
 * One-off: store an image file as the app-wide login icon in the database
 * (app_settings.login_icon), as a base64 data URL.
 *
 * Usage:  ts-node src/db/seedLoginIcon.ts /path/to/icon.png
 */
import 'dotenv/config'; // must be first — loads .env before database.ts reads process.env
import { readFileSync } from 'fs';
import { extname } from 'path';
import { pool } from './database';
import { setLoginIcon } from '../lib/appSettings';

async function main() {
  const path = process.argv[2];
  if (!path) {
    console.error('Usage: ts-node src/db/seedLoginIcon.ts <path-to-image>');
    process.exit(1);
  }
  const ext = extname(path).slice(1).toLowerCase() || 'png';
  const mime = ext === 'jpg' ? 'jpeg' : ext === 'svg' ? 'svg+xml' : ext;
  const b64 = readFileSync(path).toString('base64');
  const dataUrl = `data:image/${mime};base64,${b64}`;
  await setLoginIcon(dataUrl);
  console.log(`✓ login_icon set (${(dataUrl.length / 1024).toFixed(1)} KB) from ${path}`);
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
