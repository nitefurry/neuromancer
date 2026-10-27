import { state, apiChange, agentById } from '../state.js';
import { api } from '../api.js';
import {
  icon,
  escapeHtml,
  fmtDate,
  avatar,
  badge,
  field,
  openModal,
  readForm,
  applyFieldErrors,
  busy,
  confirmDialog,
  toast,
  emptyState,
  readFileAsBase64,
} from '../ui.js';

const ROLE_SUGGESTIONS = [
  'Orchestrator',
  'Researcher',
  'Content Writer',
  'Developer',
  'Designer',
  'Data Analyst',
  'Marketing Strategist',
  'Personal Assistant',
  'Sales',
];
const MODEL_SUGGESTIONS = [
  'hermes/orchestrator-v2',
  'openai/gpt-5',
  'anthropic/claude-sonnet-4.5',
  'google/gemini-2.5-pro',
  'meta/llama-4-70b',
  'openai/gpt-5-mini',
];

const FILTER_KEY = 'nmc-agent-filter';
const QUERY_KEY = 'nmc-agent-query';

function photoUrl(agent) {
  return agent?.photoFileId ? `/api/files/${agent.photoFileId}/view` : null;
}

function datalists() {
  return `<datalist id="role_options">${ROLE_SUGGESTIONS.map((r) => `<option value="${escapeHtml(r)}"></option>`).join('')}</datalist>
    <datalist id="model_options">${MODEL_SUGGESTIONS.map((m) => `<option value="${escapeHtml(m)}"></option>`).join('')}</datalist>`;
}

export async function renderList(root) {
  const filter = sessionStorage.getItem(FILTER_KEY) || 'all';
  const query = (sessionStorage.getItem(QUERY_KEY) || '').toLowerCase();
  const agents = state.data.agents;
  const visible = agents.filter((agent) => {
    const matchStatus = filter === 'all' ? true : agent.status === filter;
    const matchQuery =
      !query ||
      [agent.name, agent.role, agent.model, ...(agent.skills || [])].join(' ').toLowerCase().includes(query);
    return matchStatus && matchQuery;
  });
  const activeCount = agents.filter((a) => a.status === 'active').length;

  root.innerHTML = `<div class="page">
    <div class="page-head">
      <div>
        <h2 class="page-title">Team Agent</h2>
        <p class="page-sub">${activeCount} agent aktif dari ${agents.length}. Kelola identitas, skill, dan percakapan.</p>
      </div>
      <button class="btn btn--primary" type="button" data-hire>${icon('plus', 17)} Hire agent</button>
    </div>

    <section class="card" aria-label="Filter agent">
      <div class="stack">
        <div style="position:relative">
          <span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--text-muted)">${icon('search', 18)}</span>
          <input class="input" id="agent_search" type="search" value="${escapeHtml(sessionStorage.getItem(QUERY_KEY) || '')}" placeholder="Cari nama, role, atau skill…" aria-label="Cari agent" style="padding-left:40px" />
        </div>
        <div class="row" role="group" aria-label="Filter status agent">
          <button class="chip ${filter === 'all' ? 'is-active' : ''}" type="button" data-filter="all">Semua (${agents.length})</button>
          <button class="chip ${filter === 'active' ? 'is-active' : ''}" type="button" data-filter="active">Aktif (${agents.filter((a) => a.status === 'active').length})</button>
          <button class="chip ${filter === 'inactive' ? 'is-active' : ''}" type="button" data-filter="inactive">Nonaktif (${agents.filter((a) => a.status === 'inactive').length})</button>
        </div>
      </div>
    </section>

    ${
      visible.length
        ? `<div class="grid grid--auto">${visible.map((agent) => agentCard(agent)).join('')}</div>`
        : emptyState({
            icon: 'agents',
            title: 'Tidak ada agent yang cocok',
            desc: 'Ubah filter atau kata kunci, atau tambahkan agent baru.',
            action: '<button class="btn btn--primary btn--sm" type="button" data-hire>Hire agent</button>',
          })
    }

    <section class="card" aria-labelledby="skill_lib_title">
      <div class="card__head">
        <div>
          <h3 class="card__title" id="skill_lib_title">Skill Library</h3>
          <p class="card__sub">${state.data.skills.length} skill tersedia untuk diberikan ke agent.</p>
        </div>
        <button class="btn btn--ghost btn--sm" type="button" data-import-skill>${icon('plus', 15)} Import skill</button>
      </div>
      <div class="row">
        ${state.data.skills
          .map(
            (skill) => `<span class="chip chip--static" title="${escapeHtml(skill.description)}">
              ${escapeHtml(skill.name)} <span class="tiny muted">${escapeHtml(skill.category)}</span>
              ${skill.builtin ? '' : `<button class="icon-btn icon-btn--bare" type="button" style="width:20px;height:20px;min-height:20px" data-del-skill="${skill.id}" aria-label="Hapus skill ${escapeHtml(skill.name)}">${icon('close', 13)}</button>`}
            </span>`,
          )
          .join('')}
      </div>
    </section>
  </div>
  ${datalists()}`;

  const search = root.querySelector('#agent_search');
  let timer = null;
  search.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      sessionStorage.setItem(QUERY_KEY, search.value);
      renderList(root).then(() => {
        const next = root.querySelector('#agent_search');
        next.focus();
        next.setSelectionRange(next.value.length, next.value.length);
      });
    }, 260);
  });

  root.querySelectorAll('[data-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      sessionStorage.setItem(FILTER_KEY, button.dataset.filter);
      renderList(root);
    });
  });

  root.querySelectorAll('[data-hire]').forEach((button) => button.addEventListener('click', openHireModal));
  root.querySelectorAll('[data-import-skill]').forEach((button) => button.addEventListener('click', openSkillModal));

  root.querySelectorAll('[data-chat-agent]').forEach((button) => {
    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        const result = await apiChange('/api/chats', { body: { agentId: button.dataset.chatAgent } });
        location.hash = `#/chat/${result.chat.id}`;
      } catch (error) {
        toast(error.message, 'error');
        button.disabled = false;
      }
    });
  });

  root.querySelectorAll('[data-del-skill]').forEach((button) => {
    button.addEventListener('click', async () => {
      const answer = await confirmDialog({
        title: 'Hapus skill dari library?',
        message: 'Skill ini juga akan dilepas dari semua agent yang memakainya.',
        confirmLabel: 'Hapus skill',
        danger: true,
      });
      if (!answer?.confirmed) return;
      try {
        await apiChange(`/api/skills/${button.dataset.delSkill}`, { method: 'DELETE' }, 'Skill dihapus.');
        await renderList(root);
      } catch (error) {
        toast(error.message, 'error');
      }
    });
  });
}

function agentCard(agent) {
  const skills = agent.skills || [];
  return `<article class="card" style="display:grid;gap:10px">
    <div class="row" style="align-items:flex-start">
      ${avatar(agent.name, { size: 'lg', color: agent.color, photo: photoUrl(agent) })}
      <div style="min-width:0;flex:1">
        <div class="row" style="gap:6px">
          <h3 style="font-size:1rem">${escapeHtml(agent.name)}</h3>
          ${badge(agent.status === 'active' ? 'success' : 'neutral', agent.status === 'active' ? 'Aktif' : 'Nonaktif', { dot: true })}
        </div>
        <p class="tiny muted">${escapeHtml(agent.role)} · ${escapeHtml(agent.model)}</p>
      </div>
    </div>
    <div class="row">
      ${skills.slice(0, 3).map((s) => badge('primary', s)).join('')}
      ${skills.length > 3 ? badge('neutral', `+${skills.length - 3}`) : ''}
      ${!skills.length ? '<span class="tiny muted">Belum punya skill</span>' : ''}
    </div>
    <div class="stack stack--sm">
      <div class="stat-row"><span class="muted tiny">Last task</span><span class="tiny strong truncate" style="max-width:60%">${escapeHtml(agent.lastTask || '—')}</span></div>
      <div class="stat-row"><span class="muted tiny">Total task assigned</span><span class="tiny strong">${agent.totalAssigned || 0}</span></div>
      <div class="stat-row"><span class="muted tiny">Success rate</span><span class="tiny strong">${agent.successRate || 0}%</span></div>
    </div>
    <div class="row">
      <a class="btn btn--secondary btn--sm" href="#/agents/${agent.id}">Detail</a>
      <button class="btn btn--ghost btn--sm" type="button" data-chat-agent="${agent.id}">${icon('chat', 15)} Chat</button>
    </div>
  </article>`;
}

/* ------------------------------------------------------------------ hire */

export function openHireModal() {
  const skills = state.data.skills;
  const modal = openModal({
    title: 'Hire agent baru',
    sub: 'Identitas agent akan ditinjau sebelum disimpan.',
    wide: true,
    body: `<div id="hire_step1">
      <form id="hire_form" novalidate>
        <div class="form-grid">
          <div class="form-grid form-grid--2">
            ${field({ label: 'Nama agent', name: 'name', required: true, attrs: 'maxlength="40" minlength="2" list="agent_names" autofocus', placeholder: 'Contoh: Kirana' })}
            ${field({ label: 'Role', name: 'role', required: true, attrs: 'maxlength="40" minlength="2" list="role_options"', placeholder: 'Content Writer' })}
          </div>
          ${field({
            label: 'Direction',
            name: 'direction',
            type: 'textarea',
            required: true,
            attrs: 'maxlength="600" minlength="10"',
            rows: 4,
            hint: 'Cara agent bekerja: prioritas, gaya keluaran, dan larangan.',
            placeholder: 'Contoh: Tulis dengan voice tone brand, 600–900 kata, satu CTA utama, sertakan sumber.',
          })}
          ${field({ label: 'Model', name: 'model', value: MODEL_SUGGESTIONS[1], required: true, attrs: 'maxlength="80" list="model_options"' })}
          <div class="field" data-field="skills">
            <p class="field__label">Skill awal</p>
            <div class="grid grid--2">
              ${skills
                .map(
                  (skill) => `<label class="checkline"><input type="checkbox" name="skills" value="${escapeHtml(skill.name)}" />
                    <span>${escapeHtml(skill.name)} <span class="tiny muted">— ${escapeHtml(skill.category)}</span></span></label>`,
                )
                .join('')}
            </div>
            <p class="field__error" role="alert"></p>
          </div>
          <div class="banner banner--info">${icon('info', 18)}<div class="banner__body"><p class="banner__text">Agent nonaktif tetap tersimpan, tetapi tidak bisa dipilih saat membuat misi.</p></div></div>
        </div>
      </form>
    </div>
    <div id="hire_step2" hidden>
      <div class="stack">
        <div class="banner banner--info">${icon('sparkles', 18)}<div class="banner__body"><p class="banner__title">Review Agent Identity</p><p class="banner__text">Periksa Soul.md. Anda bisa kembali untuk mengubah direction.</p></div></div>
        <pre class="code-block" id="soul_preview" style="max-height:320px;white-space:pre-wrap"></pre>
      </div>
    </div>`,
    foot: `<button class="btn btn--ghost" type="button" data-dialog-close>Batal</button>
      <button class="btn btn--secondary" type="button" id="hire_back" hidden>Kembali</button>
      <button class="btn btn--primary" type="button" id="hire_review">Review Agent Identity</button>
      <button class="btn btn--primary" type="button" id="hire_save" hidden>${icon('check', 16)} Simpan agent</button>`,
  });

  const form = modal.dialog.querySelector('#hire_form');
  const step1 = modal.dialog.querySelector('#hire_step1');
  const step2 = modal.dialog.querySelector('#hire_step2');
  const reviewBtn = modal.dialog.querySelector('#hire_review');
  const saveBtn = modal.dialog.querySelector('#hire_save');
  const backBtn = modal.dialog.querySelector('#hire_back');
  let draft = null;

  reviewBtn.addEventListener('click', async () => {
    applyFieldErrors(form, {});
    const raw = readForm(form);
    const values = {
      name: String(raw.name || '').trim(),
      role: String(raw.role || '').trim(),
      direction: String(raw.direction || '').trim(),
      model: String(raw.model || '').trim(),
      skills: raw.skills ? [].concat(raw.skills) : [],
    };
    const errors = {};
    if (values.name.length < 2) errors.name = 'Nama agent minimal 2 karakter.';
    if (values.role.length < 2) errors.role = 'Role minimal 2 karakter.';
    if (values.direction.length < 10) errors.direction = 'Direction minimal 10 karakter.';
    if (values.model.length < 2) errors.model = 'Model wajib diisi.';
    if (Object.keys(errors).length) {
      applyFieldErrors(form, errors);
      return;
    }
    busy(reviewBtn, true, 'Menyusun identitas…');
    try {
      const preview = await api('/api/agents/preview', { method: 'POST', body: values });
      draft = { ...values, soul: preview.soul };
      modal.dialog.querySelector('#soul_preview').textContent = preview.soul;
      step1.hidden = true;
      step2.hidden = false;
      reviewBtn.hidden = true;
      saveBtn.hidden = false;
      backBtn.hidden = false;
      saveBtn.focus();
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      busy(reviewBtn, false);
    }
  });

  backBtn.addEventListener('click', () => {
    step1.hidden = false;
    step2.hidden = true;
    reviewBtn.hidden = false;
    saveBtn.hidden = true;
    backBtn.hidden = true;
    form.querySelector('[name="name"]').focus();
  });

  saveBtn.addEventListener('click', async () => {
    if (!draft) return;
    busy(saveBtn, true, 'Menyimpan…');
    try {
      const result = await apiChange('/api/agents', { body: { ...draft, identityApproved: true } }, 'Agent baru bergabung.');
      modal.close();
      location.hash = `#/agents/${result.agent.id}`;
    } catch (error) {
      busy(saveBtn, false);
      toast(error.fields ? Object.values(error.fields)[0] : error.message, 'error');
    }
  });
}

export function openSkillModal() {
  const modal = openModal({
    title: 'Import skill',
    sub: 'Tambahkan kemampuan baru ke library. Nama unik, huruf kecil, dan tanda hubung.',
    body: `<form id="skill_form" novalidate><div class="form-grid">
      ${field({ label: 'Nama skill', name: 'name', required: true, attrs: 'maxlength="40" minlength="2" pattern="[a-z0-9\\-]+" autofocus', placeholder: 'contoh: email-triage', hint: 'Huruf kecil, angka, tanda hubung.' })}
      ${field({ label: 'Kategori', name: 'category', attrs: 'maxlength="40"', placeholder: 'Research, Content, Sales…' })}
      ${field({ label: 'Deskripsi', name: 'description', type: 'textarea', required: true, attrs: 'maxlength="300" minlength="10"', rows: 3, placeholder: 'Apa yang bisa dilakukan skill ini dan batasannya.' })}
    </div></form>`,
    foot: `<button class="btn btn--ghost" type="button" data-dialog-close>Batal</button>
      <button class="btn btn--primary" type="submit" form="skill_form" id="skill_save">Simpan skill</button>`,
  });
  const form = modal.dialog.querySelector('#skill_form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = modal.dialog.querySelector('#skill_save');
    busy(button, true);
    try {
      await apiChange('/api/skills', { body: readForm(form) }, 'Skill ditambahkan ke library.');
      modal.close();
      await renderList(document.getElementById('view'));
    } catch (error) {
      busy(button, false);
      applyFieldErrors(form, error.fields || {}, error.message);
    }
  });
}

/* ---------------------------------------------------------------- detail */

const TABS = [
  { key: 'profile', label: 'Profil' },
  { key: 'soul', label: 'Soul.md' },
  { key: 'memory', label: 'Memory' },
  { key: 'skills', label: 'Skill' },
  { key: 'settings', label: 'Setting' },
];

export async function renderDetail(root, params) {
  const agent = agentById(params.id);
  if (!agent) {
    root.innerHTML = `<div class="page"><a class="btn btn--ghost btn--sm" href="#/agents" style="justify-self:start">${icon('arrowLeft', 16)} Team Agent</a>
      ${emptyState({ icon: 'agents', title: 'Agent tidak ditemukan', desc: 'Agent mungkin sudah dihapus.', action: '<a class="btn btn--secondary btn--sm" href="#/agents">Kembali</a>' })}</div>`;
    return;
  }
  const stored = sessionStorage.getItem(`nmc-agent-tab-${agent.id}`);
  let activeTab = TABS.some((t) => t.key === stored) ? stored : 'profile';

  const draw = () => {
    const fresh = agentById(agent.id) || agent;
    root.innerHTML = `<div class="page">
      <div class="row">
        <a class="btn btn--ghost btn--sm" href="#/agents">${icon('arrowLeft', 16)} Team Agent</a>
        <span class="spacer"></span>
        ${badge(fresh.status === 'active' ? 'success' : 'neutral', fresh.status === 'active' ? 'Aktif' : 'Nonaktif', { dot: true })}
      </div>

      <div class="page-head">
        <div class="row" style="align-items:center;min-width:0">
          ${avatar(fresh.name, { size: 'xl', color: fresh.color, photo: photoUrl(fresh) })}
          <div style="min-width:0">
            <h2 class="page-title">${escapeHtml(fresh.name)}</h2>
            <p class="page-sub">${escapeHtml(fresh.role)} · ${escapeHtml(fresh.model)} · ${fresh.skills.length} skill</p>
          </div>
        </div>
        <div class="page-actions">
          <button class="btn btn--secondary btn--sm" type="button" data-toggle-status>${fresh.status === 'active' ? 'Nonaktifkan' : 'Aktifkan'}</button>
          <button class="btn btn--primary btn--sm" type="button" data-chat>${icon('chat', 15)} Chat</button>
          <button class="btn btn--danger btn--sm" type="button" data-delete>${icon('trash', 15)} Hapus</button>
        </div>
      </div>

      <div class="tabs" role="tablist" aria-label="Bagian workspace agent">
        ${TABS.map(
          (tab) =>
            `<button class="tab ${activeTab === tab.key ? 'is-active' : ''}" type="button" role="tab" aria-selected="${activeTab === tab.key}" data-tab="${tab.key}">${tab.label}${tab.key === 'memory' ? ` (${fresh.memory.length})` : tab.key === 'skills' ? ` (${fresh.skills.length})` : ''}</button>`,
        ).join('')}
      </div>

      <div id="agent_tab"></div>
    </div>`;

    root.querySelectorAll('[data-tab]').forEach((button) => {
      button.addEventListener('click', () => {
        activeTab = button.dataset.tab;
        sessionStorage.setItem(`nmc-agent-tab-${agent.id}`, activeTab);
        draw();
      });
    });

    root.querySelector('[data-chat]').addEventListener('click', async () => {
      try {
        const result = await apiChange('/api/chats', { body: { agentId: agent.id } });
        location.hash = `#/chat/${result.chat.id}`;
      } catch (error) {
        toast(error.message, 'error');
      }
    });

    root.querySelector('[data-toggle-status]').addEventListener('click', async (event) => {
      const target = fresh.status === 'active' ? 'inactive' : 'active';
      event.currentTarget.disabled = true;
      try {
        await apiChange(`/api/agents/${agent.id}`, { method: 'PATCH', body: { status: target } }, `Agent ${target === 'active' ? 'diaktifkan' : 'dinonaktifkan'}.`);
        draw();
      } catch (error) {
        toast(error.message, 'error');
        event.currentTarget.disabled = false;
      }
    });

    root.querySelector('[data-delete]').addEventListener('click', () => deleteAgent(agent.id));

    const tabRoot = root.querySelector('#agent_tab');
    if (activeTab === 'profile') drawProfile(tabRoot, agent.id, draw);
    if (activeTab === 'soul') drawSoul(tabRoot, agent.id, draw);
    if (activeTab === 'memory') drawMemory(tabRoot, agent.id, draw);
    if (activeTab === 'skills') drawSkills(tabRoot, agent.id, draw);
    if (activeTab === 'settings') drawSettings(tabRoot, agent.id, draw);
  };

  draw();
}

async function deleteAgent(agentId) {
  const agent = agentById(agentId);
  const answer = await confirmDialog({
    title: 'Hapus agent?',
    message: `${agent.name} akan dihapus permanen. Agent dengan task/misi aktif tidak bisa dihapus — nonaktifkan saja.`,
    confirmLabel: 'Hapus agent',
    danger: true,
  });
  if (!answer?.confirmed) return;
  try {
    await apiChange(`/api/agents/${agentId}`, { method: 'DELETE' }, 'Agent dihapus.');
    location.hash = '#/agents';
  } catch (error) {
    toast(error.message, 'error');
  }
}

function drawProfile(tabRoot, agentId, redraw) {
  const agent = agentById(agentId);
  const skills = state.data.skills;

  tabRoot.innerHTML = `<div class="grid grid--2">
    <section class="card">
      <h3 class="card__title" style="margin-bottom:10px">Identitas &amp; arah kerja</h3>
      <form id="profile_form" novalidate>
        <div class="form-grid">
          <div class="form-grid form-grid--2">
            ${field({ label: 'Nama agent', name: 'name', value: agent.name, required: true, attrs: 'maxlength="40" minlength="2" list="agent_names"' })}
            ${field({ label: 'Role', name: 'role', value: agent.role, required: true, attrs: 'maxlength="40" list="role_options"' })}
          </div>
          ${field({ label: 'Model', name: 'model', value: agent.model, required: true, attrs: 'maxlength="80" list="model_options"' })}
          ${field({ label: 'Direction', name: 'direction', type: 'textarea', value: agent.direction, required: true, attrs: 'maxlength="600" minlength="10"', rows: 4 })}
          ${field({
            label: 'Status',
            name: 'status',
            type: 'select',
            value: agent.status,
            options: [
              { value: 'active', label: 'Aktif — bisa dipilih untuk misi' },
              { value: 'inactive', label: 'Nonaktif — arsip' },
            ],
          })}
          <button class="btn btn--primary" type="submit" id="profile_save">${icon('check', 16)} Simpan profil</button>
        </div>
      </form>
    </section>

    <section class="card">
      <h3 class="card__title" style="margin-bottom:10px">Foto profil</h3>
      <div class="row" style="align-items:center">
        ${avatar(agent.name, { size: 'xl', color: agent.color, photo: photoUrl(agent) })}
        <div style="min-width:0;flex:1">
          <p class="small">Unggah foto JPG/PNG maks. 2 MB. Tanpa foto, inisial nama dipakai.</p>
          <label class="upload-zone" for="avatar_file" style="margin-top:8px">
            ${icon('upload', 18)}<span>Pilih foto</span>
            <input id="avatar_file" type="file" accept="image/png,image/jpeg,image/webp" />
          </label>
        </div>
      </div>
      <p class="field__error" id="avatar_error" role="alert" style="margin-top:8px"></p>

      <hr class="divider" />

      <h3 class="card__title" style="margin-bottom:10px">Skill yang dipakai</h3>
      <div class="row">
        ${skills
          .map(
            (skill) => `<label class="checkline" style="min-height:32px">
              <input type="checkbox" name="agent_skills" value="${escapeHtml(skill.name)}" ${agent.skills.includes(skill.name) ? 'checked' : ''} />
              <span>${escapeHtml(skill.name)}</span>
            </label>`,
          )
          .join('')}
      </div>
      <button class="btn btn--secondary btn--sm" type="button" id="skills_save" style="margin-top:8px">Simpan skill</button>
    </section>
  </div>
  ${datalists()}`;

  const form = tabRoot.querySelector('#profile_form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const values = readForm(form);
    const button = tabRoot.querySelector('#profile_save');
    busy(button, true);
    try {
      await apiChange(`/api/agents/${agentId}`, { method: 'PATCH', body: values }, 'Profil agent disimpan.');
      redraw();
    } catch (error) {
      busy(button, false);
      applyFieldErrors(form, error.fields || {}, error.message);
    }
  });

  const fileInput = tabRoot.querySelector('#avatar_file');
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    const errorNode = tabRoot.querySelector('#avatar_error');
    errorNode.textContent = '';
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
      errorNode.textContent = 'Format harus PNG, JPG, atau WebP.';
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      errorNode.textContent = 'Foto maksimal 2 MB.';
      return;
    }
    try {
      const dataBase64 = await readFileAsBase64(file);
      const uploaded = await apiChange('/api/files', { body: { name: file.name, mime: file.type, dataBase64, kind: 'avatar' } });
      await apiChange(`/api/agents/${agentId}`, { method: 'PATCH', body: { photoFileId: uploaded.file.id } }, 'Foto profil diperbarui.');
      redraw();
    } catch (error) {
      errorNode.textContent = error.message;
    }
  });

  tabRoot.querySelector('#skills_save').addEventListener('click', async (event) => {
    const checked = [...tabRoot.querySelectorAll('[name="agent_skills"]:checked')].map((cb) => cb.value);
    event.currentTarget.disabled = true;
    try {
      await apiChange(`/api/agents/${agentId}`, { method: 'PATCH', body: { skills: checked } }, 'Skill agent diperbarui.');
      redraw();
    } catch (error) {
      toast(error.message, 'error');
      event.currentTarget.disabled = false;
    }
  });
}

function drawSoul(tabRoot, agentId, redraw) {
  const agent = agentById(agentId);
  tabRoot.innerHTML = `<section class="card">
    <div class="card__head">
      <div>
        <h3 class="card__title">Soul.md</h3>
        <p class="card__sub">Identitas inti agent. Dipakai sebagai konteks saat chat dan eksekusi misi.</p>
      </div>
      <div class="row">
        <button class="btn btn--ghost btn--sm" type="button" id="regen_soul">Buat ulang dari direction</button>
        <button class="btn btn--primary btn--sm" type="submit" form="soul_form" id="soul_save">Simpan</button>
      </div>
    </div>
    <form id="soul_form">
      <div class="field" data-field="soul">
        <label class="sr-only" for="soul_editor">Isi Soul.md</label>
        <textarea class="textarea textarea--tall" id="soul_editor" name="soul" spellcheck="false">${escapeHtml(agent.soul)}</textarea>
        <p class="field__error" role="alert"></p>
      </div>
    </form>
    <p class="tiny muted" style="margin-top:8px">Terakhir diperbarui ${escapeHtml(fmtDate(agent.updatedAt))} · ${agent.soul.length} karakter</p>
  </section>`;

  const form = tabRoot.querySelector('#soul_form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = tabRoot.querySelector('#soul_save');
    busy(button, true);
    try {
      await apiChange(`/api/agents/${agentId}`, { method: 'PATCH', body: { soul: form.soul.value } }, 'Soul.md disimpan.');
      redraw();
    } catch (error) {
      busy(button, false);
      toast(error.message, 'error');
    }
  });

  tabRoot.querySelector('#regen_soul').addEventListener('click', async (event) => {
    const fresh = agentById(agentId);
    busy(event.currentTarget, true, 'Menyusun…');
    try {
      const preview = await api('/api/agents/preview', {
        method: 'POST',
        body: { name: fresh.name, role: fresh.role, direction: fresh.direction, model: fresh.model },
      });
      form.soul.value = preview.soul;
      toast('Draf Soul.md diperbarui di editor. Klik Simpan untuk memakai.', 'info');
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      busy(event.currentTarget, false);
    }
  });
}

function drawMemory(tabRoot, agentId, redraw) {
  const agent = agentById(agentId);
  tabRoot.innerHTML = `<div class="grid grid--2">
    <section class="card">
      <div class="card__head">
        <div><h3 class="card__title">Memory</h3><p class="card__sub">Catatan yang dibawa agent antar sesi.</p></div>
        ${badge('neutral', `${agent.memory.length} catatan`)}
      </div>
      ${
        agent.memory.length
          ? `<div class="list">${agent.memory
              .slice()
              .sort((a, b) => new Date(b.at) - new Date(a.at))
              .map(
                (memo) => `<div class="list-item">
                  <div class="list-item__main">
                    <p class="small" style="white-space:pre-wrap">${escapeHtml(memo.text)}</p>
                    <p class="tiny muted">${escapeHtml(fmtDate(memo.at, true))} · ${escapeHtml(memo.source)}</p>
                  </div>
                  <button class="icon-btn icon-btn--bare" type="button" data-del-mem="${memo.id}" aria-label="Hapus catatan memory">${icon('trash', 16)}</button>
                </div>`,
              )
              .join('')}</div>`
          : emptyState({ icon: 'layers', title: 'Memory kosong', desc: 'Tambahkan konteks penting agar agent tidak mengulang pertanyaan yang sama.' })
      }
    </section>
    <section class="card">
      <h3 class="card__title" style="margin-bottom:10px">Tambah catatan</h3>
      <form id="memory_form">
        <div class="form-grid">
          <div class="field" data-field="text">
            <label class="field__label" for="memory_text">Catatan baru</label>
            <textarea class="textarea" id="memory_text" name="text" rows="4" maxlength="1000" placeholder="Contoh: Klien menyukai gaya bahasa ringkas dan tidak memakai emoji."></textarea>
            <p class="field__error" role="alert"></p>
          </div>
          <button class="btn btn--secondary" type="submit" id="memory_save">${icon('plus', 16)} Simpan catatan</button>
        </div>
      </form>
      <p class="tiny muted" style="margin-top:8px">Memory tersimpan lokal di workspace ini dan ikut dikirim sebagai konteks saat Hermes terhubung.</p>
    </section>
  </div>`;

  tabRoot.querySelectorAll('[data-del-mem]').forEach((button) => {
    button.addEventListener('click', async () => {
      try {
        await apiChange(`/api/agents/${agentId}/memory/${button.dataset.delMem}`, { method: 'DELETE' }, 'Catatan dihapus.');
        redraw();
      } catch (error) {
        toast(error.message, 'error');
      }
    });
  });

  const form = tabRoot.querySelector('#memory_form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const text = form.text.value.trim();
    if (text.length < 3) {
      applyFieldErrors(form, { text: 'Catatan minimal 3 karakter.' });
      return;
    }
    const button = tabRoot.querySelector('#memory_save');
    busy(button, true);
    try {
      await apiChange(`/api/agents/${agentId}/memory`, { body: { text } }, 'Catatan ditambahkan.');
      redraw();
    } catch (error) {
      busy(button, false);
      applyFieldErrors(form, error.fields || {}, error.message);
    }
  });
}

function drawSkills(tabRoot, agentId, redraw) {
  const agent = agentById(agentId);
  const assigned = agent.skills;
  const available = state.data.skills.filter((s) => !assigned.includes(s.name));
  tabRoot.innerHTML = `<div class="grid grid--2">
    <section class="card">
      <div class="card__head"><div><h3 class="card__title">Skill terpasang</h3><p class="card__sub">Dikirim ke Hermes sebagai kemampuan agent.</p></div>${badge('primary', `${assigned.length}`)}</div>
      ${
        assigned.length
          ? `<div class="row">${assigned
              .map(
                (name) => `<span class="chip chip--static">${escapeHtml(name)}
                  <button class="icon-btn icon-btn--bare" type="button" style="width:20px;height:20px;min-height:20px" data-remove-skill="${escapeHtml(name)}" aria-label="Lepas skill ${escapeHtml(name)}">${icon('close', 13)}</button></span>`,
              )
              .join('')}</div>`
          : `<p class="small muted">Belum ada skill terpasang.</p>`
      }
    </section>
    <section class="card">
      <h3 class="card__title" style="margin-bottom:10px">Tambah dari library</h3>
      ${
        available.length
          ? `<div class="list">${available
              .map(
                (skill) => `<div class="list-item">
                  <div class="list-item__main">
                    <p class="list-item__title">${escapeHtml(skill.name)}</p>
                    <p class="tiny muted">${escapeHtml(skill.description)}</p>
                  </div>
                  <button class="btn btn--ghost btn--sm" type="button" data-add-skill="${escapeHtml(skill.name)}">Tambah</button>
                </div>`,
              )
              .join('')}</div>`
          : emptyState({ icon: 'check', title: 'Semua skill sudah terpasang', desc: 'Import skill baru dari halaman Team Agent bila perlu.' })
      }
    </section>
  </div>`;

  const update = async (skills) => {
    try {
      await apiChange(`/api/agents/${agentId}`, { method: 'PATCH', body: { skills } }, 'Skill agent diperbarui.');
      redraw();
    } catch (error) {
      toast(error.message, 'error');
    }
  };

  tabRoot.querySelectorAll('[data-add-skill]').forEach((button) => {
    button.addEventListener('click', () => update([...assigned, button.dataset.addSkill]));
  });
  tabRoot.querySelectorAll('[data-remove-skill]').forEach((button) => {
    button.addEventListener('click', () => update(assigned.filter((s) => s !== button.dataset.removeSkill)));
  });
}

function drawSettings(tabRoot, agentId, redraw) {
  const agent = agentById(agentId);
  tabRoot.innerHTML = `<section class="card">
    <div class="card__head">
      <div>
        <h3 class="card__title">Setting — config.yaml</h3>
        <p class="card__sub">Konfigurasi eksekusi agent. Disimpan per agent dan bisa disalin ke Hermes.</p>
      </div>
      ${badge('neutral', 'YAML')}
    </div>
    <form id="config_form">
      <div class="field" data-field="configYaml">
        <label class="sr-only" for="config_editor">Isi config.yaml</label>
        <textarea class="textarea textarea--tall textarea--code" id="config_editor" name="configYaml" spellcheck="false">${escapeHtml(agent.configYaml || '')}</textarea>
        <p class="field__error" role="alert"></p>
      </div>
      <div class="row" style="margin-top:10px">
        <button class="btn btn--primary" type="submit" id="config_save">${icon('check', 16)} Simpan config</button>
        <button class="btn btn--ghost" type="button" id="config_copy">Salin YAML</button>
      </div>
    </form>
    <div class="banner banner--info" style="margin-top:12px">${icon('info', 18)}
      <div class="banner__body"><p class="banner__text">Validasi YAML tidak dilakukan di MVP. Jika Hermes menolak config, periksa indentasi dan nama tool.</p></div>
    </div>
  </section>`;

  const form = tabRoot.querySelector('#config_form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = tabRoot.querySelector('#config_save');
    busy(button, true);
    try {
      await apiChange(`/api/agents/${agentId}`, { method: 'PATCH', body: { configYaml: form.configYaml.value } }, 'config.yaml disimpan.');
      redraw();
    } catch (error) {
      busy(button, false);
      toast(error.message, 'error');
    }
  });

  tabRoot.querySelector('#config_copy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(form.configYaml.value);
      toast('config.yaml disalin ke clipboard.', 'success');
    } catch {
      toast('Clipboard tidak tersedia di browser ini. Pilih teks lalu salin manual.', 'error');
    }
  });
}
