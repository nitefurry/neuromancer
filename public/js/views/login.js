import { api, ApiError } from '../api.js';
import { icon, escapeHtml, busy, applyFieldErrors } from '../ui.js';

export async function renderLogin(root, onSuccess) {
  let info = { usingDefaultPassword: false, demoEmail: '' };
  try {
    info = await api('/api/auth-info');
  } catch {
    /* biarkan form tetap tampil; error muncul saat submit */
  }

  root.innerHTML = `<div class="login">
    <button class="icon-btn login__theme" type="button" data-theme-toggle aria-label="Ubah tema"></button>
    <div class="login__card">
      <div class="login__mark" aria-hidden="true">N</div>
      <div>
        <h1 class="login__title">Neuromancer<br />Mission Control</h1>
        <p class="login__sub">Pusat kendali misi, approval, dan tim agent AI Anda. Satu email untuk satu workspace.</p>
      </div>

      <form id="login_form" novalidate>
        <div class="form-grid">
          <div class="field" data-field="email">
            <label class="field__label" for="login_email">Email</label>
            <input class="input" id="login_email" name="email" type="email" autocomplete="username" inputmode="email" required placeholder="nama@domain.com" value="${escapeHtml(info.demoEmail || '')}" />
            <p class="field__error" id="login_email_err" role="alert"></p>
          </div>
          <div class="field" data-field="password">
            <label class="field__label" for="login_password">Password</label>
            <input class="input" id="login_password" name="password" type="password" autocomplete="current-password" required minlength="8" placeholder="Minimal 8 karakter" />
            <p class="field__error" id="login_password_err" role="alert"></p>
          </div>
          <button class="btn btn--primary btn--block" type="submit" id="login_submit">
            ${icon('arrowRight', 17)} Masuk ke workspace
          </button>
        </div>
      </form>

      ${
        info.usingDefaultPassword
          ? `<div class="banner banner--warn" role="note">
              ${icon('alert', 18)}
              <div class="banner__body">
                <p class="banner__title">Akun demo aktif</p>
                <p class="banner__text">Gunakan <span class="mono">${escapeHtml(info.demoEmail)}</span> dengan password <span class="mono">missioncontrol</span>, lalu ganti password di Pengaturan.</p>
              </div>
            </div>`
          : ''
      }

      <p class="login__foot">Belum punya akses? Hubungi pemilik workspace. Tidak ada pendaftaran publik pada versi MVP.</p>
    </div>
  </div>`;

  root.querySelector('[data-theme-toggle]').addEventListener('click', async () => {
    const { toggleTheme } = await import('../main.js');
    toggleTheme();
  });
  const { applyTheme } = await import('../main.js');
  applyTheme(document.documentElement.dataset.theme || 'light');

  const form = root.querySelector('#login_form');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = root.querySelector('#login_submit');
    applyFieldErrors(form, {}, '');
    const email = form.email.value.trim();
    const password = form.password.value;
    const errors = {};
    if (!email) errors.email = 'Email wajib diisi.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.email = 'Format email belum benar.';
    if (!password) errors.password = 'Password wajib diisi.';
    if (Object.keys(errors).length) {
      applyFieldErrors(form, errors);
      return;
    }
    busy(button, true, 'Memeriksa…');
    try {
      await api('/api/login', { method: 'POST', body: { email, password } });
      busy(button, false);
      await onSuccess();
    } catch (error) {
      busy(button, false);
      if (error instanceof ApiError && error.fields && Object.keys(error.fields).length) {
        applyFieldErrors(form, error.fields);
      } else {
        applyFieldErrors(form, {}, error.message || 'Gagal masuk. Coba lagi.');
      }
      form.password.value = '';
      form.password.focus();
    }
  });
}
