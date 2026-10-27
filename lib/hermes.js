/**
 * Adapter integrasi Hermes.
 *
 * Kontrak yang diasumsikan (dapat diubah lewat Settings → Integrasi):
 *   GET  {baseUrl}{healthPath}      -> 2xx bila hidup
 *   POST {baseUrl}{missionPath}     -> body { mission, agent } -> { result?: string, tokens?: number }
 *   POST {baseUrl}{chatPath}        -> body { agent, messages } -> { reply: string, tokens?: number }
 *
 * Bila Hermes belum dikonfigurasi / tidak menjawab, aplikasi memakai simulator
 * lokal dan MENANDAI hasilnya, supaya tidak ada klaim palsu bahwa Hermes berjalan.
 */

const TIMEOUT_MS = 8000;

export function hermesSettings(settings) {
  return settings?.hermes || {};
}

function endpoint(settings, key, fallback) {
  const hermes = hermesSettings(settings);
  const base = String(hermes.baseUrl || '').replace(/\/+$/, '');
  if (!base) return null;
  const path = hermes[key] || fallback;
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

async function request(url, { method = 'GET', body, apiKey } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method,
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const textBody = await response.text();
    let data = null;
    try {
      data = textBody ? JSON.parse(textBody) : null;
    } catch {
      data = { raw: textBody.slice(0, 500) };
    }
    return { ok: response.ok, status: response.status, data };
  } finally {
    clearTimeout(timer);
  }
}

export async function testConnection(settings) {
  const url = endpoint(settings, 'healthPath', '/health');
  if (!url) return { ok: false, message: 'Base URL Hermes belum diisi.', configured: false };
  try {
    const res = await request(url, { apiKey: hermesSettings(settings).apiKey });
    if (res.ok) return { ok: true, message: `Hermes menjawab ${res.status}.`, configured: true };
    return {
      ok: false,
      configured: true,
      message: `Hermes menjawab HTTP ${res.status}. Periksa path health dan API key.`,
    };
  } catch (error) {
    return {
      ok: false,
      configured: true,
      message:
        error.name === 'AbortError'
          ? 'Hermes tidak menjawab dalam 8 detik. Periksa jaringan VPS dan pastikan container berjalan.'
          : `Tidak bisa menghubungi Hermes: ${error.message}`,
    };
  }
}

export async function dispatchMission(settings, mission, agent) {
  const hermes = hermesSettings(settings);
  const url = endpoint(settings, 'missionPath', '/v1/missions');
  if (!hermes.enabled || !url) {
    return { mode: 'local', note: 'Hermes belum diaktifkan; misi dijalankan simulator lokal.' };
  }
  try {
    const res = await request(url, {
      method: 'POST',
      apiKey: hermes.apiKey,
      body: {
        mission: {
          id: mission.id,
          name: mission.name,
          goals: mission.goals,
          priority: mission.priority,
          timeLimitMinutes: mission.timeLimitMinutes,
          maxSteps: mission.maxSteps,
          notesQc: mission.notesQc,
        },
        agent: { id: agent?.id, name: agent?.name, role: agent?.role, model: agent?.model },
      },
    });
    if (!res.ok) {
      return {
        mode: 'local',
        note: `Hermes menolak permintaan (HTTP ${res.status}); memakai simulator lokal.`,
      };
    }
    return {
      mode: 'hermes',
      note: 'Misi dikirim ke Hermes.',
      result: typeof res.data?.result === 'string' ? res.data.result : null,
      tokens: Number(res.data?.tokens) || 0,
    };
  } catch (error) {
    return {
      mode: 'local',
      note:
        error.name === 'AbortError'
          ? 'Hermes timeout; memakai simulator lokal.'
          : `Gagal menghubungi Hermes (${error.message}); memakai simulator lokal.`,
    };
  }
}

export async function sendChat(settings, agent, messages) {
  const hermes = hermesSettings(settings);
  const url = endpoint(settings, 'chatPath', '/v1/chat');
  if (hermes.enabled && url) {
    try {
      const res = await request(url, {
        method: 'POST',
        apiKey: hermes.apiKey,
        body: {
          session: messages[0]?.chatId || null,
          agent: { id: agent.id, name: agent.name, role: agent.role, model: agent.model, soul: agent.soul },
          messages: messages.map((m) => ({ role: m.role, content: m.text })),
        },
      });
      if (res.ok && typeof res.data?.reply === 'string') {
        return {
          mode: 'hermes',
          text: res.data.reply,
          tokens: Number(res.data?.tokens) || 0,
          note: null,
        };
      }
      if (!hermes.fallbackLocal) {
        return {
          mode: 'error',
          text: null,
          note: `Hermes menjawab HTTP ${res.status}. Nonaktifkan "fallback lokal" untuk mencoba lagi nanti.`,
        };
      }
      return {
        mode: 'local',
        text: localReply(agent, messages[messages.length - 1]?.text || ''),
        tokens: estimateTokens(messages),
        note: `Hermes menjawab HTTP ${res.status}; balasan berikut berasal dari simulator lokal.`,
      };
    } catch (error) {
      if (!hermes.fallbackLocal) {
        return {
          mode: 'error',
          text: null,
          note: `Hermes tidak dapat dihubungi: ${error.message}`,
        };
      }
      return {
        mode: 'local',
        text: localReply(agent, messages[messages.length - 1]?.text || ''),
        tokens: estimateTokens(messages),
        note: 'Hermes tidak dapat dihubungi; balasan berikut berasal dari simulator lokal.',
      };
    }
  }
  return {
    mode: 'local',
    text: localReply(agent, messages[messages.length - 1]?.text || ''),
    tokens: estimateTokens(messages),
    note: 'Simulator lokal (Hermes belum diaktifkan). Hubungkan Hermes di Settings → Integrasi.',
  };
}

export function estimateTokens(messages) {
  const chars = messages.reduce((sum, m) => sum + String(m.text || '').length, 0);
  return Math.max(80, Math.round(chars / 3.6));
}

/** Balasan simulator: membantu, sadar-peran, dan jelas bukan Hermes asli. */
export function localReply(agent, message) {
  const text = String(message || '').toLowerCase();
  const role = (agent?.role || 'Agent').toLowerCase();
  const prefix = `[Simulator ${agent?.name || 'agent'} · ${agent?.role || role}]`;

  if (/status|progres|progress|sedang apa/.test(text)) {
    return `${prefix} Saya sedang menangani antrean ${role}. Langkah berikutnya: periksa misi berstatus "Menunggu review" di Dashboard, lalu setujui atau minta replan. Saya bisa merangkum temuan terbaru bila Anda sebutkan nama misinya.`;
  }
  if (/riset|research|kompetitor|persona/.test(text)) {
    return `${prefix} Saya akan mulai dari 3 hal: (1) kumpulkan referensi yang sudah diunggah di Brand Hub, (2) catat periode data dan sumbernya, (3) tulis temuan yang tidak terverifikasi sebagai "data belum ditemukan". Kirimkan tautan atau berkas tambahan bila ada.`;
  }
  if (/tulis|artikel|konten|copy/.test(text)) {
    return `${prefix} Saya butuh 3 hal sebelum menulis: voice tone brand, panjang target, dan satu CTA utama. Dari Brand DNA yang ada, saya akan menjaga istilah khas brand dan menghindari klaim yang tidak ada di brief.`;
  }
  if (/jadwal|schedule|kapan/.test(text)) {
    return `${prefix} Saya belum punya akses ke penjadwal otomatis (modul Automation ditunda pada MVP). Saat ini saya bisa menyusun daftar langkah dengan estimasi waktu agar Anda menjadwalkannya manual.`;
  }
  return `${prefix} Saya mencatat permintaan Anda. Sebagai ${agent?.role || 'agent'}, arah kerja saya: ${agent?.direction || 'mengikuti brief misi'}. Beri saya nama misi atau tujuan yang ingin dicapai, dan saya akan memecahnya menjadi langkah yang bisa direview. (Balasan ini dari simulator lokal; aktifkan Hermes di Settings untuk respons model asli.)`;
}
