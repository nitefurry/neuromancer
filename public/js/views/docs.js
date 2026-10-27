import { state, apiChange, docById, missionById, agentById, fileById } from '../state.js';
import {
  icon,
  escapeHtml,
  fmtDate,
  fmtNumber,
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
  renderMarkdown,
  readFileAsBase64,
} from '../ui.js';

const MISSION_FILTER_KEY = 'nmc-doc-mission';
const QUERY_KEY = 'nmc-doc-query';

function docType(doc) {
  if (doc.fileId) return { label: 'Berkas', tone: 'neutral', icon: 'file' };
  if (doc.agentId) return { label: 'Agent', tone: 'primary', icon: 'sparkles' };
  return { label: 'Manual', tone: 'neutral', icon: 'edit' };
}

export async function renderList(root) {
  const docs = state.data.docs.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const missionFilter = sessionStorage.getItem(MISSION_FILTER_KEY) || 'all';
  const query = (sessionStorage.getItem(QUERY_KEY) || '').toLowerCase();

  const visible = docs.filter((doc) => {
    const matchMission = missionFilter === 'all' ? true : missionFilter === 'none' ? !doc.missionId : doc.missionId === missionFilter;
    const matchQuery =
      !query ||
      doc.title.toLowerCase().includes(query) ||
      (doc.content || '').toLowerCase().includes(query) ||
      (missionById(doc.missionId)?.name || '').toLowerCase().includes(query);
    return matchMission && matchQuery;
  });

  root.innerHTML = `<div class="page">
    <div class="page-head">
      <div>
        <h2 class="page-title">Docs</h2>
        <p class="page-sub">Library hasil misi dan berkas manual. ${docs.length} dokumen tersimpan.</p>
      </div>
      <div class="page-actions">
        <button class="btn btn--secondary" type="button" data-new-doc>${icon('edit', 16)} Dokumen manual</button>
        <button class="btn btn--primary" type="button" data-upload>${icon('upload', 16)} Unggah berkas</button>
      </div>
    </div>

    <section class="card" aria-label="Filter dokumen">
      <div class="grid grid--2">
        <div style="position:relative">
          <span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--text-muted)">${icon('search', 18)}</span>
          <input class="input" id="doc_search" type="search" value="${escapeHtml(sessionStorage.getItem(QUERY_KEY) || '')}" placeholder="Cari judul atau isi dokumen…" aria-label="Cari dokumen" style="padding-left:40px" />
        </div>
        <select class="select" id="doc_mission" aria-label="Filter berdasarkan misi">
          <option value="all">Semua misi</option>
          <option value="none" ${missionFilter === 'none' ? 'selected' : ''}>Tanpa misi</option>
          ${state.data.missions
            .map((m) => `<option value="${m.id}" ${missionFilter === m.id ? 'selected' : ''}>${escapeHtml(m.name)}</option>`)
            .join('')}
        </select>
      </div>
    </section>

    ${
      visible.length
        ? `<div class="grid grid--2">
            ${visible
              .map((doc) => {
                const type = docType(doc);
                const mission = doc.missionId ? missionById(doc.missionId) : null;
                const agent = doc.agentId ? agentById(doc.agentId) : null;
                const file = doc.fileId ? fileById(doc.fileId) : null;
                return `<article class="card" style="display:grid;gap:8px">
                  <div class="row row--between" style="align-items:flex-start">
                    <div style="min-width:0;display:flex;gap:8px">
                      <span style="color:var(--primary);margin-top:2px">${icon(type.icon, 18)}</span>
                      <div style="min-width:0">
                        <h3 style="font-size:0.95rem;line-height:1.35">${escapeHtml(doc.title)}</h3>
                        <p class="tiny muted">${escapeHtml(fmtDate(doc.createdAt))}${mission ? ` · ${escapeHtml(mission.name)}` : ''}</p>
                      </div>
                    </div>
                    ${badge(type.tone, type.label)}
                  </div>
                  <p class="small muted" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${escapeHtml(
                    file ? `${file.name} · ${(file.size / 1024).toFixed(0)} KB` : (doc.content || '').replace(/#+/g, '').slice(0, 180),
                  )}</p>
                  <div class="row">
                    ${agent ? `<span class="row" style="gap:4px">${avatar(agent.name, { size: 'sm', color: agent.color })}<span class="tiny">${escapeHtml(agent.name)}</span></span>` : ''}
                    <span class="spacer"></span>
                    <a class="btn btn--secondary btn--sm" href="#/docs/${doc.id}">Buka</a>
                    ${file ? `<a class="icon-btn icon-btn--bare" href="/api/files/${file.id}/download" aria-label="Unduh ${escapeHtml(doc.title)}">${icon('download', 17)}</a>` : ''}
                    <button class="icon-btn icon-btn--bare" type="button" data-del-doc="${doc.id}" aria-label="Hapus ${escapeHtml(doc.title)}">${icon('trash', 17)}</button>
                  </div>
                </article>`;
              })
              .join('')}
          </div>`
        : emptyState({
            icon: 'docs',
            title: docs.length ? 'Tidak ada dokumen yang cocok' : 'Docs masih kosong',
            desc: docs.length
              ? 'Ubah filter misi atau kata kunci pencarian.'
              : 'Selesaikan misi untuk menghasilkan dokumen, atau unggah berkas manual.',
            action: '<button class="btn btn--primary btn--sm" type="button" data-upload>Unggah berkas</button>',
          })
    }
  </div>`;

  const search = root.querySelector('#doc_search');
  let timer = null;
  search.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      sessionStorage.setItem(QUERY_KEY, search.value);
      renderList(root).then(() => {
        const next = root.querySelector('#doc_search');
        next.focus();
        next.setSelectionRange(next.value.length, next.value.length);
      });
    }, 260);
  });

  root.querySelector('#doc_mission').addEventListener('change', (event) => {
    sessionStorage.setItem(MISSION_FILTER_KEY, event.target.value);
    renderList(root);
  });

  root.querySelectorAll('[data-upload]').forEach((button) => button.addEventListener('click', () => openUploadForm()));
  root.querySelectorAll('[data-new-doc]').forEach((button) => button.addEventListener('click', () => openDocForm()));

  root.querySelectorAll('[data-del-doc]').forEach((button) => {
    button.addEventListener('click', async () => {
      const doc = docById(button.dataset.delDoc);
      const answer = await confirmDialog({
        title: 'Hapus dokumen?',
        message: `"${doc.title}" akan dihapus dari Docs. Tautan hasil misi akan dilepas.`,
        confirmLabel: 'Hapus',
        danger: true,
      });
      if (!answer?.confirmed) return;
      try {
        await apiChange(`/api/docs/${doc.id}`, { method: 'DELETE' }, 'Dokumen dihapus.');
        await renderList(root);
      } catch (error) {
        toast(error.message, 'error');
      }
    });
  });
}

export function openUploadForm() {
  const modal = openModal({
    title: 'Unggah berkas ke Docs',
    sub: 'Berkas disimpan di workspace (maks. 8 MB).',
    body: `<form id="upload_doc_form" novalidate>
      <div class="form-grid">
        ${field({ label: 'Judul dokumen', name: 'title', required: true, attrs: 'maxlength="140" minlength="3" autofocus', placeholder: 'Contoh: Riset pasar Q4' })}
        ${field({ label: 'Kaitkan ke misi (opsional)', name: 'missionId', type: 'select', options: [{ value: '', label: 'Tanpa misi' }, ...state.data.missions.map((m) => ({ value: m.id, label: m.name }))] })}
        <label class="upload-zone" for="doc_file">
          ${icon('upload', 20)}
          <span>Pilih berkas (PDF, DOCX, TXT, MD, CSV, gambar)</span>
          <input id="doc_file" name="file" type="file" accept=".pdf,.doc,.docx,.txt,.md,.csv,.xlsx,.png,.jpg,.jpeg,.webp" />
        </label>
        <div class="field" data-field="file">
          <p class="field__error" role="alert"></p>
        </div>
      </div>
    </form>`,
    foot: `<button class="btn btn--ghost" type="button" data-dialog-close>Batal</button>
      <button class="btn btn--primary" type="submit" form="upload_doc_form" id="upload_doc_save">${icon('upload', 16)} Unggah</button>`,
  });
  const form = modal.dialog.querySelector('#upload_doc_form');
  const button = modal.dialog.querySelector('#upload_doc_save');
  const fileInput = form.querySelector('#doc_file');

  fileInput.addEventListener('change', () => {
    if (fileInput.files?.[0] && !form.title.value) form.title.value = fileInput.files[0].name.replace(/\.[^.]+$/, '');
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    applyFieldErrors(form, {});
    const file = fileInput.files?.[0];
    const values = readForm(form);
    if (!file) {
      applyFieldErrors(form, { file: 'Pilih berkas terlebih dahulu.' });
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      applyFieldErrors(form, { file: 'Berkas melebihi 8 MB. Kompres atau pilih berkas lain.' });
      return;
    }
    if (String(values.title || '').trim().length < 3) {
      applyFieldErrors(form, { title: 'Judul minimal 3 karakter.' });
      return;
    }
    busy(button, true, 'Mengunggah…');
    try {
      const dataBase64 = await readFileAsBase64(file);
      const uploaded = await apiChange('/api/files', {
        body: { name: file.name, mime: file.type || 'application/octet-stream', dataBase64, kind: 'doc' },
      });
      await apiChange(
        '/api/docs',
        {
          body: {
            title: values.title,
            missionId: values.missionId || null,
            type: 'upload',
            fileId: uploaded.file.id,
            content: `Berkas: ${file.name}`,
          },
        },
        'Berkas masuk ke Docs.',
      );
      modal.close();
      await renderList(document.getElementById('view'));
    } catch (error) {
      busy(button, false);
      applyFieldErrors(form, error.fields || {}, error.message);
    }
  });
}

export function openDocForm(doc = null) {
  const editing = Boolean(doc);
  const modal = openModal({
    title: editing ? 'Edit dokumen' : 'Dokumen manual',
    sub: 'Gunakan untuk catatan atau hasil di luar misi.',
    wide: true,
    body: `<form id="doc_form" novalidate><div class="form-grid">
      ${field({ label: 'Judul', name: 'title', value: doc?.title || '', required: true, attrs: 'maxlength="140" minlength="3" autofocus' })}
      ${field({
        label: 'Kaitkan ke misi (opsional)',
        name: 'missionId',
        type: 'select',
        value: doc?.missionId || '',
        options: [{ value: '', label: 'Tanpa misi' }, ...state.data.missions.map((m) => ({ value: m.id, label: m.name }))],
      })}
      ${field({ label: 'Isi dokumen (Markdown sederhana)', name: 'content', type: 'textarea', value: doc?.content || '', attrs: 'maxlength="40000"', rows: 10, hint: 'Mendukung # heading, daftar -/1., **tebal**, `kode`, dan > kutipan.' })}
    </div></form>`,
    foot: `<button class="btn btn--ghost" type="button" data-dialog-close>Batal</button>
      <button class="btn btn--primary" type="submit" form="doc_form" id="doc_save">${editing ? 'Simpan' : 'Simpan dokumen'}</button>`,
  });
  const form = modal.dialog.querySelector('#doc_form');
  const button = modal.dialog.querySelector('#doc_save');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const values = readForm(form);
    if (String(values.title || '').trim().length < 3) {
      applyFieldErrors(form, { title: 'Judul minimal 3 karakter.' });
      return;
    }
    busy(button, true);
    try {
      if (editing) {
        await apiChange(`/api/docs/${doc.id}`, { method: 'PATCH', body: values }, 'Dokumen diperbarui.');
        modal.close();
        await renderDetail(document.getElementById('view'), { id: doc.id });
      } else {
        const result = await apiChange('/api/docs', { body: { ...values, type: 'agent' } }, 'Dokumen dibuat.');
        modal.close();
        location.hash = `#/docs/${result.doc.id}`;
      }
    } catch (error) {
      busy(button, false);
      applyFieldErrors(form, error.fields || {}, error.message);
    }
  });
}

export async function renderDetail(root, params) {
  const doc = docById(params.id);
  if (!doc) {
    root.innerHTML = `<div class="page"><a class="btn btn--ghost btn--sm" href="#/docs" style="justify-self:start">${icon('arrowLeft', 16)} Docs</a>
      ${emptyState({ icon: 'docs', title: 'Dokumen tidak ditemukan', desc: 'Dokumen mungkin sudah dihapus.', action: '<a class="btn btn--secondary btn--sm" href="#/docs">Kembali ke Docs</a>' })}</div>`;
    return;
  }
  const mission = doc.missionId ? missionById(doc.missionId) : null;
  const agent = doc.agentId ? agentById(doc.agentId) : null;
  const file = doc.fileId ? fileById(doc.fileId) : null;
  const type = docType(doc);

  root.innerHTML = `<div class="page">
    <div class="row">
      <a class="btn btn--ghost btn--sm" href="#/docs">${icon('arrowLeft', 16)} Docs</a>
      <span class="spacer"></span>
      ${badge(type.tone, type.label)}
    </div>
    <div class="page-head">
      <div style="min-width:0">
        <h2 class="page-title">${escapeHtml(doc.title)}</h2>
        <p class="page-sub">${escapeHtml(fmtDate(doc.createdAt, true))}${mission ? ` · Misi: ${escapeHtml(mission.name)}` : ''}${agent ? ` · ${escapeHtml(agent.name)}` : ''}</p>
      </div>
      <div class="page-actions">
        ${mission ? `<a class="btn btn--ghost btn--sm" href="#/missions/${mission.id}">${icon('mission', 15)} Buka misi</a>` : ''}
        ${!doc.fileId ? `<button class="btn btn--secondary btn--sm" type="button" data-edit-doc>${icon('edit', 15)} Edit</button>` : ''}
        ${file ? `<a class="btn btn--secondary btn--sm" href="/api/files/${file.id}/download">${icon('download', 15)} Unduh berkas</a>` : ''}
        <button class="btn btn--danger btn--sm" type="button" data-del-doc>${icon('trash', 15)} Hapus</button>
      </div>
    </div>

    <section class="card">
      ${
        file
          ? `<div class="list-item" style="margin-bottom:12px">
              <span style="color:var(--primary)">${icon('file', 20)}</span>
              <div class="list-item__main">
                <p class="list-item__title">${escapeHtml(file.name)}</p>
                <p class="tiny muted">${fmtNumber(file.size)} byte · ${escapeHtml(file.mime)}${file.stored ? '' : ' · contoh data seed, isi berkas tidak tersedia'}</p>
              </div>
              ${file.stored ? `<a class="btn btn--secondary btn--sm" href="/api/files/${file.id}/download">Unduh</a>` : '<span class="tiny muted">Tidak tersedia</span>'}
            </div>`
          : ''
      }
      ${doc.content ? renderMarkdown(doc.content) : '<p class="muted small">Dokumen ini tidak memiliki isi teks.</p>'}
    </section>
  </div>`;

  root.querySelector('[data-edit-doc]')?.addEventListener('click', () => openDocForm(doc));
  root.querySelector('[data-del-doc]').addEventListener('click', async () => {
    const answer = await confirmDialog({
      title: 'Hapus dokumen?',
      message: `"${doc.title}" akan dihapus dari Docs.`,
      confirmLabel: 'Hapus',
      danger: true,
    });
    if (!answer?.confirmed) return;
    try {
      await apiChange(`/api/docs/${doc.id}`, { method: 'DELETE' }, 'Dokumen dihapus.');
      location.hash = '#/docs';
    } catch (error) {
      toast(error.message, 'error');
    }
  });
}
