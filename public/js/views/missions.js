import { state, apiChange, missionById, agentById, activeAgents } from '../state.js';
import {
  icon,
  escapeHtml,
  fmtDate,
  relativeTime,
  avatar,
  statusBadge,
  priorityBadge,
  taskStatusBadge,
  emptyState,
  badge,
  field,
  openModal,
  readForm,
  applyFieldErrors,
  busy,
  confirmDialog,
  toast,
} from '../ui.js';

const FILTER_KEY = 'nmc-mission-filter';

const FLOW = ['draft', 'pending_review', 'approved', 'running', 'completed'];

export function openMissionForm(mission = null) {
  const agents = activeAgents();
  if (!agents.length) {
    toast('Belum ada agent aktif. Tambahkan agent dulu di Team Agent.', 'error');
    location.hash = '#/agents';
    return;
  }
  const editing = Boolean(mission);
  const selectedAgent = mission?.agentId || agents[0].id;

  const body = `<form id="mission_form" novalidate>
    <div class="form-grid">
      ${field({
        label: 'Mission name',
        name: 'name',
        value: mission?.name || '',
        placeholder: 'Contoh: Riset persona Kopi Nusantara',
        required: true,
        attrs: 'maxlength="120" minlength="3" autofocus',
        hint: 'Nama ini juga menjadi judul task di Task Board.',
      })}
      ${field({
        label: 'Goals',
        name: 'goals',
        type: 'textarea',
        value: mission?.goals || '',
        placeholder: 'Tulis hasil yang ingin dicapai, batasan, dan format keluaran yang diharapkan.',
        required: true,
        attrs: 'maxlength="2000" minlength="10"',
        rows: 5,
      })}
      <div class="form-grid form-grid--2">
        ${field({
          label: 'Pick agent',
          name: 'agentId',
          type: 'select',
          value: selectedAgent,
          required: true,
          options: agents.map((a) => ({ value: a.id, label: `${a.name} — ${a.role}` })),
          hint: 'Hanya agent berstatus aktif yang bisa dipilih.',
        })}
        ${field({
          label: 'Priority',
          name: 'priority',
          type: 'select',
          value: mission?.priority || 'medium',
          options: [
            { value: 'low', label: 'Rendah' },
            { value: 'medium', label: 'Sedang' },
            { value: 'high', label: 'Tinggi' },
            { value: 'urgent', label: 'Urgent' },
          ],
        })}
        ${field({
          label: 'Time limit (menit)',
          name: 'timeLimitMinutes',
          type: 'number',
          value: String(mission?.timeLimitMinutes || 30),
          required: true,
          attrs: 'min="1" max="1440" inputmode="numeric"',
          hint: '1–1440 menit. Angka ini dibaca agent sebagai batas waktu.',
        })}
        ${field({
          label: 'Max. steps',
          name: 'maxSteps',
          type: 'number',
          value: String(mission?.maxSteps || 6),
          required: true,
          attrs: 'min="1" max="50" inputmode="numeric"',
          hint: '1–50 langkah. Batasi agar hasil tidak melebar.',
        })}
      </div>
      ${field({
        label: 'Notes Review QC',
        name: 'notesQc',
        type: 'textarea',
        value: mission?.notesQc || '',
        placeholder: 'Apa yang wajib diperiksa reviewer? Contoh: sertakan sumber tiap klaim.',
        attrs: 'maxlength="1000"',
        rows: 3,
        hint: 'Opsional, tetapi sangat membantu proses approval.',
      })}
      ${
        editing
          ? ''
          : `<label class="checkline"><input type="checkbox" name="createTask" checked />
              <span>Buat task otomatis di Task Board (To do) <span class="tiny muted">— sesuai alur mission → task.</span></span></label>`
      }
      <div class="banner banner--info">
        ${icon('info', 18)}
        <div class="banner__body"><p class="banner__text">Alur: simpan draf → ajukan review → setujui → luncurkan. Setelah selesai, hasil otomatis masuk ke Docs.</p></div>
      </div>
    </div>
  </form>`;

  const modal = openModal({
    title: editing ? 'Edit misi' : 'Misi baru',
    sub: editing ? 'Perubahan hanya bisa saat misi masih draf/replan.' : 'Misi akan disimpan sebagai draf dan belum mengirim apa pun ke agent.',
    body,
    wide: true,
    foot: `<button class="btn btn--ghost" type="button" data-dialog-close>Batal</button>
      <button class="btn btn--primary" type="submit" form="mission_form" id="mission_save">${editing ? 'Simpan perubahan' : 'Simpan draf misi'}</button>`,
  });

  const form = modal.dialog.querySelector('#mission_form');
  const saveButton = modal.dialog.querySelector('#mission_save');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    applyFieldErrors(form, {});
    const raw = readForm(form);
    const values = {
      name: String(raw.name || '').trim(),
      goals: String(raw.goals || '').trim(),
      agentId: raw.agentId,
      priority: raw.priority,
      timeLimitMinutes: Number(raw.timeLimitMinutes),
      maxSteps: Number(raw.maxSteps),
      notesQc: String(raw.notesQc || '').trim(),
      createTask: raw.createTask === 'on' || raw.createTask === true,
    };
    const errors = {};
    if (values.name.length < 3) errors.name = 'Nama misi minimal 3 karakter.';
    if (values.goals.length < 10) errors.goals = 'Goals minimal 10 karakter agar agent punya konteks.';
    if (!values.agentId) errors.agentId = 'Pilih agent.';
    if (!Number.isFinite(values.timeLimitMinutes) || values.timeLimitMinutes < 1) errors.timeLimitMinutes = 'Time limit minimal 1 menit.';
    if (values.timeLimitMinutes > 1440) errors.timeLimitMinutes = 'Time limit maksimal 1440 menit.';
    if (!Number.isInteger(values.maxSteps) || values.maxSteps < 1) errors.maxSteps = 'Max steps minimal 1.';
    if (values.maxSteps > 50) errors.maxSteps = 'Max steps maksimal 50.';
    if (Object.keys(errors).length) {
      applyFieldErrors(form, errors);
      return;
    }
    busy(saveButton, true, 'Menyimpan…');
    try {
      const result = editing
        ? await apiChange(`/api/missions/${mission.id}`, { method: 'PATCH', body: values }, 'Misi diperbarui.')
        : await apiChange('/api/missions', { body: values }, 'Draf misi dibuat.');
      modal.close();
      if (!editing) {
        location.hash = `#/missions/${result.mission.id}`;
      } else {
        await renderDetail(document.getElementById('view'), { id: mission.id });
      }
    } catch (error) {
      busy(saveButton, false);
      applyFieldErrors(form, error.fields || {}, error.message);
    }
  });
}

export async function renderList(root) {
  const missions = state.data.missions.slice().sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  const counts = missions.reduce((acc, m) => {
    acc[m.status] = (acc[m.status] || 0) + 1;
    return acc;
  }, {});
  const filter = sessionStorage.getItem(FILTER_KEY) || 'all';
  const query = (sessionStorage.getItem(`${FILTER_KEY}-q`) || '').toLowerCase();

  const filtered = missions.filter((mission) => {
    const matchStatus = filter === 'all' ? true : filter === 'attention' ? ['pending_review', 'rejected', 'replan'].includes(mission.status) : mission.status === filter;
    const matchQuery =
      !query ||
      mission.name.toLowerCase().includes(query) ||
      mission.goals.toLowerCase().includes(query) ||
      (agentById(mission.agentId)?.name || '').toLowerCase().includes(query);
    return matchStatus && matchQuery;
  });

  root.innerHTML = `<div class="page">
    <div class="page-head">
      <div>
        <h2 class="page-title">Missions</h2>
        <p class="page-sub">Ajukan, review, dan luncurkan pekerjaan agent. ${missions.length} misi total.</p>
      </div>
      <div class="page-actions">
        <button class="btn btn--primary" type="button" data-new-mission>${icon('plus', 17)} Misi baru</button>
      </div>
    </div>

    <section class="card" aria-label="Filter misi">
      <div class="stack">
        <div style="position:relative">
          <span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--text-muted)">${icon('search', 18)}</span>
          <input class="input" id="mission_search" type="search" placeholder="Cari misi, goals, atau agent…" value="${escapeHtml(sessionStorage.getItem(`${FILTER_KEY}-q`) || '')}" style="padding-left:40px" aria-label="Cari misi" />
        </div>
        <div class="row" role="group" aria-label="Filter status misi">
          <button class="chip ${filter === 'all' ? 'is-active' : ''}" type="button" data-filter="all">Semua (${missions.length})</button>
          <button class="chip ${filter === 'attention' ? 'is-active' : ''}" type="button" data-filter="attention">Perlu tindakan (${(counts.pending_review || 0) + (counts.rejected || 0) + (counts.replan || 0)})</button>
          ${FLOW.map(
            (status) =>
              `<button class="chip ${filter === status ? 'is-active' : ''}" type="button" data-filter="${status}">${escapeHtml(
                { draft: 'Draf', pending_review: 'Menunggu review', approved: 'Disetujui', running: 'Berjalan', completed: 'Selesai' }[status],
              )} (${counts[status] || 0})</button>`,
          ).join('')}
        </div>
      </div>
    </section>

    ${
      filtered.length
        ? `<div class="grid grid--2">${filtered.map((mission) => missionCard(mission)).join('')}</div>`
        : emptyState({
            icon: 'mission',
            title: query || filter !== 'all' ? 'Tidak ada misi yang cocok' : 'Belum ada misi',
            desc: query || filter !== 'all'
              ? 'Ubah kata kunci atau pilih filter "Semua" untuk melihat misi lain.'
              : 'Misi adalah unit kerja untuk agent: tentukan goals, agent, prioritas, batas waktu, dan langkah.',
            action: '<button class="btn btn--primary btn--sm" type="button" data-new-mission>Buat misi pertama</button>',
          })
    }
  </div>`;

  const search = root.querySelector('#mission_search');
  let timer = null;
  search.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      sessionStorage.setItem(`${FILTER_KEY}-q`, search.value);
      renderList(root).then(() => {
        const next = root.querySelector('#mission_search');
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

  root.querySelectorAll('[data-new-mission]').forEach((button) => {
    button.addEventListener('click', () => openMissionForm());
  });

  root.querySelectorAll('[data-open-mission]').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      location.hash = `#/missions/${link.dataset.openMission}`;
    });
  });

  root.querySelectorAll('[data-quick]').forEach((button) => {
    button.addEventListener('click', async () => {
      const mission = missionById(button.dataset.id);
      const action = button.dataset.quick;
      if (!mission) return;
      let note = '';
      if (['reject', 'replan', 'cancel'].includes(action)) {
        const answer = await confirmDialog({
          title: action === 'reject' ? 'Tolak misi?' : action === 'replan' ? 'Kembalikan ke draf?' : 'Batalkan misi?',
          message:
            action === 'reject'
              ? 'Misi ditolak dan kembali ke draf. Agent tidak akan dijalankan.'
              : action === 'replan'
                ? 'Misi kembali ke draf supaya Anda bisa mengubah goals, agent, atau batasannya.'
                : 'Misi dibatalkan. Task terkait ikut dibatalkan.',
          confirmLabel: action === 'reject' ? 'Tolak' : action === 'replan' ? 'Replan' : 'Batalkan misi',
          danger: action !== 'replan',
          note: { label: 'Alasan (dibaca di timeline)', placeholder: 'Contoh: goals kurang spesifik', required: false },
        });
        if (!answer?.confirmed) return;
        note = answer.note;
      }
      button.disabled = true;
      try {
        await apiChange(`/api/missions/${mission.id}/action`, { body: { action, note } }, 'Status misi diperbarui.');
        await renderList(root);
      } catch (error) {
        toast(error.message, 'error');
        button.disabled = false;
      }
    });
  });
}

function missionCard(mission) {
  const agent = agentById(mission.agentId);
  const task = state.data.tasks.find((t) => t.missionId === mission.id);
  const quick = {
    draft: `<button class="btn btn--primary btn--sm" type="button" data-quick="submit" data-id="${mission.id}">Ajukan review</button>`,
    rejected: `<button class="btn btn--primary btn--sm" type="button" data-quick="replan" data-id="${mission.id}">Replan</button>`,
    replan: `<button class="btn btn--primary btn--sm" type="button" data-quick="submit" data-id="${mission.id}">Ajukan review</button>`,
    pending_review: `<button class="btn btn--primary btn--sm" type="button" data-quick="approve" data-id="${mission.id}">Setujui</button>
      <button class="btn btn--ghost btn--sm" type="button" data-quick="reject" data-id="${mission.id}">Tolak</button>`,
    approved: `<button class="btn btn--primary btn--sm" type="button" data-quick="launch" data-id="${mission.id}">${icon('play', 14)} Luncurkan</button>`,
    running: `<button class="btn btn--primary btn--sm" type="button" data-quick="complete" data-id="${mission.id}">Tandai selesai</button>`,
    completed: mission.resultDocId
      ? `<a class="btn btn--secondary btn--sm" href="#/docs/${mission.resultDocId}">${icon('docs', 14)} Buka hasil</a>`
      : '',
    cancelled: `<button class="btn btn--ghost btn--sm" type="button" data-quick="replan" data-id="${mission.id}">Replan</button>`,
  }[mission.status] || '';

  return `<article class="card" style="display:grid;gap:10px">
    <div class="row row--between" style="align-items:flex-start">
      <div style="min-width:0">
        <p class="tiny muted">${escapeHtml(mission.id.toUpperCase())}</p>
        <h3 style="font-size:1rem;line-height:1.3">${escapeHtml(mission.name)}</h3>
      </div>
      ${statusBadge(mission.status)}
    </div>
    <p class="small soft" style="display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden">${escapeHtml(mission.goals)}</p>
    <div class="row">
      ${agent ? `<span class="row" style="gap:5px">${avatar(agent.name, { size: 'sm', color: agent.color })}<span class="small">${escapeHtml(agent.name)}</span></span>` : badge('danger', 'Agent terhapus')}
      ${priorityBadge(mission.priority)}
      ${badge('neutral', `${mission.timeLimitMinutes} menit`)}
      ${badge('neutral', `${mission.maxSteps} langkah`)}
    </div>
    ${task ? `<p class="tiny muted">Task: ${taskStatusBadge(task.status)}</p>` : ''}
    <div class="row row--between" style="margin-top:2px">
      <span class="tiny muted">Diperbarui ${escapeHtml(relativeTime(mission.updatedAt))}</span>
      <div class="row" style="gap:6px">
        <button class="btn btn--ghost btn--sm" type="button" data-open-mission="${mission.id}">Detail</button>
        ${quick}
      </div>
    </div>
  </article>`;
}

export async function renderDetail(root, params) {
  const mission = missionById(params.id);
  if (!mission) {
    root.innerHTML = `<div class="page">
      <a class="btn btn--ghost btn--sm" href="#/missions" style="justify-self:start">${icon('arrowLeft', 16)} Semua misi</a>
      ${emptyState({ icon: 'mission', title: 'Misi tidak ditemukan', desc: 'Misi mungkin sudah dihapus atau tautannya salah.', action: '<a class="btn btn--secondary btn--sm" href="#/missions">Kembali ke daftar misi</a>' })}
    </div>`;
    return;
  }
  const agent = agentById(mission.agentId);
  const task = state.data.tasks.find((t) => t.missionId === mission.id);
  const doc = mission.resultDocId ? state.data.docs.find((d) => d.id === mission.resultDocId) : null;
  const editable = ['draft', 'replan', 'rejected'].includes(mission.status);

  const actions = [];
  if (editable) {
    actions.push(`<a class="btn btn--primary" href="#/missions/${mission.id}" data-edit>${icon('edit', 16)} Edit misi</a>`);
    actions.push(`<button class="btn btn--secondary" type="button" data-action="submit">Ajukan review</button>`);
    if (mission.status !== 'draft') actions.push(`<span class="tiny muted">Perbaiki isi lalu ajukan lagi.</span>`);
  }
  if (mission.status === 'pending_review') {
    actions.push(`<button class="btn btn--primary" type="button" data-action="approve">${icon('check', 16)} Setujui</button>`);
    actions.push(`<button class="btn btn--ghost" type="button" data-action="reject">Tolak</button>`);
  }
  if (mission.status === 'approved') {
    actions.push(`<button class="btn btn--primary" type="button" data-action="launch">${icon('play', 15)} Luncurkan misi</button>`);
  }
  if (mission.status === 'running') {
    actions.push(`<button class="btn btn--primary" type="button" data-action="complete">Tandai selesai</button>`);
  }
  if (mission.status === 'completed') {
    if (doc) actions.push(`<a class="btn btn--primary" href="#/docs/${doc.id}">${icon('docs', 16)} Open result in Docs</a>`);
  }
  if (['pending_review', 'approved', 'running', 'rejected', 'replan'].includes(mission.status)) {
    actions.push(`<button class="btn btn--ghost" type="button" data-action="replan">Replan</button>`);
  }
  if (!['completed', 'cancelled'].includes(mission.status)) {
    actions.push(`<button class="btn btn--danger" type="button" data-action="cancel">Batalkan</button>`);
  }
  if (mission.status === 'cancelled') {
    actions.push(`<button class="btn btn--ghost" type="button" data-action="replan">Aktifkan lagi sebagai draf</button>`);
  }

  root.innerHTML = `<div class="page">
    <div class="row">
      <a class="btn btn--ghost btn--sm" href="#/missions">${icon('arrowLeft', 16)} Semua misi</a>
      <span class="spacer"></span>
      ${statusBadge(mission.status)}
    </div>

    <div class="page-head">
      <div style="min-width:0">
        <h2 class="page-title">${escapeHtml(mission.name)}</h2>
        <p class="page-sub">Dibuat ${escapeHtml(fmtDate(mission.createdAt, true))} · diperbarui ${escapeHtml(relativeTime(mission.updatedAt))}</p>
      </div>
      <div class="page-actions">${actions.join('')}</div>
    </div>

    ${
      mission.launch?.mode === 'local'
        ? `<div class="banner banner--warn" role="note">${icon('alert', 18)}<div class="banner__body">
            <p class="banner__title">Dijalankan pada simulator lokal</p>
            <p class="banner__text">${escapeHtml(mission.launch.note || 'Hermes belum terhubung.')} Hasil tersimpan sebagai contoh alur, bukan keluaran model produksi.</p>
          </div></div>`
        : ''
    }

    <div class="grid grid--2">
      <section class="card">
        <h3 class="card__title" style="margin-bottom:10px">Ringkasan</h3>
        <div class="stack stack--sm">
          <div class="stat-row"><span class="muted">Agent</span><span class="stat-row__value row" style="gap:6px">${agent ? `${avatar(agent.name, { size: 'sm', color: agent.color })} ${escapeHtml(agent.name)}` : '—'}</span></div>
          <div class="stat-row"><span class="muted">Role</span><span class="stat-row__value">${escapeHtml(agent?.role || '—')}</span></div>
          <div class="stat-row"><span class="muted">Priority</span><span class="stat-row__value">${priorityBadge(mission.priority)}</span></div>
          <div class="stat-row"><span class="muted">Time limit</span><span class="stat-row__value">${mission.timeLimitMinutes} menit</span></div>
          <div class="stat-row"><span class="muted">Max. steps</span><span class="stat-row__value">${mission.maxSteps} langkah</span></div>
          <div class="stat-row"><span class="muted">Token terpakai</span><span class="stat-row__value">${mission.tokens ? mission.tokens.toLocaleString('id-ID') : '0'}</span></div>
          <div class="stat-row"><span class="muted">Mode eksekusi</span><span class="stat-row__value">${escapeHtml(mission.launch?.mode === 'hermes' ? 'Hermes' : mission.launch?.mode === 'local' ? 'Simulator lokal' : 'Belum diluncurkan')}</span></div>
        </div>
      </section>

      <section class="card">
        <h3 class="card__title" style="margin-bottom:8px">Goals</h3>
        <p class="small soft" style="white-space:pre-wrap">${escapeHtml(mission.goals)}</p>
        <hr class="divider" />
        <h3 class="card__title" style="margin-bottom:8px">Notes Review QC</h3>
        ${
          mission.notesQc
            ? `<p class="small soft" style="white-space:pre-wrap">${escapeHtml(mission.notesQc)}</p>`
            : `<p class="small muted">Tidak ada catatan QC. Tambahkan lewat Edit misi agar reviewer tahu apa yang harus diperiksa.</p>`
        }
        ${
          mission.replanNote
            ? `<div class="banner banner--warn" style="margin-top:10px">${icon('refresh', 16)}<div class="banner__body"><p class="banner__title">Catatan replan</p><p class="banner__text">${escapeHtml(mission.replanNote)}</p></div></div>`
            : ''
        }
      </section>
    </div>

    <div class="grid grid--2">
      <section class="card">
        <div class="card__head">
          <h3 class="card__title">Task terkait</h3>
          <a class="btn btn--ghost btn--sm" href="#/board">Board</a>
        </div>
        ${
          task
            ? `<div class="list-item">
                <div class="list-item__main">
                  <p class="list-item__title">${escapeHtml(task.title)}</p>
                  <div class="list-item__meta">${taskStatusBadge(task.status)} ${priorityBadge(task.priority)} <span>Sumber: ${escapeHtml(task.source === 'mission' ? 'misi (otomatis)' : 'manual')}</span></div>
                </div>
              </div>`
            : `<p class="small muted">Misi ini tidak memiliki task terkait (dibuat tanpa task otomatis). Task manual bisa ditambahkan di Board.</p>`
        }
        ${
          doc
            ? `<hr class="divider" />
              <p class="section-title" style="margin-bottom:6px">Dokumen hasil</p>
              <a class="list-item" href="#/docs/${doc.id}" style="text-decoration:none;color:inherit">
                <span class="row" style="gap:8px;width:100%">
                  ${icon('docs', 18)}
                  <span style="min-width:0;flex:1">
                    <span class="list-item__title truncate" style="display:block">${escapeHtml(doc.title)}</span>
                    <span class="tiny muted">${escapeHtml(fmtDate(doc.createdAt))} · ${escapeHtml(agentById(doc.agentId)?.name || 'Upload')}</span>
                  </span>
                  ${icon('chevronRight', 16)}
                </span>
              </a>`
            : ''
        }
      </section>

      <section class="card">
        <h3 class="card__title" style="margin-bottom:10px">Timeline</h3>
        <ol class="timeline">
          ${(mission.timeline || [])
            .slice()
            .reverse()
            .map(
              (entry) => `<li class="timeline__item">
                <p style="font-weight:600">${escapeHtml(entry.label)}</p>
                <p class="tiny muted">${escapeHtml(entry.by || 'Sistem')} · ${escapeHtml(fmtDate(entry.at, true))}</p>
              </li>`,
            )
            .join('')}
        </ol>
      </section>
    </div>
  </div>`;

  root.querySelector('[data-edit]')?.addEventListener('click', (event) => {
    event.preventDefault();
    openMissionForm(mission);
  });

  root.querySelectorAll('[data-action]').forEach((button) => {
    button.addEventListener('click', () => runAction(button, mission.id, root));
  });
}

async function runAction(button, missionId, root) {
  const action = button.dataset.action;
  const mission = missionById(missionId);
  if (!mission) return;
  let note = '';
  const confirmations = {
    submit: {
      title: 'Ajukan misi untuk review?',
      message: 'Misi akan masuk ke Needs Approval dan task terkait dipindah ke kolom Review.',
      confirmLabel: 'Ajukan review',
    },
    approve: {
      title: 'Setujui misi ini?',
      message: `Misi "${mission.name}" akan disetujui dan siap diluncurkan ke ${agentById(mission.agentId)?.name || 'agent'}.`,
      confirmLabel: 'Setujui misi',
    },
    launch: {
      title: 'Luncurkan misi sekarang?',
      message: 'Misi dikirim ke Hermes bila aktif, atau dijalankan pada simulator lokal. Status berubah menjadi Berjalan.',
      confirmLabel: 'Luncurkan',
    },
    complete: {
      title: 'Tandai misi selesai?',
      message: 'Dokumen hasil akan dibuat otomatis di Docs dan task terkait dipindah ke Done.',
      confirmLabel: 'Selesaikan misi',
    },
    reject: {
      title: 'Tolak pengajuan misi?',
      message: 'Misi akan ditandai ditolak dan tidak diluncurkan.',
      confirmLabel: 'Tolak misi',
      danger: true,
      noteRequired: true,
    },
    replan: {
      title: 'Kembalikan misi ke draf?',
      message: 'Isi misi bisa diedit lagi setelah dikembalikan ke draf.',
      confirmLabel: 'Kembalikan ke draf',
    },
    cancel: {
      title: 'Batalkan misi ini?',
      message: 'Task terkait akan dibatalkan. Tindakan ini tercatat di timeline.',
      confirmLabel: 'Batalkan misi',
      danger: true,
      noteRequired: true,
    },
  };

  const config = confirmations[action];
  if (config) {
    const answer = await confirmDialog({
      title: config.title,
      message: config.message,
      confirmLabel: config.confirmLabel,
      danger: Boolean(config.danger),
      note: config.noteRequired
        ? { label: 'Alasan / catatan', placeholder: 'Contoh: data referensi belum lengkap', required: true }
        : null,
    });
    if (!answer?.confirmed) return;
    note = answer.note || '';
  }
  busy(button, true, action === 'launch' ? 'Mengirim…' : 'Memproses…');
  try {
    const result = await apiChange(`/api/missions/${mission.id}/action`, { body: { action, note } });
    toast(
      action === 'launch'
        ? result.mission.launch?.mode === 'hermes'
          ? 'Misi dikirim ke Hermes.'
          : 'Misi diluncurkan pada simulator lokal.'
        : action === 'complete'
          ? 'Misi selesai. Hasil tersedia di Docs.'
          : 'Status misi diperbarui.',
      'success',
    );
    await renderDetail(root, { id: mission.id });
  } catch (error) {
    busy(button, false);
    toast(error.message, 'error');
  }
}
