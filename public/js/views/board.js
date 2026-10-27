import { state, apiChange, agentById, missionById, activeAgents } from '../state.js';
import {
  icon,
  escapeHtml,
  fmtDate,
  avatar,
  priorityBadge,
  taskStatusBadge,
  badge,
  field,
  openModal,
  readForm,
  applyFieldErrors,
  busy,
  confirmDialog,
  toast,
  emptyState,
} from '../ui.js';

const COLUMNS = [
  { key: 'todo', label: 'To do' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'review', label: 'Review' },
  { key: 'done', label: 'Done' },
];

const VIEW_KEY = 'nmc-board-view';
const FILTER_KEY = 'nmc-board-assignee';

export async function render(root) {
  const view = sessionStorage.getItem(VIEW_KEY) || 'kanban';
  const assignee = sessionStorage.getItem(FILTER_KEY) || 'all';
  const tasks = state.data.tasks.filter((t) => t.status !== 'cancelled');
  const visible = tasks.filter((t) => (assignee === 'all' ? true : t.assigneeAgentId === assignee));
  const cancelled = state.data.tasks.filter((t) => t.status === 'cancelled').length;

  root.innerHTML = `<div class="page">
    <div class="page-head">
      <div>
        <h2 class="page-title">Task Board</h2>
        <p class="page-sub">Task dari misi masuk otomatis. Task manual bisa ditambahkan kapan saja.</p>
      </div>
      <div class="page-actions">
        <button class="btn btn--primary" type="button" data-new-task>${icon('plus', 17)} Task manual</button>
      </div>
    </div>

    <section class="card" aria-label="Filter dan tampilan board">
      <div class="row row--between">
        <div class="row" role="group" aria-label="Pilih tampilan">
          <button class="chip ${view === 'kanban' ? 'is-active' : ''}" type="button" data-view="kanban">${icon('board', 15)} Kanban</button>
          <button class="chip ${view === 'list' ? 'is-active' : ''}" type="button" data-view="list">${icon('docs', 15)} List</button>
        </div>
        <div class="row" style="flex:1 1 200px;justify-content:flex-end;min-width:0">
          <label class="sr-only" for="board_assignee">Filter agent</label>
          <select class="select" id="board_assignee" style="width:100%;max-width:260px">
            <option value="all">Semua agent</option>
            ${state.data.agents
              .map((a) => `<option value="${a.id}" ${assignee === a.id ? 'selected' : ''}>${escapeHtml(a.name)} — ${escapeHtml(a.role)}</option>`)
              .join('')}
          </select>
        </div>
      </div>
      <p class="tiny muted" style="margin-top:8px">${visible.length} task ditampilkan${cancelled ? ` · ${cancelled} task dibatalkan disembunyikan` : ''}. Gunakan tombol panah pada kartu untuk memindahkan status (ramah keyboard).</p>
    </section>

    ${
      visible.length
        ? view === 'kanban'
          ? `<div class="kanban">${COLUMNS.map((column) => kanbanColumn(column, visible)).join('')}</div>`
          : listView(visible)
        : emptyState({
            icon: 'board',
            title: 'Belum ada task',
            desc: 'Buat task manual, atau ajukan misi — task akan dibuat otomatis.',
            action: '<button class="btn btn--primary btn--sm" type="button" data-new-task>Tambah task</button>',
          })
    }
  </div>`;

  root.querySelectorAll('[data-view]').forEach((button) => {
    button.addEventListener('click', () => {
      sessionStorage.setItem(VIEW_KEY, button.dataset.view);
      render(root);
    });
  });

  root.querySelector('#board_assignee').addEventListener('change', (event) => {
    sessionStorage.setItem(FILTER_KEY, event.target.value);
    render(root);
  });

  root.querySelectorAll('[data-new-task]').forEach((button) => {
    button.addEventListener('click', () => openTaskForm());
  });

  root.querySelectorAll('[data-open-task]').forEach((button) => {
    button.addEventListener('click', () => openTaskForm(state.data.tasks.find((t) => t.id === button.dataset.openTask)));
  });

  root.querySelectorAll('[data-move]').forEach((button) => {
    button.addEventListener('click', async () => {
      const task = state.data.tasks.find((t) => t.id === button.dataset.id);
      if (!task) return;
      const index = COLUMNS.findIndex((c) => c.key === task.status);
      const next = COLUMNS[index + (button.dataset.move === 'next' ? 1 : -1)];
      if (!next) return;
      button.disabled = true;
      try {
        await apiChange(`/api/tasks/${task.id}`, { method: 'PATCH', body: { status: next.key } });
        toast(`"${task.title}" dipindah ke ${next.label}.`, 'success');
        await render(root);
      } catch (error) {
        toast(error.message, 'error');
        button.disabled = false;
      }
    });
  });
}

function kanbanColumn(column, tasks) {
  const items = tasks
    .filter((t) => t.status === column.key)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  return `<section class="kanban__col" aria-labelledby="col_${column.key}">
    <div class="kanban__head">
      <h3 class="kanban__title" id="col_${column.key}">${escapeHtml(column.label)}</h3>
      <span class="kanban__count">${items.length}</span>
      ${column.key === 'review' ? `<a class="tiny link-tap" href="#/missions" style="margin-left:auto">Approval →</a>` : ''}
    </div>
    ${
      items.length
        ? items.map((task) => taskCard(task)).join('')
        : `<p class="tiny muted" style="padding:10px 4px">${column.key === 'todo' ? 'Tidak ada task menunggu.' : 'Kosong.'}</p>`
    }
  </section>`;
}

function taskCard(task) {
  const agent = agentById(task.assigneeAgentId);
  const mission = task.missionId ? missionById(task.missionId) : null;
  const canPrev = task.status !== 'todo';
  const canNext = task.status !== 'done';
  return `<article class="task-card">
    <div class="row row--between" style="align-items:flex-start">
      <button class="task-card__title" type="button" data-open-task="${task.id}">${escapeHtml(task.title)}</button>
      ${priorityBadge(task.priority)}
    </div>
    ${task.description ? `<p class="task-card__desc">${escapeHtml(task.description)}</p>` : ''}
    <div class="task-card__foot">
      ${agent ? `<span class="row" style="gap:4px">${avatar(agent.name, { size: 'sm', color: agent.color })}<span class="tiny">${escapeHtml(agent.name)}</span></span>` : `<span class="tiny muted">Belum ditugaskan</span>`}
      ${mission ? badge('primary', 'Misi') : badge('neutral', 'Manual')}
    </div>
    <div class="task-card__foot">
      <span class="tiny muted">${escapeHtml(fmtDate(task.updatedAt))}</span>
      <span class="task-card__move">
        <button class="icon-btn icon-btn--bare" type="button" style="width:36px;height:36px" data-move="prev" data-id="${task.id}" ${canPrev ? '' : 'disabled'} aria-label="Pindahkan ${escapeHtml(task.title)} ke status sebelumnya">${icon('chevronLeft', 16)}</button>
        <button class="icon-btn icon-btn--bare" type="button" style="width:36px;height:36px" data-move="next" data-id="${task.id}" ${canNext ? '' : 'disabled'} aria-label="Pindahkan ${escapeHtml(task.title)} ke status berikutnya">${icon('chevronRight', 16)}</button>
      </span>
    </div>
  </article>`;
}

function listView(tasks) {
  const sorted = tasks.slice().sort((a, b) => {
    const order = { todo: 0, in_progress: 1, review: 2, done: 3 };
    return order[a.status] - order[b.status] || new Date(b.updatedAt) - new Date(a.updatedAt);
  });
  return `<section class="card">
    <div class="list">
      ${sorted
        .map((task) => {
          const agent = agentById(task.assigneeAgentId);
          const mission = task.missionId ? missionById(task.missionId) : null;
          return `<div class="list-item">
            <div class="list-item__main">
              <button type="button" data-open-task="${task.id}" class="list-item__title list-item__title--button">${escapeHtml(task.title)}</button>
              <p class="tiny muted" style="margin-top:2px">${mission ? `Misi: ${escapeHtml(mission.name)}` : 'Task manual'}</p>
              <div class="list-item__meta">
                ${taskStatusBadge(task.status)}
                ${priorityBadge(task.priority)}
                <span>${escapeHtml(agent?.name || 'Belum ditugaskan')}</span>
                <span>· ${escapeHtml(fmtDate(task.updatedAt))}</span>
              </div>
            </div>
            <button class="icon-btn icon-btn--bare" type="button" data-open-task="${task.id}" aria-label="Buka task ${escapeHtml(task.title)}">${icon('edit', 17)}</button>
          </div>`;
        })
        .join('')}
    </div>
  </section>`;
}

export function openTaskForm(task = null) {
  const agents = activeAgents();
  const columns = COLUMNS.map((c) => ({ value: c.key, label: c.label }));
  const editing = Boolean(task);
  const body = `<form id="task_form" novalidate>
    <div class="form-grid">
      ${field({ label: 'Judul task', name: 'title', value: task?.title || '', required: true, attrs: 'maxlength="120" minlength="3" autofocus' })}
      ${field({ label: 'Deskripsi', name: 'description', type: 'textarea', value: task?.description || '', attrs: 'maxlength="2000"', rows: 3, hint: 'Konteks singkat agar agent atau Anda tahu langkah berikutnya.' })}
      <div class="form-grid form-grid--2">
        ${field({
          label: 'Priority',
          name: 'priority',
          type: 'select',
          value: task?.priority || 'medium',
          options: [
            { value: 'low', label: 'Rendah' },
            { value: 'medium', label: 'Sedang' },
            { value: 'high', label: 'Tinggi' },
            { value: 'urgent', label: 'Urgent' },
          ],
        })}
        ${field({
          label: 'Assignee',
          name: 'assigneeAgentId',
          type: 'select',
          value: task?.assigneeAgentId || '',
          options: [{ value: '', label: 'Belum ditugaskan' }, ...agents.map((a) => ({ value: a.id, label: `${a.name} — ${a.role}` }))],
        })}
        ${
          editing
            ? field({ label: 'Status', name: 'status', type: 'select', value: task.status, options: columns })
            : field({ label: 'Status awal', name: 'status', type: 'select', value: 'todo', options: columns })
        }
      </div>
      ${task?.missionId ? `<p class="tiny muted">Task ini berasal dari misi <a href="#/missions/${task.missionId}">${escapeHtml(missionById(task.missionId)?.name || '')}</a>.</p>` : ''}
    </div>
  </form>`;

  const modal = openModal({
    title: editing ? 'Detail task' : 'Task manual baru',
    sub: editing ? `Dibuat ${fmtDate(task.createdAt, true)}` : 'Task manual tidak mengubah status misi.',
    body,
    foot: `<button class="btn btn--ghost" type="button" data-dialog-close>Tutup</button>
      ${editing ? `<button class="btn btn--danger" type="button" id="task_delete">${icon('trash', 16)} Hapus</button>` : ''}
      <button class="btn btn--primary" type="submit" form="task_form" id="task_save">${editing ? 'Simpan' : 'Tambah task'}</button>`,
  });

  const form = modal.dialog.querySelector('#task_form');
  const save = modal.dialog.querySelector('#task_save');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    applyFieldErrors(form, {});
    const values = readForm(form);
    const errors = {};
    if (String(values.title || '').trim().length < 3) errors.title = 'Judul minimal 3 karakter.';
    if (String(values.description || '').length > 2000) errors.description = 'Deskripsi maksimal 2000 karakter.';
    if (Object.keys(errors).length) {
      applyFieldErrors(form, errors);
      return;
    }
    values.assigneeAgentId = values.assigneeAgentId || null;
    busy(save, true);
    try {
      if (editing) {
        await apiChange(`/api/tasks/${task.id}`, { method: 'PATCH', body: values }, 'Task diperbarui.');
      } else {
        await apiChange('/api/tasks', { body: values }, 'Task ditambahkan.');
      }
      modal.close();
      await render(document.getElementById('view'));
    } catch (error) {
      busy(save, false);
      applyFieldErrors(form, error.fields || {}, error.message);
    }
  });

  modal.dialog.querySelector('#task_delete')?.addEventListener('click', async () => {
    const answer = await confirmDialog({
      title: 'Hapus task?',
      message: `"${task.title}" akan dihapus permanen. Misi terkait tidak ikut dihapus.`,
      confirmLabel: 'Hapus task',
      danger: true,
    });
    if (!answer?.confirmed) return;
    try {
      await apiChange(`/api/tasks/${task.id}`, { method: 'DELETE' }, 'Task dihapus.');
      modal.close();
      await render(document.getElementById('view'));
    } catch (error) {
      toast(error.message, 'error');
    }
  });
}
