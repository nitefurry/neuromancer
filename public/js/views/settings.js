import { state, apiChange } from '../state.js';
import { api } from '../api.js';
import {
  icon,
  escapeHtml,
  fmtDate,
  badge,
  field,
  applyFieldErrors,
  busy,
  toast,
} from '../ui.js';

const THEME_KEY = 'nmc-theme';

export async function render(root) {
  const { settings, user, metrics, meta } = state.data;
  const hermes = settings.hermes;
  let savedTheme = 'system';
  try {
    savedTheme = localStorage.getItem(THEME_KEY) || 'system';
  } catch {
    savedTheme = 'system';
  }

  root.innerHTML = `<div class="page">
    <div class="page-head">
      <div>
        <h2 class="page-title">Pengaturan</h2>
        <p class="page-sub">Akun, tampilan, workspace, dan integrasi Hermes.</p>
      </div>
      <a class="btn btn--ghost btn--sm" href="/api/health" target="_blank" rel="noopener noreferrer">${icon('info', 15)} Status server</a>
    </div>

    ${
      meta.usingDefaultPassword
        ? `<div class="banner banner--danger" role="alert">${icon('alert', 18)}
            <div class="banner__body"><p class="banner__title">Password masih default</p>
            <p class="banner__text">Ganti password sekarang. Selama masih default, siapa pun yang tahu email demo bisa masuk ke workspace ini.</p></div>
          </div>`
        : ''
    }

    <div class="grid grid--2">
      <section class="card" aria-labelledby="profile_title">
        <h3 class="card__title" id="profile_title">Profil pengguna</h3>
        <p class="card__sub" style="margin-bottom:10px">Satu email = satu workspace dengan peran owner (setup &amp; approval).</p>
        <form id="profile_form" novalidate>
          <div class="form-grid">
            ${field({ label: 'Nama', name: 'name', value: user.name, required: true, attrs: 'minlength="2" maxlength="60"' })}
            ${field({ label: 'Email', name: 'email', type: 'email', value: user.email, required: true, attrs: 'maxlength="160"' })}
            <button class="btn btn--primary" type="submit" id="profile_save">${icon('check', 16)} Simpan profil</button>
          </div>
        </form>
      </section>

      <section class="card" aria-labelledby="security_title">
        <h3 class="card__title" id="security_title">Keamanan</h3>
        <p class="card__sub" style="margin-bottom:10px">Password minimal 8 karakter. Semua sesi lain akan dikeluarkan setelah perubahan.</p>
        <form id="password_form" novalidate>
          <div class="form-grid">
            ${field({ label: 'Password saat ini', name: 'currentPassword', type: 'password', required: true, attrs: 'autocomplete="current-password"' })}
            <div class="form-grid form-grid--2">
              ${field({ label: 'Password baru', name: 'newPassword', type: 'password', required: true, attrs: 'minlength="8" autocomplete="new-password"' })}
              ${field({ label: 'Ulangi password baru', name: 'confirmPassword', type: 'password', required: true, attrs: 'minlength="8" autocomplete="new-password"' })}
            </div>
            <button class="btn btn--secondary" type="submit" id="password_save">${icon('key', 16)} Ganti password</button>
          </div>
        </form>
      </section>
    </div>

    <div class="grid grid--2">
      <section class="card" aria-labelledby="appearance_title">
        <h3 class="card__title" id="appearance_title">Tampilan</h3>
        <p class="card__sub" style="margin-bottom:10px">Mode terang/gelap mengikuti preferensi perangkat pada opsi Sistem.</p>
        <div class="row" role="group" aria-label="Pilih tema">
          <button class="chip ${savedTheme === 'light' ? 'is-active' : ''}" type="button" data-theme-choice="light">${icon('sun', 15)} Terang</button>
          <button class="chip ${savedTheme === 'dark' ? 'is-active' : ''}" type="button" data-theme-choice="dark">${icon('moon', 15)} Gelap</button>
          <button class="chip ${savedTheme === 'system' ? 'is-active' : ''}" type="button" data-theme-choice="system">${icon('settings', 15)} Sistem</button>
        </div>
      </section>

      <section class="card" aria-labelledby="workspace_title">
        <h3 class="card__title" id="workspace_title">Workspace</h3>
        <p class="card__sub" style="margin-bottom:10px">Nama tampil di sidebar.</p>
        <form id="workspace_form" novalidate>
          <div class="form-grid">
            ${field({ label: 'Nama workspace', name: 'workspaceName', value: settings.workspaceName, required: true, attrs: 'minlength="2" maxlength="80"' })}
            <div class="row">
              <button class="btn btn--primary" type="submit" id="workspace_save">${icon('check', 16)} Simpan</button>
              <span class="tiny muted">Slug: <span class="mono">${escapeHtml(settings.workspaceSlug)}</span></span>
            </div>
          </div>
        </form>
      </section>
    </div>

    <section class="card" aria-labelledby="hermes_title">
      <div class="card__head">
        <div>
          <h3 class="card__title" id="hermes_title">Integrasi Hermes</h3>
          <p class="card__sub">Hubungkan mesin eksekusi Hermes. Tanpa koneksi, aplikasi memakai simulator lokal dan menandainya di hasil.</p>
        </div>
        ${hermes.enabled && hermes.baseUrl ? badge('success', 'Aktif', { dot: true }) : badge('warning', 'Belum aktif', { dot: true })}
      </div>

      <form id="hermes_form" novalidate>
        <div class="form-grid">
          <label class="switch">
            <input type="checkbox" name="enabled" ${hermes.enabled ? 'checked' : ''} />
            <span class="switch__track" aria-hidden="true"></span>
            <span>Aktifkan pengiriman misi &amp; chat ke Hermes</span>
          </label>

          <div class="form-grid form-grid--2">
            ${field({
              label: 'Base URL',
              name: 'baseUrl',
              type: 'url',
              value: hermes.baseUrl,
              attrs: 'maxlength="300" placeholder="http://hermes:8080"',
              hint: 'Alamat container Hermes yang bisa dijangkau server ini.',
            })}
            ${field({
              label: 'API key',
              name: 'apiKey',
              type: 'password',
              value: '',
              attrs: `maxlength="200" autocomplete="off" placeholder="${hermes.apiKey ? escapeHtml(hermes.apiKey) : 'Bearer token (opsional)'}"`,
              hint: hermes.apiKey ? 'Kunci tersimpan. Kosongkan bila tidak ingin mengubahnya.' : 'Disimpan di server, tidak pernah dikirim ke browser.',
            })}
          </div>

          <div class="form-grid form-grid--3">
            ${field({ label: 'Health path', name: 'healthPath', value: hermes.healthPath, attrs: 'maxlength="120"' })}
            ${field({ label: 'Mission path', name: 'missionPath', value: hermes.missionPath, attrs: 'maxlength="120"' })}
            ${field({ label: 'Chat path', name: 'chatPath', value: hermes.chatPath, attrs: 'maxlength="120"' })}
          </div>

          <label class="checkline">
            <input type="checkbox" name="fallbackLocal" ${hermes.fallbackLocal ? 'checked' : ''} />
            <span>Pakai simulator lokal bila Hermes tidak menjawab <span class="tiny muted">— hasil selalu ditandai agar tidak dikira keluaran Hermes.</span></span>
          </label>

          <div class="row">
            <button class="btn btn--primary" type="submit" id="hermes_save">${icon('check', 16)} Simpan integrasi</button>
            <button class="btn btn--secondary" type="button" id="hermes_test">${icon('refresh', 16)} Tes koneksi</button>
          </div>

          <div id="hermes_result" role="status" aria-live="polite"></div>

          <details>
            <summary class="small muted" style="cursor:pointer">Kontrak API yang dipakai</summary>
            <pre class="code-block" style="margin-top:8px">GET  {baseUrl}{healthPath}   → 2xx bila hidup
POST {baseUrl}{missionPath}  → { mission, agent } → { result?, tokens? }
POST {baseUrl}{chatPath}     → { agent, messages } → { reply, tokens? }

Header: Authorization: Bearer {apiKey} (bila diisi)
Timeout: 8 detik per permintaan.</pre>
          </details>
        </div>
      </form>
    </section>

    <section class="card" aria-labelledby="system_title">
      <h3 class="card__title" id="system_title">Status sistem</h3>
      <div class="grid grid--2" style="margin-top:10px">
        <div class="stack stack--sm">
          <div class="stat-row"><span class="muted">Agent</span><span class="stat-row__value">${metrics.totals.agents} (${metrics.totals.agentsActive} aktif)</span></div>
          <div class="stat-row"><span class="muted">Misi</span><span class="stat-row__value">${metrics.totals.missions}</span></div>
          <div class="stat-row"><span class="muted">Task</span><span class="stat-row__value">${state.data.tasks.length}</span></div>
          <div class="stat-row"><span class="muted">Dokumen</span><span class="stat-row__value">${metrics.totals.docs}</span></div>
        </div>
        <div class="stack stack--sm">
          <div class="stat-row"><span class="muted">Token 30 hari</span><span class="stat-row__value">${metrics.tokens30d.toLocaleString('id-ID')}</span></div>
          <div class="stat-row"><span class="muted">Mode chat</span><span class="stat-row__value">${hermes.enabled && hermes.baseUrl ? 'Hermes' : 'Simulator lokal'}</span></div>
          <div class="stat-row"><span class="muted">Zona waktu</span><span class="stat-row__value">${escapeHtml(settings.timezone)}</span></div>
          <div class="stat-row"><span class="muted">Waktu server</span><span class="stat-row__value">${escapeHtml(fmtDate(state.data.serverTime, true))}</span></div>
        </div>
      </div>
      <p class="tiny muted" style="margin-top:10px">Versi ${escapeHtml(String(meta.version))} · data disimpan di server (JSON store + folder uploads), bukan di browser.</p>
    </section>
  </div>`;

  const profileForm = root.querySelector('#profile_form');
  profileForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = root.querySelector('#profile_save');
    busy(button, true);
    try {
      await apiChange('/api/profile', { method: 'PATCH', body: { name: profileForm.name.value, email: profileForm.email.value } }, 'Profil diperbarui.');
      await render(root);
    } catch (error) {
      busy(button, false);
      applyFieldErrors(profileForm, error.fields || {}, error.message);
    }
  });

  const passwordForm = root.querySelector('#password_form');
  passwordForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    applyFieldErrors(passwordForm, {});
    const values = {
      currentPassword: passwordForm.currentPassword.value,
      newPassword: passwordForm.newPassword.value,
      confirmPassword: passwordForm.confirmPassword.value,
    };
    const errors = {};
    if (!values.currentPassword) errors.currentPassword = 'Password saat ini wajib diisi.';
    if (values.newPassword.length < 8) errors.newPassword = 'Password baru minimal 8 karakter.';
    if (values.newPassword !== values.confirmPassword) errors.confirmPassword = 'Konfirmasi belum sama.';
    if (Object.keys(errors).length) {
      applyFieldErrors(passwordForm, errors);
      return;
    }
    const button = root.querySelector('#password_save');
    busy(button, true);
    try {
      await apiChange('/api/profile/password', { body: values }, 'Password diperbarui.');
      passwordForm.reset();
      await render(root);
    } catch (error) {
      busy(button, false);
      applyFieldErrors(passwordForm, error.fields || {}, error.message);
    }
  });

  root.querySelectorAll('[data-theme-choice]').forEach((button) => {
    button.addEventListener('click', async () => {
      const choice = button.dataset.themeChoice;
      try {
        localStorage.setItem(THEME_KEY, choice);
      } catch {
        /* penyimpanan bisa diblokir */
      }
      const { applyTheme } = await import('../main.js');
      applyTheme(choice);
      root.querySelectorAll('[data-theme-choice]').forEach((b) => b.classList.toggle('is-active', b === button));
    });
  });

  const workspaceForm = root.querySelector('#workspace_form');
  workspaceForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = root.querySelector('#workspace_save');
    busy(button, true);
    try {
      await apiChange('/api/settings', { method: 'PATCH', body: { workspaceName: workspaceForm.workspaceName.value } }, 'Nama workspace disimpan.');
      await render(root);
    } catch (error) {
      busy(button, false);
      applyFieldErrors(workspaceForm, error.fields || {}, error.message);
    }
  });

  const hermesForm = root.querySelector('#hermes_form');
  const resultBox = root.querySelector('#hermes_result');

  const payload = () => {
    const hermesPayload = {
      enabled: hermesForm.enabled.checked,
      baseUrl: hermesForm.baseUrl.value.trim(),
      healthPath: hermesForm.healthPath.value.trim(),
      missionPath: hermesForm.missionPath.value.trim(),
      chatPath: hermesForm.chatPath.value.trim(),
      fallbackLocal: hermesForm.fallbackLocal.checked,
    };
    if (hermesForm.apiKey.value) hermesPayload.apiKey = hermesForm.apiKey.value;
    return hermesPayload;
  };

  hermesForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = root.querySelector('#hermes_save');
    busy(button, true);
    try {
      await apiChange('/api/settings', { method: 'PATCH', body: { hermes: payload() } }, 'Integrasi Hermes disimpan.');
      await render(root);
    } catch (error) {
      busy(button, false);
      const fields = error.fields || {};
      applyFieldErrors(
        hermesForm,
        Object.fromEntries(Object.entries(fields).map(([k, v]) => [k.replace('hermes.', ''), v])),
        error.message,
      );
    }
  });

  root.querySelector('#hermes_test').addEventListener('click', async (event) => {
    const button = event.currentTarget;
    busy(button, true, 'Menguji…');
    resultBox.innerHTML = '';
    try {
      const result = await api('/api/hermes/test', { method: 'POST', body: {} });
      resultBox.innerHTML = `<div class="banner ${result.ok ? 'banner--info' : 'banner--danger'}" role="status">
        ${icon(result.ok ? 'check' : 'alert', 18)}
        <div class="banner__body"><p class="banner__title">${result.ok ? 'Hermes merespons' : 'Koneksi belum berhasil'}</p>
        <p class="banner__text">${escapeHtml(result.message)}</p></div>
      </div>`;
      toast(result.ok ? 'Koneksi Hermes berhasil.' : 'Koneksi Hermes gagal.', result.ok ? 'success' : 'error');
    } catch (error) {
      resultBox.innerHTML = `<div class="banner banner--danger" role="alert">${icon('alert', 18)}
        <div class="banner__body"><p class="banner__text">${escapeHtml(error.message)}</p></div></div>`;
    } finally {
      busy(button, false);
    }
  });
}
