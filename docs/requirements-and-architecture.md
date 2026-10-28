# Kebutuhan dan Arsitektur — KeyStock

## Studi kasus

KeyStock adalah sistem **manajemen inventaris gudang** untuk keyboard mechanical dan aksesori (studi kasus pilihan UAS: *Sistem Manajemen Inventaris Gudang*). Pemilik/admin mengelola katalog, supplier, dan pengguna; staff gudang mencatat setiap stok masuk, stok keluar, dan penyesuaian. Status listing marketplace hanya referensi — aplikasi tidak memanggil API marketplace.

Katalog contoh berisi 23 produk (keyboard, switch, keycaps, deskmat, aksesori). Jumlah stok, lokasi rak, dan riwayat 7 hari terakhir adalah **data simulasi** dari seeder.

> **Stack:** Soal UAS menyebut Laravel + Eloquent. Proyek ini memakai **Vue 3 + Node.js/Express + MySQL + Sequelize ORM** atas persetujuan dosen. Pola MVC, relasi ORM, validasi server, CSRF, session, dan RBAC tetap diterapkan; padanan Eloquent dijelaskan di tabel bawah.

## Hak akses pengguna

| Aksi | Admin | Staff |
| --- | :---: | :---: |
| Daftar akun sendiri (otomatis menjadi staff) | – | ✓ |
| Login, logout, melihat ringkasan / produk / supplier / riwayat stok | ✓ | ✓ |
| Mencatat stok masuk, stok keluar, penyesuaian | ✓ | ✓ |
| Tambah, ubah, arsipkan produk | ✓ | ✗ (403) |
| Tambah, ubah, arsipkan supplier | ✓ | ✗ (403) |
| Lihat pengguna, ubah peran, nonaktifkan akun | ✓ | ✗ (403) |

Aturan di atas ditegakkan di server oleh middleware `requireAuth` dan `requireRole('admin')` (`server/src/middleware/auth.js`). Menu yang disembunyikan di tampilan hanya kenyamanan, bukan pengaman.

## Fitur

1. Registrasi (akun staff), login, logout, session server-side di MySQL.
2. Ringkasan stok: KPI total unit (perubahan 7 hari), jumlah perlu restock, stok habis; heatmap aktivitas 7/14/30 hari; stok terendah/rata-rata/tertinggi; detail produk; peta rak; tabel aktivitas terbaru dengan filter dan pagination; ekspor CSV.
3. CRUD produk (tambah, lihat + cari + filter, ubah, arsip/soft delete) dengan validasi server per-field.
4. CRUD supplier (tambah, lihat, ubah, arsip).
5. Pergerakan stok: masuk, keluar, penyesuaian — setiap catatan menyimpan stok sebelum/sesudah, pengguna, waktu, dan catatan; pratinjau saldo sebelum disimpan; riwayat dengan pencarian dan filter.
6. Manajemen pengguna (admin): ubah peran admin/staff, nonaktifkan/aktifkan akun.
7. Mode terang/gelap, layout responsif (tab bar bawah di ponsel, tabel menjadi kartu).

## Arsitektur (MVC)

![Diagram arsitektur](diagrams/architecture.png)

| Lapisan MVC | Lokasi | Isi |
| --- | --- | --- |
| **Model** | `server/src/models/index.js` | Definisi tabel + relasi Sequelize (`hasMany` / `belongsTo`) |
| **View** | `client/src/App.vue`, `client/src/components/*` | Antarmuka Vue; render data JSON, escape otomatis |
| **Controller** | `server/src/controllers/*.js` | Menerima request, memanggil model/service, mengembalikan JSON |
| Routes | `server/src/routes/apiRoutes.js` | Memetakan URL + method ke controller dan middleware |
| Middleware | `server/src/middleware/*.js` | CSRF, autentikasi, otorisasi peran, validasi, error handler |
| Service | `server/src/services/stockService.js` | Logika stok dalam transaksi database + row lock |

### Siklus request (contoh: tambah produk)

![Request lifecycle](diagrams/request-flow.png)

### Routing API

| Method | Endpoint | Middleware | Controller |
| --- | --- | --- | --- |
| GET | `/api/health` | – | health check |
| GET | `/api/auth/csrf` | – | `getCsrfToken` |
| GET | `/api/auth/me` | – | `getCurrentUser` |
| POST | `/api/auth/register` | csrf, rate limit, `registerSchema` | `register` |
| POST | `/api/auth/login` | csrf, rate limit, `loginSchema` | `login` |
| POST | `/api/auth/logout` | csrf, `requireAuth` | `logout` |
| GET | `/api/dashboard` | `requireAuth` | `getDashboard` |
| GET | `/api/categories` | `requireAuth` | `listCategories` |
| GET | `/api/products` | `requireAuth` | `listProducts` (search, kategori, stok rendah) |
| POST | `/api/products` | csrf, `requireAuth`, `requireRole('admin')`, `productSchema` | `createProduct` |
| PUT | `/api/products/:id` | csrf, `requireAuth`, `requireRole('admin')`, `productSchema` | `updateProduct` |
| DELETE | `/api/products/:id` | csrf, `requireAuth`, `requireRole('admin')` | `deleteProduct` (arsip) |
| GET | `/api/suppliers` | `requireAuth` | `listSuppliers` |
| POST / PUT / DELETE | `/api/suppliers[/:id]` | csrf, `requireAuth`, `requireRole('admin')`, `supplierSchema` | create / update / archive |
| GET | `/api/stock-movements` | `requireAuth` | `listMovements` |
| POST | `/api/stock-movements` | csrf, `requireAuth`, `movementSchema` | `createMovement` |
| GET | `/api/users` | `requireAuth`, `requireRole('admin')` | `listUsers` |
| PATCH | `/api/users/:id` | csrf, `requireAuth`, `requireRole('admin')`, `userUpdateSchema` | `updateUser` |

## Database

![ERD](diagrams/erd.png)

Lima tabel domain + tabel `sessions` (dibuat otomatis oleh `express-mysql-session`):

- `categories` 1–N `products` (FK `category_id`, `ON DELETE RESTRICT`)
- `suppliers` 0..1–N `products` (FK `supplier_id`, nullable, `ON DELETE SET NULL`)
- `products` 1–N `stock_movements` (FK `product_id`, `ON DELETE RESTRICT`)
- `users` 1–N `stock_movements` (FK `user_id`, `ON DELETE RESTRICT`)

Skrip SQL: [`database/schema.sql`](../database/schema.sql). Migrasi kode: `npm run db:sync` (`sequelize.sync` + `server/src/db/migrations.js`).

### Padanan Sequelize ↔ Eloquent

| Kebutuhan | Sequelize (proyek ini) | Eloquent (Laravel) |
| --- | --- | --- |
| Relasi 1–N | `Category.hasMany(Product)` / `Product.belongsTo(Category)` | `hasMany()` / `belongsTo()` |
| Eager loading | `findAll({ include: [{ model: Category, as: 'category' }] })` | `Product::with('category')->get()` |
| Eager loading bertingkat | `include: [{ model: Product, include: [Category] }]` | `with('product.category')` |
| Hitung relasi | `fn('COUNT', col('movements.id'))` + `group` | `withCount('movements')` |
| Transaksi + lock | `sequelize.transaction()` + `lock: transaction.LOCK.UPDATE` | `DB::transaction()` + `lockForUpdate()` |
| Query aman | binding parameter otomatis (`?`) | binding parameter PDO |

## Keamanan

| Ancaman | Mitigasi | Lokasi |
| --- | --- | --- |
| SQL Injection | Semua query lewat Sequelize dengan parameter binding; tidak ada string SQL dari input | `models`, `controllers` |
| XSS | Vue `{{ }}` meng-escape output, tidak ada `v-html`; server membuang tag HTML (`stripTags`); URL hanya `http(s)` (menolak `javascript:`); header CSP via Helmet | `middleware/validators.js`, `app.js` |
| CSRF | Token acak 32 byte per sesi, wajib di header `X-CSRF-Token` untuk POST/PUT/PATCH/DELETE, dibandingkan `timingSafeEqual`; cookie `SameSite=Lax` | `middleware/csrf.js` |
| Pencurian sesi | Cookie `HttpOnly`, `Secure` di production, sesi disimpan di MySQL, `session.regenerate()` saat login/registrasi | `app.js`, `authController.js` |
| Brute force | Rate limit login 8×/15 menit, registrasi 10×/jam per IP | `routes/apiRoutes.js` |
| Password bocor | bcrypt cost 12; hash tidak pernah dikirim (default scope menyembunyikan `password_hash`) | `models/index.js` |
| Akses tanpa hak | `requireAuth` + `requireRole('admin')`; akun nonaktif langsung ditolak | `middleware/auth.js` |
| Data stok tidak konsisten | Transaksi + row lock; stok keluar tidak boleh melebihi saldo | `services/stockService.js` |
| CSV injection | Sel ekspor yang diawali `= + - @` diberi prefix `'` | `App.vue` (`exportInventoryCsv`) |

## Alur aplikasi

![Flowchart](diagrams/flowchart.png)
