/**
 * Seed data demo — dipakai sekali saat data/db.json belum ada.
 * Nilai deterministik supaya angka dashboard konsisten di setiap instalasi baru.
 */
import { hashPassword } from './password.js';

const DEFAULT_EMAIL = process.env.ADMIN_EMAIL || 'owner@neuromancer.app';
export const DEFAULT_PASSWORD = process.env.ADMIN_PASSWORD || 'missioncontrol';

function makeRandom(seed) {
  let state = seed % 2147483647;
  if (state <= 0) state += 2147483646;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

function daysAgo(n, hours = 9) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  d.setUTCHours(hours, 15, 0, 0);
  return d.toISOString();
}

function dateKey(iso) {
  return new Date(iso).toISOString().slice(0, 10);
}

const AGENT_SEED = [
  {
    name: 'Hermes',
    role: 'Orchestrator',
    model: 'hermes/orchestrator-v2',
    status: 'active',
    skills: ['prompt-engineering', 'qa-review', 'campaign-planning'],
    color: '#1F5FE0',
    direction:
      'Pecah misi menjadi langkah kecil, delegasikan ke agent yang tepat, dan jaga kualitas hasil akhir.',
    soul: 'Kamu adalah Hermes, orkestrator tim agent. Kamu tidak menulis konten sendiri kecuali diminta; kamu mendelegasikan, memeriksa, dan menyatukan hasil. Selalu laporkan progres dalam bahasa manusia dan tandai risiko lebih awal.',
    lastTask: 'Sinkronisasi kampanye Aurora Skin Q4',
    totalAssigned: 48,
    successRate: 94,
    lastActiveDays: 0,
  },
  {
    name: 'Rani',
    role: 'Researcher',
    model: 'openai/gpt-5',
    status: 'active',
    skills: ['brand-research', 'web-scraping', 'data-viz'],
    color: '#5B9BF8',
    direction:
      'Validasi asumsi pasar dengan sumber primer, ringkas temuan dalam 5 poin, sertakan tautan bukti.',
    soul: 'Kamu adalah Rani, peneliti. Kamu tidak berhalusinasi sumber. Jika data tidak tersedia, kamu menuliskan "data belum ditemukan" beserta cara mendapatkannya.',
    lastTask: 'Riset persona Kopi Nusantara',
    totalAssigned: 31,
    successRate: 96,
    lastActiveDays: 1,
  },
  {
    name: 'Bima',
    role: 'Content Writer',
    model: 'anthropic/claude-sonnet-4.5',
    status: 'active',
    skills: ['seo-writing', 'campaign-planning'],
    color: '#8A6CF6',
    direction:
      'Tulis dengan voice tone brand, panjang 600–900 kata, satu CTA utama per artikel.',
    soul: 'Kamu adalah Bima, penulis konten. Gaya tulisan mengikuti Brand DNA yang diberikan dan tidak menambahkan klaim yang tidak ada di brief.',
    lastTask: 'Artikel "Ritual Pagi Nusantara"',
    totalAssigned: 57,
    successRate: 91,
    lastActiveDays: 0,
  },
  {
    name: 'Sena',
    role: 'Designer',
    model: 'google/gemini-2.5-pro',
    status: 'active',
    skills: ['brand-research', 'data-viz'],
    color: '#E4739B',
    direction:
      'Buat moodboard, palet, dan tipografi yang konsisten dengan archetype brand.',
    soul: 'Kamu adalah Sena, desainer. Setiap keputusan visual harus bisa dijelaskan lewat Brand DNA dan aksesibilitas kontras.',
    lastTask: 'Moodboard Aurora Skin',
    totalAssigned: 22,
    successRate: 89,
    lastActiveDays: 2,
  },
  {
    name: 'Arya',
    role: 'Developer',
    model: 'meta/llama-4-70b',
    status: 'active',
    skills: ['prompt-engineering', 'qa-review'],
    color: '#2E9E8F',
    direction:
      'Implementasi kecil dan terukur, sertakan langkah verifikasi di setiap hasil.',
    soul: 'Kamu adalah Arya, engineer. Kamu menulis kode yang bisa dijalankan, menyebut asumsi, dan tidak menandai pekerjaan selesai tanpa bukti uji.',
    lastTask: 'Integrasi webhook Hermes',
    totalAssigned: 26,
    successRate: 97,
    lastActiveDays: 1,
  },
  {
    name: 'Dita',
    role: 'Marketing Strategist',
    model: 'openai/gpt-5',
    status: 'active',
    skills: ['campaign-planning', 'seo-writing', 'lead-reply'],
    color: '#E39A3B',
    direction:
      'Susun rencana kampanye berbasis funnel, target CAC, dan kalender 4 minggu.',
    soul: 'Kamu adalah Dita, strategist marketing. Rekomendasi harus punya metrik keberhasilan dan asumsi biaya yang eksplisit.',
    lastTask: 'Kalender kampanye Nimbus Dev',
    totalAssigned: 39,
    successRate: 92,
    lastActiveDays: 3,
  },
  {
    name: 'Nadia',
    role: 'Data Analyst',
    model: 'google/gemini-2.5-pro',
    status: 'inactive',
    skills: ['data-viz', 'qa-review'],
    color: '#6B7B95',
    direction:
      'Jawab pertanyaan dengan angka, tunjukkan periode data, dan sebutkan keterbatasan.',
    soul: 'Kamu adalah Nadia, analis data. Tidak ada angka tanpa periode dan sumber.',
    lastTask: 'Laporan retensi 30 hari',
    totalAssigned: 18,
    successRate: 95,
    lastActiveDays: 21,
  },
  {
    name: 'Yusuf',
    role: 'Sales',
    model: 'openai/gpt-5-mini',
    status: 'inactive',
    skills: ['lead-reply'],
    color: '#9AA6BC',
    direction:
      'Kualifikasi lead dengan 3 pertanyaan, ajukan demo hanya jika budget jelas.',
    soul: 'Kamu adalah Yusuf, sales. Nada bicara membantu, tidak memaksa, dan selalu menutup dengan langkah berikutnya.',
    lastTask: 'Follow-up 12 lead inboound',
    totalAssigned: 12,
    successRate: 83,
    lastActiveDays: 34,
  },
];

const SKILL_LIBRARY = [
  ['brand-research', 'Research', 'Riset identitas brand dari tautan/katalog dan menyusun draf Brand DNA.'],
  ['seo-writing', 'Content', 'Menulis artikel panjang dengan struktur SEO dan satu CTA utama.'],
  ['campaign-planning', 'Marketing', 'Menyusun rencana kampanye 4 minggu beserta metrik dan asumsi biaya.'],
  ['data-viz', 'Analytics', 'Mengubah data mentah menjadi ringkasan visual dan tabel yang mudah dibaca.'],
  ['qa-review', 'Quality', 'Memeriksa hasil agent terhadap brief, tone brand, dan batasan misi.'],
  ['lead-reply', 'Sales', 'Membalas lead masuk dengan kualifikasi singkat dan langkah lanjutan.'],
  ['web-scraping', 'Research', 'Mengambil data publik dari halaman referensi secara terstruktur.'],
  ['prompt-engineering', 'Engineering', 'Menyusun instruksi agent yang dapat diuji dan diulang.'],
];

export function seedDatabase() {
  const rand = makeRandom(2046941);
  const now = new Date().toISOString();
  const agentIds = AGENT_SEED.map((_, index) => `agt_${(index + 1).toString().padStart(3, '0')}`);

  const agents = AGENT_SEED.map((agent, index) => ({
    id: agentIds[index],
    name: agent.name,
    role: agent.role,
    model: agent.model,
    status: agent.status,
    skills: agent.skills,
    color: agent.color,
    direction: agent.direction,
    soul: agent.soul,
    identityApproved: true,
    photoFileId: null,
    memory: [
      {
        id: `mem_${index}_1`,
        at: daysAgo(6),
        text: `Preferensi kerja: ${agent.direction}`,
        source: 'seed',
      },
      {
        id: `mem_${index}_2`,
        at: daysAgo(2),
        text: `Brand aktif terakhir: ${index % 2 === 0 ? 'Kopi Nusantara' : 'Aurora Skin'}.`,
        source: 'seed',
      },
    ],
    configYaml: [
      `agent: ${agent.name.toLowerCase()}`,
      `role: ${agent.role}`,
      `model: ${agent.model}`,
      'temperature: 0.4',
      'max_steps: 12',
      'tools:',
      '  - search',
      '  - files',
      '  - docs',
      'memory:',
      '  strategy: summarize',
      '  window: 20',
    ].join('\n'),
    lastTask: agent.lastTask,
    totalAssigned: agent.totalAssigned,
    successRate: agent.successRate,
    createdAt: daysAgo(120 - index * 4),
    updatedAt: daysAgo(agent.lastActiveDays),
  }));

  const brands = [
    {
      id: 'brd_001',
      name: 'Kopi Nusantara',
      references: [
        { id: 'ref_001', type: 'link', url: 'https://kopinusantara.example.com', label: 'Situs resmi', addedAt: daysAgo(40) },
        { id: 'ref_002', type: 'link', url: 'https://instagram.com/kopinusantara', label: 'Instagram', addedAt: daysAgo(40) },
        { id: 'ref_003', type: 'file', fileId: 'fil_001', label: 'Katalog biji kopi 2026.pdf', addedAt: daysAgo(39) },
      ],
      dna: {
        brandName: 'Kopi Nusantara',
        archetype: 'The Caregiver',
        description:
          'Kedai kopi specialty yang merawat petani lokal dan ritual seduh lambat untuk penikmat kota.',
        typography: 'Fraunces (display) + Inter (body)',
        palette: [
          { name: 'Cobalt', hex: '#1F5FE0' },
          { name: 'Ivory', hex: '#F7F4EE' },
          { name: 'Charcoal', hex: '#22262E' },
          { name: 'Clay', hex: '#C77B4E' },
        ],
        voiceTone: 'Hangat, tenang, tidak menggurui; pakai kata kerja konkret.',
        keyMessage: 'Kopi yang tumbuh pelan, diseduh dengan sabar.',
        statement:
          'Kami menghubungkan petani dataran tinggi dengan ritual pagi orang kota, satu cangkir setiap hari.',
        niche: 'Kopi specialty',
        specificNiche: 'Single origin Indonesia',
        superSpecificNiche: 'Arabika Gayo proses natural untuk manual brew',
        positioning: 'Satu-satunya kedai yang menampilkan nama petani di setiap kemasan.',
      },
      personas: [
        {
          id: 'per_001',
          name: 'Ritualis Pagi',
          age: '27–35',
          role: 'Karyawan kreatif di kota besar',
          goals: 'Ritual seduh 10 menit yang konsisten sebelum bekerja.',
          painPoints: 'Bingung memilih beans; takut rasanya terlalu asam.',
          channels: 'Instagram, newsletter',
        },
        {
          id: 'per_002',
          name: 'Pencari Cerita',
          age: '30–45',
          role: 'Pemilik kafe kecil',
          goals: 'Menu with cerita asal-usul untuk pelanggan.',
          painPoints: 'Supplier tidak transparan soal harga petani.',
          channels: 'WhatsApp, kunjungan langsung',
        },
        {
          id: 'per_003',
          name: 'Pemberi Hadiah',
          age: '25–40',
          role: 'Profesional yang mencari hampers',
          goals: 'Hadiah kopi yang terlihat personal dan rapi.',
          painPoints: 'Kemasan terlihat generik.',
          channels: 'Marketplace, Instagram',
        },
      ],
      products: [
        {
          id: 'prd_001',
          name: 'Gayo Natural 200g',
          category: 'Biji kopi',
          field: 'Single origin',
          reference: 'https://kopinusantara.example.com/gayo',
        },
        {
          id: 'prd_002',
          name: 'Hampers Ritual Pagi',
          category: 'Paket hadiah',
          field: 'Retail',
          reference: 'Katalog 2026 hal. 12',
        },
      ],
      researchStatus: 'ready',
      researchNote: 'Draf disusun Rani dari 3 referensi pada 40 hari lalu.',
      createdAt: daysAgo(41),
      updatedAt: daysAgo(12),
    },
    {
      id: 'brd_002',
      name: 'Aurora Skin',
      references: [
        { id: 'ref_004', type: 'link', url: 'https://auroraskin.example.com', label: 'Situs resmi', addedAt: daysAgo(30) },
        { id: 'ref_005', type: 'file', fileId: 'fil_002', label: 'Brand deck Aurora.pdf', addedAt: daysAgo(29) },
      ],
      dna: {
        brandName: 'Aurora Skin',
        archetype: 'The Sage',
        description: 'Skincare berbasis bahan aktif dengan penjelasan ilmiah yang mudah dicerna.',
        typography: 'Satoshi (display) + Source Serif (body)',
        palette: [
          { name: 'Mist', hex: '#DCE3EF' },
          { name: 'Sky', hex: '#5B9BF8' },
          { name: 'Ivory', hex: '#F9F7F2' },
        ],
        voiceTone: 'Jelas, berbasis bukti, tanpa klaim berlebihan.',
        keyMessage: 'Kulitmu layak mendapat penjelasan, bukan janji.',
        statement: 'Setiap formula dijelaskan bahan aktif, kadar, dan bukti ujinya.',
        niche: 'Skincare',
        specificNiche: 'Skin barrier',
        superSpecificNiche: 'Ceramide untuk kulit sensitif iklim tropis',
        positioning: 'Skincare transparan dengan daftar kadar aktif di depan kemasan.',
      },
      personas: [
        {
          id: 'per_004',
          name: 'Analitis',
          age: '24–34',
          role: 'Pekerja kantoran dengan kulit sensitif',
          goals: 'Rutinitas 3 langkah yang tidak memicu iritasi.',
          painPoints: 'Klaim marketing berlebihan; takut breakout.',
          channels: 'TikTok, review marketplace',
        },
        {
          id: 'per_005',
          name: 'Ibu Praktis',
          age: '32–45',
          role: 'Ibu dengan waktu terbatas',
          goals: 'Produk aman untuk seluruh keluarga.',
          painPoints: 'Terlalu banyak langkah dan produk.',
          channels: 'WhatsApp, Facebook',
        },
        {
          id: 'per_006',
          name: 'Barrier Seeker',
          age: '20–28',
          role: 'Mahasiswa pengguna retinol',
          goals: 'Memulihkan skin barrier setelah eksfoliasi.',
          painPoints: 'Bingung urutan pemakaian.',
          channels: 'TikTok, Discord',
        },
      ],
      products: [
        {
          id: 'prd_003',
          name: 'Barrier Serum 5% Ceramide',
          category: 'Serum',
          field: 'Skincare',
          reference: 'https://auroraskin.example.com/serum',
        },
      ],
      researchStatus: 'ready',
      researchNote: 'Draf disusun Sena dari brand deck.',
      createdAt: daysAgo(31),
      updatedAt: daysAgo(5),
    },
    {
      id: 'brd_003',
      name: 'Nimbus Dev',
      references: [
        { id: 'ref_006', type: 'link', url: 'https://nimbus.example.dev', label: 'Dokumentasi produk', addedAt: daysAgo(9) },
      ],
      dna: {
        brandName: 'Nimbus Dev',
        archetype: 'The Creator',
        description: 'Alat deployment untuk tim kecil yang ingin rilis tanpa drama.',
        typography: 'Inter (semua)',
        palette: [
          { name: 'Charcoal', hex: '#22262E' },
          { name: 'Cobalt', hex: '#1F5FE0' },
          { name: 'Mint', hex: '#3FC1A0' },
        ],
        voiceTone: 'Ringkas, teknis, sedikit jenaka.',
        keyMessage: 'Rilis Jumat sore pun aman.',
        statement: 'Pipeline yang bisa dibaca manusia, bukan kotak hitam.',
        niche: 'Developer tools',
        specificNiche: 'Deployment',
        superSpecificNiche: 'Preview environment untuk tim 3–15 orang',
        positioning: 'Deploy tanpa konfigurasi YAML yang tidak perlu.',
      },
      personas: [
        {
          id: 'per_007',
          name: 'Tech Lead Kecil',
          age: '28–38',
          role: 'Memimpin tim 6 engineer',
          goals: 'Preview per PR tanpa biaya berlebih.',
          painPoints: 'Setup CI rumit dan mahal.',
          channels: 'GitHub, newsletter developer',
        },
        {
          id: 'per_008',
          name: 'Solo Founder',
          age: '23–35',
          role: 'Membangun produk sendirian',
          goals: 'Rilis cepat tanpa perlu DevOps.',
          painPoints: 'Tidak punya waktu memelihara server.',
          channels: 'X/Twitter, Discord',
        },
      ],
      products: [
        {
          id: 'prd_004',
          name: 'Nimbus Preview',
          category: 'SaaS',
          field: 'Deployment',
          reference: 'https://nimbus.example.dev/pricing',
        },
      ],
      researchStatus: 'draft',
      researchNote: 'Baru 1 referensi, DNA masih draf awal.',
      createdAt: daysAgo(9),
      updatedAt: daysAgo(9),
    },
  ];

  const missions = [
    {
      id: 'msn_001',
      name: 'Riset Persona Kopi Nusantara',
      goals:
        'Validasi 3 persona dari data penjualan 6 bulan dan 20 ulasan marketplace. Hasilkan ringkasan 5 poin + rekomendasi pesan kampanye.',
      agentId: 'agt_002',
      priority: 'high',
      timeLimitMinutes: 45,
      maxSteps: 8,
      notesQc: 'Sertakan sumber tiap klaim dan periode data.',
      status: 'completed',
      createdAt: daysAgo(14),
      updatedAt: daysAgo(12),
      tokens: 42800,
      resultDocId: 'doc_001',
      timeline: [
        { at: daysAgo(14), label: 'Misi dibuat (draf)', by: 'owner' },
        { at: daysAgo(14), label: 'Diajukan untuk review', by: 'owner' },
        { at: daysAgo(13), label: 'Disetujui dan diluncurkan', by: 'owner' },
        { at: daysAgo(12), label: 'Hasil masuk ke Docs', by: 'Rani' },
      ],
    },
    {
      id: 'msn_002',
      name: 'Artikel Ritual Pagi Nusantara',
      goals:
        'Tulis artikel 800 kata tentang ritual seduh pagi, tone hangat, satu CTA ke hampers.',
      agentId: 'agt_003',
      priority: 'medium',
      timeLimitMinutes: 30,
      maxSteps: 6,
      notesQc: 'Jangan pakai klaim kesehatan. Cek ejaan nama petani.',
      status: 'pending_review',
      createdAt: daysAgo(3),
      updatedAt: daysAgo(2),
      tokens: 12600,
      resultDocId: null,
      timeline: [
        { at: daysAgo(3), label: 'Misi dibuat (draf)', by: 'owner' },
        { at: daysAgo(2), label: 'Diajukan untuk review', by: 'owner' },
      ],
    },
    {
      id: 'msn_003',
      name: 'Kalender Kampanye Aurora Q4',
      goals:
        'Susun kalender kampanye 4 minggu untuk Barrier Serum: 3 konten edukasi, 2 testimoni, 1 promo. Sertakan metrik dan asumsi biaya.',
      agentId: 'agt_006',
      priority: 'high',
      timeLimitMinutes: 60,
      maxSteps: 10,
      notesQc: 'Setiap minggu harus punya satu metrik keberhasilan.',
      status: 'pending_review',
      createdAt: daysAgo(2),
      updatedAt: daysAgo(1),
      tokens: 21400,
      resultDocId: null,
      timeline: [
        { at: daysAgo(2), label: 'Misi dibuat (draf)', by: 'owner' },
        { at: daysAgo(1), label: 'Diajukan untuk review', by: 'owner' },
      ],
    },
    {
      id: 'msn_004',
      name: 'Audit Landing Page Nimbus',
      goals:
        'Audit 1 halaman pricing: hierarki pesan, kontras, dan kejelasan CTA. Beri 7 rekomendasi berurutan dampak.',
      agentId: 'agt_005',
      priority: 'urgent',
      timeLimitMinutes: 25,
      maxSteps: 5,
      notesQc: 'Fokus pada aksesibilitas dan kejelasan harga.',
      status: 'running',
      createdAt: daysAgo(1),
      updatedAt: daysAgo(0),
      tokens: 8900,
      resultDocId: null,
      timeline: [
        { at: daysAgo(1), label: 'Misi dibuat (draf)', by: 'owner' },
        { at: daysAgo(1), label: 'Diajukan untuk review', by: 'owner' },
        { at: daysAgo(1), label: 'Disetujui dan diluncurkan', by: 'owner' },
        { at: daysAgo(0), label: 'Hermes mendispatch ke Arya', by: 'Hermes' },
      ],
    },
    {
      id: 'msn_005',
      name: 'Moodboard Kemasan Hampers',
      goals:
        'Buat arahan visual kemasan hampers: 2 opsi palet, referensi material, dan tipografi.',
      agentId: 'agt_004',
      priority: 'medium',
      timeLimitMinutes: 40,
      maxSteps: 7,
      notesQc: 'Gunakan palet brand, jangan menambah warna baru.',
      status: 'approved',
      createdAt: daysAgo(4),
      updatedAt: daysAgo(2),
      tokens: 5400,
      resultDocId: null,
      timeline: [
        { at: daysAgo(4), label: 'Misi dibuat (draf)', by: 'owner' },
        { at: daysAgo(3), label: 'Diajukan untuk review', by: 'owner' },
        { at: daysAgo(2), label: 'Disetujui, menunggu peluncuran', by: 'owner' },
      ],
    },
    {
      id: 'msn_006',
      name: 'Riset Kompetitor Skincare Tropis',
      goals:
        'Petakan 5 kompetitor, rentang harga, dan klaim utama. Identifikasi 2 celah positioning.',
      agentId: 'agt_002',
      priority: 'low',
      timeLimitMinutes: 50,
      maxSteps: 9,
      notesQc: 'Sertakan tanggal akses.',
      status: 'draft',
      createdAt: daysAgo(0, 8),
      updatedAt: daysAgo(0, 8),
      tokens: 0,
      resultDocId: null,
      timeline: [{ at: daysAgo(0, 8), label: 'Misi dibuat (draf)', by: 'owner' }],
    },
    {
      id: 'msn_007',
      name: 'Balas 12 Lead Inbound',
      goals: 'Kualifikasi 12 lead masuk dengan 3 pertanyaan dan rekomendasikan jadwal demo.',
      agentId: 'agt_008',
      priority: 'low',
      timeLimitMinutes: 20,
      maxSteps: 4,
      notesQc: 'Jangan menjanjikan diskon.',
      status: 'cancelled',
      createdAt: daysAgo(8),
      updatedAt: daysAgo(7),
      replanNote: 'Ditunda karena inbox POP belum terhubung.',
      tokens: 0,
      resultDocId: null,
      timeline: [
        { at: daysAgo(8), label: 'Misi dibuat (draf)', by: 'owner' },
        { at: daysAgo(7), label: 'Dibatalkan: butuh integrasi mail', by: 'owner' },
      ],
    },
  ];

  const tasks = [
    { id: 'tsk_001', title: 'Riset Persona Kopi Nusantara', description: 'Validasi 3 persona dari data penjualan 6 bulan dan 20 ulasan marketplace.', priority: 'high', status: 'done', missionId: 'msn_001', assigneeAgentId: 'agt_002', source: 'mission', createdAt: daysAgo(14), updatedAt: daysAgo(12) },
    { id: 'tsk_002', title: 'Artikel Ritual Pagi Nusantara', description: 'Tulis artikel 800 kata tentang ritual seduh pagi, tone hangat, satu CTA.', priority: 'medium', status: 'review', missionId: 'msn_002', assigneeAgentId: 'agt_003', source: 'mission', createdAt: daysAgo(3), updatedAt: daysAgo(2) },
    { id: 'tsk_003', title: 'Kalender Kampanye Aurora Q4', description: 'Susun kalender 4 minggu + metrik keberhasilan dan asumsi biaya.', priority: 'high', status: 'review', missionId: 'msn_003', assigneeAgentId: 'agt_006', source: 'mission', createdAt: daysAgo(2), updatedAt: daysAgo(1) },
    { id: 'tsk_004', title: 'Audit Landing Page Nimbus', description: 'Audit halaman pricing: hierarki pesan, kontras, dan kejelasan CTA.', priority: 'urgent', status: 'in_progress', missionId: 'msn_004', assigneeAgentId: 'agt_005', source: 'mission', createdAt: daysAgo(1), updatedAt: daysAgo(0) },
    { id: 'tsk_005', title: 'Moodboard Kemasan Hampers', description: '2 opsi palet, referensi material, tipografi.', priority: 'medium', status: 'todo', missionId: 'msn_005', assigneeAgentId: 'agt_004', source: 'mission', createdAt: daysAgo(4), updatedAt: daysAgo(2) },
    { id: 'tsk_006', title: 'Perbarui config.yaml agent Hermes', description: 'Naikkan max_steps ke 12 dan tambahkan tool docs.', priority: 'low', status: 'todo', missionId: null, assigneeAgentId: 'agt_001', source: 'manual', createdAt: daysAgo(5), updatedAt: daysAgo(5) },
    { id: 'tsk_007', title: 'Cek ejaan 3 artikel terakhir', description: 'QC manual sebelum publish ke Docs.', priority: 'medium', status: 'in_progress', missionId: null, assigneeAgentId: 'agt_001', source: 'manual', createdAt: daysAgo(4), updatedAt: daysAgo(1) },
    { id: 'tsk_008', title: 'Riset Kompetitor Skincare Tropis', description: 'Petakan 5 kompetitor dan 2 celah positioning.', priority: 'low', status: 'todo', missionId: 'msn_006', assigneeAgentId: 'agt_002', source: 'mission', createdAt: daysAgo(0, 8), updatedAt: daysAgo(0, 8) },
    { id: 'tsk_009', title: 'Arsipkan aset kampanye 2025', description: 'Pindahkan ke folder arsip dan catat tautan.', priority: 'low', status: 'done', missionId: null, assigneeAgentId: 'agt_001', source: 'manual', createdAt: daysAgo(20), updatedAt: daysAgo(15) },
  ];

  const docs = [
    {
      id: 'doc_001',
      missionId: 'msn_001',
      title: 'Ringkasan Persona Kopi Nusantara',
      type: 'agent',
      agentId: 'agt_002',
      content:
        '# Ringkasan Persona Kopi Nusantara\n\nSumber: 6 bulan transaksi (Jan–Jun 2026) + 20 ulasan marketplace.\n\n## 5 poin utama\n1. 62% pembelian ulang berasal dari pelanggan yang menyeduh manual di rumah.\n2. Kata "ritual" muncul di 14 dari 20 ulasan positif.\n3. Keluhan terbanyak: kemasan tidak menyebut tanggal roasting (9 ulasan).\n4. Segmen hampers tumbuh 18% pada kuartal terakhir.\n5. Nama petani pada kemasan meningkatkan kepercayaan (7 ulasan menyebut eksplisit).\n\n## Rekomendasi pesan\n- Utamakan "roasting date" dan nama petani di halaman produk.\n- Gunakan frasa ritual 10 menit, bukan klaim rasa yang abstrak.\n\n## Batasan data\nData marketplace hanya mencakup 1 kanal; data kedai langsung belum tersedia.',
      createdAt: daysAgo(12),
    },
    {
      id: 'doc_002',
      missionId: 'msn_001',
      title: 'Katalog Biji Kopi 2026 (referensi)',
      type: 'upload',
      agentId: null,
      fileId: 'fil_001',
      content: 'Berkas referensi brand: Katalog Biji Kopi 2026.pdf',
      createdAt: daysAgo(39),
    },
    {
      id: 'doc_003',
      missionId: 'msn_003',
      title: 'Draf Kalender Kampanye Aurora Q4',
      type: 'agent',
      agentId: 'agt_006',
      content:
        '# Kalender Kampanye Aurora Q4\n\n## Minggu 1 — Edukasi barrier\n- Konten: "Kenapa ceramide butuh 4 minggu"\n- Metrik: waktu baca > 90 detik\n\n## Minggu 2 — Bukti\n- Konten: hasil uji 28 hari (grafik)\n- Metrik: simpan produk +12%\n\n## Minggu 3 — Testimoni\n- 2 testimoni pengguna retinol\n- Metrik: rasio klik ke halaman produk > 4%\n\n## Minggu 4 — Promo\n- Bundling serum + cleanser\n- Metrik: konversi > 2,5%\n\n## Asumsi biaya\nIklan Rp6.000.000/bulan, CAC target Rp85.000, AOV Rp210.000.',
      createdAt: daysAgo(1),
    },
    {
      id: 'doc_004',
      missionId: 'msn_002',
      title: 'Draf artikel Ritual Pagi (belum disetujui)',
      type: 'agent',
      agentId: 'agt_003',
      content:
        '# Ritual Pagi yang Tidak Terburu-buru\n\nPagi di kota sering dimulai dengan notifikasi. Sebelum itu, ada sepuluh menit yang bisa kita selamatkan: mendidihkan air, menimbang 15 gram biji, dan menuang pelan.\n\n(Isi artikel 800 kata menunggu persetujuan QC. Bagian CTA: Hampers Ritual Pagi.)',
      createdAt: daysAgo(2),
    },
    {
      id: 'doc_005',
      missionId: null,
      title: 'SOP Review Hasil Agent',
      type: 'upload',
      agentId: null,
      fileId: 'fil_003',
      content: 'Berkas referensi internal: SOP Review Hasil Agent.docx',
      createdAt: daysAgo(22),
    },
    {
      id: 'doc_006',
      missionId: 'msn_004',
      title: 'Audit Landing Page Nimbus (proses)',
      type: 'agent',
      agentId: 'agt_005',
      content:
        '# Audit Landing Page Nimbus\n\nStatus: 3 dari 5 langkah.\n\nTemuan awal:\n1. Harga tahunan tidak menampilkan penghematan.\n2. CTA sekunder bersaing secara visual dengan CTA utama.\n3. Kontras teks abu-abu pada latar terang di bawah 4.5:1.',
      createdAt: daysAgo(0),
    },
  ];

  const chats = [
    {
      id: 'cht_001',
      agentId: 'agt_002',
      title: 'Persona Kopi Nusantara',
      createdAt: daysAgo(13),
      updatedAt: daysAgo(12),
      messages: [
        { id: 'msg_001', role: 'user', text: 'Ringkas temuan persona dalam 3 poin.', at: daysAgo(13) },
        {
          id: 'msg_002',
          role: 'agent',
          text: 'Tiga poin: (1) ritual menyeduh adalah pemicu utama pembelian ulang; (2) tanggal roasting paling sering diminta; (3) segmen hampers tumbuh 18%. Detail ada di Docs "Ringkasan Persona Kopi Nusantara".',
          at: daysAgo(13),
        },
        { id: 'msg_003', role: 'user', text: 'Siapkan pertanyaan lanjutan untuk QC.', at: daysAgo(12) },
        {
          id: 'msg_004',
          role: 'agent',
          text: 'Pertanyaan QC: Apakah klaim 62% sudah diverifikasi pada data kanal kedai? Apakah frasa "ritual" dipakai konsisten di semua aset? Apakah tanggal roasting dicantumkan di kemasan baru?',
          at: daysAgo(12),
        },
      ],
    },
    {
      id: 'cht_002',
      agentId: 'agt_001',
      title: 'Dispatch misi minggu ini',
      createdAt: daysAgo(1),
      updatedAt: daysAgo(1),
      messages: [
        { id: 'msg_005', role: 'user', text: 'Misi mana yang perlu saya setujui?', at: daysAgo(1) },
        {
          id: 'msg_006',
          role: 'agent',
          text: 'Ada 2 misi menunggu persetujuan: Artikel Ritual Pagi Nusantara (Bima) dan Kalender Kampanye Aurora Q4 (Dita). Prioritas tertinggi: Aurora Q4 karena tenggat kampanye 4 minggu.',
          at: daysAgo(1),
        },
      ],
    },
    {
      id: 'cht_003',
      agentId: 'agt_005',
      title: 'Audit halaman pricing',
      createdAt: daysAgo(0),
      updatedAt: daysAgo(0),
      messages: [
        { id: 'msg_007', role: 'user', text: 'Fokus ke aksesibilitas dulu.', at: daysAgo(0) },
        {
          id: 'msg_008',
          role: 'agent',
          text: 'Baik. Saya mulai dari kontras teks dan ukuran target sentuh, lalu hierarki CTA. Hasil akan saya tulis di Docs setelah approval.',
          at: daysAgo(0),
        },
      ],
    },
  ];

  const files = [
    {
      id: 'fil_001',
      name: 'Katalog Biji Kopi 2026.pdf',
      mime: 'application/pdf',
      size: 482133,
      storedName: null,
      kind: 'reference',
      createdAt: daysAgo(39),
      placeholder: true,
    },
    {
      id: 'fil_002',
      name: 'Brand deck Aurora.pdf',
      mime: 'application/pdf',
      size: 1288442,
      storedName: null,
      kind: 'reference',
      createdAt: daysAgo(29),
      placeholder: true,
    },
    {
      id: 'fil_003',
      name: 'SOP Review Hasil Agent.docx',
      mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      size: 45602,
      storedName: null,
      kind: 'upload',
      createdAt: daysAgo(22),
      placeholder: true,
    },
  ];

  // --- metrik historis 30 hari (deterministik) ---
  const usage = [];
  const activity = [];
  for (let i = 29; i >= 0; i -= 1) {
    const date = dateKey(daysAgo(i));
    agents.forEach((agent, index) => {
      if (agent.status === 'inactive' && i < 12) return;
      const base = 900 + Math.floor(rand() * 2400);
      const weekendPenalty = [0, 6].includes(new Date(date).getUTCDay()) ? 0.45 : 1;
      const tokens = Math.round(base * weekendPenalty * (1 + index * 0.08));
      usage.push({ date, agentId: agent.id, tokens });
      const runs = Math.max(0, Math.round(rand() * 4 * weekendPenalty));
      for (let r = 0; r < runs; r += 1) {
        activity.push({
          id: `act_seed_${i}_${index}_${r}`,
          date,
          at: new Date(`${date}T${String(8 + r).padStart(2, '0')}:00:00.000Z`).toISOString(),
          agentId: agent.id,
          kind: 'task',
          label: 'Menjalankan langkah misi',
        });
      }
    });
  }

  const skills = SKILL_LIBRARY.map(([name, category, description], index) => ({
    id: `skl_${(index + 1).toString().padStart(3, '0')}`,
    name,
    category,
    description,
    builtin: true,
    createdAt: daysAgo(60),
  }));

  return {
    meta: {
      version: 1,
      createdAt: now,
      usingDefaultPassword: !process.env.ADMIN_PASSWORD,
      seedVersion: 1,
    },
    users: [
      {
        id: 'usr_owner',
        name: 'Mission Owner',
        email: DEFAULT_EMAIL,
        role: 'owner',
        passwordHash: hashPassword(DEFAULT_PASSWORD),
        createdAt: now,
      },
    ],
    sessions: [],
    settings: {
      workspaceName: 'Neuromancer Mission Control',
      workspaceSlug: 'neuromancer',
      timezone: 'Asia/Jakarta',
      hermes: {
        enabled: false,
        baseUrl: '',
        apiKey: '',
        healthPath: '/health',
        chatPath: '/v1/chat',
        missionPath: '/v1/missions',
        fallbackLocal: true,
      },
      approvalPolicy: { missions: true, documents: true },
    },
    agents,
    skills,
    brands,
    missions,
    tasks,
    docs,
    files,
    chats,
    usage,
    activity,
    events: [
      {
        id: 'evt_seed_1',
        at: daysAgo(0, 7),
        type: 'system',
        message: 'Workspace Neuromancer siap. Integrasi Hermes belum diaktifkan.',
      },
    ],
  };
}
