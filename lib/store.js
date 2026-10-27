import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { seedDatabase } from './seed.js';

export const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(process.cwd(), 'data');
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'db.json');

export function uid(prefix = '') {
  return `${prefix}${crypto.randomBytes(8).toString('hex')}`;
}

export function nowIso() {
  return new Date().toISOString();
}

/** YYYY-MM-DD (UTC) — kunci agregasi metrik harian. */
export function dayKey(date = new Date()) {
  return new Date(date).toISOString().slice(0, 10);
}

export function dayKeysBack(count, from = new Date()) {
  const keys = [];
  const base = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()),
  );
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() - i);
    keys.push(d.toISOString().slice(0, 10));
  }
  return keys;
}

let db = null;
let saveTimer = null;

function ensureDirs() {
  mkdirSync(DATA_DIR, { recursive: true });
  mkdirSync(UPLOAD_DIR, { recursive: true });
}

export function loadDatabase() {
  ensureDirs();
  if (existsSync(DB_FILE)) {
    try {
      db = JSON.parse(readFileSync(DB_FILE, 'utf8'));
    } catch (error) {
      console.error('[store] db.json rusak, memuat seed baru:', error.message);
      db = null;
    }
  }
  if (!db || !db.meta || !db.users?.length) {
    db = seedDatabase();
    saveNow();
  }
  return db;
}

export function getDb() {
  if (!db) loadDatabase();
  return db;
}

function saveNow() {
  ensureDirs();
  const tmp = `${DB_FILE}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(db, null, 2), 'utf8');
  renameSync(tmp, DB_FILE);
}

/** Simpan dengan debounce supaya burst mutasi tidak menulis berulang kali. */
export function save() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      saveNow();
    } catch (error) {
      console.error('[store] gagal menyimpan:', error.message);
    }
  }, 120);
  saveTimer.unref?.();
}

export function flush() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
    saveNow();
  }
}

export function findById(collection, id) {
  return getDb()[collection].find((item) => item.id === id);
}

/* ---------------------------------------------------------------- metrics */

export function recordUsage(agentId, tokens) {
  const store = getDb();
  const today = dayKey();
  const entry = store.usage.find(
    (row) => row.date === today && row.agentId === agentId,
  );
  if (entry) entry.tokens += tokens;
  else store.usage.push({ date: today, agentId, tokens });
  save();
}

export function recordActivity(agentId, kind, label) {
  const store = getDb();
  const today = dayKey();
  store.activity.push({
    id: uid('act_'),
    date: today,
    at: nowIso(),
    agentId,
    kind,
    label,
  });
  // batasi riwayat agar file tidak tumbuh tanpa batas
  if (store.activity.length > 4000) store.activity.splice(0, store.activity.length - 4000);
  save();
}

export function logEvent(type, message, meta = {}) {
  const store = getDb();
  store.events.push({
    id: uid('evt_'),
    at: nowIso(),
    type,
    message,
    ...meta,
  });
  if (store.events.length > 500) store.events.splice(0, store.events.length - 500);
}
