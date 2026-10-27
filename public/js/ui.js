/* Helpers UI: ikon, format, dialog, toast, form, markdown. */

const ICONS = {
  dashboard:
    '<rect x="3" y="3" width="7" height="8" rx="1.6"/><rect x="14" y="3" width="7" height="5" rx="1.6"/><rect x="14" y="12" width="7" height="9" rx="1.6"/><rect x="3" y="15" width="7" height="6" rx="1.6"/>',
  brand:
    '<circle cx="12" cy="12" r="9"/><circle cx="8.5" cy="10" r="1.1" fill="currentColor" stroke="none"/><circle cx="11" cy="7.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="15" cy="8" r="1.1" fill="currentColor" stroke="none"/><path d="M12 21a3 3 0 0 1 0-6h1.5a2 2 0 0 0 0-4H12"/>',
  mission:
    '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/>',
  board:
    '<rect x="3" y="4" width="18" height="16" rx="2.4"/><path d="M9 4v16M15 4v16"/>',
  docs:
    '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
  agents:
    '<path d="M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20"/><circle cx="10" cy="8" r="3.4"/><path d="M17 4.2a3.4 3.4 0 0 1 0 6.6M20 20v-1.4a3.6 3.6 0 0 0-2.4-3.3"/>',
  chat:
    '<path d="M20 15.5a2.5 2.5 0 0 1-2.5 2.5H8l-4 3V6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5Z"/><path d="M8 9h8M8 13h5"/>',
  workspace:
    '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2.5h7.5A2.5 2.5 0 0 1 21 10v7a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17Z"/>',
  automation:
    '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  integration:
    '<path d="M9 7V4M15 7V4M7 7h10v5a5 5 0 0 1-10 0Z"/><path d="M12 17v3"/>',
  productivity:
    '<path d="M12 21a8 8 0 1 0-8-8"/><path d="M12 12l3.5-2.5"/><path d="M4 9V4h5"/>',
  mail:
    '<rect x="3" y="5" width="18" height="14" rx="2.4"/><path d="m3.5 7 8.5 6 8.5-6"/>',
  settings:
    '<circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.56V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.66 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06A2 2 0 1 1 7.09 4.2l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.56V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9v.06a1.7 1.7 0 0 0 1.56 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m16.5 16.5 4 4"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7"/>',
  chevronRight: '<path d="m9 5 7 7-7 7"/>',
  chevronLeft: '<path d="m15 5-7 7 7 7"/>',
  arrowRight: '<path d="M4 12h16M14 6l6 6-6 6"/>',
  arrowLeft: '<path d="M20 12H4M10 18l-6-6 6-6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 15v3a2.5 2.5 0 0 0 2.5 2.5h11A2.5 2.5 0 0 0 20 18v-3"/>',
  download: '<path d="M12 4v12M7 11l5 5 5-5"/><path d="M4 15v3a2.5 2.5 0 0 0 2.5 2.5h11A2.5 2.5 0 0 0 20 18v-3"/>',
  trash: '<path d="M4 7h16M9 7V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v2M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12"/>',
  play: '<path d="M7 4.5 19 12 7 19.5Z"/>',
  send: '<path d="M21 3 10.5 13.5M21 3l-6.5 18-4-8-8-4Z"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
  alert: '<path d="M12 3 2.5 20h19Z"/><path d="M12 9v5M12 17h.01"/>',
  sparkles: '<path d="m12 3 1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8Z"/><path d="M18.5 15.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9Z"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3.2 1.9"/>',
  link: '<path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5Z"/><path d="m3 13 9 5 9-5"/><path d="m3 17 9 5 9-5"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l2 2M14 9l2 2"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
};

export function icon(name, size = 18, cls = '') {
  const path = ICONS[name] || ICONS.info;
  return `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

const numberFormat = new Intl.NumberFormat('id-ID');
const compactFormat = new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 });

export function fmtNumber(value) {
  return numberFormat.format(Number(value) || 0);
}

export function fmtCompact(value) {
  return compactFormat.format(Number(value) || 0);
}

export function fmtDate(iso, withTime = false) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(date);
}

export function fmtDayShort(dateKey) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(date);
}

export function relativeTime(iso) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const minute = 60_000;
  if (diff < minute) return 'baru saja';
  if (diff < 60 * minute) return `${Math.floor(diff / minute)} menit lalu`;
  if (diff < 24 * 60 * minute) return `${Math.floor(diff / (60 * minute))} jam lalu`;
  const days = Math.floor(diff / (24 * 60 * minute));
  if (days < 30) return `${days} hari lalu`;
  return fmtDate(iso);
}

export const MISSION_STATUS = {
  draft: { label: 'Draf', tone: 'neutral' },
  pending_review: { label: 'Menunggu review', tone: 'warning' },
  approved: { label: 'Disetujui', tone: 'primary' },
  running: { label: 'Berjalan', tone: 'primary' },
  completed: { label: 'Selesai', tone: 'success' },
  cancelled: { label: 'Dibatalkan', tone: 'neutral' },
  rejected: { label: 'Ditolak', tone: 'danger' },
  replan: { label: 'Perlu replan', tone: 'warning' },
};

export const TASK_STATUS = {
  todo: { label: 'To do', tone: 'neutral' },
  in_progress: { label: 'In progress', tone: 'primary' },
  review: { label: 'Review', tone: 'warning' },
  done: { label: 'Done', tone: 'success' },
  cancelled: { label: 'Dibatalkan', tone: 'neutral' },
};

export const PRIORITY = {
  low: { label: 'Rendah', tone: 'neutral' },
  medium: { label: 'Sedang', tone: 'primary' },
  high: { label: 'Tinggi', tone: 'warning' },
  urgent: { label: 'Urgent', tone: 'danger' },
};

export function badge(tone, label, { dot = false } = {}) {
  return `<span class="badge badge--${tone}">${dot ? '<span class="badge__dot"></span>' : ''}${escapeHtml(label)}</span>`;
}

export function statusBadge(status) {
  const meta = MISSION_STATUS[status] || { label: status, tone: 'neutral' };
  return badge(meta.tone, meta.label, { dot: true });
}

export function taskStatusBadge(status) {
  const meta = TASK_STATUS[status] || { label: status, tone: 'neutral' };
  return badge(meta.tone, meta.label);
}

export function priorityBadge(priority) {
  const meta = PRIORITY[priority] || PRIORITY.medium;
  return badge(meta.tone, meta.label);
}

export function initials(name) {
  const parts = String(name || '?').trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() || '').join('') || '?';
}

const AVATAR_COLORS = ['#1F5FE0', '#5B9BF8', '#8A6CF6', '#E4739B', '#2E9E8F', '#E39A3B'];
export function avatarColor(name = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) % 997;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export function avatar(name, { size = '', color = '', photo = null } = {}) {
  const cls = `avatar${size ? ` avatar--${size}` : ''}`;
  const bg = color || avatarColor(name);
  if (photo) {
    return `<span class="${cls}" style="background:${escapeAttr(bg)}"><img src="${escapeAttr(photo)}" alt="" /></span>`;
  }
  return `<span class="${cls}" style="background:${escapeAttr(bg)}" aria-hidden="true">${escapeHtml(initials(name))}</span>`;
}

export function emptyState({ icon: iconName = 'info', title, desc = '', action = '' }) {
  return `<div class="empty">
    <span class="empty__icon">${icon(iconName, 22)}</span>
    <p class="empty__title">${escapeHtml(title)}</p>
    ${desc ? `<p class="empty__desc">${escapeHtml(desc)}</p>` : ''}
    ${action}
  </div>`;
}

export function skeletonBlock(height = 14, width = '100%') {
  return `<div class="skeleton" style="height:${height}px;width:${width}"></div>`;
}

export function field({
  label,
  name,
  type = 'text',
  value = '',
  placeholder = '',
  hint = '',
  required = false,
  attrs = '',
  options = null,
  rows = 4,
  className = '',
}) {
  const id = `f_${name.replace(/[^\w-]/g, '_')}`;
  const common = `id="${id}" name="${escapeAttr(name)}" ${required ? 'required' : ''} ${attrs}`;
  let control;
  if (type === 'textarea') {
    control = `<textarea class="textarea ${className}" ${common} rows="${rows}" placeholder="${escapeAttr(placeholder)}">${escapeHtml(value)}</textarea>`;
  } else if (type === 'select') {
    const opts = (options || [])
      .map(
        (opt) =>
          `<option value="${escapeAttr(opt.value)}" ${String(opt.value) === String(value) ? 'selected' : ''}>${escapeHtml(opt.label)}</option>`,
      )
      .join('');
    control = `<select class="select ${className}" ${common}>${opts}</select>`;
  } else if (type === 'color') {
    control = `<input class="color-input" type="color" ${common} value="${escapeAttr(value || '#1F5FE0')}" />`;
  } else {
    control = `<input class="input ${className}" type="${type}" ${common} value="${escapeAttr(value)}" placeholder="${escapeAttr(placeholder)}" />`;
  }
  return `<div class="field" data-field="${escapeAttr(name)}">
    <label class="field__label" for="${id}">${escapeHtml(label)}${required ? '<span class="req" aria-hidden="true">*</span>' : ''}</label>
    ${control}
    ${hint ? `<p class="field__hint">${escapeHtml(hint)}</p>` : ''}
    <p class="field__error" id="${id}_err" role="alert"></p>
  </div>`;
}

export function textareaField(name, label, value = '', opts = {}) {
  return field({ ...opts, name, label, value, type: 'textarea' });
}

export function readForm(form) {
  const out = {};
  const fd = new FormData(form);
  for (const key of new Set(fd.keys())) {
    const values = fd.getAll(key);
    out[key] = values.length > 1 ? values : values[0];
  }
  form.querySelectorAll('input[type="checkbox"][name]').forEach((cb) => {
    if (!(cb.name in out)) {
      if (cb.dataset.array === 'true') out[cb.name] = out[cb.name] || [];
      else out[cb.name] = false;
    } else if (cb.value === 'on') {
      out[cb.name] = true;
    }
  });
  return out;
}

export function clearFieldErrors(form) {
  form.querySelectorAll('.field__error').forEach((node) => {
    node.textContent = '';
    node.classList.remove('is-visible');
  });
  form.querySelectorAll('[aria-invalid="true"]').forEach((node) => node.removeAttribute('aria-invalid'));
  const banner = form.querySelector('.form-error');
  if (banner) banner.remove();
}

export function applyFieldErrors(form, errors = {}, message = '') {
  clearFieldErrors(form);
  const keys = Object.keys(errors || {});
  let firstInvalid = null;
  keys.forEach((key) => {
    const wrapper = form.querySelector(`[data-field="${CSS.escape(key)}"]`);
    if (!wrapper) return;
    const control = wrapper.querySelector('input, select, textarea');
    const error = wrapper.querySelector('.field__error');
    if (error) {
      error.textContent = errors[key];
      error.classList.add('is-visible');
    }
    if (control) {
      control.setAttribute('aria-invalid', 'true');
      if (error?.id) control.setAttribute('aria-describedby', error.id);
      if (!firstInvalid) firstInvalid = control;
    }
  });
  if (keys.length === 0 && message) {
    const banner = document.createElement('div');
    banner.className = 'banner banner--danger form-error';
    banner.setAttribute('role', 'alert');
    banner.innerHTML = `<span>${icon('alert', 18)}</span><div class="banner__body"><p class="banner__text">${escapeHtml(message)}</p></div>`;
    form.prepend(banner);
  }
  firstInvalid?.focus();
}

export function busy(button, isBusy, label = 'Menyimpan…') {
  if (!button) return;
  if (isBusy) {
    button.dataset.original = button.innerHTML;
    button.innerHTML = `<span class="spinner" aria-hidden="true"></span> ${escapeHtml(label)}`;
    button.disabled = true;
    button.classList.add('is-busy');
  } else {
    if (button.dataset.original) button.innerHTML = button.dataset.original;
    delete button.dataset.original;
    button.disabled = false;
    button.classList.remove('is-busy');
  }
}

/* ------------------------------------------------------------------ dialog */

let lastFocused = null;

export function openModal({ title, sub = '', body = '', foot = '', wide = false, onClose = null }) {
  const root = document.getElementById('modal-root');
  lastFocused = document.activeElement;
  const backdrop = document.createElement('div');
  backdrop.className = 'dialog-backdrop';
  backdrop.innerHTML = `<div class="dialog ${wide ? 'dialog--wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="dlg_title">
    <div class="dialog__head">
      <div style="min-width:0;flex:1">
        <h2 class="dialog__title" id="dlg_title">${escapeHtml(title)}</h2>
        ${sub ? `<p class="dialog__sub">${escapeHtml(sub)}</p>` : ''}
      </div>
      <button class="icon-btn icon-btn--bare" type="button" data-dialog-close aria-label="Tutup dialog">${icon('close', 20)}</button>
    </div>
    <div class="dialog__body">${body}</div>
    ${foot ? `<div class="dialog__foot">${foot}</div>` : ''}
  </div>`;
  root.appendChild(backdrop);
  document.body.style.overflow = 'hidden';

  const dialog = backdrop.querySelector('.dialog');

  function close() {
    document.removeEventListener('keydown', onKey);
    backdrop.remove();
    document.body.style.overflow = '';
    if (lastFocused?.focus) lastFocused.focus();
    onClose?.();
  }

  function onKey(event) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      close();
    }
    if (event.key === 'Tab') {
      const focusables = dialog.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) close();
    if (event.target.closest('[data-dialog-close]')) close();
  });
  document.addEventListener('keydown', onKey);

  requestAnimationFrame(() => {
    const target =
      dialog.querySelector('[autofocus]') ||
      dialog.querySelector('input:not([type="hidden"]), textarea, select') ||
      dialog.querySelector('button');
    target?.focus();
  });

  return { close, dialog, body: dialog.querySelector('.dialog__body') };
}

export function confirmDialog({
  title,
  message,
  confirmLabel = 'Lanjutkan',
  cancelLabel = 'Batal',
  danger = false,
  note = null,
}) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
      modal.close();
    };
    const modal = openModal({
      title,
      body: `<p class="soft">${escapeHtml(message)}</p>
        ${note ? `<div class="field" data-field="note" style="margin-top:12px">
          <label class="field__label" for="dlg_note">${escapeHtml(note.label || 'Catatan')}</label>
          <textarea class="textarea" id="dlg_note" rows="3" placeholder="${escapeAttr(note.placeholder || '')}"></textarea>
          <p class="field__error" role="alert"></p>
        </div>` : ''}`,
      foot: `<button class="btn btn--ghost" type="button" data-dialog-close>${escapeHtml(cancelLabel)}</button>
        <button class="btn ${danger ? 'btn--danger' : 'btn--primary'}" type="button" data-confirm>${escapeHtml(confirmLabel)}</button>`,
      onClose: () => {
        if (!settled) {
          settled = true;
          resolve(null);
        }
      },
    });
    modal.dialog.querySelector('[data-confirm]').addEventListener('click', () => {
      const textarea = modal.dialog.querySelector('#dlg_note');
      if (note?.required && textarea && textarea.value.trim().length < 3) {
        const error = textarea.parentElement.querySelector('.field__error');
        error.textContent = 'Tulis alasan minimal 3 karakter agar tim tahu konteksnya.';
        error.classList.add('is-visible');
        textarea.setAttribute('aria-invalid', 'true');
        textarea.focus();
        return;
      }
      const value = textarea ? textarea.value.trim() : '';
      finish({ confirmed: true, note: value });
    });
  });
}

export function toast(message, type = 'info', timeout = 4200) {
  const root = document.getElementById('toast-root');
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');
  const iconName = type === 'success' ? 'check' : type === 'error' ? 'alert' : 'info';
  el.innerHTML = `<span class="toast__icon">${icon(iconName, 18)}</span>
    <p style="flex:1;min-width:0">${escapeHtml(message)}</p>
    <button class="icon-btn icon-btn--bare toast__close" type="button" aria-label="Tutup notifikasi" style="width:28px;height:28px;min-height:28px">${icon('close', 16)}</button>`;
  while (root.children.length >= 3) root.firstElementChild.remove();
  root.appendChild(el);
  const remove = () => el.remove();
  el.querySelector('.toast__close').addEventListener('click', remove);
  setTimeout(remove, timeout);
}

export function renderMarkdown(markdown = '') {
  const lines = escapeHtml(markdown).split(/\r?\n/);
  const html = [];
  let list = null;
  let paragraph = [];

  const inline = (text) =>
    text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');

  const flushParagraph = () => {
    if (paragraph.length) {
      html.push(`<p>${inline(paragraph.join(' '))}</p>`);
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list) {
      html.push(`<${list.tag}>${list.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${list.tag}>`);
      list = null;
    }
  };

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      flushList();
      return;
    }
    const heading = trimmed.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      return;
    }
    if (/^>\s?/.test(trimmed)) {
      flushParagraph();
      flushList();
      html.push(`<blockquote>${inline(trimmed.replace(/^>\s?/, ''))}</blockquote>`);
      return;
    }
    const ordered = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (ordered) {
      flushParagraph();
      if (!list || list.tag !== 'ol') {
        flushList();
        list = { tag: 'ol', items: [] };
      }
      list.items.push(ordered[2]);
      return;
    }
    const bullet = trimmed.match(/^[-*]\s+(.*)$/);
    if (bullet) {
      flushParagraph();
      if (!list || list.tag !== 'ul') {
        flushList();
        list = { tag: 'ul', items: [] };
      }
      list.items.push(bullet[1]);
      return;
    }
    flushList();
    paragraph.push(trimmed);
  });
  flushParagraph();
  flushList();
  return `<div class="doc-content">${html.join('')}</div>`;
}

export function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      resolve(result.split(',')[1] || '');
    };
    reader.onerror = () => reject(new Error('Berkas tidak bisa dibaca. Coba pilih ulang.'));
    reader.readAsDataURL(file);
  });
}

export function debounce(fn, wait = 220) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}
