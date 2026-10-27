import { state } from '../state.js';
import { icon, escapeHtml, badge, emptyState } from '../ui.js';

export async function render(root, key) {
  const module = state.data.roadmap.find((m) => m.key === key);
  if (!module) {
    root.innerHTML = `<div class="page"><a class="btn btn--ghost btn--sm" href="#/dashboard" style="justify-self:start">${icon('arrowLeft', 16)} Dashboard</a>
      ${emptyState({ icon: 'info', title: 'Modul tidak ditemukan', desc: 'Halaman ini tidak tersedia pada versi MVP.' })}</div>`;
    return;
  }

  const status =
    module.status === 'partial'
      ? badge('primary', 'Sebagian aktif', { dot: true })
      : badge('warning', 'Ditunda ke versi berikut', { dot: true });

  root.innerHTML = `<div class="page">
    <div class="page-head">
      <div>
        <h2 class="page-title">${escapeHtml(module.title)}</h2>
        <p class="page-sub">${escapeHtml(module.description)}</p>
      </div>
      ${status}
    </div>

    <div class="banner banner--info" role="note">
      ${icon('info', 18)}
      <div class="banner__body">
        <p class="banner__title">Belum termasuk fitur wajib MVP</p>
        <p class="banner__text">Modul 9–12 pada brief ditandai sekunder. Halaman ini hanya memetakan rencana; tidak ada data yang disimpan atau aksi yang dijalankan dari sini.</p>
      </div>
    </div>

    <div class="grid grid--2">
      <section class="card">
        <h3 class="card__title" style="margin-bottom:10px">Rencana cakupan</h3>
        <ul class="stack stack--sm" style="padding-left:1.1rem">
          ${module.planned.map((item) => `<li class="small soft">${escapeHtml(item)}</li>`).join('')}
        </ul>
      </section>

      <section class="card">
        <h3 class="card__title" style="margin-bottom:10px">Yang sudah tersedia sekarang</h3>
        ${
          key === 'integration'
            ? `<div class="stack stack--sm">
                <p class="small soft">Integrasi Hermes (misi &amp; chat) sudah bisa dikonfigurasi dan diuji.</p>
                <a class="btn btn--secondary btn--sm" href="#/settings" style="justify-self:start">${icon('settings', 15)} Buka pengaturan integrasi</a>
              </div>`
            : key === 'mail'
              ? `<div class="stack stack--sm">
                  <p class="small soft">Tanpa POP mail, balasan lead dan triase email belum bisa dijalankan agent. Approval misi tetap berjalan di aplikasi ini.</p>
                  <a class="btn btn--secondary btn--sm" href="#/missions" style="justify-self:start">${icon('mission', 15)} Lihat misi</a>
                </div>`
              : key === 'automation'
                ? `<p class="small soft">Saat ini misi dijalankan manual lewat tombol Luncurkan. Penjadwalan otomatis belum ada.</p>`
                : `<p class="small soft">Timer fokus dan sticky notes belum dibuat. Task Board sudah bisa dipakai untuk memantau pekerjaan.</p>`
        }
      </section>
    </div>
  </div>`;
}
