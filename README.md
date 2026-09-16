# InTrack — Sistem Manajemen Absensi & Aktivitas Magang

<p align="center">
  <img src="client/public/brand/intrack-logo.png" alt="Logo InTrack" width="240" />
</p>

**InTrack** adalah aplikasi web untuk mengelola absensi intern, logbook harian, agenda kegiatan, dan pemantauan progres oleh mentor. Aplikasi menyediakan tiga peran pengguna: **Intern**, **Mentor**, dan **Superuser (Admin)**, dengan antarmuka bertema gelap, warna netral, serta aksen coral pada identitas merek dan fitur AI.

InTrack menggabungkan verifikasi wajah, pencatatan lokasi, unggahan bukti kegiatan, dan AI Chat berbasis data aplikasi. Integrasi Google Calendar dan Notion tersedia untuk mendukung pencatatan aktivitas di layanan eksternal.

---

## Fitur Utama

### Untuk Intern

- **Login dan profil:** masuk menggunakan email/password, mengubah profil, dan mengunggah avatar. Akun dibuat oleh admin.
- **Absensi harian:** mengirim status `HADIR`, `IZIN`, atau `SAKIT` beserta evidence. Status hadir memerlukan koordinat lokasi; izin dan sakit memerlukan alasan.
- **Pencatatan lokasi:** menyimpan koordinat dan menghitung jarak dari kantor. Implementasi saat ini belum menolak absensi berdasarkan batas radius.
- **Face ID:** mendaftarkan **15 foto wajah**, melihat progres enrollment, dan memverifikasi wajah sebelum mengirim absensi.
- **Logbook:** mencatat waktu, aktivitas kualitatif/kuantitatif, output, dan evidence per tugas, serta mengunduh laporan PDF.
- **Planner:** membuat, memperbarui, dan menghapus agenda pribadi, termasuk agenda sepanjang hari. Event dapat diteruskan ke Google Calendar setelah akun dihubungkan.

### Untuk Mentor

- **Dashboard:** melihat ringkasan intern, absensi, dan aktivitas yang tercatat.
- **Attendance View:** memantau absensi intern beserta detail dan evidence.
- **Intern Progress:** meninjau aktivitas setiap intern, riwayat logbook, dan laporan PDF.
- **AI Chat:** menanyakan data intern, absensi, logbook, progres, serta agenda melalui ruang percakapan yang menyimpan riwayat pesan.
- **Reset Face ID:** mereset enrollment wajah pengguna melalui API yang memerlukan peran mentor/admin.

Mentor dapat membaca data seluruh intern; akses baca saat ini tidak dibatasi hanya kepada intern yang ditugaskan kepadanya.

### Untuk Superuser (Admin)

- **Manajemen pengguna:** membuat, mengubah, dan menghapus akun, mengatur peran, serta menugaskan mentor kepada intern.
- **Pengaturan absensi:** mengatur jam mulai/akhir pengisian dan koordinat kantor.
- **Pembukaan tanggal absensi:** membuka atau menutup tanggal pengisian, termasuk secara massal, agar intern dapat mengirim ulang absensi tanggal lampau yang diizinkan.
- **Integrasi Notion bersama:** menghubungkan workspace, memilih database/data source absensi, melihat status sinkronisasi, dan mencoba ulang sinkronisasi yang gagal.
- **Pemantauan:** mengakses dashboard, progres intern, dan AI Chat yang juga tersedia untuk mentor.

### Aturan Absensi

- Waktu operasional menggunakan **WIB (`Asia/Jakarta`)**. Pengaturan awal seed adalah **10:00–17:00**.
- Semua status absensi memerlukan evidence dan bukti verifikasi wajah yang valid.
- Bukti verifikasi terikat pada pengguna dan tanggal, berlaku **2 menit**, dan hanya dapat digunakan sekali.
- Tanggal masa depan ditolak; tanggal lampau harus dibuka oleh admin terlebih dahulu.
- Sistem menyimpan satu catatan per pengguna per tanggal dan dapat memperbaruinya melalui pengiriman ulang yang valid. Belum ada alur clock-out.

---

## Arsitektur Sistem

Project menggunakan monorepo dengan frontend React, backend Express, dan layanan Python terpisah untuk pengenalan wajah. Backend mengakses PostgreSQL, object storage, serta integrasi eksternal.

```text
InTrack/
├── client/                 # Frontend React + Vite
│   ├── public/brand/       # Logo dan favicon InTrack
│   ├── src/                # Halaman, komponen, API client, dan styling
│   └── vercel.json         # Fallback routing SPA
├── server/                 # Backend Express
│   ├── api/index.js        # Entry point deployment serverless
│   ├── prisma/             # Schema, migrations, dan seed admin
│   ├── src/                # Routes, controllers, services, middleware
│   ├── test/               # Tes backend dan evaluasi AI
│   └── vercel.json         # Routing deployment backend
├── ai-service/             # FastAPI + InsightFace
│   ├── main.py
│   ├── requirements.txt
│   └── Dockerfile
├── docs/                   # Template environment dan script audit
├── .github/workflows/      # Pemeriksaan otomatis
├── .env                    # Konfigurasi lokal, tidak untuk di-commit
└── package.json            # Menjalankan client/server dan pemeriksaan
```

`npm run dev` menjalankan frontend dan backend Node.js melalui `concurrently`. Layanan Python dijalankan secara terpisah.

---

## Stack Teknologi

| Bagian | Teknologi |
|---|---|
| Frontend | React 19, Vite 7, Tailwind CSS 4, React Router DOM 7 |
| Komponen pendukung | Lucide React, Axios, react-webcam, jsPDF, jsPDF-AutoTable |
| Backend | Node.js, Express 5, Prisma 6.19.2, PostgreSQL |
| Autentikasi | bcryptjs, JWT, cookie HTTP-only, sesi dan rotasi refresh token di database |
| HTTP dan unggahan | Helmet, CORS, Morgan, Multer |
| Object storage | AWS SDK S3 untuk penyimpanan yang kompatibel dengan S3; template memakai Supabase Storage |
| Integrasi | Google APIs untuk Calendar, Notion API/SDK untuk sinkronisasi absensi |
| Face recognition | Python, FastAPI, InsightFace, ONNX Runtime, OpenCV, NumPy |
| AI Chat | REST API yang kompatibel dengan OpenAI; provider/model diatur melalui environment |
| Konfigurasi hosting | Vercel untuk client/API dan Docker untuk layanan wajah; template database menggunakan Neon PostgreSQL |

Nama paket npm dan sebagian identifier internal masih memakai `getabsen`; identitas aplikasi yang ditampilkan kepada pengguna adalah **InTrack**.

---

## Database Schema

Schema PostgreSQL dikelola melalui [Prisma](server/prisma/schema.prisma) dan saat ini memiliki **14 model**:

| Model | Deskripsi |
|---|---|
| `User` | Akun, peran, profil, dan relasi mentor–intern |
| `Attendance` | Status absensi per tanggal, waktu pengiriman, lokasi, jarak, dan alasan |
| `AttendanceEvidence` | URL dan tipe file bukti absensi |
| `FaceEmbedding` | Embedding wajah 512 dimensi dan label foto |
| `LogbookEntry` | Catatan logbook per pengguna per tanggal |
| `LogbookTask` | Waktu, aktivitas, output, dan evidence setiap tugas |
| `PlannerEvent` | Agenda pengguna dan ID event Google Calendar |
| `ExternalSync` | Status dan identitas sinkronisasi absensi ke layanan eksternal |
| `AppSetting` | Jam absensi, koordinat kantor, pembukaan tanggal, dan konfigurasi integrasi bersama |
| `ChatRoom` | Ruang percakapan AI milik pengguna |
| `ChatMessage` | Riwayat pesan pengguna dan asisten |
| `AuthSession` | Sesi login, hash refresh token, dan waktu kedaluwarsa |
| `OneTimeToken` | Token sekali pakai untuk OAuth dan bukti verifikasi wajah |
| `FaceAttempt` | Jumlah percobaan verifikasi wajah dan masa pemblokiran |

---

## Setup & Instalasi Lokal

### Prasyarat

- **Node.js 22.12+ pada lini 22** dan npm. Vite yang terpasang mensyaratkan `^20.19.0 || >=22.12.0`; workflow project menggunakan Node.js 22.
- **PostgreSQL**, misalnya database Neon, beserta connection string.
- **Object storage kompatibel S3** untuk evidence dan avatar.
- **Python 3.10** untuk mengikuti lingkungan Docker layanan wajah; kamera dan izin lokasi browser diperlukan untuk alur absensi.
- Kredensial **Google Calendar**, **Notion**, dan **provider AI Chat** jika menggunakan integrasi tersebut.

### 1. Siapkan Environment

Buka terminal di root repository `InTrack`. Untuk checkout baru, salin [template environment](docs/intrack.server.env.example) menjadi `.env`:

```powershell
Copy-Item docs/intrack.server.env.example .env
```

Jika `.env` sudah tersedia, perbarui nilai yang diperlukan di file tersebut. Isi kredensial layanan milik sendiri. Konfigurasi dasar yang perlu diperhatikan:

```env
NODE_ENV=development
PORT=3001
CLIENT_URL=http://localhost:5173
DATABASE_URL=postgresql://USER:PASSWORD@HOST/intrack?sslmode=require

JWT_SECRET=GANTI_DENGAN_SECRET_ACAK_YANG_KUAT
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

OFFICE_LATITUDE=-6.2088
OFFICE_LONGITUDE=106.8456
FACE_SERVICE_URL=http://127.0.0.1:8001

# Diperlukan saat menjalankan seed admin pertama
BOOTSTRAP_ADMIN_EMAIL=admin@example.com
BOOTSTRAP_ADMIN_PASSWORD=GANTI_DENGAN_PASSWORD_UNIK_MINIMAL_12_KARAKTER
BOOTSTRAP_ADMIN_NAME=InTrack Admin
```

Nilai koordinat di atas adalah contoh; sesuaikan dengan kantor yang digunakan. Setelah seed, pengaturan tersimpan dapat diubah melalui halaman admin.

| Integrasi | Variabel environment |
|---|---|
| Storage | `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET_NAME`, `S3_PUBLIC_URL` |
| Google Calendar | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` |
| Notion | `NOTION_CLIENT_ID`, `NOTION_CLIENT_SECRET`, `NOTION_REDIRECT_URI` |
| AI Chat | `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL` |

Gunakan callback lokal berikut agar sesuai dengan route backend:

```env
GOOGLE_REDIRECT_URI=http://localhost:3001/api/google/callback
NOTION_REDIRECT_URI=http://localhost:3001/api/auth/notion/callback
```

Urutan prioritas konfigurasi backend adalah **environment proses → `server/.env` → `.env` root**. Script Prisma menggunakan loader yang sama. Simpan secret hanya di environment backend.

Frontend secara default memakai `/api`, yang diteruskan oleh Vite ke `http://localhost:3001`. File `client/.env` bersifat opsional untuk penggunaan lokal:

```env
VITE_API_URL=/api
```

### 2. Install Dependencies

Jalankan dari root repository:

```powershell
npm ci
npm ci --prefix server
npm ci --prefix client
npm run db:generate --prefix server
```

### 3. Siapkan Database dan Admin

Untuk **database baru yang masih kosong**:

```powershell
npm run db:migrate
npm run db:seed
```

`db:migrate` menjalankan `prisma migrate deploy` untuk menerapkan migration yang tersedia. Database yang sudah berisi tabel perlu diperiksa dan memiliki baseline yang sesuai sebelum menerapkan migration; jangan melakukan reset untuk mengikuti panduan ini.

Seed membutuhkan `BOOTSTRAP_ADMIN_EMAIL` dan `BOOTSTRAP_ADMIN_PASSWORD` minimal 12 karakter. Seed membuat akun `SUPERUSER` dan pengaturan yang belum ada tanpa mengubah pengguna yang sudah tersimpan. Tidak tersedia kredensial login bawaan maupun seed akun demo.

### 4. Jalankan Frontend dan Backend

```powershell
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3001`
- Health check backend: `http://localhost:3001/api/health`

Port di atas mengikuti `.env` dan proxy Vite. Pastikan `PORT=3001`; fallback backend tanpa variabel tersebut adalah `3000`.

### 5. Jalankan AI Face Service

Layanan ini diperlukan untuk enrollment/verifikasi wajah dan pengiriman absensi. Jika sudah memakai layanan remote, isi `FACE_SERVICE_URL` dengan URL layanan tersebut.

Untuk menjalankannya secara lokal, buka terminal terpisah:

```powershell
cd ai-service
python -m venv venv
.\venv\Scripts\python.exe -m pip install -r requirements.txt
.\venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8001
```

Pada Linux/macOS, gunakan `venv/bin/python` sebagai pengganti `.\venv\Scripts\python.exe`. Tunggu inisialisasi model InsightFace selesai, lalu periksa `http://127.0.0.1:8001/health`.

### 6. Penggunaan Pertama

1. Login menggunakan akun hasil bootstrap, lalu buat akun intern dan mentor melalui **Users**.
2. Periksa jam absensi dan koordinat kantor melalui **Settings**.
3. Login sebagai intern, izinkan kamera/lokasi, dan selesaikan 15 foto pada **Face ID**.
4. Verifikasi wajah dan kirim absensi beserta evidence pada waktu pengisian yang diizinkan.
5. Isi **Logbook** dan **Planner**, lalu periksa hasilnya dari akun mentor.
6. Hubungkan Google Calendar dari Planner dan Notion dari Settings admin jika diperlukan.

---

## Panduan Deployment

Repository menyediakan konfigurasi deployment, tetapi keberhasilan deployment tetap perlu diperiksa di lingkungan tujuan. Panduan layanan dan akun yang lebih lengkap tersedia di [New Accounts & Integrations](INTRACK_NEW_ACCOUNTS_GUIDE.md).

### Backend — Vercel

- Gunakan root directory **`server`**, dengan entry point `api/index.js` dan konfigurasi [server/vercel.json](server/vercel.json).
- Install dependencies menggunakan `npm ci`; `postinstall` menjalankan Prisma generate.
- Isi environment backend, termasuk `DATABASE_URL`, `JWT_SECRET`, konfigurasi storage/integrasi, `NODE_ENV=production`, dan `CLIENT_URL=https://<FRONTEND>`.
- Terapkan migration ke database tujuan melalui proses terpisah yang terkontrol. Jalankan seed hanya jika perlu membuat admin awal.
- Periksa `https://<BACKEND>/api/health` setelah deployment.

### Frontend — Vercel

- Gunakan project terpisah dengan root directory **`client`**.
- Build command: `npm run build`; output directory: `dist`; install command: `npm ci`.
- Isi **`VITE_API_URL=https://<BACKEND>/api`** sebelum build.
- [client/vercel.json](client/vercel.json) hanya menyediakan fallback ke `index.html` untuk routing React. Konfigurasi tersebut **belum menyediakan proxy `/api`** seperti proxy development Vite.

Sesuaikan `CLIENT_URL` backend dan kedua callback OAuth dengan domain aktual. Untuk pola dua project, callback Google memakai `https://<BACKEND>/api/google/callback`, sedangkan Notion memakai `https://<BACKEND>/api/auth/notion/callback`. Perubahan environment memerlukan deployment ulang; `VITE_API_URL` tertanam saat build frontend.

Uji login, reload, refresh sesi, callback OAuth, dan upload pada browser tujuan. Jika cookie lintas situs diblokir, gunakan domain frontend/API yang berada dalam satu situs atau implementasikan proxy satu origin beserta penyesuaian OAuth/cookie.

### AI Face Service — Docker / Hugging Face Spaces

[Dockerfile](ai-service/Dockerfile) menggunakan Python 3.10 dan menjalankan Uvicorn pada port **7860**. Untuk Space berbasis Docker, gunakan isi folder `ai-service/` sebagai sumber build. Setelah layanan aktif, arahkan `FACE_SERVICE_URL` backend ke URL layanan tersebut dan periksa `/health`.

---

## API Endpoints

Berikut route utama yang tersedia di source code. Akses selain login, refresh, health check, dan callback OAuth membutuhkan autentikasi; pembatasan peran dan kepemilikan diterapkan sesuai route.

### Autentikasi & Profil

| Method | Endpoint | Deskripsi |
|---|---|---|
| `GET` | `/api/health` | Health check backend |
| `POST` | `/api/auth/login` | Login email/password |
| `POST` | `/api/auth/refresh` | Rotasi refresh token dan penerbitan access token |
| `POST` | `/api/auth/logout` | Mencabut sesi dan menghapus cookie |
| `GET` | `/api/auth/me` | Data pengguna yang sedang login |
| `PUT` | `/api/auth/profile` | Memperbarui profil dan avatar |

### Absensi, Logbook & Planner

| Method | Endpoint | Deskripsi |
|---|---|---|
| `GET / POST` | `/api/attendance` | Membaca absensi / mengirim absensi intern |
| `GET` | `/api/attendance/:id` | Detail absensi |
| `POST` | `/api/attendance/:id/evidence` | Menambah evidence |
| `GET / POST` | `/api/logbook` | Membaca / membuat entri logbook |
| `POST` | `/api/logbook/:entryId/tasks` | Menambah tugas beserta evidence |
| `PUT / DELETE` | `/api/logbook/tasks/:taskId` | Memperbarui / menghapus tugas |
| `GET / POST` | `/api/planner/events` | Membaca / membuat agenda |
| `PUT / DELETE` | `/api/planner/events/:id` | Memperbarui / menghapus agenda milik pengguna |

### Face ID

| Method | Endpoint | Deskripsi |
|---|---|---|
| `POST` | `/api/face/enroll` | Mengunggah satu foto enrollment |
| `POST` | `/api/face/verify` | Memverifikasi wajah dan menerbitkan `faceProof` |
| `GET` | `/api/face/status` | Jumlah foto dan status enrollment |
| `DELETE` | `/api/face/enroll/:userId` | Reset enrollment oleh mentor/admin |

Layanan Python memiliki endpoint terpisah: `GET /health`, `POST /embedding`, `POST /enroll`, dan `POST /verify`. Frontend menggunakan API Express; backend yang meneruskan foto ke layanan Python.

### Pengguna, Admin & AI Chat

| Method | Endpoint | Deskripsi |
|---|---|---|
| `GET / POST` | `/api/users` | Daftar pengguna untuk mentor/admin / pembuatan akun oleh admin |
| `PUT / DELETE` | `/api/users/:id` | Perubahan / penghapusan akun oleh admin |
| `GET / PUT` | `/api/admin/settings` | Membaca / memperbarui pengaturan admin |
| `GET` | `/api/admin/attendance/config` | Konfigurasi absensi untuk pengguna login |
| `GET` | `/api/admin/attendance/reopened` | Daftar tanggal yang dibuka |
| `POST / DELETE` | `/api/admin/attendance/reopen` | Membuka / menutup tanggal |
| `POST` | `/api/admin/attendance/reopen-bulk` | Membuka beberapa tanggal |
| `POST` | `/api/admin/attendance/close-bulk` | Menutup beberapa tanggal |
| `GET / POST` | `/api/admin/mentor/chat-rooms` | Daftar / pembuatan ruang AI Chat |
| `PUT / DELETE` | `/api/admin/mentor/chat-rooms/:id` | Perubahan / penghapusan ruang chat |
| `GET` | `/api/admin/mentor/chat-rooms/:roomId/messages` | Riwayat pesan suatu ruang |
| `POST` | `/api/admin/mentor/ai-query` | Mengirim pertanyaan AI untuk mentor/admin |

### Google Calendar & Notion

| Method | Endpoint | Deskripsi |
|---|---|---|
| `GET` | `/api/google/auth-url` | URL consent Google Calendar |
| `GET` | `/api/google/callback` | Callback OAuth Google |
| `GET` | `/api/google/status` | Status koneksi Calendar |
| `POST` | `/api/google/disconnect` | Memutus koneksi Calendar |
| `GET` | `/api/auth/notion` | URL consent Notion untuk admin |
| `GET` | `/api/auth/notion/callback` | Callback OAuth Notion |
| `GET` | `/api/auth/notion/status` | Status integrasi bersama |
| `GET` | `/api/auth/notion/databases` | Daftar database/data source yang tersedia |
| `PUT` | `/api/auth/notion/database` | Memilih data source absensi |
| `GET` | `/api/auth/notion/syncs` | Riwayat sinkronisasi terbaru |
| `POST` | `/api/auth/notion/sync/:attendanceId` | Mencoba ulang sinkronisasi absensi |
| `DELETE` | `/api/auth/notion/disconnect` | Memutus koneksi Notion bersama |

---

## Integrasi AI & Layanan Eksternal

### AI Chat Asisten

Backend menyusun konteks dari database melalui [ai.context.js](server/src/services/ai.context.js), lalu mengirimkannya ke provider yang dikonfigurasi. Model menerima konteks yang disiapkan backend, termasuk daftar intern, absensi, detail/output logbook, agenda, rentang tanggal, dan penanda hasil yang terpotong.

- Cakupan percakapan dibatasi pada data/fitur InTrack dan pendampingan magang yang relevan.
- Klasifikasi cakupan dijalankan sebelum pembuatan jawaban; pertanyaan di luar cakupan menerima penolakan tetap. Hasil klasifikasi yang tidak valid menghentikan permintaan.
- Sapaan, ucapan terima kasih, dan pilihan bahasa sederhana dapat dijawab lokal tanpa memanggil provider.
- Bahasa mengikuti preferensi eksplisit atau bahasa pertanyaan. Instruksi jawaban secara default membatasi panjang hingga 100 kata, atau 60 kata untuk permintaan singkat.
- Data database dan riwayat chat diperlakukan sebagai masukan tidak tepercaya. Asisten diarahkan untuk mengakui data yang tidak tersedia serta membedakan pencatatan absensi dari kehadiran.
- Pertanyaan dalam cakupan menggunakan dua permintaan provider dengan timeout bersama 45 detik. Pesan percakapan disimpan setelah provider berhasil.

Atur `AI_API_KEY`, `AI_BASE_URL`, dan `AI_MODEL` sebagai satu konfigurasi yang sesuai dengan provider pilihan. Evaluasi model diperlukan setelah perubahan model atau prompt; tes unit tidak menjamin ketahanan terhadap prompt injection maupun ketepatan semua jawaban model.

### Face Recognition

InsightFace menghasilkan embedding 512 dimensi. Setelah 15 foto terdaftar, foto verifikasi dibandingkan dengan embedding tersimpan menggunakan cosine similarity. Nilai threshold saat ini adalah **`0.4`**, ditetapkan sebagai konstanta `SIMILARITY_THRESHOLD` di [main.py](ai-service/main.py), bukan environment variable.

Backend membatasi percobaan verifikasi; kegagalan berulang hingga batas 5 percobaan memicu pemblokiran selama 15 menit. Liveness detection belum diimplementasikan. Dependencies bawaan memakai `onnxruntime`; penggunaan GPU memerlukan runtime/provider dan dependensi GPU yang sesuai.

### Google Calendar

OAuth Google menghubungkan kalender pengguna yang sudah login. Sinkronisasi berjalan **satu arah dari InTrack ke kalender `primary` Google**, mencakup pembuatan, perubahan, dan penghapusan event. Belum ada impor event Google, rekonsiliasi dua arah, atau mekanisme retry persisten; kegagalan provider dapat meninggalkan perubahan hanya di InTrack.

### Notion

Admin mengelola satu koneksi bersama untuk sinkronisasi absensi seluruh intern. Integrasi menyediakan pemilihan data source, validasi kolom, pembuatan/perubahan halaman, dan retry. Google/Notion OAuth digunakan untuk menghubungkan integrasi, bukan sebagai metode login aplikasi.

---

## Perintah Development & Pengujian

Jalankan perintah berikut dari root repository sesuai kebutuhan:

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Menjalankan client dan backend Node.js |
| `npm run dev:client` | Menjalankan frontend saja |
| `npm run dev:server` | Menjalankan backend saja |
| `npm run db:generate --prefix server` | Menghasilkan Prisma Client |
| `npm run db:migrate` | Menerapkan migration yang tersedia |
| `npm run db:seed` | Membuat admin dan pengaturan awal yang belum ada |
| `npm run db:studio` | Membuka Prisma Studio |
| `npm run db:push` | Menyamakan schema langsung; bukan alur migration utama |
| `npm test` | Menjalankan tes otomatis backend dan utilitas frontend |
| `npm run lint --prefix client` | Memeriksa lint frontend |
| `npm run build --prefix client` | Menghasilkan build frontend di `client/dist` |

Workflow [Checks](.github/workflows/check.yml) menjalankan tes, lint, dan build tanpa kredensial production. Tes menggunakan fixture terisolasi untuk memeriksa sesi, token, OAuth, validasi, integrasi tiruan, konteks AI, dan pembatasan cakupan/bahasa.

Evaluasi langsung terhadap provider AI dijalankan secara terpisah:

```powershell
node --test server/test/ai-scope.live.cjs
```

Evaluasi tersebut menggunakan kuota provider dan data intern fiktif tanpa mengakses database. Skenario berjalan berurutan dengan jeda 15 detik antarpermintaan provider dan melewati skenario berikutnya ketika provider gagal. Jeda di dalam satu percakapan ikut dihitung dalam timeout 45 detik.

Untuk audit integrasi yang membuat/menghapus data sementara dan menghubungi layanan nyata, ikuti [instruksi audit live](IMPLEMENTATION_STATUS.md). `docs/function-audit.cjs` merupakan harness historis sebelum migrasi keamanan, bukan pemeriksaan utama versi ini.

---

## Batasan Implementasi & Dokumentasi Lanjutan

- Evidence masih menggunakan URL publik; unduhan privat dengan pemeriksaan izin belum tersedia.
- Penghapusan akun belum memiliki antrean pembersihan otomatis untuk objek storage lama dan event provider. Kompensasi upload juga belum memiliki retry jika penghapusan objek gagal.
- Kamera, lokasi, PDF, consent OAuth, dan integrasi dengan akun layanan nyata perlu diuji pada lingkungan yang digunakan. Angka hasil audit dalam dokumen status merupakan hasil pada tanggal pencatatannya, bukan jaminan kondisi layanan saat ini.

| Dokumen | Isi |
|---|---|
| [New Accounts & Integrations](INTRACK_NEW_ACCOUNTS_GUIDE.md) | Setup akun layanan, environment, integrasi, dan deployment |
| [Implementation Status](IMPLEMENTATION_STATUS.md) | Catatan implementasi, hasil pemeriksaan bertanggal, dan pengujian lanjutan |
| [Website Function Audit](WEBSITE_FUNCTION_AUDIT.md) | Audit fungsi dan riwayat temuan |
| [Design Reference](DESIGN.md) | Referensi desain project |
| [UI Rebranding Plan](UI_REBRANDING_PLAN.md) | Rencana perubahan identitas dan tampilan |
| [Environment Template](docs/intrack.server.env.example) | Placeholder konfigurasi backend tanpa kredensial aktif |
