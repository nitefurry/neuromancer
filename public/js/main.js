import { state, loadState, subscribe } from './state.js';
import { api } from './api.js';
import { icon, avatar, escapeHtml, fmtNumber } from './ui.js';
import { renderLogin } from './views/login.js';
import * as dashboard from './views/dashboard.js';
import * as brands from './views/brands.js';
import * as missions from './views/missions.js';
import * as board from './views/board.js';
import * as docs from './views/docs.js';
import * as agents from './views/agents.js';
import * as workspace from './views/workspace.js';
import * as chat from './views/chat.js';
import * as settings from './views/settings.js';
import * as roadmap from './views/roadmap.js';

/* ------------------------------------------------------------------- theme */

const THEME_KEY = 'nmc-theme';

export function applyTheme(theme) {
  const resolved =
    theme === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : theme;
  document.documentElement.dataset.theme = resolved;
  document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
    const dark = resolved === 'dark';
    btn.innerHTML = icon(dark ? 'sun' : 'moon', 19);
    btn.setAttribute('aria-label', dark ? 'Aktifkan mode terang' : 'Aktifkan mode gelap');
    btn.setAttribute('title', dark ? 'Mode terang' : 'Mode gelap');
  });
}

function initTheme() {
  let saved = 'system';
  try {
    saved = localStorage.getItem(THEME_KEY) || 'system';
  } catch {
    saved = 'system';
  }
  applyTheme(saved);
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if ((localStorage.getItem(THEME_KEY) || 'system') === 'system') applyTheme('system');
  });
}

export function toggleTheme() {
  const current = document.documentElement.dataset.theme;
  const next = current === 'dark' ? 'light' : 'dark';
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {
    /* storage bisa diblokir; tema tetap berlaku untuk sesi ini */
  }
  applyTheme(next);
}

initTheme();

/* --------------------------------------------------------------------- nav */

const NAV = [
  {
    label: 'Operasional',
    items: [
      { href: '#/dashboard', label: 'Dashboard', icon: 'dashboard' },
      { href: '#/missions', label: 'Missions', icon: 'mission', badge: 'approvals' },
      { href: '#/board', label: 'Task Board', icon: 'board' },
      { href: '#/docs', label: 'Docs', icon: 'docs' },
    ],
  },
  {
    label: 'Workspace',
    items: [
      { href: '#/brands', label: 'Brand Hub', icon: 'brand' },
      { href: '#/agents', label: 'Team Agent', icon: 'agents' },
      { href: '#/chat', label: 'Chat Agent', icon: 'chat' },
      { href: '#/workspace', label: 'File & Workspace', icon: 'workspace' },
    ],
  },
  {
    label: 'Modul lanjutan',
    items: [
      { href: '#/automation', label: 'Automation', icon: 'automation', soon: true },
      { href: '#/integration', label: 'Integration', icon: 'integration', soon: true },
      { href: '#/productivity', label: 'Productivity', icon: 'productivity', soon: true },
      { href: '#/mail', label: 'Mail with Jev', icon: 'mail', soon: true },
    ],
  },
];

const ROUTES = [
  { path: '/dashboard', title: 'Dashboard', eyebrow: 'Operasional', view: dashboard.render },
  { path: '/brands', title: 'Project & Brand Hub', eyebrow: 'Workspace', view: brands.renderList },
  { path: '/brands/:id', title: 'Brand', eyebrow: 'Brand Hub', view: brands.renderDetail },
  { path: '/missions', title: 'Missions', eyebrow: 'Operasional', view: missions.renderList },
  { path: '/missions/:id', title: 'Detail misi', eyebrow: 'Missions', view: missions.renderDetail },
  { path: '/board', title: 'Task Board', eyebrow: 'Operasional', view: board.render },
  { path: '/docs', title: 'Docs', eyebrow: 'Operasional', view: docs.renderList },
  { path: '/docs/:id', title: 'Dokumen', eyebrow: 'Docs', view: docs.renderDetail },
  { path: '/agents', title: 'Team Agent', eyebrow: 'Workspace', view: agents.renderList },
  { path: '/agents/:id', title: 'Agent', eyebrow: 'Team Agent', view: agents.renderDetail },
  { path: '/chat', title: 'Chat with Agent', eyebrow: 'Workspace', view: chat.render },
  { path: '/chat/:id', title: 'Chat with Agent', eyebrow: 'Workspace', view: chat.render },
  { path: '/workspace', title: 'File & Agent Workspace', eyebrow: 'Workspace', view: workspace.render },
  { path: '/settings', title: 'Pengaturan', eyebrow: 'Sistem', view: settings.render },
  { path: '/automation', title: 'Automation', eyebrow: 'Modul lanjutan', view: (root) => roadmap.render(root, 'automation') },
  { path: '/integration', title: 'Integration', eyebrow: 'Modul lanjutan', view: (root) => roadmap.render(root, 'integration') },
  { path: '/productivity', title: 'Productivity', eyebrow: 'Modul lanjutan', view: (root) => roadmap.render(root, 'productivity') },
  { path: '/mail', title: 'Mail with Jev', eyebrow: 'Modul lanjutan', view: (root) => roadmap.render(root, 'mail') },
];

let shell = null;
let sidebarOpen = false;

function currentHash() {
  const raw = location.hash.replace(/^#/, '') || '/dashboard';
  return raw.startsWith('/') ? raw : `/${raw}`;
}

function matchRoute(path) {
  const parts = path.split('/').filter(Boolean);
  for (const route of ROUTES) {
    const segs = route.path.split('/').filter(Boolean);
    if (segs.length !== parts.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < segs.length; i += 1) {
      if (segs[i].startsWith(':')) params[segs[i].slice(1)] = decodeURIComponent(parts[i]);
      else if (segs[i] !== parts[i]) {
        ok = false;
        break;
      }
    }
    if (ok) return { route, params };
  }
  return null;
}

function navHtml(compact = false) {
  const approvals = state.data?.metrics?.needsApproval?.length || 0;
  return NAV.map(
    (group) => `<div class="nav-group">
      <p class="nav-group__label">${escapeHtml(group.label)}</p>
      ${group.items
        .map((item) => {
          const badge =
            item.badge === 'approvals' && approvals > 0
              ? `<span class="nav-link__badge">${approvals}</span>`
              : item.soon
                ? `<span class="nav-link__soon">Ditunda</span>`
                : '';
          return `<a class="nav-link" href="${item.href}" data-nav="${item.href}">
            ${icon(item.icon, 19)}<span>${escapeHtml(item.label)}</span>${badge}
          </a>`;
        })
        .join('')}
    </div>`,
  ).join('');
}

function buildShell() {
  const user = state.data.user;
  const wsName = state.data.settings.workspaceName || 'Neuromancer Mission Control';
  document.getElementById('root').innerHTML = `<div class="app">
    <aside class="sidebar" id="sidebar" aria-label="Navigasi utama">
      <a class="sidebar__brand" href="#/dashboard">
        <span class="sidebar__mark" aria-hidden="true">N</span>
        <span style="min-width:0">
          <span class="sidebar__name">${escapeHtml(wsName)}</span>
          <span class="sidebar__ver">Mission Control · v1.0</span>
        </span>
      </a>
      <nav style="display:contents">${navHtml()}</nav>
      <div class="sidebar__foot">
        <div class="list-item" style="align-items:center">
          ${avatar(user.name, { size: 'sm' })}
          <div class="list-item__main" style="min-width:0">
            <p class="list-item__title truncate">${escapeHtml(user.name)}</p>
            <p class="tiny muted truncate">${escapeHtml(user.email)}</p>
          </div>
        </div>
        <div class="row" style="margin-top:8px;gap:6px">
          <a class="btn btn--ghost btn--sm" href="#/settings" style="flex:1">${icon('settings', 16)} Pengaturan</a>
          <button class="icon-btn" type="button" data-logout aria-label="Keluar">${icon('logout', 18)}</button>
        </div>
      </div>
    </aside>
    <div class="scrim" id="scrim" hidden></div>
    <div style="min-width:0">
      <header class="topbar">
        <button class="icon-btn icon-btn--bare topbar__menu" type="button" data-menu aria-label="Buka menu navigasi" aria-expanded="false" aria-controls="sidebar">${icon('menu', 22)}</button>
        <div class="topbar__titles">
          <p class="topbar__eyebrow" id="page-eyebrow">Operasional</p>
          <h1 class="topbar__title" id="page-title">Dashboard</h1>
        </div>
        <div class="topbar__right">
          <button class="btn btn--primary btn--sm" type="button" data-new-mission>
            ${icon('plus', 16)}<span class="nowrap">Misi</span>
          </button>
          <button class="icon-btn icon-btn--bare" type="button" data-theme-toggle aria-label="Ubah tema"></button>
          <a class="icon-btn icon-btn--bare" href="#/settings" aria-label="Buka pengaturan akun">${avatar(user.name, { size: 'sm' })}</a>
        </div>
      </header>
      <main class="main" id="main" tabindex="-1">
        <div id="view"></div>
      </main>
    </div>
    <nav class="bottomnav" aria-label="Navigasi bawah">
      <a class="bottomnav__item" href="#/dashboard" data-nav="#/dashboard">${icon('dashboard')}<span>Dashboard</span></a>
      <a class="bottomnav__item" href="#/missions" data-nav="#/missions">${icon('mission')}<span>Missions</span></a>
      <a class="bottomnav__item" href="#/board" data-nav="#/board">${icon('board')}<span>Board</span></a>
      <a class="bottomnav__item" href="#/agents" data-nav="#/agents">${icon('agents')}<span>Agents</span></a>
      <button class="bottomnav__item" type="button" data-menu aria-label="Menu lainnya" aria-expanded="false" aria-controls="sidebar">${icon('menu')}<span>Lainnya</span></button>
    </nav>
  </div>`;

  shell = {
    sidebar: document.getElementById('sidebar'),
    scrim: document.getElementById('scrim'),
    view: document.getElementById('view'),
    title: document.getElementById('page-title'),
    eyebrow: document.getElementById('page-eyebrow'),
    main: document.getElementById('main'),
  };

  document.querySelectorAll('[data-menu]').forEach((btn) => {
    btn.addEventListener('click', () => setSidebar(!sidebarOpen));
  });
  shell.scrim.addEventListener('click', () => setSidebar(false));
  document.querySelector('[data-logout]').addEventListener('click', logout);
  document.querySelector('[data-new-mission]').addEventListener('click', () => missions.openMissionForm());
  document.querySelector('.topbar [data-theme-toggle]').addEventListener('click', toggleTheme);
  applyTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');

  shell.sidebar.addEventListener('click', (event) => {
    if (event.target.closest('a')) setSidebar(false);
  });

  updateChrome();
}

function setSidebar(open) {
  sidebarOpen = open;
  shell?.sidebar.classList.toggle('is-open', open);
  if (shell?.scrim) shell.scrim.hidden = !open;
  document.querySelectorAll('[data-menu]').forEach((b) => b.setAttribute('aria-expanded', String(open)));
  document.body.style.overflow = open ? 'hidden' : '';
}

function updateChrome() {
  if (!shell || !state.data) return;
  const path = currentHash();
  document.querySelectorAll('[data-nav]').forEach((link) => {
    const target = link.dataset.nav.replace('#', '');
    const active = path === target || path.startsWith(`${target}/`);
    link.classList.toggle('is-active', active);
    if (link.classList.contains('nav-link')) {
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
  });
  const approvals = state.data.metrics.needsApproval.length;
  const navMission = document.querySelector('.nav-link[data-nav="#/missions"] .nav-link__badge');
  if (navMission) navMission.textContent = String(approvals);
  else if (approvals > 0) {
    const target = document.querySelector('.nav-link[data-nav="#/missions"]');
    if (target && !target.querySelector('.nav-link__badge') && !target.querySelector('.nav-link__soon')) {
      const span = document.createElement('span');
      span.className = 'nav-link__badge';
      span.textContent = String(approvals);
      target.appendChild(span);
    }
  }
  const workspaceName = document.querySelector('.sidebar__name');
  if (workspaceName) workspaceName.textContent = state.data.settings.workspaceName;
}

async function renderRoute() {
  if (!state.data || !shell) return;
  const path = currentHash();
  const match = matchRoute(path);
  if (!match) {
    location.hash = '#/dashboard';
    return;
  }
  setSidebar(false);
  const { route, params } = match;
  shell.eyebrow.textContent = route.eyebrow;
  shell.title.textContent = route.title;
  document.title = `${route.title} · Neuromancer Mission Control`;
  updateChrome();
  const scrollY = window.scrollY;
  shell.view.innerHTML = '';
  try {
    await route.view(shell.view, params);
  } catch (error) {
    console.error(error);
    shell.view.innerHTML = `<div class="page"><div class="banner banner--danger" role="alert">
      ${icon('alert', 18)}<div class="banner__body"><p class="banner__title">Halaman gagal dimuat</p>
      <p class="banner__text">${escapeHtml(error.message || 'Terjadi kesalahan tak terduga.')}</p></div></div>
      <button class="btn btn--secondary" type="button" data-retry-page>${icon('refresh', 16)} Muat ulang</button></div>`;
    shell.view.querySelector('[data-retry-page]')?.addEventListener('click', () => loadState().then(renderRoute));
  }
  window.scrollTo({ top: scrollY, behavior: 'instant' });
  const skipMain = path === currentHash();
  if (skipMain) shell.main.focus({ preventScroll: true });
}

export function go(hash) {
  if (location.hash === hash) renderRoute();
  else location.hash = hash;
}

export async function refreshView() {
  await loadState({ silent: true });
  await renderRoute();
}

export async function logout() {
  try {
    await fetch('/api/logout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  } catch {
    /* tetap tampilkan login */
  }
  state.data = null;
  state.requiresAuth = true;
  renderLoginScreen();
}

function renderLoginScreen() {
  renderLogin(document.getElementById('root'), async () => {
    state.requiresAuth = false;
    await loadState();
    if (state.data) {
      buildShell();
      await renderRoute();
    }
  });
}

/* --------------------------------------------------------------------- boot */

async function boot() {
  try {
    const info = await api('/api/auth-info');
    if (!info.authenticated) {
      state.requiresAuth = true;
      renderLoginScreen();
      return;
    }
  } catch (error) {
    document.getElementById('root').innerHTML = `<div class="login"><div class="login__card">
      <div class="login__mark">N</div>
      <h1 class="login__title">Tidak bisa memuat aplikasi</h1>
      <p class="login__sub">${escapeHtml(error.message)}</p>
      <button class="btn btn--primary btn--block" type="button" id="boot_retry">${icon('refresh', 16)} Coba lagi</button>
    </div></div>`;
    document.getElementById('boot_retry').addEventListener('click', boot);
    return;
  }

  await loadState();
  if (state.requiresAuth || !state.data) {
    if (state.error) {
      document.getElementById('root').innerHTML = `<div class="login"><div class="login__card">
        <div class="login__mark">N</div>
        <h1 class="login__title">Tidak bisa memuat aplikasi</h1>
        <p class="login__sub">${escapeHtml(state.error)}</p>
        <button class="btn btn--primary btn--block" type="button" id="boot_retry">${icon('refresh', 16)} Coba lagi</button>
      </div></div>`;
      document.getElementById('boot_retry').addEventListener('click', boot);
      return;
    }
    renderLoginScreen();
    return;
  }
  buildShell();
  await renderRoute();
}

window.addEventListener('hashchange', renderRoute);

subscribe((next) => {
  if (next.requiresAuth) {
    renderLoginScreen();
    return;
  }
  if (next.data) updateChrome();
});

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && sidebarOpen) setSidebar(false);
});

boot();

export { fmtNumber };
