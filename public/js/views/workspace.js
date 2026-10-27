import { state, apiChange, agentById } from '../state.js';
import { icon, escapeHtml, fmtDate, avatar, badge, emptyState, confirmDialog, toast, fmtNumber } from '../ui.js';

export async function render(root) {
  const agents = state.data.agents;
  const files = state.data.files.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  root.innerHTML = `<div class="page">
    <div class="page-head">
      <div>
        <h2 class="page-title">File &amp; Agent Workspace</h2>
        <p class="page-sub">Identitas, memory, skill, dan config.yaml tiap agent — serta berkas yang diunggah ke workspace.</p>
      </div>
      <a class="btn btn--secondary btn--sm" href="#/agents">${icon('agents', 16)} Kelola tim</a>
    </div>

    <div class="banner banner--info" role="note">
      ${icon('info', 18)}
      <div class="banner__body">
        <p class="banner__title">Penyimpanan lokal workspace</p>
        <p class="banner__text">File disimpan di server ini (maks. 8 MB per berkas). Data agent tersimpan pada profil masing-masing; config.yaml dapat disalin ke Hermes.</p>
      </div>
    </div>

    <div class="grid grid--auto">
      ${agents
        .map((agent) => {
          const soulLines = (agent.soul || '').split('\n').length;
          const configLines = (agent.configYaml || '').split('\n').length;
          return `<article class="card" style="display:grid;gap:10px">
            <div class="row">
              ${avatar(agent.name, { size: 'lg', color: agent.color, photo: agent.photoFileId ? `/api/files/${agent.photoFileId}/view` : null })}
              <div style="min-width:0;flex:1">
                <h3 style="font-size:0.98rem">${escapeHtml(agent.name)}</h3>
                <p class="tiny muted">${escapeHtml(agent.role)} ${agent.status === 'inactive' ? '· nonaktif' : ''}</p>
              </div>
              ${badge(agent.status === 'active' ? 'success' : 'neutral', agent.status === 'active' ? 'Aktif' : 'Nonaktif')}
            </div>
            <div class="list list--flush">
              ${workspaceRow('Soul.md', `${soulLines} baris`, agent, 'soul')}
              ${workspaceRow('Memory', `${agent.memory.length} catatan`, agent, 'memory')}
              ${workspaceRow('Skill', `${agent.skills.length} terpasang`, agent, 'skills')}
              ${workspaceRow('Setting', `config.yaml · ${configLines} baris`, agent, 'settings')}
            </div>
            <div class="row">
              <a class="btn btn--secondary btn--sm" href="#/agents/${agent.id}" data-open agent-id="${agent.id}" data-tab="profile">Buka workspace</a>
              <a class="btn btn--ghost btn--sm" href="#/chat">Chat</a>
            </div>
          </article>`;
        })
        .join('')}
    </div>

    <section class="card" aria-labelledby="files_title">
      <div class="card__head">
        <div>
          <h3 class="card__title" id="files_title">Berkas workspace</h3>
          <p class="card__sub">${files.length} berkas · referensi brand, lampiran Docs, dan foto agent.</p>
        </div>
        <a class="btn btn--ghost btn--sm" href="#/docs">${icon('docs', 15)} Unggah via Docs</a>
      </div>
      ${
        files.length
          ? `<div class="list">
              ${files
                .map(
                  (file) => `<div class="list-item">
                    <span style="color:var(--primary)">${icon(file.mime.startsWith('image/') ? 'brand' : 'file', 18)}</span>
                    <div class="list-item__main">
                      <p class="list-item__title truncate">${escapeHtml(file.name)}</p>
                      <p class="tiny muted">${escapeHtml(file.kind)} · ${fmtNumber(file.size)} byte · ${escapeHtml(fmtDate(file.createdAt))}${file.stored ? '' : ' · contoh seed'}</p>
                    </div>
                    ${file.stored ? `<a class="icon-btn icon-btn--bare" href="/api/files/${file.id}/download" aria-label="Unduh ${escapeHtml(file.name)}">${icon('download', 17)}</a>` : ''}
                    <button class="icon-btn icon-btn--bare" type="button" data-del-file="${file.id}" aria-label="Hapus ${escapeHtml(file.name)}">${icon('trash', 17)}</button>
                  </div>`,
                )
                .join('')}
            </div>`
          : emptyState({
              icon: 'workspace',
              title: 'Belum ada berkas',
              desc: 'Unggah referensi brand atau lampiran dokumen; berkas akan muncul di sini.',
              action: '<a class="btn btn--secondary btn--sm" href="#/docs">Buka Docs</a>',
            })
      }
    </section>
  </div>`;

  root.querySelectorAll('[data-open]').forEach((link) => {
    link.addEventListener('click', () => {
      sessionStorage.setItem(`nmc-agent-tab-${link.dataset.agentId}`, link.dataset.tab || 'profile');
    });
  });

  root.querySelectorAll('[data-del-file]').forEach((button) => {
    button.addEventListener('click', async () => {
      const file = state.data.files.find((f) => f.id === button.dataset.delFile);
      const usedByBrand = state.data.brands.some((b) => b.references.some((r) => r.fileId === file.id));
      const usedByDoc = state.data.docs.some((d) => d.fileId === file.id);
      const answer = await confirmDialog({
        title: 'Hapus berkas?',
        message: `"${file.name}" akan dihapus dari server.${usedByBrand || usedByDoc ? ' Referensi/dokumen yang memakainya akan kehilangan berkas ini.' : ''}`,
        confirmLabel: 'Hapus berkas',
        danger: true,
      });
      if (!answer?.confirmed) return;
      try {
        await apiChange(`/api/files/${file.id}`, { method: 'DELETE' }, 'Berkas dihapus.');
        await render(root);
      } catch (error) {
        toast(error.message, 'error');
      }
    });
  });
}

function workspaceRow(label, value, agent, tab) {
  return `<a class="list-item list-item--plain" href="#/agents/${agent.id}" data-open data-agent-id="${agent.id}" data-tab="${tab}" style="text-decoration:none;color:inherit">
    <div class="list-item__main">
      <p class="small strong">${escapeHtml(label)}</p>
      <p class="tiny muted">${escapeHtml(value)}</p>
    </div>
    ${icon('chevronRight', 15)}
  </a>`;
}
