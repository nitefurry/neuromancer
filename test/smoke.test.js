/**
 * Smoke test alur utama (API-level) — menjalankan server sendiri dengan
 * DATA_DIR sementara di port 3100, lalu memeriksa autentikasi, misi/approval,
 * task, brand, chat, upload, dan validasi.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';
import path from 'node:path';

const PORT = 3100;
const BASE = `http://127.0.0.1:${PORT}`;
const DATA_DIR = path.join(process.cwd(), '.run', 'test-data');
const EMAIL = 'owner@neuromancer.app';
const PASSWORD = 'missioncontrol';

let cookie = '';
let passed = 0;
const failures = [];

async function call(pathname, { method = 'GET', body, headers = {}, withCookie = true } = {}) {
  const response = await fetch(`${BASE}${pathname}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(withCookie && cookie ? { cookie } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { raw: text };
  }
  return { status: response.status, body: payload, headers: response.headers };
}

function check(name, fn) {
  return (async () => {
    try {
      await fn();
      passed += 1;
      console.log(`  ok  ${name}`);
    } catch (error) {
      failures.push({ name, error });
      console.error(`  FAIL ${name}\n       ${error.message}`);
    }
  })();
}

async function waitForServer() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) return true;
    } catch {
      /* belum siap */
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error('Server uji tidak siap dalam 9 detik.');
}

async function main() {
  rmSync(DATA_DIR, { recursive: true, force: true });
  const child = spawn(process.execPath, ['server.js'], {
    env: { ...process.env, PORT: String(PORT), DATA_DIR, HOST: '127.0.0.1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stderr.on('data', (chunk) => process.stderr.write(`[server] ${chunk}`));
  await waitForServer();

  console.log('\nAuth & sesi');
  await check('GET /api/state tanpa sesi ditolak 401', async () => {
    const res = await call('/api/state');
    assert.equal(res.status, 401);
  });
  await check('login password salah ditolak 401', async () => {
    const res = await call('/api/login', { method: 'POST', body: { email: EMAIL, password: 'salah-sekali' } });
    assert.equal(res.status, 401);
  });
  await check('login kredensial valid mengembalikan cookie', async () => {
    const res = await call('/api/login', { method: 'POST', body: { email: EMAIL, password: PASSWORD } });
    assert.equal(res.status, 200);
    const setCookie = res.headers.getSetCookie?.()[0] || res.headers.get('set-cookie') || '';
    assert.match(setCookie, /nmc_session=/);
    assert.match(setCookie, /HttpOnly/i);
    cookie = setCookie.split(';')[0];
  });
  await check('GET /api/state memuat data + metrik', async () => {
    const res = await call('/api/state');
    assert.equal(res.status, 200);
    assert.ok(res.body.agents.length >= 5, 'agent seed tersedia');
    assert.ok(res.body.metrics.tokenByDay.length === 14, 'metrik token 14 hari');
    assert.ok(Array.isArray(res.body.metrics.agentRows));
    assert.equal(res.body.settings.hermes.apiKey, '', 'API key tidak dikirim ke browser');
    assert.equal(res.body.user.role, 'owner');
  });
  await check('POST tanpa content-type JSON ditolak 415', async () => {
    const res = await fetch(`${BASE}/api/tasks`, {
      method: 'POST',
      headers: { cookie, 'content-type': 'text/plain' },
      body: '{}',
    });
    assert.equal(res.status, 415);
  });
  await check('POST dari origin asing ditolak 403', async () => {
    const res = await call('/api/tasks', {
      method: 'POST',
      headers: { origin: 'https://evil.example' },
      body: { title: 'CSRF test' },
    });
    assert.equal(res.status, 403);
  });

  console.log('\nMisi, approval, docs');
  let missionId = '';
  let docId = '';
  await check('validasi misi gagal menyebut field', async () => {
    const res = await call('/api/missions', { method: 'POST', body: { name: 'ab', goals: 'pendek' } });
    assert.equal(res.status, 422);
    assert.ok(res.body.fields.name, 'error field name ada');
    assert.ok(res.body.fields.goals, 'error field goals ada');
  });
  await check('buat misi -> task otomatis -> submit', async () => {
    const state = await call('/api/state');
    const agent = state.body.agents.find((a) => a.status === 'active');
    const res = await call('/api/missions', {
      method: 'POST',
      body: {
        name: 'Uji alur misi end-to-end',
        goals: 'Pastikan misi dapat diajukan, disetujui, diluncurkan, dan menghasilkan dokumen.',
        agentId: agent.id,
        priority: 'high',
        timeLimitMinutes: 15,
        maxSteps: 4,
        notesQc: 'Cek angka dan sumber.',
      },
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.mission.status, 'draft');
    missionId = res.body.mission.id;
    const after = await call('/api/state');
    const task = after.body.tasks.find((t) => t.missionId === missionId);
    assert.ok(task, 'task otomatis terbentuk');
    const submit = await call(`/api/missions/${missionId}/action`, { method: 'POST', body: { action: 'submit' } });
    assert.equal(submit.status, 200);
    assert.equal(submit.body.mission.status, 'pending_review');
  });
  await check('approve -> launch (fallback lokal) -> complete membuat docs', async () => {
    const approve = await call(`/api/missions/${missionId}/action`, { method: 'POST', body: { action: 'approve' } });
    assert.equal(approve.body.mission.status, 'approved');
    const launch = await call(`/api/missions/${missionId}/action`, { method: 'POST', body: { action: 'launch' } });
    assert.equal(launch.body.mission.status, 'running');
    assert.equal(launch.body.mission.launch.mode, 'local');
    const complete = await call(`/api/missions/${missionId}/action`, { method: 'POST', body: { action: 'complete' } });
    assert.equal(complete.body.mission.status, 'completed');
    docId = complete.body.mission.resultDocId;
    assert.ok(docId, 'resultDocId terisi');
    const state = await call('/api/state');
    const doc = state.body.docs.find((d) => d.id === docId);
    assert.ok(doc, 'dokumen hasil ada');
    assert.match(doc.content, /Hasil misi/);
  });
  await check('aksi tidak valid di status selesai ditolak 409', async () => {
    const res = await call(`/api/missions/${missionId}/action`, { method: 'POST', body: { action: 'approve' } });
    assert.equal(res.status, 409);
  });

  console.log('\nTask board');
  await check('task manual dibuat, dipindah, lalu dihapus', async () => {
    const create = await call('/api/tasks', {
      method: 'POST',
      body: { title: 'Task uji manual', description: 'Dibuat oleh smoke test', priority: 'low', status: 'todo' },
    });
    assert.equal(create.status, 201);
    const id = create.body.task.id;
    const patch = await call(`/api/tasks/${id}`, { method: 'PATCH', body: { status: 'in_progress' } });
    assert.equal(patch.status, 200);
    assert.equal(patch.body.task.status, 'in_progress');
    const del = await call(`/api/tasks/${id}`, { method: 'DELETE' });
    assert.equal(del.status, 200);
  });

  console.log('\nBrand hub');
  await check('brand baru + referensi + riset + DNA divalidasi', async () => {
    const brand = await call('/api/brands', { method: 'POST', body: { name: 'Brand Uji' } });
    assert.equal(brand.status, 201);
    const brandId = brand.body.brand.id;
    const ref = await call(`/api/brands/${brandId}/references`, {
      method: 'POST',
      body: { type: 'link', label: 'Situs uji', url: 'https://example.com/brand' },
    });
    assert.equal(ref.status, 201);
    const research = await call(`/api/brands/${brandId}/research`, { method: 'POST', body: {} });
    assert.equal(research.status, 200);
    assert.ok(research.body.proposal.brandName === 'Brand Uji');
    const invalidDna = await call(`/api/brands/${brandId}/dna`, { method: 'POST', body: { brandName: 'Brand Uji' } });
    assert.equal(invalidDna.status, 422);
    const proposal = research.body.proposal;
    const dna = await call(`/api/brands/${brandId}/dna`, {
      method: 'POST',
      body: {
        brandName: proposal.brandName,
        archetype: proposal.archetype,
        description: proposal.description,
        typography: proposal.typography,
        palette: proposal.palette,
        voiceTone: proposal.voiceTone,
        keyMessage: proposal.keyMessage,
        statement: proposal.statement,
        niche: proposal.niche,
        specificNiche: proposal.specificNiche,
        superSpecificNiche: proposal.superSpecificNiche,
        positioning: proposal.positioning,
        personas: [],
      },
    });
    assert.equal(dna.status, 200);
    const product = await call(`/api/brands/${brandId}/products`, { method: 'POST', body: { name: 'Produk Uji' } });
    assert.equal(product.status, 201);
  });

  console.log('\nAgent & chat');
  await check('preview identitas agent + hire + memory', async () => {
    const preview = await call('/api/agents/preview', {
      method: 'POST',
      body: { name: 'Kirana', role: 'Content Writer', direction: 'Tulis ringkas dengan satu CTA utama.', model: 'openai/gpt-5' },
    });
    assert.equal(preview.status, 200);
    assert.match(preview.body.soul, /Soul.md/);
    const hire = await call('/api/agents', {
      method: 'POST',
      body: {
        name: 'Kirana',
        role: 'Content Writer',
        direction: 'Tulis ringkas dengan satu CTA utama.',
        model: 'openai/gpt-5',
        skills: ['seo-writing'],
        soul: preview.body.soul,
        identityApproved: true,
      },
    });
    assert.equal(hire.status, 201);
    const agentId = hire.body.agent.id;
    const memo = await call(`/api/agents/${agentId}/memory`, { method: 'POST', body: { text: 'Preferensi: bahasa Indonesia.' } });
    assert.equal(memo.status, 200);
    assert.equal(memo.body.memory.length, 1);
  });
  await check('chat sesi baru dibalas simulator lokal', async () => {
    const state = await call('/api/state');
    const agent = state.body.agents[0];
    const chat = await call('/api/chats', { method: 'POST', body: { agentId: agent.id } });
    assert.equal(chat.status, 201);
    const reply = await call(`/api/chats/${chat.body.chat.id}/messages`, {
      method: 'POST',
      body: { message: 'Apa status pekerjaan saat ini?' },
    });
    assert.equal(reply.status, 200);
    assert.equal(reply.body.mode, 'local');
    const last = reply.body.chat.messages[reply.body.chat.messages.length - 1];
    assert.equal(last.role, 'agent');
    assert.ok(last.text.length > 20);
    assert.match(last.note, /lokal/i);
  });
  await check('chat pesan kosong ditolak 422', async () => {
    const state = await call('/api/state');
    const chatId = state.body.chats[0].id;
    const res = await call(`/api/chats/${chatId}/messages`, { method: 'POST', body: { message: '   ' } });
    assert.equal(res.status, 422);
  });

  console.log('\nUpload & pengaturan');
  await check('upload berkas + dokumen + unduh', async () => {
    const base64 = Buffer.from('hello neuromancer').toString('base64');
    const upload = await call('/api/files', {
      method: 'POST',
      body: { name: 'catatan.txt', mime: 'text/plain', dataBase64: base64, kind: 'doc' },
    });
    assert.equal(upload.status, 201);
    const fileId = upload.body.file.id;
    const doc = await call('/api/docs', {
      method: 'POST',
      body: { title: 'Dokumen unggah uji', type: 'upload', fileId, content: 'catatan.txt' },
    });
    assert.equal(doc.status, 201);
    const download = await fetch(`${BASE}/api/files/${fileId}/download`, { headers: { cookie } });
    assert.equal(download.status, 200);
    const text = await download.text();
    assert.equal(text, 'hello neuromancer');
  });
  await check('upload > 8MB ditolak', async () => {
    const big = Buffer.alloc(8 * 1024 * 1024 + 10, 1).toString('base64');
    const res = await call('/api/files', { method: 'POST', body: { name: 'besar.bin', mime: 'application/octet-stream', dataBase64: big } });
    assert.equal(res.status, 413);
  });
  await check('pengaturan Hermes: URL invalid ditolak', async () => {
    const res = await call('/api/settings', { method: 'PATCH', body: { hermes: { enabled: true, baseUrl: 'hermes:8080' } } });
    assert.equal(res.status, 422);
    assert.ok(res.body.fields['hermes.baseUrl']);
  });
  await check('tes koneksi Hermes tanpa URL gagal dengan pesan jelas', async () => {
    const res = await call('/api/hermes/test', { method: 'POST', body: {} });
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, false);
    assert.match(res.body.message, /Base URL/);
  });
  await check('ganti password tidak menerima password lama yang salah', async () => {
    const res = await call('/api/profile/password', {
      method: 'POST',
      body: { currentPassword: 'bukan-ini', newPassword: 'PasswordBaru123', confirmPassword: 'PasswordBaru123' },
    });
    assert.equal(res.status, 422);
  });
  await check('ganti password valid lalu login dengan password baru', async () => {
    const change = await call('/api/profile/password', {
      method: 'POST',
      body: { currentPassword: PASSWORD, newPassword: 'PasswordBaru123', confirmPassword: 'PasswordBaru123' },
    });
    assert.equal(change.status, 200);
    cookie = '';
    const oldLogin = await call('/api/login', { method: 'POST', body: { email: EMAIL, password: PASSWORD } });
    assert.equal(oldLogin.status, 401, 'password lama harus ditolak');
    const newLogin = await call('/api/login', { method: 'POST', body: { email: EMAIL, password: 'PasswordBaru123' } });
    assert.equal(newLogin.status, 200);
    cookie = (newLogin.headers.getSetCookie?.()[0] || newLogin.headers.get('set-cookie')).split(';')[0];
    const state = await call('/api/state');
    assert.equal(state.status, 200);
  });
  await check('logout menghapus sesi', async () => {
    const res = await call('/api/logout', { method: 'POST', body: {} });
    assert.equal(res.status, 200);
    cookie = '';
    const state = await call('/api/state');
    assert.equal(state.status, 401);
  });

  child.kill('SIGTERM');
  await new Promise((resolve) => child.on('exit', resolve));

  console.log(`\n${passed} pengujian lulus, ${failures.length} gagal.`);
  if (failures.length) {
    console.error(failures.map((f) => `- ${f.name}: ${f.error.message}`).join('\n'));
    process.exit(1);
  }
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
