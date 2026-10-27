import { state, missionById, agentById } from '../state.js';
import {
  icon,
  escapeHtml,
  fmtNumber,
  fmtCompact,
  fmtDayShort,
  fmtDate,
  relativeTime,
  avatar,
  statusBadge,
  priorityBadge,
  taskStatusBadge,
  emptyState,
  badge,
  toast,
  confirmDialog,
} from '../ui.js';
import { apiChange } from '../state.js';

const HEAT_DAYS_KEY = 'nmc-heat-days';

export async function render(root) {
  const { metrics, settings, missions, tasks, agents } = state.data;
  let heatDays = Number(sessionStorage.getItem(HEAT_DAYS_KEY) || 30);

  const hermes = settings.hermes;
  const hermesChip = hermes.enabled && hermes.baseUrl
    ? badge('success', 'Hermes aktif', { dot: true })
    : badge('warning', 'Hermes belum aktif', { dot: true });

  const maxToken = Math.max(1, ...metrics.tokenByDay.map((d) => d.tokens));
  const chartCols = metrics.tokenByDay
    .map((day, index) => {
      const height = Math.round((day.tokens / maxToken) * 100);
      const showLabel = index % 2 === 0 || index === metrics.tokenByDay.length - 1;
      return `<div class="bars__col" title="${escapeHtml(fmtDayShort(day.date))}: ${fmtNumber(day.tokens)} token">
        <div class="bars__bar ${day.tokens ? '' : 'bars__bar--empty'}" style="height:${day.tokens ? Math.max(height, 4) : 3}%"></div>
      </div>`;
    })
    .join('');
  const chartLabels = metrics.tokenByDay
    .map((day, index) => `<span class="${index % 2 === 0 ? '' : 'is-hidden-mobile'}">${escapeHtml(fmtDayShort(day.date))}</span>`)
    .join('');

  const needsApproval = metrics.needsApproval;
  const ongoing = metrics.tasksOngoing.slice(0, 6);
  const heatRows = metrics.agentRows
    .filter((row) => row.status === 'active' || row.events30d > 0)
    .slice(0, 9);

  root.innerHTML = `<div class="page">
    <div class="page-head">
      <div>
        <p class="muted small">${escapeHtml(fmtDate(new Date().toISOString(), true))} · ${escapeHtml(settings.timezone)}</p>
        <h2 style="font-size:1.35rem;margin-top:2px">Selamat datang, ${escapeHtml(state.data.user.name.split(' ')[0])}</h2>
        <p class="page-sub">Ringkasan pekerjaan, approval, dan aktivitas agent Anda.</p>
      </div>
      <div class="row">${hermesChip}
        <a class="btn btn--ghost btn--sm" href="#/settings">${icon('settings', 16)} Integrasi</a>
      </div>
    </div>

    ${
      state.data.meta.usingDefaultPassword
        ? `<div class="banner banner--warn" role="note">
            ${icon('alert', 18)}
            <div class="banner__body"><p class="banner__title">Password akun masih default</p>
            <p class="banner__text">Ganti sekarang agar workspace tidak bisa diakses orang lain. <a href="#/settings">Buka Pengaturan → Keamanan</a>.</p></div>
          </div>`
        : ''
    }

    <div class="grid grid--kpi">
      <div class="kpi kpi--accent">
        <p class="kpi__label">${icon('sparkles', 14)} Token hari ini</p>
        <p class="kpi__value">${fmtCompact(metrics.tokensToday)}</p>
        <p class="kpi__foot">7 hari: ${fmtNumber(metrics.tokens7d)} · 30 hari: ${fmtCompact(metrics.tokens30d)}</p>
      </div>
      <div class="kpi">
        <p class="kpi__label">${icon('board', 14)} Task berjalan</p>
        <p class="kpi__value">${fmtNumber(metrics.tasksOngoing.length)}</p>
        <p class="kpi__foot">${metrics.totals.tasksByStatus.review || 0} menunggu review</p>
      </div>
      <div class="kpi">
        <p class="kpi__label">${icon('check', 14)} Butuh persetujuan</p>
        <p class="kpi__value">${fmtNumber(needsApproval.length)}</p>
        <p class="kpi__foot"><a href="#/missions">Tinjau misi →</a></p>
      </div>
      <div class="kpi">
        <p class="kpi__label">${icon('agents', 14)} Agent aktif</p>
        <p class="kpi__value">${metrics.totals.agentsActive}<small>/${metrics.totals.agents}</small></p>
        <p class="kpi__foot">${metrics.totals.brands} brand · ${metrics.totals.docs} dokumen</p>
      </div>
    </div>

    <div class="grid grid--2">
      <section class="card" aria-labelledby="token_title">
        <div class="card__head">
          <div>
            <h3 class="card__title" id="token_title">Token Used per Day</h3>
            <p class="card__sub">14 hari terakhir · total ${fmtNumber(metrics.tokenByDay.reduce((sum, d) => sum + d.tokens, 0))} token</p>
          </div>
          ${badge('primary', 'metrik')}
        </div>
        <div class="bars" role="img" aria-label="Grafik pemakaian token 14 hari terakhir, tertinggi ${fmtNumber(maxToken)} token per hari">${chartCols}</div>
        <div class="bars__labels" aria-hidden="true">${chartLabels}</div>
        <details style="margin-top:10px">
          <summary class="small muted" style="cursor:pointer">Lihat data sebagai tabel</summary>
          <div style="margin-top:8px">
            <table style="width:100%;border-collapse:collapse" class="small">
              <thead><tr><th style="text-align:left;padding:4px 0">Tanggal</th><th style="text-align:right">Token</th></tr></thead>
              <tbody>
                ${metrics.tokenByDay
                  .slice()
                  .reverse()
                  .map(
                    (d) =>
                      `<tr><td style="padding:3px 0">${escapeHtml(fmtDate(`${d.date}T00:00:00Z`))}</td><td style="text-align:right">${fmtNumber(d.tokens)}</td></tr>`,
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        </details>
      </section>

      <section class="card" aria-labelledby="activity_title">
        <div class="card__head">
          <div>
            <h3 class="card__title" id="activity_title">Agent Activity</h3>
            <p class="card__sub">Intensitas langkah agent per hari</p>
          </div>
          <div class="row" role="group" aria-label="Rentang aktivitas">
            <button class="chip ${heatDays === 7 ? 'is-active' : ''}" type="button" data-heat="7">7 hari</button>
            <button class="chip ${heatDays === 30 ? 'is-active' : ''}" type="button" data-heat="30">30 hari</button>
          </div>
        </div>
        ${
          heatRows.length
            ? `<div class="heat" data-heat-wrap>
                ${heatRows
                  .map((row) => {
                    const keys = heatDays === 7 ? metrics.days30.slice(-7) : metrics.days30;
                    const cells = keys
                      .map((date) => {
                        const count = row.activity[date] || 0;
                        const level = count === 0 ? 0 : count === 1 ? 1 : count === 2 ? 2 : count <= 4 ? 3 : 4;
                        return `<span class="heat__cell" data-level="${level}" title="${escapeHtml(`${row.name} · ${date}: ${count} aktivitas`)}"></span>`;
                      })
                      .join('');
                    return `<div class="heat__row">
                      <div class="heat__name">${avatar(row.name, { size: 'sm', color: agentById(row.agentId)?.color })}
                        <span class="truncate">${escapeHtml(row.name)}</span>
                        <span class="heat__meta">${heatDays === 7 ? row.events7d : row.events30d}</span>
                      </div>
                      <div class="heat__cells" role="img" aria-label="${escapeHtml(`${row.name}: ${heatDays === 7 ? row.events7d : row.events30d} aktivitas dalam ${heatDays} hari`)}">${cells}</div>
                    </div>`;
                  })
                  .join('')}
              </div>
              <div class="row" style="margin-top:10px;justify-content:space-between">
                <div class="heat-scale">Sedikit
                  <span class="heat__cell" data-level="0"></span><span class="heat__cell" data-level="1"></span><span class="heat__cell" data-level="2"></span><span class="heat__cell" data-level="3"></span><span class="heat__cell" data-level="4"></span>
                  Banyak</div>
                <a class="small link-tap" href="#/agents">Lihat tim agent →</a>
              </div>`
            : emptyState({
                icon: 'agents',
                title: 'Belum ada aktivitas agent',
                desc: 'Aktivitas muncul setelah misi diluncurkan atau agent dihubungi lewat Chat.',
                action: '<a class="btn btn--secondary btn--sm" href="#/agents">Buka Team Agent</a>',
              })
        }
      </section>
    </div>

    <div class="grid grid--2">
      <section class="card" aria-labelledby="approval_title">
        <div class="card__head">
          <div>
            <h3 class="card__title" id="approval_title">Needs Approval</h3>
            <p class="card__sub">Misi yang menunggu keputusan Anda</p>
          </div>
          ${badge(needsApproval.length ? 'warning' : 'success', `${needsApproval.length} menunggu`)}
        </div>
        ${
          needsApproval.length
            ? `<div class="list">
                ${needsApproval
                  .map((mission) => {
                    const agent = agentById(mission.agentId);
                    return `<article class="list-item">
                      <div class="list-item__main">
                        <p class="list-item__title">${escapeHtml(mission.name)}</p>
                        <p class="tiny muted" style="margin-top:2px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${escapeHtml(mission.goals)}</p>
                        <div class="list-item__meta">
                          ${priorityBadge(mission.priority)}
                          <span>${escapeHtml(agent?.name || 'Agent terhapus')}</span>
                          <span>· ${fmtDate(mission.updatedAt)}</span>
                        </div>
                        <div class="row" style="margin-top:8px">
                          <a class="btn btn--secondary btn--sm" href="#/missions/${mission.id}">Review</a>
                          <button class="btn btn--primary btn--sm" type="button" data-approve="${mission.id}">${icon('check', 15)} Setujui</button>
                        </div>
                      </div>
                    </article>`;
                  })
                  .join('')}
              </div>`
            : emptyState({
                icon: 'check',
                title: 'Tidak ada yang menunggu',
                desc: 'Setiap misi yang diajukan akan muncul di sini beserta konteks untuk diputuskan.',
              })
        }
      </section>

      <section class="card" aria-labelledby="ongoing_title">
        <div class="card__head">
          <div>
            <h3 class="card__title" id="ongoing_title">Task Ongoing</h3>
            <p class="card__sub">${ongoing.length} dari ${metrics.tasksOngoing.length} task aktif</p>
          </div>
          <a class="btn btn--ghost btn--sm" href="#/board">Board</a>
        </div>
        ${
          ongoing.length
            ? `<div class="list">
                ${ongoing
                  .map((task) => {
                    const agent = agentById(task.assigneeAgentId);
                    return `<div class="list-item list-item--plain">
                      <div class="list-item__main">
                        <p class="list-item__title">${escapeHtml(task.title)}</p>
                        <div class="list-item__meta">
                          ${taskStatusBadge(task.status)}
                          ${priorityBadge(task.priority)}
                          <span>${escapeHtml(agent?.name || 'Belum ditugaskan')}</span>
                        </div>
                      </div>
                    </div>`;
                  })
                  .join('')}
              </div>`
            : emptyState({ icon: 'board', title: 'Task board bersih', desc: 'Task baru muncul otomatis dari misi, atau tambahkan manual di Task Board.' })
        }
      </section>
    </div>

    <div class="grid grid--2">
      <section class="card" aria-labelledby="pipeline_title">
        <div class="card__head">
          <div>
            <h3 class="card__title" id="pipeline_title">Status Misi</h3>
            <p class="card__sub">${missions.length} misi di workspace</p>
          </div>
          <a class="btn btn--ghost btn--sm" href="#/missions">Semua misi</a>
        </div>
        <div class="stack stack--sm">
          ${['draft', 'pending_review', 'approved', 'running', 'completed']
            .map((status) => {
              const count = missions.filter((m) => m.status === status).length;
              const pct = missions.length ? Math.round((count / missions.length) * 100) : 0;
              return `<div>
                <div class="row row--between" style="gap:6px">
                  <span class="small">${statusBadge(status)}</span>
                  <span class="small muted">${count} misi · ${pct}%</span>
                </div>
                <div class="meter" style="margin-top:4px"><div class="meter__bar" style="width:${pct}%"></div></div>
              </div>`;
            })
            .join('')}
        </div>
      </section>

      <section class="card" aria-labelledby="feed_title">
        <div class="card__head">
          <div>
            <h3 class="card__title" id="feed_title">Aktivitas terbaru</h3>
            <p class="card__sub">Langkah agent & peristiwa sistem</p>
          </div>
        </div>
        ${
          metrics.events.length
            ? `<div class="list list--flush">
                ${metrics.events
                  .slice(0, 6)
                  .map(
                    (event) => `<div class="list-item list-item--plain">
                      <div class="list-item__main">
                        <p class="small">${escapeHtml(event.label)}</p>
                        <p class="tiny muted">${escapeHtml(event.agentName)} · ${escapeHtml(relativeTime(event.at))}</p>
                      </div>
                    </div>`,
                  )
                  .join('')}
              </div>`
            : emptyState({ icon: 'clock', title: 'Belum ada aktivitas', desc: 'Jalankan misi pertama untuk melihat jejak langkah agent di sini.' })
        }
      </section>
    </div>
  </div>`;

  root.querySelectorAll('[data-heat]').forEach((button) => {
    button.addEventListener('click', () => {
      heatDays = Number(button.dataset.heat);
      sessionStorage.setItem(HEAT_DAYS_KEY, String(heatDays));
      render(root);
    });
  });

  root.querySelectorAll('[data-approve]').forEach((button) => {
    button.addEventListener('click', async () => {
      const mission = missionById(button.dataset.approve);
      if (!mission) return;
      const answer = await confirmDialog({
        title: 'Setujui misi ini?',
        message: `"${mission.name}" akan disetujui dan siap diluncurkan ke ${agentById(mission.agentId)?.name || 'agent'}. Anda tetap bisa replan setelahnya.`,
        confirmLabel: 'Setujui misi',
      });
      if (!answer?.confirmed) return;
      button.disabled = true;
      try {
        await apiChange(`/api/missions/${mission.id}/action`, { body: { action: 'approve' } }, 'Misi disetujui.');
        await render(root);
      } catch (error) {
        toast(error.message, 'error');
        button.disabled = false;
      }
    });
  });
}
