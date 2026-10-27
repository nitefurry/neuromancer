import crypto from 'node:crypto';
import { getDb, nowIso, save } from './store.js';
import { sha256 } from './password.js';

const SESSION_DAYS = 7;

export function createSession(userId) {
  const db = getDb();
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString();
  db.sessions.push({ tokenHash: sha256(token), userId, createdAt: nowIso(), expiresAt });
  // buang sesi kedaluwarsa
  db.sessions = db.sessions.filter((s) => new Date(s.expiresAt) > new Date());
  save();
  return { token, expiresAt };
}

export function destroySession(token) {
  if (!token) return;
  const db = getDb();
  const hash = sha256(token);
  db.sessions = db.sessions.filter((s) => s.tokenHash !== hash);
  save();
}

export function destroyUserSessions(userId, keepToken) {
  const db = getDb();
  const keepHash = keepToken ? sha256(keepToken) : null;
  db.sessions = db.sessions.filter(
    (s) => s.userId !== userId || (keepHash && s.tokenHash === keepHash),
  );
  save();
}

export function getUserByToken(token) {
  if (!token) return null;
  const db = getDb();
  const hash = sha256(token);
  const session = db.sessions.find((s) => s.tokenHash === hash);
  if (!session) return null;
  if (new Date(session.expiresAt) <= new Date()) {
    destroySession(token);
    return null;
  }
  return db.users.find((u) => u.id === session.userId) || null;
}

export function parseCookies(header = '') {
  const out = {};
  header.split(';').forEach((part) => {
    const index = part.indexOf('=');
    if (index === -1) return;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  });
  return out;
}
