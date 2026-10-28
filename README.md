# KeyStock — Mechanical Keyboard Inventory

Web app inventaris untuk keyboard mechanical dan aksesori. Project ini memakai Vue.js untuk antarmuka, Node.js dengan Express untuk API MVC, dan MySQL untuk penyimpanan relasional.

## Fokus project

- Melihat ringkasan stok dan produk yang perlu diisi ulang.
- Memilih tampilan terang atau gelap dengan dasar hitam-putih dan aksen status biru, kuning, dan merah.
- Mengelola katalog produk keyboard dan aksesori.
- Memisahkan brand pembuat produk dari supplier, menyimpan kontak supplier, harga beli, harga jual, batas minimum, dan lokasi rak.
- Mencatat stok masuk, stok keluar, dan penyesuaian stok beserta pengguna yang mencatatnya.
- Membatasi akses melalui login dengan peran admin dan staff.
- Menampilkan sumber marketplace sebagai referensi katalog; sinkronisasi API marketplace belum termasuk MVP.

## Stack dan keputusan

- Frontend: Vue 3 + Vite.
- Backend: Node.js 24 + Express, dengan struktur routes, controllers, models, dan middleware.
- Database: MySQL 8.4.
- ORM: Sequelize; relasi dan operasi query akan dijelaskan sebagai padanan implementasi Eloquent pada materi esai.

> **Kesesuaian brief:** Dokumen soal tertulis menyebut Laravel dan Eloquent. Stack Vue.js + Node.js + MySQL dipilih berdasarkan persetujuan dosen yang disampaikan mahasiswa. Implementasi dan esai akan menjelaskan keputusan tersebut secara terbuka.

## Struktur

```text
client/                 Vue.js app
server/                 Express API (MVC)
  src/controllers/       HTTP handlers
  src/models/            Sequelize models
  src/routes/            API routes
  src/middleware/        authentication, authorization, CSRF, validation
  src/services/          domain operations
  src/seeders/           sample products and demo accounts
docs/                   requirements, ERD, and flow diagrams
docker-compose.yml       local MySQL service
```

## Menjalankan project

1. Salin `.env.example` menjadi `.env`.
2. Ganti `SESSION_SECRET` dengan hasil `openssl rand -hex 32`, lalu ganti password admin demo dan password MySQL di `.env`. Password admin minimal 12 karakter. File `.env` tidak dikomit.
3. Pastikan Docker Desktop berjalan, lalu jalankan `docker compose up -d mysql` (atau siapkan MySQL 8.4 lokal dengan nilai `.env` yang sama).
4. Jalankan `npm install` di root project.
5. Unduh gambar katalog ke asset lokal dengan `npm run assets:download`.
6. Buat tabel dengan `npm run db:sync`, lalu isi katalog dan admin demo dengan `npm run db:seed`.
7. Jalankan `npm run dev`, lalu buka `http://localhost:5173`.

Jika ingin akun staff untuk demo role, isi ketiga variabel `SEED_STAFF_*`; biarkan semuanya kosong jika tidak diperlukan. Data stok seed bersifat simulasi. Login menggunakan `SEED_ADMIN_EMAIL` dan `SEED_ADMIN_PASSWORD` yang kamu isi di `.env`.

Katalog contoh mengambil referensi produk dari Noir Gear dan Work Louder; nama-nama tersebut adalah brand atau sumber produk, bukan nama aplikasi. Nilai stok dan lokasi awal disimulasikan untuk demo. Harga listing hanya referensi; harga beli dan harga jual inventaris dibiarkan kosong sampai dicatat. Kredensial admin demo disimpan di environment lokal dan tidak dikomit ke repository.

Gambar produk disimpan di `client/public/images/` untuk dipakai saat demo tanpa hotlink CDN. URL produk sumber tetap dicatat agar referensi katalog bisa diperiksa.

## Rencana deliverables

- [ ] Aplikasi CRUD produk dan pergerakan stok.
- [ ] ERD minimal empat tabel berelasi.
- [ ] Validasi input, CSRF, session, autentikasi, dan kontrol akses.
- [ ] File SQL/migrasi, `.env.example`, dan panduan setup.
- [ ] Deployment, PDF submission, dan video presentasi maksimal 15 menit.
