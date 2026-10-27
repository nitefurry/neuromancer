import { state, apiChange, brandById, dnaCompleteness, agentById, activeAgents } from '../state.js';
import {
  icon,
  escapeHtml,
  fmtDate,
  fmtNumber,
  emptyState,
  badge,
  field,
  openModal,
  readForm,
  applyFieldErrors,
  busy,
  confirmDialog,
  toast,
  readFileAsBase64,
  avatar,
} from '../ui.js';

const RESEARCH_BADGE = {
  empty: { label: 'Belum ada data', tone: 'neutral' },
  references: { label: 'Referensi siap', tone: 'primary' },
  proposal: { label: 'Draf usulan', tone: 'warning' },
  ready: { label: 'DNA tersimpan', tone: 'success' },
};

export async function renderList(root) {
  const brands = state.data.brands;

  root.innerHTML = `<div class="page">
    <div class="page-head">
      <div>
        <h2 class="page-title">Project &amp; Brand Hub</h2>
        <p class="page-sub">Simpan referensi, Brand DNA, persona, dan produk per brand. Riset bisa dibantu agent.</p>
      </div>
      <button class="btn btn--primary" type="button" data-new-brand>${icon('plus', 17)} Brand baru</button>
    </div>

    ${
      brands.length
        ? `<div class="grid grid--2">${brands
            .map((brand) => {
              const pct = dnaCompleteness(brand);
              const meta = RESEARCH_BADGE[brand.researchStatus] || RESEARCH_BADGE.empty;
              return `<article class="card" style="display:grid;gap:10px">
                <div class="row row--between" style="align-items:flex-start">
                  <div style="min-width:0">
                    <h3 style="font-size:1.05rem">${escapeHtml(brand.name)}</h3>
                    <p class="tiny muted">Diperbarui ${escapeHtml(fmtDate(brand.updatedAt))}</p>
                  </div>
                  ${badge(meta.tone, meta.label)}
                </div>
                <p class="small soft" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${escapeHtml(brand.dna.description || 'Brand DNA belum diisi. Mulai dari referensi lalu jalankan riset.')}</p>
                <div class="row">
                  ${badge('neutral', `${brand.references.length} referensi`)}
                  ${badge('neutral', `${brand.products.length} produk`)}
                  ${badge('neutral', `${brand.personas.length} persona`)}
                </div>
                <div>
                  <div class="row row--between"><span class="tiny muted">Kelengkapan Brand DNA</span><span class="tiny strong">${pct}%</span></div>
                  <div class="meter" style="margin-top:4px"><div class="meter__bar" style="width:${pct}%"></div></div>
                </div>
                <div class="row">
                  <a class="btn btn--secondary btn--sm" href="#/brands/${brand.id}">Buka brand</a>
                  <a class="btn btn--ghost btn--sm" href="#/missions">Buat misi</a>
                </div>
              </article>`;
            })
            .join('')}</div>`
        : emptyState({
            icon: 'brand',
            title: 'Belum ada brand',
            desc: 'Brand Hub menyimpan identitas yang dipakai agent saat menulis, mendesain, dan menyusun kampanye.',
            action: '<button class="btn btn--primary btn--sm" type="button" data-new-brand>Buat brand pertama</button>',
          })
    }
  </div>`;

  root.querySelectorAll('[data-new-brand]').forEach((button) => {
    button.addEventListener('click', () => openBrandForm());
  });
}

export function openBrandForm() {
  const modal = openModal({
    title: 'Brand baru',
    sub: 'Nama brand bisa diubah nanti. Referensi dan DNA diisi pada halaman brand.',
    body: `<form id="brand_form" novalidate><div class="form-grid">
      ${field({ label: 'Nama brand', name: 'name', required: true, attrs: 'minlength="2" maxlength="80" autofocus', placeholder: 'Contoh: Kopi Nusantara' })}
    </div></form>`,
    foot: `<button class="btn btn--ghost" type="button" data-dialog-close>Batal</button>
      <button class="btn btn--primary" type="submit" form="brand_form" id="brand_save">Buat brand</button>`,
  });
  const form = modal.dialog.querySelector('#brand_form');
  const submit = modal.dialog.querySelector('#brand_save');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    applyFieldErrors(form, {});
    const values = readForm(form);
    if (String(values.name || '').trim().length < 2) {
      applyFieldErrors(form, { name: 'Nama brand minimal 2 karakter.' });
      return;
    }
    busy(submit, true);
    try {
      const result = await apiChange('/api/brands', { body: values }, 'Brand dibuat.');
      modal.close();
      location.hash = `#/brands/${result.brand.id}`;
    } catch (error) {
      busy(submit, false);
      applyFieldErrors(form, error.fields || {}, error.message);
    }
  });
}

function tabButton(tab, label, count, active) {
  return `<button class="tab ${active ? 'is-active' : ''}" type="button" role="tab" aria-selected="${active}" data-tab="${tab}">${escapeHtml(label)}${count !== null ? ` (${count})` : ''}</button>`;
}

export async function renderDetail(root, params) {
  const brand = brandById(params.id);
  if (!brand) {
    root.innerHTML = `<div class="page">
      <a class="btn btn--ghost btn--sm" href="#/brands" style="justify-self:start">${icon('arrowLeft', 16)} Brand Hub</a>
      ${emptyState({ icon: 'brand', title: 'Brand tidak ditemukan', desc: 'Brand mungkin sudah dihapus.', action: '<a class="btn btn--secondary btn--sm" href="#/brands">Kembali</a>' })}
    </div>`;
    return;
  }

  const tabs = ['references', 'dna', 'personas', 'products'];
  const stored = sessionStorage.getItem(`nmc-brand-tab-${brand.id}`);
  let activeTab = tabs.includes(stored) ? stored : 'references';
  const meta = RESEARCH_BADGE[brand.researchStatus] || RESEARCH_BADGE.empty;

  const draw = () => {
    const fresh = brandById(brand.id) || brand;
    root.innerHTML = `<div class="page">
      <div class="row">
        <a class="btn btn--ghost btn--sm" href="#/brands">${icon('arrowLeft', 16)} Brand Hub</a>
        <span class="spacer"></span>
        ${badge(meta.tone, RESEARCH_BADGE[fresh.researchStatus]?.label || meta.label)}
      </div>

      <div class="page-head">
        <div style="min-width:0">
          <h2 class="page-title">${escapeHtml(fresh.name)}</h2>
          <p class="page-sub">${escapeHtml(fresh.dna.archetype || 'Arketipe belum diisi')} · ${dnaCompleteness(fresh)}% kelengkapan DNA · ${fmtNumber(fresh.references.length)} referensi</p>
        </div>
        <div class="page-actions">
          <button class="btn btn--ghost btn--sm" type="button" data-rename>${icon('edit', 15)} Ganti nama</button>
          <button class="btn btn--danger btn--sm" type="button" data-delete-brand>${icon('trash', 15)} Hapus</button>
        </div>
      </div>

      <div class="tabs" role="tablist" aria-label="Bagian brand">
        ${tabButton('references', 'Referensi', fresh.references.length, activeTab === 'references')}
        ${tabButton('dna', 'Brand DNA', null, activeTab === 'dna')}
        ${tabButton('personas', 'Persona', fresh.personas.length, activeTab === 'personas')}
        ${tabButton('products', 'Produk', fresh.products.length, activeTab === 'products')}
      </div>

      <div id="brand_tab"></div>
    </div>`;

    root.querySelectorAll('[data-tab]').forEach((button) => {
      button.addEventListener('click', () => {
        activeTab = button.dataset.tab;
        sessionStorage.setItem(`nmc-brand-tab-${brand.id}`, activeTab);
        draw();
      });
    });

    root.querySelector('[data-rename]').addEventListener('click', () => renameBrand(brand.id));
    root.querySelector('[data-delete-brand]').addEventListener('click', () => deleteBrand(brand.id, root));

    const tabRoot = root.querySelector('#brand_tab');
    if (activeTab === 'references') drawReferences(tabRoot, brand.id, draw);
    if (activeTab === 'dna') drawDna(tabRoot, brand.id, draw);
    if (activeTab === 'personas') drawPersonas(tabRoot, brand.id, draw);
    if (activeTab === 'products') drawProducts(tabRoot, brand.id, draw);
  };

  draw();
}

function renameBrand(brandId) {
  const brand = brandById(brandId);
  const modal = openModal({
    title: 'Ganti nama brand',
    body: `<form id="rename_form"><div class="form-grid">${field({ label: 'Nama brand', name: 'name', value: brand.name, required: true, attrs: 'minlength="2" maxlength="80" autofocus' })}</div></form>`,
    foot: `<button class="btn btn--ghost" type="button" data-dialog-close>Batal</button>
      <button class="btn btn--primary" type="submit" form="rename_form" id="rename_save">Simpan</button>`,
  });
  const form = modal.dialog.querySelector('#rename_form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = modal.dialog.querySelector('#rename_save');
    busy(button, true);
    try {
      await apiChange(`/api/brands/${brandId}`, { method: 'PATCH', body: { name: form.name.value } }, 'Nama brand diperbarui.');
      modal.close();
      await renderDetail(document.getElementById('view'), { id: brandId });
    } catch (error) {
      busy(button, false);
      applyFieldErrors(form, error.fields || {}, error.message);
    }
  });
}

async function deleteBrand(brandId, root) {
  const brand = brandById(brandId);
  const answer = await confirmDialog({
    title: 'Hapus brand?',
    message: `"${brand.name}" beserta referensi, DNA, persona, dan produknya akan dihapus. Dokumen dan misi tidak terhapus.`,
    confirmLabel: 'Hapus brand',
    danger: true,
  });
  if (!answer?.confirmed) return;
  try {
    await apiChange(`/api/brands/${brandId}`, { method: 'DELETE' }, 'Brand dihapus.');
    location.hash = '#/brands';
  } catch (error) {
    toast(error.message, 'error');
  }
}

/* ------------------------------------------------------------------ tab: refs */

function drawReferences(tabRoot, brandId, redraw) {
  const brand = brandById(brandId);
  const agents = activeAgents();
  const proposal = brand.researchProposal;

  tabRoot.innerHTML = `<div class="grid grid--2">
    <section class="card">
      <div class="card__head">
        <div>
          <h3 class="card__title">Referensi brand</h3>
          <p class="card__sub">Link website, sosial, atau berkas katalog. Bisa lebih dari satu.</p>
        </div>
        ${badge('neutral', `${brand.references.length} item`)}
      </div>

      ${
        brand.references.length
          ? `<div class="ref-list" style="margin-bottom:14px">
              ${brand.references
                .map(
                  (ref) => `<div class="ref">
                    <span style="color:var(--text-muted)">${icon(ref.type === 'file' ? 'file' : 'link', 18)}</span>
                    <div class="ref__body">
                      <p class="ref__title">${escapeHtml(ref.label)}</p>
                      <p class="ref__url">${escapeHtml(ref.type === 'file' ? 'Berkas diunggah' : ref.url)}</p>
                    </div>
                    ${ref.type === 'file' ? `<a class="icon-btn icon-btn--bare" href="/api/files/${ref.fileId}/download" aria-label="Unduh ${escapeHtml(ref.label)}">${icon('download', 17)}</a>` : ''}
                    <button class="icon-btn icon-btn--bare" type="button" data-del-ref="${ref.id}" aria-label="Hapus referensi ${escapeHtml(ref.label)}">${icon('trash', 17)}</button>
                  </div>`,
                )
                .join('')}
            </div>`
          : `<div style="margin-bottom:14px">${emptyState({ icon: 'link', title: 'Belum ada referensi', desc: 'Tambahkan minimal satu tautan atau berkas agar agent punya bahan riset.' })}</div>`
      }

      <form id="link_form" novalidate>
        <div class="form-grid">
          <p class="section-title">Tambah tautan</p>
          ${field({ label: 'Label', name: 'label', required: true, attrs: 'maxlength="100"', placeholder: 'Contoh: Situs resmi' })}
          ${field({ label: 'URL', name: 'url', type: 'url', required: true, attrs: 'maxlength="500"', placeholder: 'https://contoh.com' })}
          <button class="btn btn--secondary" type="submit" id="link_save">${icon('plus', 16)} Tambah tautan</button>
        </div>
      </form>

      <hr class="divider" />

      <form id="file_form" novalidate>
        <div class="form-grid">
          <p class="section-title">Unggah berkas referensi</p>
          ${field({ label: 'Label berkas', name: 'label', placeholder: 'Contoh: Brand deck 2026', attrs: 'maxlength="100"' })}
          <label class="upload-zone" for="ref_file">
            ${icon('upload', 20)}
            <span>Pilih berkas (maks. 8 MB)</span>
            <input id="ref_file" name="file" type="file" accept=".pdf,.doc,.docx,.txt,.md,.png,.jpg,.jpeg,.webp,.csv,.xlsx" />
          </label>
          <button class="btn btn--secondary" type="submit" id="file_save">${icon('upload', 16)} Unggah &amp; tambahkan</button>
        </div>
      </form>
    </section>

    <section class="card">
      <div class="card__head">
        <div>
          <h3 class="card__title">Riset brand identity</h3>
          <p class="card__sub">Agent menyusun draf Brand DNA dari referensi yang tersedia.</p>
        </div>
        ${icon('sparkles', 20)}
      </div>
      ${
        agents.length
          ? `<div class="form-grid">
              ${field({ label: 'Agent peneliti', name: 'agentId', type: 'select', value: brand.researchProposal?.agentId || agents[0].id, options: agents.map((a) => ({ value: a.id, label: `${a.name} — ${a.role}` })) })}
              <button class="btn btn--primary" type="button" id="run_research">${icon('sparkles', 16)} Jalankan riset</button>
            </div>`
          : `<div class="banner banner--warn">${icon('alert', 18)}<div class="banner__body"><p class="banner__text">Belum ada agent aktif. <a href="#/agents">Aktifkan agent</a> terlebih dahulu.</p></div></div>`
      }
      <p class="tiny muted" style="margin-top:8px">Draf riset bersifat usulan. Selalu review sebelum dipakai untuk produksi.</p>

      ${
        proposal
          ? `<div class="proposal" style="margin-top:14px">
              <div class="row row--between">
                <p class="strong">Draf usulan</p>
                ${badge('primary', `${proposal.referenceCount} referensi`)}
              </div>
              <p class="tiny muted">${escapeHtml(proposal.note)}</p>
              <div class="stack stack--sm">
                <div class="kv"><span class="kv__label">Archetype</span><span class="kv__value">${escapeHtml(proposal.archetype)}</span></div>
                <div class="kv"><span class="kv__label">Key message</span><span class="kv__value">${escapeHtml(proposal.keyMessage)}</span></div>
                <div class="kv"><span class="kv__label">Positioning</span><span class="kv__value">${escapeHtml(proposal.positioning)}</span></div>
              </div>
              <div class="row" style="margin-top:4px">
                <button class="btn btn--secondary btn--sm" type="button" id="apply_proposal">Terapkan ke field kosong</button>
                <button class="btn btn--ghost btn--sm" type="button" id="open_dna_tab">Review di Brand DNA</button>
              </div>
            </div>`
          : ''
      }

      <div class="banner banner--info" style="margin-top:14px">
        ${icon('info', 18)}
        <div class="banner__body"><p class="banner__text">Untuk riset mendalam, buat <a href="#/missions">misi riset</a> dan lampirkan konteks brand di goals.</p></div>
      </div>
    </section>
  </div>`;

  tabRoot.querySelectorAll('[data-del-ref]').forEach((button) => {
    button.addEventListener('click', async () => {
      const answer = await confirmDialog({
        title: 'Hapus referensi?',
        message: 'Referensi ini tidak lagi dipakai saat riset berikutnya.',
        confirmLabel: 'Hapus',
        danger: true,
      });
      if (!answer?.confirmed) return;
      try {
        await apiChange(`/api/brands/${brandId}/references/${button.dataset.delRef}`, { method: 'DELETE' }, 'Referensi dihapus.');
        drawReferences(tabRoot, brandId, redraw);
      } catch (error) {
        toast(error.message, 'error');
      }
    });
  });

  const linkForm = tabRoot.querySelector('#link_form');
  linkForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    applyFieldErrors(linkForm, {});
    const values = readForm(linkForm);
    const button = tabRoot.querySelector('#link_save');
    const errors = {};
    if (!values.label || values.label.trim().length < 2) errors.label = 'Label minimal 2 karakter.';
    if (!/^https?:\/\/.+/.test(String(values.url || '').trim())) errors.url = 'URL harus dimulai http:// atau https://';
    if (Object.keys(errors).length) {
      applyFieldErrors(linkForm, errors);
      return;
    }
    busy(button, true);
    try {
      await apiChange(`/api/brands/${brandId}/references`, { body: { type: 'link', label: values.label, url: values.url } }, 'Tautan ditambahkan.');
      drawReferences(tabRoot, brandId, redraw);
    } catch (error) {
      busy(button, false);
      applyFieldErrors(linkForm, error.fields || {}, error.message);
    }
  });

  const fileForm = tabRoot.querySelector('#file_form');
  fileForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = tabRoot.querySelector('#file_save');
    const input = fileForm.querySelector('#ref_file');
    const file = input.files?.[0];
    if (!file) {
      toast('Pilih berkas terlebih dahulu.', 'error');
      input.focus();
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast('Berkas melebihi 8 MB. Kompres atau pilih berkas lain.', 'error');
      return;
    }
    busy(button, true, 'Mengunggah…');
    try {
      const dataBase64 = await readFileAsBase64(file);
      const uploaded = await apiChange(
        '/api/files',
        { body: { name: file.name, mime: file.type || 'application/octet-stream', dataBase64, kind: 'reference' } },
      );
      const label = String(fileForm.label.value || '').trim() || file.name;
      await apiChange(
        `/api/brands/${brandId}/references`,
        { body: { type: 'file', label, fileId: uploaded.file.id } },
        'Berkas referensi ditambahkan.',
      );
      drawReferences(tabRoot, brandId, redraw);
    } catch (error) {
      busy(button, false);
      toast(error.message, 'error');
    }
  });

  const runButton = tabRoot.querySelector('#run_research');
  runButton?.addEventListener('click', async () => {
    const agentId = tabRoot.querySelector('[name="agentId"]')?.value;
    busy(runButton, true, 'Menjalankan riset…');
    try {
      await apiChange(`/api/brands/${brandId}/research`, { body: { agentId } }, 'Draf riset dibuat. Review sebelum diterapkan.');
      drawReferences(tabRoot, brandId, redraw);
    } catch (error) {
      busy(runButton, false);
      toast(error.message, 'error');
    }
  });

  tabRoot.querySelector('#open_dna_tab')?.addEventListener('click', () => {
    sessionStorage.setItem(`nmc-brand-tab-${brandId}`, 'dna');
    redraw();
  });

  tabRoot.querySelector('#apply_proposal')?.addEventListener('click', async () => {
    const fresh = brandById(brandId);
    const draft = fresh.researchProposal;
    if (!draft) return;
    const dna = fresh.dna;
    const pick = (key) => (String(dna[key] || '').trim() ? dna[key] : draft[key] || dna[key]);
    const payload = {
      brandName: pick('brandName'),
      archetype: pick('archetype'),
      description: pick('description'),
      typography: pick('typography'),
      palette: Array.isArray(dna.palette) && dna.palette.length ? dna.palette : draft.palette,
      voiceTone: pick('voiceTone'),
      keyMessage: pick('keyMessage'),
      statement: pick('statement'),
      niche: pick('niche'),
      specificNiche: pick('specificNiche'),
      superSpecificNiche: pick('superSpecificNiche'),
      positioning: pick('positioning'),
      personas: fresh.personas,
    };
    try {
      await apiChange(`/api/brands/${brandId}/dna`, { body: payload }, 'Usulan diterapkan ke field kosong. Periksa kembali isinya.');
      drawReferences(tabRoot, brandId, redraw);
    } catch (error) {
      toast(error.fields ? Object.values(error.fields)[0] : error.message, 'error');
    }
  });
}

/* ------------------------------------------------------------------- tab: DNA */

function drawDna(tabRoot, brandId, redraw) {
  const brand = brandById(brandId);
  const dna = brand.dna;
  tabRoot.innerHTML = `<section class="card">
    <div class="card__head">
      <div>
        <h3 class="card__title">Brand DNA</h3>
        <p class="card__sub">Semua field wajib. Draft usulan riset bisa dilihat di tab Referensi.</p>
      </div>
      ${badge('neutral', `${dnaCompleteness(brand)}% lengkap`)}
    </div>
    <form id="dna_form" novalidate>
      <div class="form-grid">
        <div class="form-grid form-grid--2">
          ${field({ label: 'Brand Name', name: 'brandName', value: dna.brandName || brand.name, required: true, attrs: 'maxlength="80" minlength="2"' })}
          ${field({ label: 'Brand Archetype', name: 'archetype', value: dna.archetype, required: true, attrs: 'maxlength="80" minlength="2"', placeholder: 'The Sage, The Creator…' })}
        </div>
        ${field({ label: 'Brand Description', name: 'description', type: 'textarea', value: dna.description, required: true, attrs: 'maxlength="800" minlength="10"', rows: 3 })}
        <div class="form-grid form-grid--2">
          ${field({ label: 'Brand Typography', name: 'typography', value: dna.typography, required: true, attrs: 'maxlength="160"', placeholder: 'Display + body font' })}
          ${field({ label: 'Voice Tone', name: 'voiceTone', value: dna.voiceTone, required: true, attrs: 'maxlength="400"' })}
        </div>
        ${field({ label: 'Brand Key Message', name: 'keyMessage', value: dna.keyMessage, required: true, attrs: 'maxlength="240"' })}
        ${field({ label: 'Brand Statement', name: 'statement', type: 'textarea', value: dna.statement, required: true, attrs: 'maxlength="600" minlength="10"', rows: 2 })}
        <div class="form-grid form-grid--2">
          ${field({ label: 'Brand Niche', name: 'niche', value: dna.niche, required: true, attrs: 'maxlength="120"' })}
          ${field({ label: 'Brand Specific Niche', name: 'specificNiche', value: dna.specificNiche, required: true, attrs: 'maxlength="160"' })}
        </div>
        ${field({ label: 'Brand Super Specific Niche', name: 'superSpecificNiche', value: dna.superSpecificNiche, required: true, attrs: 'maxlength="200"' })}
        ${field({ label: 'Positioning', name: 'positioning', type: 'textarea', value: dna.positioning, required: true, attrs: 'maxlength="400"' , rows: 2 })}

        <div class="field" data-field="palette">
          <p class="field__label">Color Palette <span class="req">*</span></p>
          <div class="stack stack--sm" id="palette_rows">
            ${(dna.palette.length ? dna.palette : [{ name: 'Primary', hex: '#1F5FE0' }])
              .map(
                (color, index) => `<div class="color-row" data-palette-row>
                  <input class="color-input" type="color" value="${escapeHtml(color.hex || '#1F5FE0')}" aria-label="Warna ${index + 1}" data-hex />
                  <input class="input" type="text" value="${escapeHtml(color.name || '')}" maxlength="30" placeholder="Nama warna" aria-label="Nama warna ${index + 1}" data-name />
                  <button class="icon-btn icon-btn--bare" type="button" data-remove-color aria-label="Hapus warna ${index + 1}">${icon('trash', 17)}</button>
                </div>`,
              )
              .join('')}
          </div>
          <button class="btn btn--ghost btn--sm" type="button" id="add_color" style="justify-self:start">${icon('plus', 15)} Tambah warna</button>
          <p class="field__hint">Maksimal 8 warna. Gunakan kontras cukup untuk teks.</p>
          <p class="field__error" id="palette_err" role="alert"></p>
        </div>

        <button class="btn btn--primary" type="submit" id="dna_save">${icon('check', 16)} Simpan Brand DNA</button>
      </div>
    </form>
  </section>`;

  const form = tabRoot.querySelector('#dna_form');
  const paletteRows = tabRoot.querySelector('#palette_rows');

  tabRoot.querySelector('#add_color').addEventListener('click', () => {
    const count = paletteRows.querySelectorAll('[data-palette-row]').length;
    if (count >= 8) {
      toast('Maksimal 8 warna palet.', 'error');
      return;
    }
    const row = document.createElement('div');
    row.className = 'color-row';
    row.dataset.paletteRow = '';
    row.innerHTML = `<input class="color-input" type="color" value="#5B9BF8" aria-label="Warna baru" data-hex />
      <input class="input" type="text" maxlength="30" placeholder="Nama warna" aria-label="Nama warna baru" data-name />
      <button class="icon-btn icon-btn--bare" type="button" data-remove-color aria-label="Hapus warna">${icon('trash', 17)}</button>`;
    paletteRows.appendChild(row);
    row.querySelector('[data-name]').focus();
  });

  paletteRows.addEventListener('click', (event) => {
    const remove = event.target.closest('[data-remove-color]');
    if (!remove) return;
    if (paletteRows.querySelectorAll('[data-palette-row]').length === 1) {
      toast('Minimal satu warna palet.', 'error');
      return;
    }
    remove.closest('[data-palette-row]').remove();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    applyFieldErrors(form, {});
    const raw = readForm(form);
    const palette = [...paletteRows.querySelectorAll('[data-palette-row]')].map((row) => ({
      name: row.querySelector('[data-name]').value.trim(),
      hex: row.querySelector('[data-hex]').value,
    }));
    const payload = { ...raw, palette, personas: brandById(brandId).personas };
    delete payload.add_color;
    const button = tabRoot.querySelector('#dna_save');
    busy(button, true);
    try {
      await apiChange(`/api/brands/${brandId}/dna`, { body: payload }, 'Brand DNA disimpan.');
      drawDna(tabRoot, brandId, redraw);
    } catch (error) {
      busy(button, false);
      applyFieldErrors(form, error.fields || {}, error.message);
    }
  });
}

/* -------------------------------------------------------------- tab: personas */

function drawPersonas(tabRoot, brandId, redraw) {
  const brand = brandById(brandId);
  const personas = brand.personas.length ? brand.personas : [];

  tabRoot.innerHTML = `<section class="card">
    <div class="card__head">
      <div>
        <h3 class="card__title">Audience Persona</h3>
        <p class="card__sub">Maksimal 3 persona. Nama wajib; detail lain opsional tetapi membantu agent.</p>
      </div>
      <button class="btn btn--ghost btn--sm" type="button" id="add_persona" ${personas.length >= 3 ? 'disabled' : ''}>${icon('plus', 15)} Tambah persona</button>
    </div>

    <form id="persona_form" novalidate>
      <div class="stack">
        ${
          personas.length
            ? personas.map((persona, index) => personaCard(persona, index)).join('')
            : emptyState({ icon: 'agents', title: 'Belum ada persona', desc: 'Tambahkan persona agar pesan kampanye lebih tepat sasaran.' })
        }
      </div>
      ${personas.length ? `<button class="btn btn--primary" type="submit" id="persona_save" style="margin-top:14px">${icon('check', 16)} Simpan persona</button>` : ''}
    </form>
  </section>`;

  tabRoot.querySelector('#add_persona').addEventListener('click', async () => {
    const fresh = brandById(brandId);
    if (fresh.personas.length >= 3) {
      toast('Maksimal 3 persona.', 'error');
      return;
    }
    const payload = { ...fresh.dna, palette: fresh.dna.palette, personas: [...fresh.personas, { name: 'Persona baru' }] };
    try {
      await apiChange(`/api/brands/${brandId}/dna`, { body: payload }, '');
      drawPersonas(tabRoot, brandId, redraw);
    } catch (error) {
      toast(error.fields ? Object.values(error.fields)[0] : error.message, 'error');
    }
  });

  tabRoot.querySelectorAll('[data-remove-persona]').forEach((button) => {
    button.addEventListener('click', async () => {
      const index = Number(button.dataset.removePersona);
      const fresh = brandById(brandId);
      const answer = await confirmDialog({
        title: 'Hapus persona?',
        message: `Persona "${fresh.personas[index]?.name}" akan dihapus dari brand ini.`,
        confirmLabel: 'Hapus persona',
        danger: true,
      });
      if (!answer?.confirmed) return;
      const payload = { ...fresh.dna, palette: fresh.dna.palette, personas: fresh.personas.filter((_, i) => i !== index) };
      try {
        await apiChange(`/api/brands/${brandId}/dna`, { body: payload }, 'Persona dihapus.');
        drawPersonas(tabRoot, brandId, redraw);
      } catch (error) {
        toast(error.fields ? Object.values(error.fields)[0] : error.message, 'error');
      }
    });
  });

  const form = tabRoot.querySelector('#persona_form');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    applyFieldErrors(form, {});
    const rows = [...form.querySelectorAll('[data-persona]')].map((row, index) => ({
      id: row.dataset.personaId || undefined,
      name: row.querySelector(`[name="personas.${index}.name"]`).value.trim(),
      age: row.querySelector(`[name="personas.${index}.age"]`).value.trim(),
      role: row.querySelector(`[name="personas.${index}.role"]`).value.trim(),
      goals: row.querySelector(`[name="personas.${index}.goals"]`).value.trim(),
      painPoints: row.querySelector(`[name="personas.${index}.painPoints"]`).value.trim(),
      channels: row.querySelector(`[name="personas.${index}.channels"]`).value.trim(),
      index,
    }));
    const errors = {};
    rows.forEach((row) => {
      if (row.name.length < 2) errors[`personas.${row.index}.name`] = `Nama persona ${row.index + 1} minimal 2 karakter.`;
    });
    if (Object.keys(errors).length) {
      applyFieldErrors(form, errors);
      return;
    }
    const fresh = brandById(brandId);
    const payload = { ...fresh.dna, palette: fresh.dna.palette, personas: rows };
    const button = tabRoot.querySelector('#persona_save');
    busy(button, true);
    try {
      await apiChange(`/api/brands/${brandId}/dna`, { body: payload }, 'Persona disimpan.');
      drawPersonas(tabRoot, brandId, redraw);
    } catch (error) {
      busy(button, false);
      applyFieldErrors(form, error.fields || {}, error.message);
    }
  });
}

function personaCard(persona, index) {
  const key = (name) => `personas.${index}.${name}`;
  return `<div class="card card--flat" data-persona data-persona-id="${escapeHtml(persona.id || '')}" style="background:var(--surface-2)">
    <div class="card__head" style="margin-bottom:6px">
      <p class="card__title">Persona ${index + 1}</p>
      <button class="icon-btn icon-btn--bare" type="button" data-remove-persona="${index}" aria-label="Hapus persona ${index + 1}">${icon('trash', 17)}</button>
    </div>
    <div class="form-grid form-grid--2">
      ${field({ label: 'Nama persona', name: key('name'), value: persona.name, required: true, attrs: 'maxlength="60"' })}
      ${field({ label: 'Usia', name: key('age'), value: persona.age, attrs: 'maxlength="40"', placeholder: '27–35' })}
      ${field({ label: 'Peran / pekerjaan', name: key('role'), value: persona.role, attrs: 'maxlength="160"' })}
      ${field({ label: 'Kanal', name: key('channels'), value: persona.channels, attrs: 'maxlength="160"', placeholder: 'Instagram, WhatsApp' })}
    </div>
    <div class="form-grid" style="margin-top:10px">
      ${field({ label: 'Tujuan', name: key('goals'), type: 'textarea', value: persona.goals, attrs: 'maxlength="400"', rows: 2 })}
      ${field({ label: 'Kendala', name: key('painPoints'), type: 'textarea', value: persona.painPoints, attrs: 'maxlength="400"', rows: 2 })}
    </div>
  </div>`;
}

/* -------------------------------------------------------------- tab: products */

function drawProducts(tabRoot, brandId, redraw) {
  const brand = brandById(brandId);

  tabRoot.innerHTML = `<div class="grid grid--2">
    <section class="card">
      <div class="card__head">
        <div>
          <h3 class="card__title">Produk</h3>
          <p class="card__sub">Bisa lebih dari satu. Sertakan katalog atau tautan produk.</p>
        </div>
        ${badge('neutral', `${brand.products.length} produk`)}
      </div>
      ${
        brand.products.length
          ? `<div class="list">
              ${brand.products
                .map(
                  (product) => `<div class="list-item">
                    <div class="list-item__main">
                      <p class="list-item__title">${escapeHtml(product.name)}</p>
                      <p class="tiny muted">${escapeHtml([product.category, product.field].filter(Boolean).join(' · ') || 'Tanpa kategori')}</p>
                      ${
                        product.reference
                          ? `<p class="tiny" style="margin-top:2px;word-break:break-all">${/^https?:\/\//.test(product.reference) ? `<a href="${escapeHtml(product.reference)}" target="_blank" rel="noopener noreferrer">${escapeHtml(product.reference)}</a>` : escapeHtml(product.reference)}</p>`
                          : ''
                      }
                    </div>
                    <button class="icon-btn icon-btn--bare" type="button" data-edit-product="${product.id}" aria-label="Edit ${escapeHtml(product.name)}">${icon('edit', 17)}</button>
                    <button class="icon-btn icon-btn--bare" type="button" data-del-product="${product.id}" aria-label="Hapus ${escapeHtml(product.name)}">${icon('trash', 17)}</button>
                  </div>`,
                )
                .join('')}
            </div>`
          : emptyState({ icon: 'layers', title: 'Belum ada produk', desc: 'Tambahkan produk agar agent tahu apa yang dipromosikan.' })
      }
    </section>

    <section class="card">
      <h3 class="card__title" style="margin-bottom:10px">Tambah produk</h3>
      <form id="product_form" novalidate>
        <div class="form-grid">
          ${field({ label: 'Name', name: 'name', required: true, attrs: 'maxlength="100" minlength="2"', placeholder: 'Nama produk' })}
          ${field({ label: 'Kategori', name: 'category', attrs: 'maxlength="60"', placeholder: 'Serum, biji kopi, SaaS…' })}
          ${field({ label: 'Bidang', name: 'field', attrs: 'maxlength="60"', placeholder: 'Skincare, F&B, Developer tools…' })}
          ${field({ label: 'Referensi produk', name: 'reference', attrs: 'maxlength="500"', placeholder: 'Tautan katalog atau lokasi file' })}
          <button class="btn btn--secondary" type="submit" id="product_save">${icon('plus', 16)} Tambah produk</button>
        </div>
      </form>
    </section>
  </div>`;

  tabRoot.querySelectorAll('[data-del-product]').forEach((button) => {
    button.addEventListener('click', async () => {
      const answer = await confirmDialog({
        title: 'Hapus produk?',
        message: 'Produk ini akan dihapus dari brand.',
        confirmLabel: 'Hapus produk',
        danger: true,
      });
      if (!answer?.confirmed) return;
      try {
        await apiChange(`/api/brands/${brandId}/products/${button.dataset.delProduct}`, { method: 'DELETE' }, 'Produk dihapus.');
        drawProducts(tabRoot, brandId, redraw);
      } catch (error) {
        toast(error.message, 'error');
      }
    });
  });

  tabRoot.querySelectorAll('[data-edit-product]').forEach((button) => {
    button.addEventListener('click', () => {
      const product = brandById(brandId).products.find((p) => p.id === button.dataset.editProduct);
      openProductEdit(brandId, product, tabRoot, redraw);
    });
  });

  const form = tabRoot.querySelector('#product_form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    applyFieldErrors(form, {});
    const values = readForm(form);
    if (String(values.name || '').trim().length < 2) {
      applyFieldErrors(form, { name: 'Nama produk minimal 2 karakter.' });
      return;
    }
    const button = tabRoot.querySelector('#product_save');
    busy(button, true);
    try {
      await apiChange(`/api/brands/${brandId}/products`, { body: values }, 'Produk ditambahkan.');
      drawProducts(tabRoot, brandId, redraw);
    } catch (error) {
      busy(button, false);
      applyFieldErrors(form, error.fields || {}, error.message);
    }
  });
}

function openProductEdit(brandId, product, tabRoot, redraw) {
  if (!product) return;
  const modal = openModal({
    title: 'Edit produk',
    body: `<form id="product_edit" novalidate><div class="form-grid">
      ${field({ label: 'Name', name: 'name', value: product.name, required: true, attrs: 'maxlength="100" autofocus' })}
      ${field({ label: 'Kategori', name: 'category', value: product.category, attrs: 'maxlength="60"' })}
      ${field({ label: 'Bidang', name: 'field', value: product.field, attrs: 'maxlength="60"' })}
      ${field({ label: 'Referensi produk', name: 'reference', value: product.reference, attrs: 'maxlength="500"' })}
    </div></form>`,
    foot: `<button class="btn btn--ghost" type="button" data-dialog-close>Batal</button>
      <button class="btn btn--primary" type="submit" form="product_edit" id="product_edit_save">Simpan</button>`,
  });
  const form = modal.dialog.querySelector('#product_edit');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = modal.dialog.querySelector('#product_edit_save');
    busy(button, true);
    try {
      await apiChange(`/api/brands/${brandId}/products/${product.id}`, { method: 'PATCH', body: readForm(form) }, 'Produk diperbarui.');
      modal.close();
      drawProducts(tabRoot, brandId, redraw);
    } catch (error) {
      busy(button, false);
      applyFieldErrors(form, error.fields || {}, error.message);
    }
  });
}
