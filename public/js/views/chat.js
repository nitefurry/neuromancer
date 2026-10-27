import { state, apiChange, chatById, agentById } from '../state.js';
import {
  icon,
  escapeHtml,
  fmtDate,
  relativeTime,
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
} from '../ui.js';

export async function render(root, params = {}) {
  const chats = state.data.chats.slice().sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  const selected = params.id ? chatById(params.id) : chats[0] || null;
  const agents = state.data.agents;

  if (params.id && !selected) {
    root.innerHTML = `<div class="page"><a class="btn btn--ghost btn--sm" href="#/chat" style="justify-self:start">${icon('arrowLeft', 16)} Semua sesi</a>
      ${emptyState({ icon: 'chat', title: 'Sesi chat tidak ditemukan', desc: 'Sesi mungkin sudah dihapus.', action: '<a class="btn btn--secondary btn--sm" href="#/chat">Kembali</a>' })}</div>`;
    return;
  }

  root.innerHTML = `<div class="page">
    <div class="page-head">
      <div>
        <h2 class="page-title">Chat with Agent</h2>
        <p class="page-sub">Percakapan per sesi. Balasan memakai Hermes bila aktif, atau simulator lokal yang ditandai jelas.</p>
      </div>
      <button class="btn btn--primary" type="button" data-new-chat>${icon('plus', 17)} Sesi baru</button>
    </div>

    <div class="chat">
      <aside class="card chat__sessions-card" style="padding:10px" aria-label="Daftar sesi chat">
        <div class="card__head" style="padding:4px 4px 8px;margin:0">
          <h3 class="card__title" style="font-size:0.8125rem">Sesi (${chats.length})</h3>
        </div>
        ${
          chats.length
            ? `<div class="chat__sessions">
                ${chats
                  .map((session) => {
                    const agent = agentById(session.agentId);
                    return `<div style="display:flex;gap:2px;align-items:center">
                      <a class="chat__session ${selected?.id === session.id ? 'is-active' : ''}" href="#/chat/${session.id}">
                        <span class="chat__session-title">${escapeHtml(session.title)}</span>
                        <span class="chat__session-meta">${escapeHtml(agent?.name || 'Agent terhapus')} · ${escapeHtml(relativeTime(session.updatedAt))}</span>
                      </a>
                      <button class="icon-btn icon-btn--bare" type="button" style="width:32px;height:32px;min-height:32px" data-del-chat="${session.id}" aria-label="Hapus sesi ${escapeHtml(session.title)}">${icon('trash', 14)}</button>
                    </div>`;
                  })
                  .join('')}
              </div>`
            : `<p class="tiny muted" style="padding:6px">Belum ada sesi.</p>`
        }
      </aside>

      ${
        selected
          ? chatPanel(selected)
          : `<section class="card">${emptyState({
              icon: 'chat',
              title: 'Mulai percakapan',
              desc: 'Pilih agent, lalu tuliskan konteks pekerjaan agar jawabannya relevan.',
              action: '<button class="btn btn--primary btn--sm" type="button" data-new-chat>Mulai sesi</button>',
            })}</section>`
      }
    </div>
  </div>`;

  root.querySelectorAll('[data-new-chat]').forEach((button) => button.addEventListener('click', () => openChatModal(agents)));
  root.querySelectorAll('[data-del-chat]').forEach((button) => {
    button.addEventListener('click', async () => {
      const session = chatById(button.dataset.delChat);
      const answer = await confirmDialog({
        title: 'Hapus sesi chat?',
        message: `"${session.title}" beserta seluruh pesannya akan dihapus.`,
        confirmLabel: 'Hapus sesi',
        danger: true,
      });
      if (!answer?.confirmed) return;
      try {
        await apiChange(`/api/chats/${session.id}`, { method: 'DELETE' }, 'Sesi chat dihapus.');
        location.hash = '#/chat';
        await render(root, {});
      } catch (error) {
        toast(error.message, 'error');
      }
    });
  });

  if (!selected) return;
  const agent = agentById(selected.agentId);
  const form = root.querySelector('#chat_form');
  const textarea = root.querySelector('#chat_input');
  const thread = root.querySelector('#chat_thread');
  thread.scrollTop = thread.scrollHeight;

  textarea.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const message = textarea.value.trim();
    if (!message) {
      textarea.focus();
      return;
    }
    if (message.length > 4000) {
      toast('Pesan maksimal 4000 karakter.', 'error');
      return;
    }
    const send = root.querySelector('#chat_send');
    busy(send, true, 'Mengirim…');
    textarea.disabled = true;
    const typing = root.querySelector('#chat_typing');
    typing.hidden = false;
    const errorBox = root.querySelector('#chat_error');
    errorBox.hidden = true;
    try {
      const result = await apiChange(`/api/chats/${selected.id}/messages`, { body: { message } });
      textarea.value = '';
      if (result.note) toast(result.note, result.mode === 'error' ? 'error' : 'info', 6000);
      await render(root, { id: selected.id });
      root.querySelector('#chat_input')?.focus();
    } catch (error) {
      busy(send, false);
      textarea.disabled = false;
      typing.hidden = true;
      errorBox.hidden = false;
      errorBox.innerHTML = `${icon('alert', 18)}<div class="banner__body"><p class="banner__title">Pesan tidak terkirim</p><p class="banner__text">${escapeHtml(error.message)}</p></div>`;
      textarea.focus();
    }
  });
}

function chatPanel(session) {
  const agent = agentById(session.agentId);
  const lastMode = [...session.messages].reverse().find((m) => m.role === 'agent')?.mode;
  return `<section class="chat__panel" aria-label="Percakapan">
    <div class="chat__header">
      ${agent ? avatar(agent.name, { size: 'sm', color: agent.color, photo: agent.photoFileId ? `/api/files/${agent.photoFileId}/view` : null }) : avatar('?', { size: 'sm' })}
      <div style="min-width:0;flex:1">
        <p class="strong truncate" style="font-size:0.9rem">${escapeHtml(agent?.name || 'Agent terhapus')}</p>
        <p class="tiny muted truncate">${escapeHtml(agent ? `${agent.role} · ${agent.model}` : 'Agent tidak tersedia')}</p>
      </div>
      ${lastMode === 'local' ? badge('warning', 'Simulator lokal') : lastMode === 'hermes' ? badge('success', 'Hermes') : ''}
      ${agent ? `<a class="icon-btn icon-btn--bare" href="#/agents/${agent.id}" aria-label="Buka workspace agent">${icon('workspace', 18)}</a>` : ''}
    </div>

    <div class="chat__thread" id="chat_thread" tabindex="0" aria-label="Riwayat pesan">
      ${
        session.messages.length
          ? session.messages
              .map(
                (message) => `<div class="chat__msg chat__msg--${message.role === 'user' ? 'user' : 'agent'}">
                  <span class="chat__msg-text">${escapeHtml(message.text)}</span>
                  <div class="chat__msg-meta">${message.role === 'user' ? 'Anda' : escapeHtml(agent?.name || 'Agent')} · ${escapeHtml(fmtDate(message.at, true))}</div>
                  ${message.note ? `<div class="chat__msg-note">${escapeHtml(message.note)}</div>` : ''}
                </div>`,
              )
              .join('')
          : `<div style="margin:auto 0">${emptyState({
              icon: 'chat',
              title: `Mulai percakapan dengan ${agent?.name || 'agent'}`,
              desc: 'Sebutkan misi atau hasil yang Anda butuhkan. Agent akan menjawab sesuai role dan direction-nya.',
            })}</div>`
      }
      <p class="chat__typing" id="chat_typing" hidden><span class="spinner" aria-hidden="true"></span> Agent sedang menulis…</p>
    </div>

    <p class="sr-only" id="chat_hint">Enter mengirim pesan, Shift+Enter membuat baris baru.</p>
    <div id="chat_error" class="banner banner--danger" role="alert" hidden style="margin:8px 10px"></div>

    <form class="chat__composer" id="chat_form">
      <label class="sr-only" for="chat_input">Tulis pesan</label>
      <textarea class="textarea" id="chat_input" rows="1" maxlength="4000" placeholder="Tulis pesan…" aria-describedby="chat_hint" ${agent ? '' : 'disabled'}></textarea>
      <button class="btn btn--primary btn--icon" type="submit" id="chat_send" aria-label="Kirim pesan" ${agent ? '' : 'disabled'}>${icon('send', 18)}</button>
    </form>
  </section>`;
}

export function openChatModal(agents) {
  const active = agents.filter((a) => a.status === 'active');
  if (!active.length) {
    toast('Belum ada agent aktif. Aktifkan agent di Team Agent.', 'error');
    return;
  }
  const modal = openModal({
    title: 'Sesi chat baru',
    body: `<form id="chat_new_form" novalidate><div class="form-grid">
      ${field({ label: 'Pilih agent', name: 'agentId', type: 'select', options: active.map((a) => ({ value: a.id, label: `${a.name} — ${a.role}` })), required: true })}
      ${field({ label: 'Judul sesi (opsional)', name: 'title', attrs: 'maxlength="120"', placeholder: 'Contoh: Review artikel Q4' })}
    </div></form>`,
    foot: `<button class="btn btn--ghost" type="button" data-dialog-close>Batal</button>
      <button class="btn btn--primary" type="submit" form="chat_new_form" id="chat_new_save">Mulai chat</button>`,
  });
  const form = modal.dialog.querySelector('#chat_new_form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const values = readForm(form);
    const button = modal.dialog.querySelector('#chat_new_save');
    busy(button, true);
    try {
      const result = await apiChange('/api/chats', { body: values }, 'Sesi chat dibuat.');
      modal.close();
      location.hash = `#/chat/${result.chat.id}`;
    } catch (error) {
      busy(button, false);
      applyFieldErrors(form, error.fields || {}, error.message);
    }
  });
}
