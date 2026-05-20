/**
 * Reads .env and generates js/firebase-config.js for the browser app.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const envPath = resolve(root, '.env');
const outPath = resolve(root, 'js', 'firebase-config.js');

const KEYS = [
  'FIREBASE_API_KEY',
  'FIREBASE_AUTH_DOMAIN',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_STORAGE_BUCKET',
  'FIREBASE_MESSAGING_SENDER_ID',
  'FIREBASE_APP_ID',
  'FIREBASE_MEASUREMENT_ID',
];

function parseEnv(content) {
  const env = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

if (!existsSync(envPath)) {
  console.error('Missing .env — copy .env.example to .env and fill in values.');
  process.exit(1);
}

const env = parseEnv(readFileSync(envPath, 'utf8'));
const missing = KEYS.filter((k) => k !== 'FIREBASE_MEASUREMENT_ID' && !env[k]?.trim());

if (missing.length) {
  console.error('Missing required env vars:', missing.join(', '));
  process.exit(1);
}

const lines = [
  '/**',
  ' * Auto-generated from .env — do not edit manually.',
  ' * Run: npm run env:build',
  ' */',
  'const FIREBASE_CONFIG = {',
  `  apiKey: '${escapeJs(env.FIREBASE_API_KEY)}',`,
  `  authDomain: '${escapeJs(env.FIREBASE_AUTH_DOMAIN)}',`,
  `  projectId: '${escapeJs(env.FIREBASE_PROJECT_ID)}',`,
  `  storageBucket: '${escapeJs(env.FIREBASE_STORAGE_BUCKET)}',`,
  `  messagingSenderId: '${escapeJs(env.FIREBASE_MESSAGING_SENDER_ID)}',`,
  `  appId: '${escapeJs(env.FIREBASE_APP_ID)}',`,
];

if (env.FIREBASE_MEASUREMENT_ID?.trim()) {
  lines.push(`  measurementId: '${escapeJs(env.FIREBASE_MEASUREMENT_ID)}',`);
}

lines.push('};', '');

writeFileSync(outPath, lines.join('\n'), 'utf8');
console.log('Generated js/firebase-config.js');

function escapeJs(str) {
  return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}
