# Panduan akun dan integrasi baru InTrack

Tanggal: 15 September 2026. Pilihan: **mulai kosong**. Tidak menyalin user, absensi, file, chat, token OAuth, atau face embedding dari sistem lama.

## 1. Yang perlu dibuat

| Layanan | Akun/resource baru | Kredensial/config yang dibutuhkan | Kebutuhan |
|---|---|---|---|
| PostgreSQL/Neon | Akun owner InTrack, project baru, database `intrack`, role database | `DATABASE_URL` | Wajib: semua data aplikasi |
| Cloudflare R2 | Akun Cloudflare, bucket `intrack-files`, R2 S3 credentials | `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET_NAME`, `S3_PUBLIC_URL` | Wajib untuk bukti/avatar dengan implementasi sekarang |
| Google Calendar | Akun Google owner, Google Cloud project, OAuth web client | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` | Jika memakai sync Calendar |
| Notion | Workspace InTrack, database attendance, public OAuth connection | `NOTION_CLIENT_ID`, `NOTION_CLIENT_SECRET`, `NOTION_REDIRECT_URI`; token dan database ID disimpan di User | Jika memakai sync Notion; ada perbaikan kode yang wajib |
| AI chat | Project/API key Gemini milik InTrack | `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL` | Jika memakai AI chat |
| Face ID | Proses Python/FastAPI sendiri; VPS atau Docker hosting jika online | `FACE_SERVICE_URL` | Wajib bagi alur absensi UI sekarang |
| Hosting | Hosting frontend, Node backend, dan Python service | URL frontend/backend, environment backend, domain/HTTPS | Untuk akses online |
| GitHub/deployment | Repository/private team InTrack dan akses deploy baru | SSH secrets jika memakai workflow yang tersedia | Untuk pemisahan ownership dan deploy otomatis |
| Login InTrack | Satu SUPERUSER baru, lalu mentor/intern melalui Users | Email + password aplikasi; `JWT_SECRET` baru | Terpisah dari akun Google/Notion/Neon |

Gunakan satu email owner khusus InTrack untuk mengelola layanan. Project/resource baru tetap diperlukan meskipun beberapa layanan memakai email owner yang sama. Akun Google pengguna Calendar berbeda per intern; owner Google Cloud tidak perlu login Calendar atas nama semua intern.

Tidak perlu API key Google Maps untuk lokasi saat ini: browser mengambil koordinat dan backend menghitung jarak. Tidak ditemukan integrasi SMTP, pembayaran, Firebase, atau Supabase Auth. PDF menggunakan jsPDF lokal; Google Fonts tidak memerlukan API key. Login Google untuk masuk InTrack juga belum ada—OAuth Google saat ini hanya untuk Calendar.

## 2. Database kosong: Neon/PostgreSQL

1. Buat akun/project Neon khusus InTrack dan database `intrack`; pilih region dekat backend.
2. Buat atau gunakan role database project baru, lalu ambil connection string dari tombol **Connect**. Pastikan host, database, dan role mengarah ke project baru. Gunakan string beserta opsi SSL dari dashboard. [Dokumentasi koneksi Neon](https://neon.com/docs/guides/railway).
3. Simpan sebagai `DATABASE_URL` di **server/.env**, bukan hanya `.env` root. Environment hosting backend harus diisi terpisah.
4. Dari root project, setelah memastikan target benar-benar database kosong baru:

```powershell
npm run db:generate --prefix server
npm run db:push --prefix server
```

Perintah ini memakai Prisma untuk membuat schema; tidak membuat akun login. Repository belum mempunyai folder migration historis, sehingga panduan ini memakai script `db:push` yang memang tersedia, khusus target kosong. Jangan menjalankan reset atau menghapus database lama.

5. Seed publikasi sudah menggunakan BOOTSTRAP_ADMIN_EMAIL dan BOOTSTRAP_ADMIN_PASSWORD (minimal 12 karakter), serta BOOTSTRAP_ADMIN_NAME opsional. Set di server/.env. Seed membuat SUPERUSER tanpa password default dan tidak mengubah user yang sudah ada.
6. Setelah target database baru dikonfirmasi:

```powershell
npm run db:seed --prefix server
```

7. Login menggunakan akun baru tersebut. Tambah akun lain dari **Users → Add User**. Password tidak dikirim otomatis melalui email; pengiriman email/reset password self-service belum tersedia.

Yang dibutuhkan aplikasi adalah connection string PostgreSQL, **bukan Neon management API key**. Tidak perlu pg_dump/restore karena kamu memilih mulai kosong. Generate `JWT_SECRET` baru secara lokal, simpan di password manager/environment backend; jangan gunakan secret demo atau membagikannya di chat.

## 3. Penyimpanan file: Cloudflare R2

1. Aktifkan R2 pada akun InTrack dan buat bucket baru `intrack-files`.
2. Buat R2 API token dengan akses object read/write yang dibatasi ke bucket tersebut. Ambil **Access Key ID** dan **Secret Access Key**, bukan memasukkan bearer token Cloudflare ke field S3. Endpoint S3 berbentuk `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`, region `auto`. [Autentikasi R2](https://developers.cloudflare.com/r2/api/tokens/).
3. Isi enam variabel S3 pada template. Jangan menaruh trailing slash di `S3_PUBLIC_URL`.
4. Kode sekarang menyimpan URL file langsung. Public URL harus merupakan domain file yang dapat dibaca, berbeda dari endpoint S3. `r2.dev` ditujukan untuk pengembangan; custom domain dapat dipakai untuk akses publik. [Public buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/).
5. **Untuk bukti izin/sakit dan dokumen pengguna, pilih bucket private dengan download yang memeriksa hak akses.** Ini memerlukan perubahan kode ke signed URL/proxy; belum didukung oleh `r2.service.js` sekarang. Jangan membuka dokumen nyata ke publik hanya agar implementasi saat ini bekerja. Uji sementara memakai data dummy.
6. Setelah perbaikan storage: upload avatar, evidence absensi, dan evidence logbook; buka kembali file; uji file ditolak/terlalu besar dan kegagalan storage.

Tidak perlu mengubah CORS bucket untuk upload yang sepenuhnya dilakukan Node backend. Jika nanti upload langsung dari browser ditambahkan, konfigurasikan CORS untuk origin InTrack. Tidak perlu menyalin objek bucket lama.

## 4. Google Calendar

1. Buat Google Cloud project InTrack, aktifkan **Google Calendar API**.
2. Konfigurasikan Google Auth Platform/consent screen: nama InTrack, email support, audience, dan test users untuk pengujian.
3. Buat OAuth Client tipe **Web application**. Simpan client ID dan secret di backend.
4. Daftarkan redirect URI persis:

```text
Lokal:      http://localhost:3001/api/google/callback
Production: https://<BACKEND-DOMAIN>/api/google/callback
```

5. Isi `GOOGLE_REDIRECT_URI` sesuai environment. Route `/api/auth/google/callback` tidak tersedia pada kode sekarang. Scope yang dipakai adalah `https://www.googleapis.com/auth/calendar.events`; aplikasi meminta offline access untuk refresh token. [Panduan OAuth web server](https://developers.google.com/identity/protocols/oauth2/web-server).
6. Login sebagai intern → Planner → Connect Calendar → pilih akun Google intern → consent. Refresh token terbentuk otomatis dan disimpan di database; tidak perlu menyalinnya ke `.env`.
7. Saat status aplikasi masih External/Testing, refresh token untuk scope Calendar dapat berakhir setelah 7 hari. Siapkan publishing/verification yang sesuai sebelum penggunaan luas. [Masa berlaku token Testing](https://developers.google.com/identity/protocols/oauth2).

Saat ini event masuk ke calendar **primary** pengguna, bukan kalender tim yang dapat dipilih. API key biasa maupun service account tidak menggantikan OAuth ini. Perbaiki validasi state, all-day, dan sinkronisasi update terlebih dahulu. Uji create timed event, all-day, delete, penolakan consent, token expired, dan disconnect. Sync saat ini satu arah dan tidak mengimpor event Google ke InTrack.

## 5. Notion

1. Buat workspace dan database baru, misalnya **InTrack Attendance**.
2. Untuk mengikuti kode sekarang, buat **public OAuth connection/integration**, lalu simpan OAuth client ID/secret. Internal integration token `NOTION_TOKEN` saja tidak dibaca oleh kode saat ini. Aktifkan kemampuan membaca dan memasukkan konten sesuai kebutuhan search/create page, lalu beri connection akses ke database. [Otorisasi Notion](https://developers.notion.com/guides/get-started/authorization).
3. Daftarkan callback:

```text
Lokal:      http://localhost:3001/api/auth/notion/callback
Production: https://<BACKEND-DOMAIN>/api/auth/notion/callback
```

4. Buat property dengan nama dan tipe persis sesuai payload saat ini:

| Property | Tipe | Isi |
|---|---|---|
| Name | Title | Nama intern dan tanggal |
| Status | Select, bukan property tipe Status | Opsi `HADIR`, `IZIN`, `SAKIT` |
| Date | Date | Tanggal absensi |
| Distance | Number | Jarak kilometer |
| Reason | Text/Rich text | Alasan |

Label UI InTrack sudah Inggris, tetapi enum payload Notion masih tiga nilai di atas. File evidence belum dikirim sebagai property Notion.

5. **Perbaikan yang diperlukan sebelum connect:** arahkan return page ke `/admin/settings`; ambil nama intern dari DB; validasi OAuth state; tentukan database eksplisit; selaraskan pemilik token dengan user yang disinkronkan.

Untuk kebutuhan InTrack satu tim, saya menyarankan satu workspace/database yang dikelola admin dengan integrasi terpusat. Ini usulan arsitektur project, belum menjadi perilaku kode. Alternatif mempertahankan per-user membutuhkan tombol connect dan database selection bagi setiap intern. Menghubungkan admin saja sekarang tidak menyinkronkan absensi semua intern.

Kode masih memakai Notion-Version `2022-06-28`. Notion sudah memiliki data source API; database dengan beberapa data source dapat gagal dengan pendekatan database ID lama. Rencanakan upgrade search/parent/data-source ID, bukan sekadar mengganti version header. [Panduan upgrade](https://developers.notion.com/guides/get-started/upgrade-guide-2025-09-03).

## 6. AI chat: akun API baru

Pilihan yang cocok dengan pola request saat ini adalah Gemini melalui endpoint kompatibel chat completions.

1. Buka Google AI Studio menggunakan owner InTrack, buat/pilih project dan API key baru. Pastikan project mempunyai akses model dan kuota/billing sesuai penggunaan. [API keys Gemini](https://ai.google.dev/gemini-api/docs/api-key).
2. Isi backend:

```dotenv
AI_API_KEY=<KEY-BARU>
AI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
AI_MODEL=<ID-MODEL-CHAT-YANG-TERSEDIA-DI-AKUN>
```

Backend menambahkan `/chat/completions` sendiri, jadi jangan menambah path tersebut pada base URL. Pilih model tersedia dari daftar model akun; jangan mengandalkan fallback lama `gemini-2.5-flash` tanpa pengujian. [Endpoint kompatibel Gemini](https://ai.google.dev/gemini-api/docs/openai).
3. Uji satu pertanyaan sederhana, kemudian pertanyaan dengan data intern dummy. Pastikan error quota/key invalid terlihat jelas. Label model pada greeting UI juga perlu diselaraskan jika provider/model berubah.

Key Gemini berbeda dari OAuth secret Calendar, walaupun owner/project dapat dikelola bersama. Chat tidak membutuhkan akun ChatGPT atau key router GetCore. Konteks Indonesia tetap dipahami; instruksi saat ini meminta bahasa Inggris sebagai default jawaban. Data intern yang dimasukkan ke konteks dikirim ke provider AI—gunakan data dummy saat verifikasi awal.

## 7. Face ID / layanan Python

Ini layanan FastAPI + InsightFace milik project, bukan API wajah SaaS yang memerlukan key provider. Face service berbeda dari layanan AI chat.

Untuk lokal, dari folder `ai-service` dengan environment Python/dependensi sudah siap:

```powershell
.\venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8001
```

`npm run dev` saat ini hanya menyalakan frontend dan backend Node, tidak menyalakan Python. Set `FACE_SERVICE_URL=http://127.0.0.1:8001` dan cek `/health`. Endpoint layanan: POST `/enroll`, POST `/verify`, POST `/embedding`; frontend memanggilnya melalui Node, bukan langsung.

Untuk online, deploy Python pada VPS/container sendiri. Jika memakai Hugging Face, buat akun/Space Docker baru; Dockerfile repository sudah memakai port 7860, sesuai pengaturan Docker Space. [Docker Spaces](https://huggingface.co/docs/hub/spaces-sdks-docker). Hosting ini opsional bila Python sudah berjalan di VPS yang sama.

Pastikan model berhasil dimuat dan provider CPU/GPU sesuai mesin. `main.py` menginisialisasi ctx_id=0 sementara requirements mencantumkan onnxruntime; validasi konfigurasi runtime pada mesin target. Jangan mengekspos service tanpa autentikasi/private network. Jika Space membutuhkan bearer token, backend saat ini belum mengirimnya dan perlu diubah.

User baru harus enroll ulang 15 foto. Perbaiki angka required/remaining serta server enforcement absensi sebelum uji end-to-end.

## 8. Hosting dan domain

Pilih satu pola deployment, tidak perlu membuat akun untuk semua alternatif:

- **Satu VPS/container host:** frontend build, Node API, dan Python service; reverse proxy melayani `/api` dan HTTPS. Ini memudahkan satu origin serta Python tetap private.
- **Frontend/backend terpisah:** dua project hosting, dan satu hosting Python. Repository mempunyai konfigurasi Vercel, tetapi rewrite frontend masih menunjuk backend lama dan harus diganti.

Konfigurasi frontend: `VITE_API_URL=/api` jika memakai proxy satu origin, atau `https://<BACKEND>/api` jika langsung lintas origin. Konfigurasi backend: `CLIENT_URL` harus tepat origin frontend, tanpa `/api`. `VITE_*` bersifat publik: jangan masukkan password DB atau API secret.

Untuk GitHub Actions SSH yang sudah ada, buat secret `SERVER_HOST`, `SERVER_USER`, `SSH_PRIVATE_KEY`; ganti path deployment serta nama proses PM2 ke InTrack. Jika memilih deploy hosting melalui Git integration, workflow SSH lama tidak perlu diaktifkan. Siapkan HTTPS untuk penggunaan kamera/geolocation di luar localhost.

## 9. Urutan aktivasi yang disarankan

1. Buat owner/resource baru dan simpan kredensial di password manager.
2. Selesaikan defect P0/P1 pada [audit fungsi](WEBSITE_FUNCTION_AUDIT.md).
3. Isi environment baru berdasarkan [template backend](docs/intrack.server.env.example); template ini tidak berisi secret dan belum aktif.
4. Buat schema database kosong dan bootstrap admin InTrack yang sudah disesuaikan.
5. Jalankan frontend, Node, dan Python. Uji login, refresh/reload, role, profile.
6. Uji storage dummy dan enrollment Face ID, lalu absensi/logbook/PDF.
7. Hubungkan Notion dan Google menggunakan akun baru; verifikasi objek benar-benar muncul di workspace/calendar baru.
8. Uji dashboard/progress/AI dengan data dummy, termasuk isolasi user kedua dan kegagalan integrasi.
9. Update target hosting/domain, kemudian lakukan pemeriksaan yang sama lewat HTTPS.

Selesai berarti login baru bekerja, semua transaksi masuk layanan baru, tidak ada URL backend/file lama yang digunakan, dan pengujian negatif tidak membocorkan/mengubah data user lain. Akun, bucket, database, dan kredensial lama tidak dihapus otomatis oleh proses ini.
