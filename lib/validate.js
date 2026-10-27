/**
 * Validasi sisi server. Semua pesan dalam bahasa Indonesia dan menyebut
 * tindakan yang bisa dilakukan pengguna.
 */

const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const MISSION_STATUS = [
  'draft',
  'pending_review',
  'approved',
  'running',
  'completed',
  'cancelled',
  'replan',
  'rejected',
];
const TASK_STATUS = ['todo', 'in_progress', 'review', 'done', 'cancelled'];
const AGENT_STATUS = ['active', 'inactive'];

function text(value) {
  return typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim();
}

function requireText(value, field, label, { min = 1, max = 200, errors } = {}) {
  const v = text(value);
  if (!v) errors[field] = `${label} wajib diisi.`;
  else if (v.length < min) errors[field] = `${label} minimal ${min} karakter.`;
  else if (v.length > max) errors[field] = `${label} maksimal ${max} karakter.`;
  return v;
}

function optionalText(value, field, label, { max = 500, errors } = {}) {
  const v = text(value);
  if (v.length > max) errors[field] = `${label} maksimal ${max} karakter.`;
  return v;
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function validateLogin(input = {}) {
  const errors = {};
  const email = requireText(input.email, 'email', 'Email', { max: 160, errors }).toLowerCase();
  if (email && !isEmail(email)) errors.email = 'Format email tidak valid, contoh: nama@domain.com';
  const password = text(input.password);
  if (!password) errors.password = 'Password wajib diisi.';
  return { errors, value: { email, password } };
}

export function validateProfile(input = {}) {
  const errors = {};
  const name = requireText(input.name, 'name', 'Nama', { min: 2, max: 60, errors });
  const email = requireText(input.email, 'email', 'Email', { max: 160, errors }).toLowerCase();
  if (email && !isEmail(email)) errors.email = 'Format email tidak valid.';
  return { errors, value: { name, email } };
}

export function validatePassword(input = {}) {
  const errors = {};
  const current = text(input.currentPassword);
  const next = text(input.newPassword);
  const confirm = text(input.confirmPassword);
  if (!current) errors.currentPassword = 'Password saat ini wajib diisi.';
  if (next.length < 8) errors.newPassword = 'Password baru minimal 8 karakter.';
  if (next && next === current) errors.newPassword = 'Password baru harus berbeda dari password saat ini.';
  if (confirm !== next) errors.confirmPassword = 'Konfirmasi password belum sama.';
  return { errors, value: { current, next } };
}

export function validateAgent(input = {}) {
  const errors = {};
  const name = requireText(input.name, 'name', 'Nama agent', { min: 2, max: 40, errors });
  const role = requireText(input.role, 'role', 'Role', { min: 2, max: 40, errors });
  const direction = requireText(input.direction, 'direction', 'Direction', { min: 10, max: 600, errors });
  const model = requireText(input.model, 'model', 'Model', { min: 2, max: 80, errors });
  const status = AGENT_STATUS.includes(input.status) ? input.status : 'active';
  const skills = Array.isArray(input.skills)
    ? [...new Set(input.skills.map((s) => text(s)).filter(Boolean))].slice(0, 10)
    : [];
  if (skills.some((s) => s.length > 40)) errors.skills = 'Nama skill maksimal 40 karakter.';
  return {
    errors,
    value: { name, role, direction, model, status, skills },
  };
}

export function validateBrand(input = {}) {
  const errors = {};
  const name = requireText(input.name, 'name', 'Nama brand', { min: 2, max: 80, errors });
  return { errors, value: { name } };
}

const DNA_FIELDS = [
  ['brandName', 'Brand Name', 2, 80],
  ['archetype', 'Brand Archetype', 2, 80],
  ['description', 'Brand Description', 10, 800],
  ['typography', 'Brand Typography', 2, 160],
  ['voiceTone', 'Voice Tone', 3, 400],
  ['keyMessage', 'Brand Key Message', 3, 240],
  ['statement', 'Brand Statement', 10, 600],
  ['niche', 'Brand Niche', 2, 120],
  ['specificNiche', 'Brand Specific Niche', 2, 160],
  ['superSpecificNiche', 'Brand Super Specific Niche', 2, 200],
  ['positioning', 'Positioning', 5, 400],
];

export function validateBrandDna(input = {}) {
  const errors = {};
  const value = {};
  DNA_FIELDS.forEach(([field, label, min, max]) => {
    value[field] = requireText(input[field], field, label, { min, max, errors });
  });
  const palette = Array.isArray(input.palette) ? input.palette : [];
  if (!palette.length) errors.palette = 'Tambahkan minimal 1 warna palet.';
  value.palette = palette.slice(0, 8).map((entry, index) => {
    const name = text(entry?.name);
    const hex = text(entry?.hex).toUpperCase();
    if (!/^#[0-9A-F]{6}$/.test(hex)) {
      errors.palette = `Warna #${index + 1} harus format heksadesimal, contoh #1F5FE0.`;
    }
    return { name: name || `Warna ${index + 1}`, hex };
  });

  const personas = Array.isArray(input.personas) ? input.personas : [];
  if (personas.length > 3) errors.personas = 'Maksimal 3 persona.';
  value.personas = personas.slice(0, 3).map((persona, index) => {
    const label = `Persona ${index + 1}`;
    const out = {
      id: text(persona?.id) || undefined,
      name: requireText(persona?.name, `personas.${index}.name`, `${label} — nama`, {
        min: 2,
        max: 60,
        errors,
      }),
      age: optionalText(persona?.age, `personas.${index}.age`, `${label} — usia`, {
        max: 40,
        errors,
      }),
      role: optionalText(persona?.role, `personas.${index}.role`, `${label} — peran`, {
        max: 160,
        errors,
      }),
      goals: optionalText(persona?.goals, `personas.${index}.goals`, `${label} — tujuan`, {
        max: 400,
        errors,
      }),
      painPoints: optionalText(
        persona?.painPoints,
        `personas.${index}.painPoints`,
        `${label} — kendala`,
        { max: 400, errors },
      ),
      channels: optionalText(persona?.channels, `personas.${index}.channels`, `${label} — kanal`, {
        max: 160,
        errors,
      }),
    };
    return out;
  });
  return { errors, value };
}

export function validateProduct(input = {}) {
  const errors = {};
  const name = requireText(input.name, 'name', 'Nama produk', { min: 2, max: 100, errors });
  const category = optionalText(input.category, 'category', 'Kategori', { max: 60, errors });
  const field = optionalText(input.field, 'field', 'Bidang', { max: 60, errors });
  const reference = optionalText(input.reference, 'reference', 'Referensi produk', {
    max: 500,
    errors,
  });
  return { errors, value: { name, category, field, reference } };
}

export function validateReference(input = {}) {
  const errors = {};
  const type = input.type === 'file' ? 'file' : 'link';
  const label = requireText(input.label, 'label', 'Label referensi', { min: 2, max: 100, errors });
  if (type === 'link') {
    const url = requireText(input.url, 'url', 'URL referensi', { max: 500, errors });
    if (url && !isHttpUrl(url)) errors.url = 'URL harus dimulai dengan http:// atau https://';
    return { errors, value: { type, label, url } };
  }
  const fileId = text(input.fileId);
  if (!fileId) errors.fileId = 'Pilih berkas yang ingin diunggah.';
  return { errors, value: { type, label, fileId } };
}

export function validateMission(input = {}) {
  const errors = {};
  const name = requireText(input.name, 'name', 'Nama misi', { min: 3, max: 120, errors });
  const goals = requireText(input.goals, 'goals', 'Goals', { min: 10, max: 2000, errors });
  const agentId = requireText(input.agentId, 'agentId', 'Agent', { max: 60, errors });
  const priority = PRIORITIES.includes(input.priority) ? input.priority : 'medium';
  const timeLimitMinutes = Number(input.timeLimitMinutes);
  if (!Number.isFinite(timeLimitMinutes) || timeLimitMinutes < 1) {
    errors.timeLimitMinutes = 'Time limit minimal 1 menit.';
  } else if (timeLimitMinutes > 1440) {
    errors.timeLimitMinutes = 'Time limit maksimal 1440 menit (24 jam).';
  }
  const maxSteps = Number(input.maxSteps);
  if (!Number.isInteger(maxSteps) || maxSteps < 1) {
    errors.maxSteps = 'Max steps minimal 1.';
  } else if (maxSteps > 50) {
    errors.maxSteps = 'Max steps maksimal 50.';
  }
  const notesQc = optionalText(input.notesQc, 'notesQc', 'Notes Review QC', {
    max: 1000,
    errors,
  });
  return {
    errors,
    value: {
      name,
      goals,
      agentId,
      priority,
      timeLimitMinutes: Number(timeLimitMinutes || 0),
      maxSteps: Number(maxSteps || 0),
      notesQc,
    },
  };
}

export function validateTask(input = {}, { partial = false } = {}) {
  const errors = {};
  const value = {};
  if (!partial || input.title !== undefined) {
    value.title = requireText(input.title, 'title', 'Judul task', { min: 3, max: 120, errors });
  }
  if (!partial || input.description !== undefined) {
    value.description = optionalText(input.description, 'description', 'Deskripsi', {
      max: 2000,
      errors,
    });
  }
  if (!partial || input.priority !== undefined) {
    value.priority = PRIORITIES.includes(input.priority) ? input.priority : 'medium';
  }
  if (input.status !== undefined) {
    if (!TASK_STATUS.includes(input.status)) errors.status = 'Status task tidak dikenal.';
    else value.status = input.status;
  }
  if (input.assigneeAgentId !== undefined) {
    value.assigneeAgentId = text(input.assigneeAgentId) || null;
  }
  return { errors, value };
}

export function validateDoc(input = {}, { partial = false } = {}) {
  const errors = {};
  const value = {};
  if (!partial || input.title !== undefined) {
    value.title = requireText(input.title, 'title', 'Judul dokumen', { min: 3, max: 140, errors });
  }
  if (!partial || input.content !== undefined) {
    value.content = optionalText(input.content, 'content', 'Isi dokumen', {
      max: 40000,
      errors,
    });
  }
  if (input.missionId !== undefined) value.missionId = text(input.missionId) || null;
  return { errors, value };
}

export function validateSkill(input = {}) {
  const errors = {};
  const name = requireText(input.name, 'name', 'Nama skill', { min: 2, max: 40, errors });
  if (name && !/^[a-z0-9-]+$/.test(name)) {
    errors.name = 'Nama skill hanya huruf kecil, angka, dan tanda hubung.';
  }
  const category = optionalText(input.category, 'category', 'Kategori', { max: 40, errors });
  const description = requireText(input.description, 'description', 'Deskripsi skill', {
    min: 10,
    max: 300,
    errors,
  });
  return { errors, value: { name, category: category || 'Custom', description } };
}

export function validateMessage(input = {}) {
  const errors = {};
  const message = requireText(input.message, 'message', 'Pesan', { max: 4000, errors });
  return { errors, value: { message } };
}

export function validateSettings(input = {}) {
  const errors = {};
  const value = {};
  if (input.workspaceName !== undefined) {
    value.workspaceName = requireText(input.workspaceName, 'workspaceName', 'Nama workspace', {
      min: 2,
      max: 80,
      errors,
    });
  }
  if (input.hermes !== undefined) {
    const hermes = input.hermes || {};
    const baseUrl = text(hermes.baseUrl);
    if (baseUrl && !isHttpUrl(baseUrl)) {
      errors['hermes.baseUrl'] = 'Base URL harus http:// atau https://';
    }
    value.hermes = {
      enabled: Boolean(hermes.enabled),
      baseUrl: baseUrl.replace(/\/+$/, ''),
      apiKey: typeof hermes.apiKey === 'string' && hermes.apiKey.startsWith('••••')
        ? undefined
        : text(hermes.apiKey),
      healthPath: text(hermes.healthPath) || '/health',
      chatPath: text(hermes.chatPath) || '/v1/chat',
      missionPath: text(hermes.missionPath) || '/v1/missions',
      fallbackLocal: hermes.fallbackLocal !== false,
    };
    if (value.hermes.enabled && !baseUrl) {
      errors['hermes.baseUrl'] = 'Isi Base URL sebelum mengaktifkan Hermes.';
    }
  }
  if (value.hermes) Object.keys(value.hermes).forEach((k) => value.hermes[k] === undefined && delete value.hermes[k]);
  return { errors, value };
}

export { PRIORITIES, MISSION_STATUS, TASK_STATUS, AGENT_STATUS };
