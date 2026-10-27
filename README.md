# Neuromancer Mission Control V.1.0 (PaaS)

Pusat kendali operasional untuk tim agent AI: misi, approval, brand DNA, task board,
docs, workspace agent, dan chat — dengan konektor Hermes.

Aplikasi berjalan sebagai satu proses Node.js tanpa dependensi runtime, data tersimpan
di server (JSON store + folder upload), dan antarmuka SPA responsif (mobile-first,
mode terang/gelap).

> Status: **MVP fungsional dan diuji** pada Chromium headless di ukuran 375×812,
> 768×1024, dan 1440×900. Lihat [Hasil pengujian](#9-hasil-pengujian) dan
> [Batasan](#10-batasan-yang-masih-ada). Belum diuji pada Hermes asli, POP mail,
> atau perangkat fisik.

![Dashboard desktop](artifacts/final-desktop-dashboard.png)

---

## 1. Ruang lingkup MVP

### Fitur wajib (1–8) — status

| # | Fitur | Status | Catatan |
|---|-------|--------|---------|
| 1 | Dashboard: token per hari, task ongoing, needs approval, aktivitas agent 7/30 hari | Selesai | Grafik token 14 hari + tabel alternatif; heatmap aktivitas dengan toggle 7/30 hari |
| 2 | Project & Brand Hub: riset dari banyak link/berkas, Brand DNA 12 field, 3 persona, banyak produk | Selesai | Riset menghasilkan **draf usulan** yang harus direview; bukan auto-publish |
| 3 | Mission: nama, goals, agent, priority, batas waktu, max steps, notes QC; submit → review → approve → launch; cancel/replan/open result | Selesai | Transisi status dijaga server; setiap aksi masuk timeline |
| 4 | Task Board kanban/list; task otomatis dari misi + input manual | Selesai | Tanpa drag-and-drop; tombol panah (ramah keyboard & sentuh) |
| 5 | Docs: hasil per misi, generate agent, upload manual | Selesai | Markdown viewer sederhana, unduh berkas |
| 6 | File / Agent Workspace: profil, memory, skill, setting (config.yaml) | Selesai | config.yaml disimpan per agent, bisa disalin; validasi YAML belum ada |
| 7 | Team Agent: list aktif/nonaktif + foto, role, model, skill, Soul.md, last task, total task, status, chat; hire agent + review identity; skill library + import | Selesai | Foto profil (unggah) memakai inisial bila kosong |
| 8 | Chat with Agent per sesi | Selesai | Balasan Hermes bila aktif; jika tidak, simulator lokal **selalu diberi label** |

### Fitur sekunder (9–12) — ditunda

| # | Modul | Alasan ditunda |
|---|-------|----------------|
| 9 | Automation (schedule/automate) | Butuh worker/penjadwal persisten; belum ada di MVP |
| 10 | Integration (konektor selain Hermes) | Kontrak tiap layanan berbeda; Hermes sudah tertangani |
| 11 | Productivity (timer, sticky notes) | Tidak memblokir alur inti |
| 12 | Mail with Jev (POP) | Butuh kredensial mailbox, sinkronisasi, dan kebijakan privasi tersendiri |

Halaman modul 9–12 tersedia sebagai **peta jalan** bertanda “Ditunda”. Tidak ada data
palsu atau tombol yang mengklaim berfungsi.

### Asumsi yang dipakai

1. **Kontrak API Hermes tidak tersedia** saat implementasi. Karena itu dibuat adapter
   dengan path yang bisa dikonfigurasi, timeout 8 detik, dan fallback simulator lokal
   yang selalu diberi keterangan. Koneksi nyata harus diverifikasi di VPS Anda.
2. **Satu email = satu workspace, satu peran `owner`** (setup + approval) sesuai brief.
   Belum ada undangan anggota, role lain, atau multi-tenant.
3. **Approval tingkat misi.** Data `approvalPolicy` disiapkan, tetapi approval dokumen
   belum menjadi alur tersendiri.
4. **Penyimpanan lokal**: `data/db.json` + `data/uploads/`. Berkas contoh pada seed
   hanya metadata (tidak bisa diunduh) dan ditandai di UI.
5. **Batas unggah 8 MB/berkas**; total body permintaan 12 MB.
6. **Token dan biaya** dicatat dari respons Hermes bila ada; pada simulator lokal,
   angka adalah estimasi/heuristik dan tidak boleh dipakai sebagai tagihan.
7. **Zona waktu** label `Asia/Jakarta`; agregasi metrik harian memakai tanggal UTC.
8. **Deployment ke domain** tidak dilakukan dari lingkungan ini. Berkas Docker/nginx/
   systemd disediakan; DNS, TLS, dan VPS tetap milik Anda.
9. **Data seed** dibuat deterministik agar dashboard langsung menunjukkan contoh
   aktivitas 30 hari. Semua bisa dihapus dengan menghapus folder `data/`.

---

## 2. Halaman, navigasi, dan alur pengguna

### Peta halaman

| Rute | Halaman | Isi utama |
|------|---------|-----------|
| `#/login` | Masuk | Email + password, info akun demo bila masih default |
| `#/dashboard` | Dashboard | KPI, grafik token, needs approval, task ongoing, heatmap agent, status misi, feed |
| `#/brands` | Brand Hub | Daftar brand + kelengkapan DNA |
| `#/brands/:id` | Detail brand | Tab Referensi (link/berkas + riset), Brand DNA, Persona, Produk |
| `#/missions` | Missions | Cari/filter status, kartu misi, aksi cepat, misi baru |
| `#/missions/:id` | Detail misi | Ringkasan, goals, QC, timeline, task terkait, dokumen hasil, aksi status |
| `#/board` | Task Board | Kanban 4 kolom atau list, filter agent, task manual |
| `#/docs` | Docs | Cari/filter misi, unggah, dokumen manual |
| `#/docs/:id` | Detail dokumen | Markdown viewer, unduh berkas, edit/hapus |
| `#/agents` | Team Agent | Filter aktif/nonaktif, hire agent, skill library |
| `#/agents/:id` | Workspace agent | Tab Profil, Soul.md, Memory, Skill, Setting (config.yaml) |
| `#/chat` | Chat | Daftar sesi + percakapan + composer |
| `#/workspace` | File & Workspace | Ringkasan file tiap agent + berkas terunggah |
| `#/settings` | Pengaturan | Profil, keamanan, tema, workspace, integrasi Hermes, status sistem |
| `#/automation`, `#/integration`, `#/productivity`, `#/mail` | Modul ditunda | Peta jalan + apa yang sudah tersedia |

Navigasi:

- **Desktop ≥1024px**: sidebar tetap dengan grup Operasional, Workspace, Modul lanjutan.
- **Tablet & ponsel <1024px**: bottom nav 5 item (Dashboard, Missions, Board, Agents,
  Lainnya) + drawer berisi navigasi lengkap; `Esc` dan tombol scrim menutup drawer.
- Badge angka pada “Missions” menunjukkan jumlah misi menunggu approval.

### Alur utama (happy path)

```text
Masuk
  └─ Dashboard (lihat token, task, approval, aktivitas)
       ├─ Brand Hub → tambah referensi (link/berkas) → Riset dengan Agent
       │     → review draf → isi Brand DNA + persona + produk
       └─ Missions → Misi baru (goals, agent, priority, limit, steps, QC)
             → [task otomatis di Board: To do]
             → Ajukan review  → status Menunggu review (muncul di Needs Approval)
             → Setujui (owner) → status Disetujui
             → Luncurkan     → status Berjalan (Hermes/simulator)
             → Tandai selesai → status Selesai + dokumen hasil di Docs
             → Buka hasil di Docs / chat dengan agent / replan / cancel
```

Alternatif: task manual dibuat langsung di Board tanpa misi; menyelesaikan task
yang terhubung misi juga menutup misinya.

---

## 3. Struktur data dan aturan validasi

Data disimpan sebagai satu dokumen JSON (`data/db.json`) dengan koleksi berikut.
Validasi server ada di [`lib/validate.js`](lib/validate.js); UI mencerminkan aturan yang
sama dan menampilkan error di bawah field terkait dengan `aria-invalid`.

### User & sesi

| Field | Aturan |
|-------|--------|
| `email` | wajib, format email, unik, ≤160 karakter |
| `password` | ≥8 karakter; disimpan sebagai `scrypt$salt$hash` |
| `name` | 2–60 karakter |
| `role` | `owner` (satu-satunya peran di MVP) |
| sesi | cookie `nmc_session`, HttpOnly, SameSite=Lax, 7 hari; hash token di server |

### Agent

| Field | Aturan |
|-------|--------|
| `name` | 2–40 karakter, unik (case-insensitive) |
| `role` | 2–40 karakter |
| `direction` | 10–600 karakter |
| `model` | 2–80 karakter |
| `status` | `active` / `inactive` |
| `skills` | array nama skill, maks. 10, tiap item ≤40 karakter |
| `soul` | ≤6000 karakter |
| `memory[]` | maks. 200 catatan; tiap teks ≤1000 karakter |
| `configYaml` | ≤8000 karakter (tidak divalidasi sebagai YAML) |
| hapus agent | ditolak `409` bila masih memegang task/misi aktif |

### Brand

| Field | Aturan |
|-------|--------|
| `name` | 2–80 karakter |
| referensi | `type` link/file; label 2–100; URL wajib `http(s)://`; file harus ada; link duplikat ditolak |
| DNA: brandName/archetype/typography/niche/… | wajib, batas 2–800 karakter sesuai field |
| palette | 1–8 warna, format `#RRGGBB` |
| persona | maks. 3; nama wajib 2–60; field lain opsional (≤400) |
| produk | nama wajib 2–100; kategori/bidang/referensi opsional (≤60/≤60/≤500) |
| riset | butuh ≥1 referensi; menghasilkan draf usulan + mencatat aktivitas/token agent |

### Mission

| Field | Aturan |
|-------|--------|
| `name` | 3–120 karakter |
| `goals` | 10–2000 karakter |
| `agentId` | wajib, agent harus ada dan **aktif** |
| `priority` | `low` / `medium` / `high` / `urgent` |
| `timeLimitMinutes` | 1–1440 |
| `maxSteps` | 1–50 |
| `notesQc` | ≤1000 karakter (opsional) |
| edit | hanya saat `draft`/`replan`/`rejected`; selain itu `409` + saran Replan |
| transisi | `submit`, `approve`, `reject`, `launch`, `complete`, `replan`, `cancel` — masing-masing dibatasi status asal; `approve/reject/complete` hanya owner |

Status misi: `draft → pending_review → approved → running → completed`, plus
`rejected`, `replan`, `cancelled`.

### Task

| Field | Aturan |
|-------|--------|
| `title` | 3–120 karakter |
| `description` | ≤2000 karakter |
| `priority` | sama dengan misi |
| `status` | `todo` / `in_progress` / `review` / `done` / `cancelled` |
| `assigneeAgentId` | opsional; harus agent yang ada |

### Dokumen & berkas

| Field | Aturan |
|-------|--------|
| judul | 3–140 karakter |
| isi | ≤40.000 karakter |
| misi | opsional, harus ada bila diisi |
| unggahan | nama ≤160, isi tidak kosong, ≤8 MB; berkas disimpan dengan nama acak |
| unduh | butuh sesi; berkas seed (tanpa isi) menjawab `410` dengan penjelasan |

### Chat & pengaturan

| Field | Aturan |
|-------|--------|
| pesan | 1–4000 karakter, tidak boleh hanya spasi |
| skill | nama 2–40, pola `a-z0-9-`, unik; deskripsi 10–300 |
| settings | nama workspace 2–80; Base URL Hermes harus `http(s)://` dan wajib bila diaktifkan; API key tidak pernah dikirim balik ke browser (dimask) |

---

## 4. Pilihan teknologi

| Lapisan | Pilihan | Alasan |
|---------|---------|--------|
| Runtime | Node.js ≥20.6 (diuji 24.21) | Sudah ada di VPS/Docker; `node:crypto`, `node:http`, ESM cukup |
| Backend | HTTP server murni + router kecil | Tanpa framework; total dependensi runtime **nol** |
| Data | JSON store atomik + folder upload | Satu workspace, volume kecil; mudah dibackup/dipindah |
| Auth | scrypt + cookie HttpOnly + sesi hash di server | Tanpa layanan eksternal |
| Frontend | SPA vanilla ES modules + CSS custom properties | Tanpa build step, bundle kecil, mudah di-deploy di domain apa pun |
| Ikon/visual | SVG inline + glassmorphism/soft-UI | Sesuai arahan visual; tidak perlu aset eksternal/font CDN |

Tidak ada `npm install` yang diperlukan untuk menjalankan aplikasi. Playwright dipakai
hanya sebagai alat uji di lingkungan pengembangan dan **tidak** menjadi dependensi proyek.

---

## 5. Cara menjalankan aplikasi

```bash
# dari root proyek
node -v            # butuh >= 20.6
npm start          # = node server.js
# buka http://localhost:3000
```

Alternatif tanpa npm:

```bash
node server.js
```

Kredensial seed (hanya saat `data/` belum ada):

```text
email    : owner@neuromancer.app
password : missioncontrol
```

> Ganti password segera di **Pengaturan → Keamanan**. Banner peringatan akan tetap
> muncul sampai password default diganti.

Variabel lingkungan:

| Nama | Default | Fungsi |
|------|---------|--------|
| `PORT` | `3000` | Port HTTP |
| `HOST` | `0.0.0.0` | Alamat bind |
| `DATA_DIR` | `./data` | Lokasi `db.json` + `uploads/` |
| `ADMIN_EMAIL` | `owner@neuromancer.app` | Email seed pertama |
| `ADMIN_PASSWORD` | `missioncontrol` | Password seed pertama (diabaikan bila DB sudah ada) |

Reset data demo: hentikan server, hapus folder `data/`, jalankan lagi.

Script:

```bash
npm test           # smoke test API end-to-end (server terpisah, port 3100, data sementara)
```

---

## 6. Deploy ke `https://app.srv2046941.hstgr.cloud/`

Repo ini menyertakan tiga opsi. Pilih salah satu; jangan mengekspos port 3000 langsung
ke internet tanpa TLS/HTTP proxy.

### A. Docker Compose (disarankan)

```bash
# di VPS, dari root proyek
docker compose up -d --build
docker compose logs -f app
```

`docker-compose.yml` memetakan `127.0.0.1:3000` (hanya lokal) dan volume `./data`.
Atur `ADMIN_PASSWORD` sebelum start pertama bila tidak ingin password demo.

### B. systemd

```bash
sudo useradd --system --home /opt/neuromancer --shell /usr/sbin/nologin neuromancer
sudo mkdir -p /opt/neuromancer && sudo cp -r . /opt/neuromancer
sudo chown -R neuromancer:neuromancer /opt/neuromancer
sudo cp deploy/neuromancer.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now neuromancer
curl -s http://127.0.0.1:3000/api/health
```

### C. Reverse proxy + TLS (wajib untuk domain)

```bash
sudo cp deploy/nginx.conf.example /etc/nginx/sites-available/neuromancer
sudo ln -s /etc/nginx/sites-available/neuromancer /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d app.srv2046941.hstgr.cloud
```

Pastikan DNS `A/AAAA` untuk `app.srv2046941.hstgr.cloud` menunjuk ke IP VPS, port
80/443 terbuka, dan header `X-Forwarded-Proto` diteruskan (contoh nginx sudah
mengaturnya). Aplikasi memakai header itu untuk menandai cookie `Secure`.

**Catatan jujur:** lingkungan cloud tempat aplikasi ini dibangun tidak memiliki akses
ke VPS/domain Anda, jadi deployment ke `app.srv2046941.hstgr.cloud` belum dijalankan
dan belum diuji dari internet. Yang sudah diuji adalah aplikasi yang sama berjalan di
`127.0.0.1:3000`, termasuk restart dan persistensi data.

Setelah deploy, lakukan pemeriksaan cepat:

```bash
curl -s https://app.srv2046941.hstgr.cloud/api/health
# login di browser, ganti password, buat 1 misi → approve → launch → complete
```

---

## 7. Integrasi Hermes

Buka **Pengaturan → Integrasi Hermes**: aktifkan, isi Base URL (mis. `http://hermes:8080`
dari container yang satu network), API key bila perlu, lalu **Tes koneksi**.

Kontrak yang diasumsikan:

```http
GET  {baseUrl}{healthPath}          -> 2xx bila hidup
POST {baseUrl}{missionPath}         body {mission, agent} -> {result?, tokens?}
POST {baseUrl}{chatPath}            body {session, agent, messages} -> {reply, tokens?}

Authorization: Bearer {apiKey}      (bila diisi)
```

- Timeout 8 detik per permintaan.
- Jika gagal dan “simulator lokal” aktif, aplikasi memakai simulator dan menuliskan
  catatan sumber pada hasil misi/chat. Dokumen hasil simulator juga diberi peringatan.
- Jika “simulator lokal” dimatikan, chat akan error dengan pesan yang bisa ditindaklanjuti
  dan misi tidak diluncurkan.
- Token dari respons Hermes dicatat ke metrik harian; tanpa itu, angka adalah estimasi.
- Menyesuaikan path nyata Hermes cukup dari UI (health/mission/chat path).

---

## 8. Fitur yang sudah berfungsi (diuji)

**Autentikasi & workspace**

- Login/logout, sesi cookie 7 hari, ganti nama/email, ganti password (sesi lain keluar),
  pembatasan 8 percobaan login / 5 menit.
- Banner password default + tautan langsung ke pengaturan keamanan.

**Dashboard**

- Token per hari (14 hari) dengan angka hari ini/7/30 hari dan tabel alternatif.
- Jumlah task berjalan, misi butuh approval, agent aktif.
- Heatmap aktivitas agent 7/30 hari + feed aktivitas.
- Distribusi status misi & daftar misi menunggu approval dengan aksi Setujui.

**Brand Hub**

- CRUD brand; referensi link tanpa batas + unggah berkas; riset oleh agent dengan draf
  usulan; penerapan draf ke field kosong; simpan 12 field Brand DNA + palet warna;
  hingga 3 persona (tambah/hapus/simpan); CRUD produk.

**Missions**

- Buat/edit draf dengan validasi lengkap, task otomatis di Board.
- Alur submit → approve → launch → complete dengan konfirmasi, catatan, dan timeline.
- Reject, replan, cancel; “Open result in Docs”; badge status; filter/pencarian.
- Dispatch ke Hermes atau simulator lokal; token & aktivitas agent tercatat.

**Task Board**

- Kanban 4 kolom dan tampilan list; filter agent; tambah/edit/hapus task manual.
- Pindah status dengan tombol (bukan hanya drag), sehingga bisa dipakai keyboard/sentuh.
- Menyelesaikan task bermisi ikut menyelesaikan misinya.

**Docs**

- Dokumen hasil misi otomatis, dokumen manual (markdown), unggah berkas, filter misi,
  pencarian, unduh, hapus, render heading/list/bold/kode/kutipan.

**Team Agent & workspace**

- Daftar agent aktif/nonaktif dengan foto/ini sial, role, model, skill, last task,
  total task, success rate, tombol Chat.
- Hire agent dua langkah: isi identitas → **Review Agent Identity (Soul.md)** → simpan.
- Detail agent: edit profil, unggah foto, kelola skill, editor Soul.md (termasuk
  regenerate dari direction), memory (tambah/hapus), config.yaml (simpan/salin).
- Skill library + import skill + hapus skill kustom.

**Chat**

- Sesi per agent, judul otomatis dari pesan pertama, hapus sesi.
- Kirim dengan Enter (Shift+Enter baris baru), indikator menulis, error yang bisa
  diulang, label sumber balasan (Hermes vs simulator lokal).

**Lain-lain**

- Mode terang/gelap/sistem; drawer + bottom nav; empty state, skeleton/loading state,
  error state, toast, dialog konfirmasi dengan focus trap dan `Esc`.
- Halaman roadmap untuk modul yang ditunda (tanpa data palsu).

---

## 9. Hasil pengujian

Semua uji dijalankan pada build ini, bukan pada versi sebelumnya.

### A. Smoke test API — `npm test`

Server dijalankan terpisah (`DATA_DIR` sementara, port 3100) agar data demo tidak
tercampur.

```text
22 pengujian lulus, 0 gagal.
```

Mencakup: 401 tanpa sesi, password salah, login sukses + cookie HttpOnly, state termask,
415 tanpa JSON, 403 origin asing, validasi misi per-field, pembuatan misi + task otomatis,
submit → approve → launch (fallback lokal) → complete + dokumen, aksi tidak valid (409),
CRUD task, brand + referensi + riset + validasi DNA, preview/hire agent + memory,
chat dibalas simulator + label, pesan kosong (422), unggah + unduh berkas (isi identik),
berkas >8 MB (413), validasi URL Hermes, tes koneksi gagal dengan pesan jelas,
password lama salah (422), ganti password + login dengan password baru, logout (401).

### B. Audit UI browser (Chromium headless, Playwright)

Viewport: **375×812 (ponsel), 768×1024 (tablet), 1440×900 (desktop)**. 14 rute per
viewport, termasuk detail misi/dokumen/brand/agent, board, chat, workspace, settings,
dan halaman roadmap.

```text
Masalah ditemukan: 0
```

Yang diperiksa dan lulus:

- Tidak ada **scroll horizontal halaman** pada ketiga ukuran (selisih 0px).
- Tidak ada error console / page error / request gagal setelah login.
- Target interaktif ≥24px (ponsel dan desktop).
- Drawer navigasi terbuka, scrim menutup, `Esc` menutup, fokus keyboard berpindah ke kontrol.
- Alur end-to-end lewat UI di desktop: buat misi → submit → setujui → luncurkan →
  tandai selesai → dokumen hasil terbuka; task manual dibuat → dipindah → dihapus;
  chat mengirim pesan dan menerima balasan berlabel; mode gelap aktif; tes Hermes
  menampilkan pesan kegagalan yang jelas.
- Dialog konfirmasi berfungsi (regresi ditemukan saat pengujian lalu diperbaiki).

### C. Audit formulir (UI, 10 alur)

```text
Masalah formulir: 0
```

Brand baru, simpan Brand DNA, tambah + simpan persona, tambah produk, unggah referensi,
hire agent + review Soul.md, simpan nama workspace, dokumen manual + render markdown,
tampilan list Board, dan validasi form misi (2 pesan field tampil, fokus pindah ke field
pertama yang salah).

### D. Persistensi & sesi

Task dibuat → server di-restart → task **masih ada** dan cookie sesi masih valid;
task uji dihapus kembali. Data demo akhir dikembalikan ke kondisi seed bersih.

### E. Bukti visual

Tersedia di [`artifacts/`](artifacts):

- [Ponsel – dashboard](artifacts/final-mobile-dashboard.png) ·
  [chat](artifacts/final-mobile-chat.png) ·
  [brand](artifacts/final-mobile-brand.png) ·
  [mode gelap](artifacts/final-mobile-dark.png)
- [Tablet – dashboard](artifacts/final-tablet-dashboard.png) ·
  [missions](artifacts/final-tablet-missions.png)
- [Desktop – dashboard](artifacts/final-desktop-dashboard.png) ·
  [board](artifacts/final-desktop-board.png) ·
  [agents](artifacts/final-desktop-agents.png)

### Yang belum diuji

- Koneksi ke instance Hermes nyata (tidak ada endpoint/kredensial di lingkungan ini).
- POP mail/IMAP, modul 9–12 (memang ditunda).
- Perangkat fisik iOS/Android, Safari/Firefox, dan screen reader nyata. Yang diperiksa
  baru struktur semantik, label ARIA, urutan fokus, dan penutupan dialog via `Esc`.
- Uji beban/konkurensi dan multi-worker (store JSON dirancang untuk satu proses).
- Deployment pada domain `app.srv2046941.hstgr.cloud` (tidak ada akses VPS).

---

## 10. Batasan yang masih ada

1. **Satu pengguna/workspace.** Belum ada multi-workspace, undangan, atau role lain.
2. **Penyimpanan JSON satu proses.** Penulisan memakai file sementara + rename, tetapi
   belum aman untuk beberapa instance yang menulis bersamaan. Untuk skala lebih besar,
   migrasikan ke database relasional.
3. **Tanpa enkripsi at-rest** untuk `db.json`; API key Hermes tersimpan plaintext di server
   (tidak pernah dikirim ke browser). Batasi permission folder `data/`.
4. **Upload tanpa pemindaian malware** dan tanpa kuota per workspace; hanya batas 8 MB
   dan daftar ekstensi di UI (server menerima MIME apa pun).
5. **Rate limit login disimpan di memori** dan hilang saat restart.
6. **Belum ada CSRF token**; proteksi memakai SameSite=Lax, pengecekan Origin, dan
   Content-Type JSON. Cukup untuk MVP satu-origin, tetapi bukan pertahanan lengkap.
7. **Belum ada verifikasi email, reset password, 2FA, atau audit log permanen**
   (riwayat aktivitas dibatasi 4000 entri, event 500 entri).
8. **Token/biaya adalah estimasi** saat Hermes tidak terhubung.
9. **Riset brand rule-based** — hasilnya draf yang harus direview; bukan riset web penuh.
10. **config.yaml tidak divalidasi** sebagai YAML dan tidak dieksekusi; hanya disimpan.
11. **Task Board belum drag-and-drop antar kolom**; memakai tombol panah dan form status.
12. **Modul Automation/Integration/Productivity/Mail** belum ada implementasinya.
13. **Tidak ada backup otomatis**; backup berarti menyalin folder `data/` (dalam keadaan
    server berhenti atau setelah flush).
14. **Zona waktu** hanya label; agregasi harian memakai UTC sehingga “hari ini” bisa
    bergeser bagi pengguna WIB di sekitar tengah malam.
15. **Tidak ada pagination**; daftar tugas/dokumen dirender sekaligus. Aman untuk data
    MVP, perlu diperbaiki saat ribuan item.

---

## 11. Struktur proyek

```text
server.js                HTTP server, router API, keamanan dasar, static handler
lib/
  store.js               muat/simpan JSON atomik, helper metrik & aktivitas
  seed.js                data demo deterministik (30 hari metrik)
  auth.js                sesi, cookie, lookup user
  password.js            scrypt hash/verify
  validate.js            seluruh aturan validasi server
  metrics.js             agregasi dashboard
  hermes.js              adapter Hermes + simulator berlabel
public/
  index.html             shell minimal (skip link, root, toast)
  css/app.css            design system + mobile-first responsive
  js/main.js             shell, navigasi, tema, router, boot/login
  js/api.js              fetch wrapper + ApiError
  js/ui.js               ikon, format, dialog, toast, markdown, helper form
  js/state.js             state global + mutasi
  js/views/*.js           dashboard, brands, missions, board, docs, agents,
                          workspace, chat, settings, roadmap, login
test/smoke.test.js       uji API end-to-end
deploy/                  contoh nginx + systemd
Dockerfile, docker-compose.yml
artifacts/               tangkapan layar hasil pengujian
data/                    (dibuat saat runtime; jangan di-commit)
```

---

## 12. Catatan keamanan

- Password di-hash scrypt dengan salt acak; tidak ada password mentah di disk/log.
- Cookie sesi: `HttpOnly`, `SameSite=Lax`, `Secure` otomatis di belakang HTTPS,
  `Max-Age` 7 hari. Token disimpan sebagai hash SHA-256 di server.
- Semua endpoint selain login/health/auth-info memerlukan sesi; aksi approval/pengaturan
  memeriksa peran `owner`.
- Header: CSP (tanpa inline script), `X-Content-Type-Options`, `X-Frame-Options: DENY`,
  `Referrer-Policy`, `Permissions-Policy`.
- API key Hermes dimask pada `/api/state` dan tidak pernah dirender di browser.
- Ganti password default sebelum membuka domain ke publik. Untuk produksi, tambahkan
  backup rutin `data/`, batasi akses SSH, dan pertimbangkan rate limit di reverse proxy.

