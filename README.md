# KeyStock — Mechanical Keyboard Inventory

Sistem manajemen inventaris gudang untuk keyboard mechanical dan aksesori. Antarmuka **Vue 3**, API **Node.js + Express** berpola MVC, database **MySQL** lewat **Sequelize ORM**.

Proyek UAS *Web Application Development* — Universitas Cakrawala.

> **Kesesuaian brief:** soal UAS menyebut Laravel dan Eloquent. Stack Vue.js + Node.js + MySQL dipakai atas persetujuan dosen. Padanan konsep Eloquent (relasi, eager loading, `withCount`, transaksi) dijelaskan di [docs/requirements-and-architecture.md](docs/requirements-and-architecture.md#padanan-sequelize--eloquent).

## Fitur

- **Autentikasi:** registrasi (akun baru = staff), login, logout, session di MySQL.
- **Ringkasan stok** (desain mengikuti referensi Quantara, hitam-putih): KPI total unit / perlu restock / stok habis, heatmap aktivitas 7/14/30 hari, stok terendah–rata-rata–tertinggi, detail produk + kontak supplier, peta rak, tabel aktivitas terbaru dengan filter + pagination, ekspor CSV.
- **Produk:** CRUD lengkap (arsip = soft delete), pencarian, filter kategori/supplier/stok rendah, validasi per-field.
- **Supplier:** CRUD + kontak (telepon, email, situs).
- **Pergerakan stok:** stok masuk, keluar, penyesuaian dengan pratinjau saldo; setiap catatan menyimpan stok sebelum/sesudah, pengguna, waktu.
- **Pengguna (admin):** ubah peran admin/staff, nonaktifkan akun, tabel rincian hak akses.
- Mode terang/gelap, responsif (tab bar bawah di ponsel, tabel jadi kartu).

## Hak akses

| Aksi | Admin | Staff |
| --- | :---: | :---: |
| Lihat ringkasan, produk, supplier, riwayat stok | ✓ | ✓ |
| Catat stok masuk / keluar / penyesuaian | ✓ | ✓ |
| Tambah / ubah / arsipkan produk dan supplier | ✓ | ✗ |
| Kelola pengguna | ✓ | ✗ |

## Akun demo

Akun dibuat oleh seeder dari nilai `SEED_*` di `.env` (lokal) atau *Variables* Railway (production). Password **tidak** disimpan di repository.

| Peran | Email | Password |
| --- | --- | --- |
| Admin | nilai `SEED_ADMIN_EMAIL` (contoh: `admin@keystock.local`) | nilai `SEED_ADMIN_PASSWORD` |
| Staff | nilai `SEED_STAFF_EMAIL` (contoh: `staff@keystock.local`) | nilai `SEED_STAFF_PASSWORD` |

Akun staff tambahan bisa dibuat sendiri lewat tab **Daftar akun** di halaman login.

## Menjalankan di komputer lokal

Prasyarat: Node.js 24 (lihat `.nvmrc`), npm, dan MySQL 8 (lokal atau Docker Desktop).

```bash
# 1. Konfigurasi
cp .env.example .env
#    - SESSION_SECRET  -> hasil: openssl rand -hex 32
#    - DB_PASSWORD / DB_ROOT_PASSWORD -> password MySQL lokal
#    - SEED_ADMIN_PASSWORD (min. 12 karakter), opsional SEED_STAFF_PASSWORD

# 2. Database (pilih salah satu)
docker compose up -d mysql            # MySQL 8.4 via Docker
#  atau import database/schema.sql ke MySQL lokal lalu buat user sesuai .env

# 3. Dependency + data
npm install
npm run db:sync     # buat / sesuaikan tabel
npm run db:seed     # kategori, supplier, 23 produk, riwayat stok demo, akun demo

# 4. Jalankan (API :3000 + Vite :5173)
npm run dev
```

Buka <http://localhost:5173>.

| Script | Fungsi |
| --- | --- |
| `npm run dev` | API (node --watch) + Vite dev server |
| `npm run db:sync` | `sequelize.sync()` + migrasi kolom tambahan |
| `npm run db:seed` | Isi data demo (idempoten) |
| `npm run db:fresh` | **Hapus** semua tabel domain lalu seed ulang (reset demo sebelum rekam video) |
| `npm run build` | Build Vue ke `client/dist` |
| `npm start` | Jalankan API; di `NODE_ENV=production` juga menyajikan `client/dist` |
| `npm run assets:download` | Unduh ulang foto katalog ke `client/public/images` |

## Struktur project (MVC)

```text
client/                         View — Vue 3 + Vite
  src/App.vue                   halaman, state, dan pemanggilan API
  src/components/               ActivityHeatmap.vue, RackMap.vue
  src/api.js                    fetch wrapper + header X-CSRF-Token
  src/style.css                 design tokens terang/gelap
server/src/
  routes/apiRoutes.js           routing URL -> middleware -> controller
  controllers/                  Controller: auth, dashboard, product, supplier, stockMovement, user
  models/index.js               Model: User, Category, Supplier, Product, StockMovement + relasi
  services/stockService.js      logika stok (transaksi + row lock)
  middleware/                   auth (requireAuth/requireRole), csrf, validate, validators (zod), errorHandler
  db/                           sync & migrasi kolom
  seeders/                      catalog.json + seed.js
database/schema.sql             DDL MySQL (5 tabel, foreign key, index)
docs/                           kebutuhan, arsitektur, ERD, flowchart, deployment, keputusan desain
railway.json                    konfigurasi build/start Railway
docker-compose.yml              MySQL lokal
```

## Dokumentasi

- [Kebutuhan, arsitektur MVC, routing, keamanan](docs/requirements-and-architecture.md)
- [Langkah deployment Railway + troubleshooting](docs/deployment.md)
- [Keputusan desain (referensi Quantara)](docs/design-decisions.md)
- Diagram (PNG siap tempel ke PDF): [ERD](docs/diagrams/erd.png) · [Arsitektur](docs/diagrams/architecture.png) · [Request flow](docs/diagrams/request-flow.png) · [Flowchart](docs/diagrams/flowchart.png) — sumber Mermaid di `docs/*.mmd`

## Keamanan singkat

- **SQL Injection:** semua query lewat Sequelize (parameter binding).
- **XSS:** Vue meng-escape output (tanpa `v-html`), server membuang tag HTML dan menolak URL non-`http(s)`, header CSP via Helmet.
- **CSRF:** token per sesi wajib di header `X-CSRF-Token` untuk request yang mengubah data.
- **Session:** cookie `HttpOnly` + `SameSite=Lax` (+ `Secure` di production), disimpan di MySQL, ID sesi diganti saat login.
- **Password:** bcrypt (cost 12); rate limit login dan registrasi.
- **Akses:** `requireAuth` + `requireRole('admin')` di setiap route sensitif.

## Data dan sumber

Katalog contoh mengambil referensi produk dari Noir Gear dan Work Louder (nama brand, bukan nama aplikasi). Stok, lokasi rak, dan riwayat 7 hari terakhir adalah simulasi untuk demo. Harga listing hanya referensi; harga beli/jual dibiarkan kosong sampai diisi admin. Foto produk disimpan lokal di `client/public/images/`.

## Checklist deliverables UAS

- [x] Aplikasi CRUD produk, supplier, dan pergerakan stok
- [x] ERD 5 tabel berelasi + skrip `database/schema.sql`
- [x] Registrasi, login, logout, session, role admin/staff
- [x] Validasi input server, CSRF, sanitasi XSS, query berparameter
- [x] `.env.example` + README instalasi + akun demo
- [x] Konfigurasi deployment (`railway.json`, `docs/deployment.md`)
- [ ] Deploy ke Railway dan isi URL live
- [ ] PDF submission + video presentasi (maks. 15 menit)
