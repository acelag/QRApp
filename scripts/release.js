#!/usr/bin/env node
/**
 * Release script — writes today's date as the version, commits, and tags.
 * Usage:  npm run release
 *         npm run release -- 2026.06.15   (optional: override date)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const VERSION_FILE = path.join(ROOT, 'VERSION');

// Determine version string
const override = process.argv[2];
const today = new Date();
const pad = (n) => String(n).padStart(2, '0');
const autoDate = `${today.getFullYear()}.${pad(today.getMonth() + 1)}.${pad(today.getDate())}`;
const version = override ?? autoDate;

// Write VERSION file
fs.writeFileSync(VERSION_FILE, version + '\n', 'utf8');
console.log(`✓ VERSION → ${version}`);

// Git commit + tag
try {
  execSync(`git -C "${ROOT}" add VERSION`, { stdio: 'inherit' });
  execSync(`git -C "${ROOT}" commit -m "chore: release ${version}"`, { stdio: 'inherit' });
  execSync(`git -C "${ROOT}" tag -a "v${version}" -m "Release ${version}"`, { stdio: 'inherit' });
  console.log(`✓ Tagged v${version}`);
  console.log('\nNext: git push origin main --tags');
} catch (e) {
  console.error('Git step failed:', e.message);
  process.exit(1);
}
