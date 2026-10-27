import http from 'node:http';
import path from 'node:path';
import { createReadStream } from 'node:fs';
import { readFile, stat, unlink, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
  DATA_DIR,
  UPLOAD_DIR,
  findById,
  flush,
  getDb,
  loadDatabase,
  logEvent,
  nowIso,
  recordActivity,
  recordUsage,
  save,
  uid,
} from './lib/store.js';
import { createSession, destroySession, destroyUserSessions, getUserByToken, parseCookies } from './lib/auth.js';
import { hashPassword, verifyPassword } from './lib/password.js';
import { buildMetrics } from './lib/metrics.js';
import { dispatchMission, sendChat, testConnection, estimateTokens } from './lib/hermes.js';
import * as V from './lib/validate.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, 'public');
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const COOKIE_NAME = 'nmc_session';
const MAX_BODY = 12 * 1024 * 1024;
const MAX_FILE = 8 * 1024 * 1024;

loadDatabase();

/* --------------------------------------------------------------- utilities */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.pdf': 'application/pdf',
};

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "font-src 'self' data:",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

function baseHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader('Content-Security-Policy', CSP);
}

function sendJson(res, status, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  baseHeaders(res);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...extraHeaders,
  });
  res.end(body);
}

class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new HttpError(413, 'Data terlalu besar. Maksimal 8 MB per berkas.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new HttpError(400, 'Format data tidak valid (JSON diharapkan).'));
      }
    });
    req.on('error', reject);
  });
}

function isSecure(req) {
  if (req.socket.encrypted) return true;
  const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  return proto === 'https';
}

function sessionCookie(req, token, maxAge) {
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ];
  if (isSecure(req)) parts.push('Secure');
  return parts.join('; ');
}

function currentUser(req) {
  const cookies = parseCookies(req.headers.cookie || '');
  return getUserByToken(cookies[COOKIE_NAME]);
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function requireAuth(ctx) {
  if (!ctx.user) throw new HttpError(401, 'Sesi berakhir. Silakan masuk kembali.');
  return ctx.user;
}

function requireOwner(ctx) {
  const user = requireAuth(ctx);
  if (user.role !== 'owner') {
    throw new HttpError(403, 'Hanya pemilik workspace yang dapat melakukan aksi ini.');
  }
  return user;
}

function assertValid(result) {
  if (Object.keys(result.errors).length) {
    throw new HttpError(422, 'Periksa kembali isian yang ditandai.', { fields: result.errors });
  }
  return result.value;
}

/* ------------------------------------------------------------------- views */

function maskKey(key) {
  if (!key) return '';
  return `••••${String(key).slice(-4)}`;
}

function publicState(user) {
  const db = getDb();
  const metrics = buildMetrics(db);
  return {
    serverTime: nowIso(),
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    meta: { usingDefaultPassword: db.meta.usingDefaultPassword, version: db.meta.version },
    settings: {
      ...db.settings,
      hermes: { ...db.settings.hermes, apiKey: maskKey(db.settings.hermes.apiKey) },
    },
    agents: db.agents.map(agentView),
    skills: db.skills,
    brands: db.brands,
    missions: db.missions,
    tasks: db.tasks,
    docs: db.docs,
    files: db.files.map(({ storedName, ...rest }) => ({ ...rest, stored: Boolean(storedName) })),
    chats: db.chats,
    metrics,
    activity: db.activity.slice(-60),
    events: db.events.slice(-30),
    roadmap: [
      {
        key: 'automation',
        title: 'Automation',
        status: 'planned',
        description: 'Schedule misi berulang dan trigger otomatis.',
        planned: ['Jadwal cron misi', 'Antrean job & next run', 'Riwayat eksekusi'],
      },
      {
        key: 'integration',
        title: 'Integration',
        status: 'partial',
        description: 'Konektor Hermes sudah aktif; konektor lain menyusul.',
        planned: ['Webhook keluar', 'Google Drive / Notion', 'POP/IMAP mailbox'],
      },
      {
        key: 'productivity',
        title: 'Productivity',
        status: 'planned',
        description: 'Timer fokus dan catatan tempel per misi.',
        planned: ['Pomodoro', 'Sticky notes', 'Ringkasan harian'],
      },
      {
        key: 'mail',
        title: 'Mail with Jev',
        status: 'planned',
        description: 'Integrasi POP mail untuk triase dan draf balasan.',
        planned: ['Sinkronisasi POP', 'Klasifikasi email', 'Draf balasan butuh approval'],
      },
    ],
  };
}

function agentView(agent) {
  return {
    ...agent,
    soulPreview: agent.soul.slice(0, 220),
  };
}

/* ------------------------------------------------------------------ routes */

const routes = [];
function route(method, pattern, handler) {
  const segments = pattern.split('/').filter(Boolean);
  routes.push({ method, segments, handler });
}

function matchRoute(method, pathname) {
  const parts = pathname.split('/').filter(Boolean);
  for (const entry of routes) {
    if (entry.method !== method) continue;
    if (entry.segments.length !== parts.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < entry.segments.length; i += 1) {
      const seg = entry.segments[i];
      if (seg.startsWith(':')) params[seg.slice(1)] = decodeURIComponent(parts[i]);
      else if (seg !== parts[i]) {
        ok = false;
        break;
      }
    }
    if (ok) return { handler: entry.handler, params };
  }
  return null;
}

/* -------------------------------------------------------------------- auth */

const loginAttempts = new Map();

route('POST', '/api/login', async (ctx) => {
  const ip = ctx.req.socket.remoteAddress || 'unknown';
  const attempt = loginAttempts.get(ip) || { count: 0, until: 0 };
  if (attempt.until > Date.now() && attempt.count >= 8) {
    throw new HttpError(429, 'Terlalu banyak percobaan masuk. Tunggu 5 menit lalu coba lagi.');
  }
  const { email, password } = assertValid(V.validateLogin(ctx.body));
  const db = getDb();
  const user = db.users.find((u) => u.email.toLowerCase() === email);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    loginAttempts.set(ip, {
      count: attempt.until > Date.now() ? attempt.count + 1 : 1,
      until: Date.now() + 5 * 60 * 1000,
    });
    throw new HttpError(401, 'Email atau password salah. Periksa kembali lalu coba lagi.');
  }
  loginAttempts.delete(ip);
  const { token } = createSession(user.id);
  return {
    json: true,
    status: 200,
    headers: { 'set-cookie': sessionCookie(ctx.req, token, 7 * 86400) },
    body: { ok: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } },
  };
});

route('POST', '/api/logout', async (ctx) => {
  const cookies = parseCookies(ctx.req.headers.cookie || '');
  destroySession(cookies[COOKIE_NAME]);
  return {
    json: true,
    headers: { 'set-cookie': sessionCookie(ctx.req, '', 0) },
    body: { ok: true },
  };
});

route('GET', '/api/auth-info', async (ctx) => {
  const db = getDb();
  const user = currentUser(ctx.req);
  return {
    body: {
      requiresLogin: true,
      authenticated: Boolean(user),
      usingDefaultPassword: db.meta.usingDefaultPassword,
      demoEmail: db.users[0]?.email || '',
    },
  };
});

route('GET', '/api/state', async (ctx) => {
  const user = requireAuth(ctx);
  return { body: publicState(user) };
});

/* ------------------------------------------------------------------ profile */

route('PATCH', '/api/profile', async (ctx) => {
  const user = requireAuth(ctx);
  const db = getDb();
  const { name, email } = assertValid(V.validateProfile(ctx.body));
  if (db.users.some((u) => u.id !== user.id && u.email.toLowerCase() === email)) {
    throw new HttpError(422, 'Email sudah dipakai akun lain.', { fields: { email: 'Email ini sudah terdaftar.' } });
  }
  user.name = name;
  user.email = email;
  save();
  return { body: { ok: true, user: { id: user.id, name, email, role: user.role } } };
});

route('POST', '/api/profile/password', async (ctx) => {
  const user = requireAuth(ctx);
  const db = getDb();
  const { current, next } = assertValid(V.validatePassword(ctx.body));
  if (!verifyPassword(current, user.passwordHash)) {
    throw new HttpError(422, 'Password saat ini tidak cocok.', {
      fields: { currentPassword: 'Password saat ini tidak cocok.' },
    });
  }
  user.passwordHash = hashPassword(next);
  db.meta.usingDefaultPassword = false;
  const cookies = parseCookies(ctx.req.headers.cookie || '');
  destroyUserSessions(user.id, cookies[COOKIE_NAME]);
  save();
  return { body: { ok: true } };
});

/* ----------------------------------------------------------------- settings */

route('PATCH', '/api/settings', async (ctx) => {
  requireOwner(ctx);
  const db = getDb();
  const body = ctx.body || {};
  const value = assertValid(V.validateSettings(body));
  if (value.workspaceName) db.settings.workspaceName = value.workspaceName;
  if (value.hermes) {
    db.settings.hermes = { ...db.settings.hermes, ...value.hermes };
  }
  save();
  logEvent('settings', 'Pengaturan workspace diperbarui.');
  save();
  return { body: { ok: true } };
});

route('POST', '/api/hermes/test', async (ctx) => {
  requireOwner(ctx);
  const db = getDb();
  const result = await testConnection(db.settings);
  logEvent('integration', `Tes koneksi Hermes: ${result.ok ? 'berhasil' : 'gagal'}.`);
  save();
  return { body: result };
});

/* ------------------------------------------------------------------- agents */

route('POST', '/api/agents/preview', async (ctx) => {
  requireAuth(ctx);
  const { name, role, direction, model } = ctx.body || {};
  if (!name || !role || !String(direction || '').trim()) {
    throw new HttpError(422, 'Isi nama, role, dan direction sebelum melihat identitas.', {
      fields: { direction: 'Isi direction minimal 10 karakter untuk menyusun Soul.md.' },
    });
  }
  const soul = [
    `# Soul.md — ${name}`,
    '',
    `Kamu adalah ${name}, ${role} di workspace Neuromancer.`,
    '',
    '## Arah kerja',
    String(direction).trim(),
    '',
    '## Gaya kerja',
    '- Mulai dari tujuan misi, bukan dari alat.',
    '- Sebutkan asumsi dan data yang belum tersedia.',
    '- Akhiri setiap hasil dengan langkah verifikasi.',
    '',
    `## Model`,
    model || 'hermes/default',
  ].join('\n');
  return { body: { soul, summary: `${name} — ${role}`, model: model || 'hermes/default' } };
});

route('POST', '/api/agents', async (ctx) => {
  requireAuth(ctx);
  const db = getDb();
  const value = assertValid(V.validateAgent(ctx.body));
  if (db.agents.some((a) => a.name.toLowerCase() === value.name.toLowerCase())) {
    throw new HttpError(422, 'Nama agent sudah dipakai.', {
      fields: { name: 'Gunakan nama lain, mis. tambahkan huruf akhir.' },
    });
  }
  const colors = ['#1F5FE0', '#5B9BF8', '#8A6CF6', '#E4739B', '#2E9E8F', '#E39A3B'];
  const agent = {
    id: uid('agt_'),
    ...value,
    color: colors[db.agents.length % colors.length],
    soul: String(ctx.body.soul || '').trim() || `# Soul.md — ${value.name}\n\nKamu adalah ${value.name}, ${value.role}.\n\n## Arah kerja\n${value.direction}`,
    identityApproved: Boolean(ctx.body.identityApproved),
    photoFileId: null,
    memory: [],
    configYaml: [
      `agent: ${value.name.toLowerCase().replace(/\s+/g, '-')}`,
      `role: ${value.role}`,
      `model: ${value.model}`,
      'temperature: 0.4',
      'max_steps: 12',
      'tools:',
      '  - search',
      '  - files',
      '  - docs',
    ].join('\n'),
    lastTask: 'Belum ada task',
    totalAssigned: 0,
    successRate: 0,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  db.agents.push(agent);
  save();
  logEvent('agent', `Agent ${agent.name} (${agent.role}) ditambahkan.`);
  save();
  return { status: 201, body: { ok: true, agent: agentView(agent) } };
});

route('PATCH', '/api/agents/:id', async (ctx) => {
  requireAuth(ctx);
  const db = getDb();
  const agent = findById('agents', ctx.params.id);
  if (!agent) throw new HttpError(404, 'Agent tidak ditemukan.');
  const body = ctx.body || {};
  const partialFields = {};
  if (body.identity !== undefined) partialFields.identity = body.identity;
  if (body.name !== undefined || body.role !== undefined || body.direction !== undefined) {
    const candidate = {
      name: body.name ?? agent.name,
      role: body.role ?? agent.role,
      direction: body.direction ?? agent.direction,
      model: body.model ?? agent.model,
      status: body.status ?? agent.status,
      skills: body.skills ?? agent.skills,
    };
    Object.assign(agent, assertValid(V.validateAgent(candidate)));
  }
  if (body.model !== undefined) agent.model = String(body.model).slice(0, 80);
  if (body.soul !== undefined) {
    agent.soul = String(body.soul).slice(0, 6000);
    agent.identityApproved = true;
  }
  if (body.memory !== undefined) {
    if (!Array.isArray(body.memory)) throw new HttpError(422, 'Memory harus berupa daftar.');
    agent.memory = body.memory.slice(0, 200).map((m) => ({
      id: m.id || uid('mem_'),
      at: m.at || nowIso(),
      text: String(m.text || '').slice(0, 1000),
      source: m.source || 'manual',
    }));
  }
  if (body.configYaml !== undefined) agent.configYaml = String(body.configYaml).slice(0, 8000);
  if (body.photoFileId !== undefined) {
    const file = body.photoFileId ? findById('files', String(body.photoFileId)) : null;
    if (body.photoFileId && !file) {
      throw new HttpError(422, 'Foto tidak ditemukan. Unggah ulang.', { fields: { photo: 'Berkas foto tidak ditemukan.' } });
    }
    if (file && !file.mime.startsWith('image/')) {
      throw new HttpError(422, 'Foto profil harus berupa gambar.', { fields: { photo: 'Format foto harus PNG/JPG/WebP.' } });
    }
    agent.photoFileId = file ? file.id : null;
  }
  if (body.status !== undefined) {
    if (!V.AGENT_STATUS.includes(body.status)) throw new HttpError(422, 'Status agent tidak dikenal.');
    agent.status = body.status;
  }
  agent.updatedAt = nowIso();
  save();
  return { body: { ok: true, agent: agentView(agent) } };
});

route('DELETE', '/api/agents/:id', async (ctx) => {
  requireAuth(ctx);
  const db = getDb();
  const agent = findById('agents', ctx.params.id);
  if (!agent) throw new HttpError(404, 'Agent tidak ditemukan.');
  const usedTasks = db.tasks.filter((t) => t.assigneeAgentId === agent.id && t.status !== 'done');
  const usedMissions = db.missions.filter(
    (m) => m.agentId === agent.id && !['completed', 'cancelled'].includes(m.status),
  );
  if (usedTasks.length || usedMissions.length) {
    throw new HttpError(
      409,
      `${agent.name} masih memegang ${usedTasks.length} task dan ${usedMissions.length} misi aktif. Nonaktifkan agent alih-alih menghapus.`,
    );
  }
  db.agents = db.agents.filter((a) => a.id !== agent.id);
  save();
  return { body: { ok: true } };
});

route('POST', '/api/agents/:id/memory', async (ctx) => {
  requireAuth(ctx);
  const agent = findById('agents', ctx.params.id);
  if (!agent) throw new HttpError(404, 'Agent tidak ditemukan.');
  const text = String(ctx.body?.text || '').trim();
  if (text.length < 3) {
    throw new HttpError(422, 'Catatan memory minimal 3 karakter.', { fields: { text: 'Tulis catatan minimal 3 karakter.' } });
  }
  agent.memory.push({ id: uid('mem_'), at: nowIso(), text: text.slice(0, 1000), source: 'manual' });
  agent.updatedAt = nowIso();
  save();
  return { body: { ok: true, memory: agent.memory } };
});

route('DELETE', '/api/agents/:id/memory/:memId', async (ctx) => {
  requireAuth(ctx);
  const agent = findById('agents', ctx.params.id);
  if (!agent) throw new HttpError(404, 'Agent tidak ditemukan.');
  agent.memory = agent.memory.filter((m) => m.id !== ctx.params.memId);
  save();
  return { body: { ok: true, memory: agent.memory } };
});

/* ------------------------------------------------------------------- skills */

route('POST', '/api/skills', async (ctx) => {
  requireAuth(ctx);
  const db = getDb();
  const value = assertValid(V.validateSkill(ctx.body));
  if (db.skills.some((s) => s.name === value.name)) {
    throw new HttpError(422, 'Skill dengan nama itu sudah ada.', { fields: { name: 'Pilih nama lain.' } });
  }
  const skill = { id: uid('skl_'), ...value, builtin: false, createdAt: nowIso() };
  db.skills.push(skill);
  save();
  return { status: 201, body: { ok: true, skill } };
});

route('DELETE', '/api/skills/:id', async (ctx) => {
  requireAuth(ctx);
  const db = getDb();
  const skill = db.skills.find((s) => s.id === ctx.params.id);
  if (!skill) throw new HttpError(404, 'Skill tidak ditemukan.');
  if (skill.builtin) throw new HttpError(409, 'Skill bawaan tidak bisa dihapus.');
  db.skills = db.skills.filter((s) => s.id !== skill.id);
  db.agents.forEach((agent) => {
    agent.skills = agent.skills.filter((name) => name !== skill.name);
  });
  save();
  return { body: { ok: true } };
});

/* ------------------------------------------------------------------- brands */

route('POST', '/api/brands', async (ctx) => {
  requireAuth(ctx);
  const db = getDb();
  const value = assertValid(V.validateBrand(ctx.body));
  const brand = {
    id: uid('brd_'),
    name: value.name,
    references: [],
    dna: {
      brandName: value.name,
      archetype: '',
      description: '',
      typography: '',
      palette: [],
      voiceTone: '',
      keyMessage: '',
      statement: '',
      niche: '',
      specificNiche: '',
      superSpecificNiche: '',
      positioning: '',
    },
    personas: [],
    products: [],
    researchStatus: 'empty',
    researchNote: '',
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  db.brands.push(brand);
  save();
  return { status: 201, body: { ok: true, brand } };
});

route('PATCH', '/api/brands/:id', async (ctx) => {
  requireAuth(ctx);
  const brand = findById('brands', ctx.params.id);
  if (!brand) throw new HttpError(404, 'Brand tidak ditemukan.');
  if (ctx.body?.name !== undefined) {
    brand.name = assertValid(V.validateBrand(ctx.body)).name;
  }
  brand.updatedAt = nowIso();
  save();
  return { body: { ok: true, brand } };
});

route('DELETE', '/api/brands/:id', async (ctx) => {
  requireOwner(ctx);
  const db = getDb();
  if (!findById('brands', ctx.params.id)) throw new HttpError(404, 'Brand tidak ditemukan.');
  db.brands = db.brands.filter((b) => b.id !== ctx.params.id);
  save();
  return { body: { ok: true } };
});

route('POST', '/api/brands/:id/dna', async (ctx) => {
  requireAuth(ctx);
  const brand = findById('brands', ctx.params.id);
  if (!brand) throw new HttpError(404, 'Brand tidak ditemukan.');
  const value = assertValid(V.validateBrandDna(ctx.body));
  const previousIds = new Map(brand.personas.map((p) => [p.name, p.id]));
  brand.dna = {
    ...brand.dna,
    ...Object.fromEntries(Object.entries(value).filter(([k]) => k !== 'personas')),
  };
  brand.personas = value.personas.map((persona) => ({
    ...persona,
    id: persona.id || previousIds.get(persona.name) || uid('per_'),
  }));
  brand.researchStatus = 'ready';
  brand.updatedAt = nowIso();
  save();
  return { body: { ok: true, brand } };
});

route('POST', '/api/brands/:id/references', async (ctx) => {
  requireAuth(ctx);
  const db = getDb();
  const brand = findById('brands', ctx.params.id);
  if (!brand) throw new HttpError(404, 'Brand tidak ditemukan.');
  const value = assertValid(V.validateReference(ctx.body));
  if (value.type === 'file' && !findById('files', value.fileId)) {
    throw new HttpError(422, 'Berkas tidak ditemukan. Unggah ulang.', {
      fields: { fileId: 'Berkas tidak ditemukan.' },
    });
  }
  if (value.type === 'link') {
    const dup = brand.references.some((r) => r.type === 'link' && r.url === value.url);
    if (dup) throw new HttpError(422, 'Tautan itu sudah ada di daftar referensi.', { fields: { url: 'Tautan duplikat.' } });
  }
  const reference = {
    id: uid('ref_'),
    ...value,
    addedAt: nowIso(),
  };
  if (reference.type === 'file') reference.label = reference.label;
  brand.references.push(reference);
  if (brand.researchStatus === 'empty') brand.researchStatus = 'references';
  brand.updatedAt = nowIso();
  save();
  if (value.type === 'file') {
    const file = findById('files', value.fileId);
    if (file) file.kind = 'reference';
    save();
  }
  return { status: 201, body: { ok: true, reference, brand } };
});

route('DELETE', '/api/brands/:id/references/:refId', async (ctx) => {
  requireAuth(ctx);
  const brand = findById('brands', ctx.params.id);
  if (!brand) throw new HttpError(404, 'Brand tidak ditemukan.');
  brand.references = brand.references.filter((r) => r.id !== ctx.params.refId);
  brand.updatedAt = nowIso();
  save();
  return { body: { ok: true, brand } };
});

route('POST', '/api/brands/:id/products', async (ctx) => {
  requireAuth(ctx);
  const brand = findById('brands', ctx.params.id);
  if (!brand) throw new HttpError(404, 'Brand tidak ditemukan.');
  const value = assertValid(V.validateProduct(ctx.body));
  const product = { id: uid('prd_'), ...value };
  brand.products.push(product);
  brand.updatedAt = nowIso();
  save();
  return { status: 201, body: { ok: true, product, brand } };
});

route('PATCH', '/api/brands/:id/products/:productId', async (ctx) => {
  requireAuth(ctx);
  const brand = findById('brands', ctx.params.id);
  if (!brand) throw new HttpError(404, 'Brand tidak ditemukan.');
  const product = brand.products.find((p) => p.id === ctx.params.productId);
  if (!product) throw new HttpError(404, 'Produk tidak ditemukan.');
  Object.assign(product, assertValid(V.validateProduct({ ...product, ...ctx.body })));
  brand.updatedAt = nowIso();
  save();
  return { body: { ok: true, product, brand } };
});

route('DELETE', '/api/brands/:id/products/:productId', async (ctx) => {
  requireAuth(ctx);
  const brand = findById('brands', ctx.params.id);
  if (!brand) throw new HttpError(404, 'Brand tidak ditemukan.');
  brand.products = brand.products.filter((p) => p.id !== ctx.params.productId);
  save();
  return { body: { ok: true, brand } };
});

route('POST', '/api/brands/:id/research', async (ctx) => {
  requireAuth(ctx);
  const db = getDb();
  const brand = findById('brands', ctx.params.id);
  if (!brand) throw new HttpError(404, 'Brand tidak ditemukan.');
  if (!brand.references.length) {
    throw new HttpError(400, 'Tambahkan minimal satu tautan atau berkas referensi sebelum menjalankan riset.', {
      fields: { references: 'Belum ada referensi brand.' },
    });
  }
  const agent = findById('agents', ctx.body?.agentId) || db.agents[0];
  const links = brand.references.filter((r) => r.type === 'link');
  const files = brand.references.filter((r) => r.type === 'file');
  const proposal = {
    brandName: brand.name,
    archetype: 'The Creator',
    description: `Draf awal untuk ${brand.name}, disusun dari ${links.length} tautan dan ${files.length} berkas referensi. Perlu validasi manusia sebelum dipakai.`,
    typography: 'Usulan: satu display serif + satu sans-serif netral.',
    palette: [
      { name: 'Primary', hex: '#1F5FE0' },
      { name: 'Surface', hex: '#F7F4EE' },
      { name: 'Ink', hex: '#22262E' },
    ],
    voiceTone: 'Jelas, hangat, tanpa klaim berlebihan.',
    keyMessage: `${brand.name}: janji yang bisa dibuktikan.`,
    statement: `Kami membuat ${brand.name} mudah dipahami dan mudah dipercaya.`,
    niche: 'Belum ditentukan',
    specificNiche: 'Belum ditentukan',
    superSpecificNiche: 'Belum ditentukan',
    positioning: 'Perlu riset kompetitor untuk memastikan pembeda.',
    personas: [],
    note: db.settings.hermes.enabled
      ? 'Draf rule-based lokal. Untuk riset penuh, dispatch misi riset ke Hermes.'
      : 'Draf rule-based lokal (Hermes belum aktif). Semua field perlu direview manusia.',
    agentId: agent?.id || null,
    generatedAt: nowIso(),
    referenceCount: brand.references.length,
  };
  brand.researchStatus = 'proposal';
  brand.researchNote = `${proposal.note} • ${links.length} tautan, ${files.length} berkas.`;
  brand.researchProposal = proposal;
  brand.updatedAt = nowIso();
  if (agent) {
    recordActivity(agent.id, 'research', `Riset brand ${brand.name}`);
    recordUsage(agent.id, 1800 + brand.references.length * 400);
  }
  save();
  return { body: { ok: true, proposal, brand } };
});

/* ----------------------------------------------------------------- missions */

function addTimeline(mission, label, by) {
  mission.timeline = mission.timeline || [];
  mission.timeline.push({ at: nowIso(), label, by });
  mission.updatedAt = nowIso();
}

function linkedTask(db, missionId) {
  return db.tasks.find((t) => t.missionId === missionId);
}

route('POST', '/api/missions', async (ctx) => {
  const user = requireAuth(ctx);
  const db = getDb();
  const value = assertValid(V.validateMission(ctx.body));
  const agent = findById('agents', value.agentId);
  if (!agent) {
    throw new HttpError(422, 'Agent yang dipilih tidak ditemukan.', {
      fields: { agentId: 'Pilih agent dari daftar.' },
    });
  }
  if (agent.status !== 'active') {
    throw new HttpError(422, `${agent.name} sedang nonaktif. Aktifkan dulu atau pilih agent lain.`, {
      fields: { agentId: `${agent.name} nonaktif.` },
    });
  }
  const mission = {
    id: uid('msn_'),
    ...value,
    status: 'draft',
    tokens: 0,
    resultDocId: null,
    launch: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    timeline: [{ at: nowIso(), label: 'Misi dibuat (draf)', by: user.name }],
  };
  db.missions.push(mission);
  if (ctx.body.createTask !== false) {
    db.tasks.push({
      id: uid('tsk_'),
      title: mission.name,
      description: mission.goals,
      priority: mission.priority,
      status: 'todo',
      missionId: mission.id,
      assigneeAgentId: mission.agentId,
      source: 'mission',
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
  }
  save();
  logEvent('mission', `Misi "${mission.name}" dibuat untuk ${agent.name}.`);
  save();
  return { status: 201, body: { ok: true, mission } };
});

route('PATCH', '/api/missions/:id', async (ctx) => {
  requireAuth(ctx);
  const db = getDb();
  const mission = findById('missions', ctx.params.id);
  if (!mission) throw new HttpError(404, 'Misi tidak ditemukan.');
  if (!['draft', 'replan', 'rejected'].includes(mission.status)) {
    throw new HttpError(409, 'Misi yang sudah diajukan tidak bisa diedit. Gunakan Replan untuk mengubah isi.');
  }
  const merged = { ...mission, ...ctx.body };
  const value = assertValid(V.validateMission(merged));
  const agent = findById('agents', value.agentId);
  if (!agent) {
    throw new HttpError(422, 'Agent tidak ditemukan.', { fields: { agentId: 'Pilih agent lain.' } });
  }
  Object.assign(mission, value);
  addTimeline(mission, 'Isi misi diperbarui', ctx.user.name);
  const task = linkedTask(db, mission.id);
  if (task) {
    task.title = mission.name;
    task.description = mission.goals;
    task.priority = mission.priority;
    task.assigneeAgentId = mission.agentId;
    task.updatedAt = nowIso();
  }
  save();
  return { body: { ok: true, mission } };
});

route('POST', '/api/missions/:id/action', async (ctx) => {
  const user = requireAuth(ctx);
  const db = getDb();
  const mission = findById('missions', ctx.params.id);
  if (!mission) throw new HttpError(404, 'Misi tidak ditemukan.');
  const action = String(ctx.body?.action || '');
  const note = String(ctx.body?.note || '').trim().slice(0, 600);
  const task = linkedTask(db, mission.id);
  const agent = findById('agents', mission.agentId);

  const transitions = {
    submit: ['draft', 'replan', 'rejected'],
    approve: ['pending_review'],
    reject: ['pending_review'],
    launch: ['approved'],
    complete: ['running', 'approved'],
    replan: ['pending_review', 'approved', 'running', 'rejected', 'replan', 'completed'],
    cancel: ['draft', 'pending_review', 'approved', 'running', 'replan', 'rejected'],
  };

  if (!transitions[action]) throw new HttpError(400, 'Aksi misi tidak dikenal.');
  if (!transitions[action].includes(mission.status)) {
    throw new HttpError(409, `Aksi "${action}" tidak bisa dilakukan saat status "${mission.status}".`);
  }
  if (['approve', 'reject', 'complete'].includes(action)) requireOwner(ctx);

  switch (action) {
    case 'submit': {
      mission.status = 'pending_review';
      addTimeline(mission, 'Diajukan untuk review', user.name);
      if (task) {
        task.status = 'review';
        task.updatedAt = nowIso();
      }
      logEvent('approval', `Misi "${mission.name}" menunggu persetujuan.`);
      break;
    }
    case 'approve': {
      mission.status = 'approved';
      addTimeline(mission, 'Disetujui, menunggu peluncuran', user.name);
      if (task) {
        task.status = 'todo';
        task.updatedAt = nowIso();
      }
      logEvent('approval', `Misi "${mission.name}" disetujui.`);
      break;
    }
    case 'reject': {
      mission.status = 'rejected';
      addTimeline(mission, note ? `Ditolak: ${note}` : 'Ditolak, perlu replan', user.name);
      if (task) {
        task.status = 'todo';
        task.updatedAt = nowIso();
      }
      logEvent('approval', `Misi "${mission.name}" ditolak.`);
      break;
    }
    case 'launch': {
      if (!agent) throw new HttpError(409, 'Agent misi ini sudah dihapus.');
      const dispatch = await dispatchMission(db.settings, mission, agent);
      mission.status = 'running';
      mission.launch = { mode: dispatch.mode, at: nowIso(), note: dispatch.note || null };
      if (dispatch.result) mission.resultText = String(dispatch.result).slice(0, 40000);
      addTimeline(mission, `Diluncurkan (${dispatch.mode === 'hermes' ? 'Hermes' : 'simulator lokal'})`, user.name);
      if (task) {
        task.status = 'in_progress';
        task.updatedAt = nowIso();
      }
      recordActivity(agent.id, 'mission', `Menjalankan misi ${mission.name}`);
      const tokens = dispatch.tokens || Math.min(24000, 900 + mission.maxSteps * 420);
      recordUsage(agent.id, tokens);
      mission.tokens = (mission.tokens || 0) + tokens;
      agent.totalAssigned = (agent.totalAssigned || 0) + 1;
      agent.lastTask = mission.name;
      agent.updatedAt = nowIso();
      logEvent('mission', `Misi "${mission.name}" diluncurkan (${dispatch.mode}).`);
      break;
    }
    case 'complete': {
      mission.status = 'completed';
      const content =
        mission.launch?.mode === 'hermes' && mission.resultText
          ? mission.resultText
          : [
              `# Hasil misi — ${mission.name}`,
              '',
              `Agent: ${agent?.name || 'Agent'} (${agent?.role || '-'})`,
              `Selesai: ${new Date().toLocaleString('id-ID')}`,
              '',
              '## Goals',
              mission.goals,
              '',
              '## Langkah yang dijalankan',
              `1. Membaca brief dan Notes Review QC.`,
              `2. Memecah goals menjadi maksimal ${mission.maxSteps} langkah.`,
              `3. Menjalankan langkah dalam batas ${mission.timeLimitMinutes} menit.`,
              '4. Menyusun ringkasan dan menandai bagian yang perlu validasi manusia.',
              '',
              '## Catatan QC',
              mission.notesQc || 'Tidak ada catatan khusus.',
              '',
              '## Perlu tindak lanjut manusia',
              '- Validasi angka dan sumber sebelum dipublikasikan.',
              '- Cek konsistensi voice tone dengan Brand DNA.',
              '',
              mission.launch?.mode === 'hermes'
                ? '> Dijalankan melalui Hermes.'
                : '> Dijalankan pada simulator lokal karena Hermes belum terhubung. Hasil ini contoh alur, bukan keluaran model produksi.',
            ].join('\n');
      const doc = {
        id: uid('doc_'),
        missionId: mission.id,
        title: `Hasil: ${mission.name}`,
        type: 'agent',
        agentId: mission.agentId,
        content,
        createdAt: nowIso(),
      };
      db.docs.push(doc);
      mission.resultDocId = doc.id;
      addTimeline(mission, 'Hasil masuk ke Docs', agent?.name || 'Sistem');
      if (task) {
        task.status = 'done';
        task.updatedAt = nowIso();
      }
      if (agent) recordActivity(agent.id, 'doc', `Menghasilkan dokumen ${doc.title}`);
      logEvent('mission', `Misi "${mission.name}" selesai dan hasilnya tersimpan di Docs.`);
      break;
    }
    case 'replan': {
      mission.status = 'draft';
      mission.replanNote = note || mission.replanNote || '';
      addTimeline(mission, note ? `Replan: ${note}` : 'Dikembalikan ke draf untuk replan', user.name);
      if (task) {
        task.status = 'todo';
        task.updatedAt = nowIso();
      }
      logEvent('mission', `Misi "${mission.name}" dikembalikan ke draf.`);
      break;
    }
    case 'cancel': {
      mission.status = 'cancelled';
      addTimeline(mission, note ? `Dibatalkan: ${note}` : 'Dibatalkan', user.name);
      if (task) {
        task.status = 'cancelled';
        task.updatedAt = nowIso();
      }
      logEvent('mission', `Misi "${mission.name}" dibatalkan.`);
      break;
    }
    default:
      break;
  }
  save();
  return { body: { ok: true, mission } };
});

/* -------------------------------------------------------------------- tasks */

route('POST', '/api/tasks', async (ctx) => {
  const user = requireAuth(ctx);
  const db = getDb();
  const value = assertValid(V.validateTask(ctx.body));
  if (value.assigneeAgentId && !findById('agents', value.assigneeAgentId)) {
    throw new HttpError(422, 'Agent tidak ditemukan.', { fields: { assigneeAgentId: 'Pilih agent lain.' } });
  }
  const task = {
    id: uid('tsk_'),
    title: value.title,
    description: value.description || '',
    priority: value.priority,
    status: V.TASK_STATUS.includes(ctx.body.status) ? ctx.body.status : 'todo',
    missionId: null,
    assigneeAgentId: value.assigneeAgentId || null,
    source: 'manual',
    createdAt: nowIso(),
    updatedAt: nowIso(),
    createdBy: user.name,
  };
  db.tasks.push(task);
  save();
  logEvent('task', `Task manual "${task.title}" ditambahkan.`);
  save();
  return { status: 201, body: { ok: true, task } };
});

route('PATCH', '/api/tasks/:id', async (ctx) => {
  requireAuth(ctx);
  const db = getDb();
  const task = findById('tasks', ctx.params.id);
  if (!task) throw new HttpError(404, 'Task tidak ditemukan.');
  const value = assertValid(V.validateTask({ ...task, ...ctx.body }, { partial: false }));
  if (value.assigneeAgentId && !findById('agents', value.assigneeAgentId)) {
    throw new HttpError(422, 'Agent tidak ditemukan.', { fields: { assigneeAgentId: 'Pilih agent lain.' } });
  }
  Object.assign(task, value);
  if (ctx.body.status) task.status = ctx.body.status;
  task.updatedAt = nowIso();
  save();
  if (task.missionId) {
    const mission = findById('missions', task.missionId);
    if (mission && task.status === 'done' && ['running', 'approved'].includes(mission.status)) {
      mission.status = 'completed';
      addTimeline(mission, 'Selesai lewat Task Board', ctx.user.name);
      save();
    }
  }
  return { body: { ok: true, task } };
});

route('DELETE', '/api/tasks/:id', async (ctx) => {
  requireAuth(ctx);
  const db = getDb();
  const task = findById('tasks', ctx.params.id);
  if (!task) throw new HttpError(404, 'Task tidak ditemukan.');
  db.tasks = db.tasks.filter((t) => t.id !== task.id);
  save();
  return { body: { ok: true } };
});

/* --------------------------------------------------------------------- docs */

route('POST', '/api/docs', async (ctx) => {
  requireAuth(ctx);
  const db = getDb();
  const value = assertValid(V.validateDoc(ctx.body));
  const type = ctx.body.type === 'upload' ? 'upload' : 'agent';
  if (type === 'upload' && !findById('files', ctx.body.fileId)) {
    throw new HttpError(422, 'Berkas tidak ditemukan. Unggah ulang.', {
      fields: { fileId: 'Berkas tidak ditemukan.' },
    });
  }
  if (value.missionId && !findById('missions', value.missionId)) {
    throw new HttpError(422, 'Misi tidak ditemukan.', { fields: { missionId: 'Pilih misi lain.' } });
  }
  const doc = {
    id: uid('doc_'),
    missionId: value.missionId || null,
    title: value.title,
    type,
    agentId: ctx.body.agentId || null,
    fileId: type === 'upload' ? ctx.body.fileId : null,
    content: value.content || '',
    createdAt: nowIso(),
    createdBy: ctx.user.name,
  };
  db.docs.push(doc);
  save();
  logEvent('doc', `Dokumen "${doc.title}" ditambahkan.`);
  save();
  return { status: 201, body: { ok: true, doc } };
});

route('PATCH', '/api/docs/:id', async (ctx) => {
  requireAuth(ctx);
  const doc = findById('docs', ctx.params.id);
  if (!doc) throw new HttpError(404, 'Dokumen tidak ditemukan.');
  const value = assertValid(V.validateDoc({ ...doc, ...ctx.body }, { partial: false }));
  Object.assign(doc, value);
  doc.updatedAt = nowIso();
  save();
  return { body: { ok: true, doc } };
});

route('DELETE', '/api/docs/:id', async (ctx) => {
  requireAuth(ctx);
  const db = getDb();
  const doc = findById('docs', ctx.params.id);
  if (!doc) throw new HttpError(404, 'Dokumen tidak ditemukan.');
  db.docs = db.docs.filter((d) => d.id !== doc.id);
  db.missions.forEach((m) => {
    if (m.resultDocId === doc.id) m.resultDocId = null;
  });
  save();
  return { body: { ok: true } };
});

/* -------------------------------------------------------------------- files */

route('POST', '/api/files', async (ctx) => {
  requireAuth(ctx);
  const db = getDb();
  const body = ctx.body || {};
  const name = String(body.name || '').trim();
  if (name.length < 1 || name.length > 160) {
    throw new HttpError(422, 'Nama berkas wajib diisi (maks. 160 karakter).', {
      fields: { name: 'Nama berkas tidak valid.' },
    });
  }
  const base64 = String(body.dataBase64 || '');
  if (!base64) {
    throw new HttpError(422, 'Isi berkas kosong. Pilih berkas lalu unggah ulang.', {
      fields: { file: 'Berkas kosong.' },
    });
  }
  let buffer;
  try {
    buffer = Buffer.from(base64, 'base64');
  } catch {
    throw new HttpError(422, 'Berkas tidak bisa dibaca.');
  }
  if (buffer.length > MAX_FILE) {
    throw new HttpError(413, 'Ukuran berkas melebihi 8 MB. Kompres atau pilih berkas lain.');
  }
  if (!buffer.length) throw new HttpError(422, 'Berkas kosong.');
  const id = uid('fil_');
  const safeName = `${id}-${name.replace(/[^\w.\-]+/g, '_')}`.slice(0, 180);
  await writeFile(path.join(UPLOAD_DIR, safeName), buffer);
  const file = {
    id,
    name,
    mime: String(body.mime || 'application/octet-stream').slice(0, 120),
    size: buffer.length,
    storedName: safeName,
    kind: ['reference', 'doc', 'avatar'].includes(body.kind) ? body.kind : 'upload',
    createdAt: nowIso(),
  };
  db.files.push(file);
  save();
  return {
    status: 201,
    body: {
      ok: true,
      file: { id: file.id, name: file.name, mime: file.mime, size: file.size, kind: file.kind },
    },
  };
});

async function serveFile(ctx, { inline = false } = {}) {
  requireAuth(ctx);
  const file = findById('files', ctx.params.id);
  if (!file) throw new HttpError(404, 'Berkas tidak ditemukan.');
  if (!file.storedName) {
    throw new HttpError(
      410,
      'Berkas ini hanya contoh pada data seed dan isinya tidak tersedia. Unggah ulang berkas asli untuk mengunduh.',
    );
  }
  const target = path.join(UPLOAD_DIR, file.storedName);
  await stat(target);
  baseHeaders(ctx.res);
  ctx.res.writeHead(200, {
    'content-type': file.mime,
    'content-length': String(file.size),
    'content-disposition': `${inline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(file.name)}"`,
    'cache-control': 'private, max-age=60',
  });
  createReadStream(target).pipe(ctx.res);
  return { raw: true };
}

route('GET', '/api/files/:id/download', (ctx) => serveFile(ctx, { inline: false }));
route('GET', '/api/files/:id/view', (ctx) => serveFile(ctx, { inline: true }));

route('DELETE', '/api/files/:id', async (ctx) => {
  requireAuth(ctx);
  const db = getDb();
  const file = findById('files', ctx.params.id);
  if (!file) throw new HttpError(404, 'Berkas tidak ditemukan.');
  if (file.storedName) {
    await unlink(path.join(UPLOAD_DIR, file.storedName)).catch(() => {});
  }
  db.files = db.files.filter((f) => f.id !== file.id);
  db.docs.forEach((d) => {
    if (d.fileId === file.id) d.fileMissing = true;
  });
  db.brands.forEach((b) => {
    b.references = b.references.filter((r) => r.fileId !== file.id);
  });
  save();
  return { body: { ok: true } };
});

/* -------------------------------------------------------------------- chats */

route('POST', '/api/chats', async (ctx) => {
  requireAuth(ctx);
  const db = getDb();
  const agent = findById('agents', ctx.body?.agentId);
  if (!agent) throw new HttpError(422, 'Pilih agent untuk memulai percakapan.', { fields: { agentId: 'Agent tidak ditemukan.' } });
  const chat = {
    id: uid('cht_'),
    agentId: agent.id,
    title: String(ctx.body?.title || `Sesi dengan ${agent.name}`).slice(0, 120),
    createdAt: nowIso(),
    updatedAt: nowIso(),
    messages: [],
  };
  db.chats.push(chat);
  save();
  return { status: 201, body: { ok: true, chat } };
});

route('DELETE', '/api/chats/:id', async (ctx) => {
  requireAuth(ctx);
  const db = getDb();
  const chat = findById('chats', ctx.params.id);
  if (!chat) throw new HttpError(404, 'Sesi chat tidak ditemukan.');
  db.chats = db.chats.filter((c) => c.id !== chat.id);
  save();
  return { body: { ok: true } };
});

route('POST', '/api/chats/:id/messages', async (ctx) => {
  requireAuth(ctx);
  const db = getDb();
  const chat = findById('chats', ctx.params.id);
  if (!chat) throw new HttpError(404, 'Sesi chat tidak ditemukan.');
  const agent = findById('agents', chat.agentId);
  if (!agent) throw new HttpError(409, 'Agent pada sesi ini sudah dihapus.');
  const { message } = assertValid(V.validateMessage(ctx.body));
  const userMessage = { id: uid('msg_'), role: 'user', text: message, at: nowIso() };
  chat.messages.push(userMessage);
  chat.updatedAt = nowIso();
  if (chat.messages.filter((m) => m.role === 'user').length === 1) {
    chat.title = message.slice(0, 60);
  }
  save();

  const result = await sendChat(db.settings, agent, chat.messages.map((m) => ({ ...m, chatId: chat.id })));
  if (result.text) {
    chat.messages.push({
      id: uid('msg_'),
      role: 'agent',
      text: result.text,
      at: nowIso(),
      mode: result.mode,
      note: result.note || null,
    });
  }
  const tokens = result.tokens || estimateTokens(chat.messages);
  recordUsage(agent.id, tokens);
  recordActivity(agent.id, 'chat', `Chat: ${chat.title}`);
  agent.lastTask = `Chat: ${chat.title}`;
  agent.updatedAt = nowIso();
  save();
  return {
    body: {
      ok: true,
      chat,
      mode: result.mode,
      note: result.note || null,
      error: result.mode === 'error' ? result.note : null,
    },
  };
});

/* -------------------------------------------------------------- attachments */

route('GET', '/api/health', async () => {
  const db = getDb();
  return {
    body: {
      ok: true,
      app: 'Neuromancer Mission Control',
      version: '1.0.0',
      dataDir: DATA_DIR,
      uptimeSeconds: Math.round(process.uptime()),
      counts: {
        agents: db.agents.length,
        missions: db.missions.length,
        tasks: db.tasks.length,
        docs: db.docs.length,
      },
    },
  };
});

/* -------------------------------------------------------------- static/HTML */

async function serveStatic(req, res, pathname) {
  const relative = pathname.replace(/^\/+/, '');
  const filePath = path.join(PUBLIC_DIR, relative || 'index.html');
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  try {
    const info = await stat(filePath);
    if (!info.isFile()) throw new Error('not a file');
    baseHeaders(res);
    res.writeHead(200, {
      'content-type': MIME[path.extname(filePath)] || 'application/octet-stream',
      'cache-control': 'no-cache',
    });
    createReadStream(filePath).pipe(res);
  } catch {
    try {
      const html = await readFile(path.join(PUBLIC_DIR, 'index.html'));
      baseHeaders(res);
      res.writeHead(200, { 'content-type': MIME['.html'], 'cache-control': 'no-cache' });
      res.end(html);
    } catch {
      res.writeHead(404).end('Not found');
    }
  }
}

/* ------------------------------------------------------------------ server */

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  if (!pathname.startsWith('/api/')) {
    return serveStatic(req, res, pathname);
  }

  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      if (!sameOrigin(req)) {
        throw new HttpError(403, 'Permintaan ditolak: origin tidak sama dengan host aplikasi.');
      }
      const contentType = String(req.headers['content-type'] || '');
      const sendsBody = ['POST', 'PUT', 'PATCH'].includes(req.method);
      if (sendsBody && !contentType.includes('application/json')) {
        throw new HttpError(415, 'Kirim data dengan Content-Type: application/json.');
      }
    }

    const match = matchRoute(req.method, pathname);
    if (!match) throw new HttpError(404, 'Endpoint tidak ditemukan.');

    const ctx = {
      req,
      res,
      url,
      params: match.params,
      query: Object.fromEntries(url.searchParams),
      user: currentUser(req),
      body: req.method === 'GET' || req.method === 'HEAD' ? {} : await readBody(req),
    };

    const result = (await match.handler(ctx)) || {};
    if (result.raw) return;
    if (result.json) {
      return sendJson(res, result.status || 200, result.body || { ok: true }, result.headers || {});
    }
    return sendJson(res, result.status || 200, result.body || { ok: true }, result.headers || {});
  } catch (error) {
    if (error.code === 'ENOENT') {
      return sendJson(res, 404, { error: 'Berkas tidak ditemukan di disk. Unggah ulang.' });
    }
    const status = error instanceof HttpError ? error.status : 500;
    if (status >= 500) console.error('[server]', error);
    return sendJson(res, status, {
      error: status >= 500 ? 'Terjadi kesalahan pada server. Coba lagi; bila tetap gagal, periksa log server.' : error.message,
      ...(error.extra || {}),
    });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Neuromancer Mission Control berjalan di http://${HOST}:${PORT}`);
  console.log(`Data: ${DATA_DIR}`);
});

function shutdown() {
  flush();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
