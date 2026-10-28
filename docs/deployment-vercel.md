# Deployment ke Vercel

Konfigurasi ini mengirim hasil build Vue sebagai file statis Vercel dan menjalankan Express sebagai Vercel Function. Entry point Express ada di [`app.js`](../app.js); perintah `npm run vercel-build` membuat aset frontend di `public/`.

## Prasyarat

Vercel tidak dapat mengakses MySQL Docker lokal di `127.0.0.1`. Sebelum login dan fitur inventaris dapat dipakai, sediakan database MySQL yang dapat diakses dari Vercel, lalu siapkan variabel koneksinya. Jangan menyalin nilai dari `.env` lokal jika host-nya masih `127.0.0.1`.

TiDB Cloud Starter adalah salah satu opsi MySQL-compatible jika memang sesuai dengan kebutuhan database UAS. Pastikan kompatibilitas dan kuota gratis provider sebelum digunakan.

## Pengaturan Vercel

1. Impor repository ini sebagai project baru dengan root directory repo.
2. Gunakan Node.js 24.x. Build command di [`vercel.json`](../vercel.json) menjalankan `npm run vercel-build`.
3. Tambahkan environment variables di Project Settings → Environment Variables:
   - `NODE_ENV=production`
   - `SESSION_SECRET` berisi nilai acak minimal 32 karakter
   - `SESSION_COOKIE_NAME=keystock.sid`
   - `CLIENT_ORIGIN` berisi domain production Vercel
   - `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` untuk database hosted
   - Variabel `SEED_ADMIN_*`, `SEED_DOSEN_*`, dan `SEED_STAFF_*` dengan akun demo yang ingin digunakan
4. Jalankan `npm run db:sync` lalu `npm run db:seed` satu kali dari mesin yang dapat mengakses database tersebut. Jangan jalankan seeder pada setiap request serverless.
5. Deploy ke Production, lalu periksa `/api/health` dan coba login.

Vercel Function menjalankan autentikasi koneksi database dan menunggu MySQL session store siap sebelum memproses request. File hasil build `public/` tidak perlu di-commit karena dibuat oleh build script.
