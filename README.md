# Noir Gear Inventory

Web app inventaris untuk keyboard mechanical dan aksesori. Project ini memakai Vue.js untuk antarmuka, Node.js dengan Express untuk API MVC, dan MySQL untuk penyimpanan relasional.

## Fokus project

- Melihat ringkasan stok dan produk yang perlu diisi ulang.
- Mengelola katalog produk keyboard dan aksesori.
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

1. Salin `.env.example` menjadi `.env`, lalu isi kredensial database dan secret session.
2. Jalankan MySQL lokal, atau gunakan `docker compose up -d mysql`.
3. Jalankan `npm install` di root project.
4. Jalankan migrasi dan seed sesuai petunjuk yang akan dilengkapi setelah backend siap.
5. Jalankan `npm run dev` untuk membuka Vue dan API saat pengembangan.

Nilai stok awal adalah data simulasi untuk demo, bukan stok resmi Noir Gear. Kredensial admin demo akan disimpan di environment lokal dan tidak dikomit ke repository.

## Rencana deliverables

- [ ] Aplikasi CRUD produk dan pergerakan stok.
- [ ] ERD minimal empat tabel berelasi.
- [ ] Validasi input, CSRF, session, autentikasi, dan kontrol akses.
- [ ] File SQL/migrasi, `.env.example`, dan panduan setup.
- [ ] Deployment, PDF submission, dan video presentasi maksimal 15 menit.
