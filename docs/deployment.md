# Deployment ke Railway

Aplikasi dideploy sebagai **satu service Node.js** (Express menyajikan API `/api/*` sekaligus hasil build Vue di `client/dist`) ditambah **satu service MySQL**. Konfigurasi build/start ada di [`railway.json`](../railway.json).

## 1. Persiapan

1. Push repository ke GitHub (`git push origin main`).
2. Pastikan `package-lock.json` ikut ter-commit (sudah berisi binary build untuk Linux).
3. Buat secret sesi: `openssl rand -hex 32`.

## 2. Buat project Railway

1. Login ke [railway.com](https://railway.com) → **New Project** → **Deploy from GitHub repo** → pilih repo ini.
2. Di project yang sama: **+ Create** → **Database** → **MySQL**.

## 3. Environment variables (service aplikasi → tab *Variables*)

| Variable | Nilai |
| --- | --- |
| `NODE_ENV` | `production` |
| `SESSION_SECRET` | hasil `openssl rand -hex 32` |
| `SESSION_COOKIE_NAME` | `keystock.sid` |
| `CLIENT_ORIGIN` | URL publik aplikasi, mis. `https://keystock-production.up.railway.app` |
| `DB_HOST` | `${{MySQL.MYSQLHOST}}` |
| `DB_PORT` | `${{MySQL.MYSQLPORT}}` |
| `DB_NAME` | `${{MySQL.MYSQLDATABASE}}` |
| `DB_USER` | `${{MySQL.MYSQLUSER}}` |
| `DB_PASSWORD` | `${{MySQL.MYSQLPASSWORD}}` |
| `SEED_ADMIN_NAME` / `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | akun admin demo (password ≥ 12 karakter) |
| `SEED_STAFF_NAME` / `SEED_STAFF_EMAIL` / `SEED_STAFF_PASSWORD` | akun staff demo untuk dosen |

`PORT` diisi otomatis oleh Railway. Jika variabel `DB_*` dikosongkan, `server/src/config.js` otomatis memakai `MYSQLHOST`, `MYSQLPORT`, dst. dari service MySQL yang direferensikan.

## 4. Build & start

Railway membaca `railway.json`:

- **Build:** `npm ci` (otomatis) lalu `npm run build` → menghasilkan `client/dist`.
- **Start:** `npm run db:sync && npm run db:seed && npm start`
  - `db:sync` membuat/menyesuaikan tabel.
  - `db:seed` mengisi kategori, supplier, 23 produk, riwayat stok demo, dan akun demo. Aman dijalankan berulang (hanya membuat data yang belum ada).
  - `npm start` menjalankan Express; karena `NODE_ENV=production`, Express menyajikan `client/dist`, mengaktifkan cookie `Secure`, dan `trust proxy`.
- **Health check:** `GET /api/health` → `{"status":"ok"}`.

## 5. Domain publik

Service aplikasi → **Settings** → **Networking** → **Generate Domain**. Salin URL ke `CLIENT_ORIGIN`, lalu redeploy.

## 6. Uji setelah deploy

1. Buka URL di jendela incognito → halaman login muncul.
2. Login admin demo → ringkasan stok berisi data.
3. Tambah produk, catat stok masuk, arsipkan produk.
4. Logout → daftar akun baru → pastikan menu *Pengguna* tidak muncul dan `POST /api/products` ditolak (403).

## Troubleshooting

| Gejala | Penyebab & solusi |
| --- | --- |
| Build gagal `Cannot find module @rollup/rollup-linux-x64-gnu` | Lockfile hanya berisi binary macOS. Sudah diperbaiki; jika terulang: hapus `node_modules` + `package-lock.json`, `npm install`, commit lockfile baru. |
| `Missing required environment variables` | Variabel `DB_*`/`SESSION_SECRET` belum diisi atau referensi `${{MySQL...}}` salah nama service. |
| `SESSION_SECRET must be a generated secret` | Secret kurang dari 32 karakter atau masih `replace-with...`. |
| Login berhasil tapi langsung ter-logout | Akses lewat `http://`; cookie `Secure` hanya terkirim lewat HTTPS. Gunakan domain `https://` Railway. |
| `Seed gagal: Set SEED_ADMIN_EMAIL ...` | Isi `SEED_ADMIN_EMAIL` dan `SEED_ADMIN_PASSWORD` (≥ 12 karakter). |
| `ER_ACCESS_DENIED_ERROR` / `ECONNREFUSED` | Kredensial atau host MySQL salah; cek variabel referensi dan pastikan service MySQL running. |

## Mengapa konfigurasi sensitif di `.env`

- Kredensial database, `SESSION_SECRET`, dan password demo **tidak boleh masuk Git** (`.gitignore` mengecualikan `.env`; yang di-commit hanya `.env.example` tanpa nilai rahasia).
- Nilai yang sama di-set lewat *Variables* Railway sehingga kode identik di lokal dan production; hanya konfigurasi yang berbeda.
- Jika secret bocor cukup diganti di Railway lalu redeploy — tidak perlu mengubah kode atau riwayat Git.
