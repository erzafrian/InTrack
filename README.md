# InTrack — Sistem Manajemen Absensi & Aktivitas Magang

<p align="center">
  <img src="client/public/brand/intrack-logo.png" alt="Logo InTrack" width="240" />
</p>

**InTrack** adalah aplikasi web untuk mengelola absensi intern, logbook harian, agenda kegiatan, dan pemantauan progres oleh mentor. Aplikasi menyediakan tiga peran pengguna: **Intern**, **Mentor**, dan **Superuser (Admin)**, dengan antarmuka bertema gelap, warna netral, serta aksen coral pada identitas merek dan fitur AI.

InTrack menggabungkan verifikasi wajah, pencatatan lokasi, unggahan bukti kegiatan, dan AI Chat berbasis data aplikasi. Integrasi Google Calendar tersedia untuk meneruskan agenda ke kalender pengguna. Database menggunakan Neon PostgreSQL, sedangkan evidence dan avatar disimpan di Supabase Storage.

## Status Project Terbaru

- **Perbaikan audit:** enrollment wajah dikunci setelah 15 foto; admin terakhir dilindungi; validasi akun, pembatasan login, dan perlindungan request lintas situs ditambahkan. Edit profil biasa mempertahankan sesi. Respons AI mengikuti ruang asal, tanggal operasional memakai WIB, dan Planner menyediakan retry sinkronisasi Google.
- **Efisiensi layanan wajah:** inferensi berjalan di thread terpisah, dengan satu inferensi aktif per worker dan penolakan sementara saat sibuk. Kapasitas VPS 2 vCPU/2 GB yang dibagi beberapa project masih perlu diukur dengan model nyata.
- **File dan dependency:** pilihan upload evidence diselaraskan menjadi JPEG, PNG, WebP, dan PDF. Penggantian avatar/evidence logbook mencoba menghapus objek lama. Lockfile npm diperbarui dan Prisma menggunakan versi 6.19.3; catatan hasil audit dependency tersedia pada bagian pengujian.
- **Target deployment VPS:** frontend berupa hasil build statis, backend memakai `server/src/server.js`, dan layanan wajah dijalankan terpisah. Konfigurasi Vercel serta entry point `server/api/index.js` telah dihapus.
- **Settings admin:** berisi pengaturan jam absensi, koordinat kantor, dan petunjuk koneksi Google Calendar dari Planner. Integrasi Notion serta informasi storage pada halaman Settings telah dihapus.
- **Penyimpanan tetap aktif:** Neon menyimpan data aplikasi, sedangkan Supabase Storage menyimpan file. Upload ditangani oleh [storage.service.js](server/src/services/storage.service.js) melalui konfigurasi `S3_*` pada backend.
- **Akun dan login:** contoh alamat menggunakan domain `@intrack.com`. Perubahan alamat akun yang sudah ada tidak mengubah password.
- **Repository dirapikan:** worktree `.kilo` telah dilepas, arsip audit dan cache Python lokal dibersihkan, serta informasi penting dari dokumen Markdown lama dipusatkan di README ini. Tes, migration, workflow CI, dan script audit yang masih digunakan tetap dipertahankan.

---

## Fitur Utama

### Untuk Intern

- **Login dan profil:** masuk menggunakan email/password, mengubah profil, dan mengunggah avatar. Akun dibuat oleh admin.
- **Absensi harian:** mengirim status `HADIR`, `IZIN`, atau `SAKIT` beserta evidence. Status hadir memerlukan koordinat lokasi; izin dan sakit memerlukan alasan.
- **Pencatatan lokasi:** menyimpan koordinat dan menghitung jarak dari kantor. Implementasi saat ini belum menolak absensi berdasarkan batas radius.
- **Face ID:** mendaftarkan **15 foto wajah**, melihat progres enrollment, dan memverifikasi wajah sebelum mengirim absensi.
- **Logbook:** mencatat waktu, aktivitas kualitatif/kuantitatif, output, dan evidence per tugas, serta mengunduh laporan PDF.
- **Planner:** membuat dan menghapus agenda pribadi, termasuk agenda sepanjang hari, serta mencoba ulang sinkronisasi ke Google Calendar. Perubahan agenda tersedia melalui API; formulir edit agenda belum tersedia di antarmuka.

### Untuk Mentor

- **Dashboard:** melihat ringkasan intern, absensi, dan aktivitas yang tercatat.
- **Attendance View:** memantau absensi intern beserta detail dan evidence.
- **Intern Progress:** meninjau aktivitas setiap intern, riwayat logbook, dan laporan PDF.
- **AI Chat:** menanyakan data intern, absensi, logbook, progres, serta agenda melalui ruang percakapan yang menyimpan riwayat pesan.
- **Reset Face ID:** mereset enrollment wajah pengguna melalui API yang memerlukan peran mentor/admin.

Mentor dapat membaca data seluruh intern; akses baca saat ini tidak dibatasi hanya kepada intern yang ditugaskan kepadanya.

### Untuk Superuser (Admin)

- **Manajemen pengguna:** membuat, mengubah, dan menghapus akun serta mengatur peran melalui Users. Penugasan mentor kepada intern didukung API pengguna; formulir Users belum menyediakan pilihan mentor.
- **Pengaturan absensi:** mengatur jam mulai/akhir pengisian dan koordinat kantor.
- **Pembukaan tanggal absensi:** membuka atau menutup tanggal pengisian, termasuk secara massal, agar intern dapat mengisi absensi tanggal lampau yang diizinkan.
- **Pemantauan:** mengakses dashboard, progres intern, dan AI Chat yang juga tersedia untuk mentor.

### Aturan Absensi

- Waktu operasional menggunakan **WIB (`Asia/Jakarta`)**. Pengaturan awal seed adalah **10:00–17:00**.
- Semua status absensi memerlukan evidence dan bukti verifikasi wajah yang valid.
- Bukti verifikasi terikat pada pengguna dan tanggal, berlaku **2 menit**, dan hanya dapat digunakan sekali.
- Tanggal masa depan ditolak; tanggal lampau harus dibuka oleh admin terlebih dahulu.
- Sistem menyimpan satu catatan per pengguna per tanggal. API mendukung pembaruan melalui pengiriman ulang yang valid, tetapi antarmuka saat ini menampilkan detail untuk tanggal yang sudah terisi dan belum menyediakan formulir kirim ulang. Belum ada alur clock-out.

---

## Arsitektur Sistem

Project menggunakan monorepo dengan frontend React, backend Express, dan layanan Python terpisah untuk pengenalan wajah. Backend mengakses PostgreSQL, object storage, serta integrasi eksternal.

```text
InTrack/
├── client/                 # Frontend React + Vite
│   ├── public/brand/       # Logo dan favicon InTrack
│   ├── src/                # Halaman, komponen, API client, dan styling
│   ├── test/               # Tes tanggal dan respons asinkron AI Chat
│   └── vite.config.js      # Konfigurasi build dan proxy development
├── server/                 # Backend Express
│   ├── prisma/             # Schema, migrations, dan seed admin
│   ├── src/                # Routes, controllers, services, middleware
│   │   ├── app.js          # Konfigurasi Express dan pemasangan route
│   │   └── server.js       # Entry point proses backend
│   └── test/               # Tes backend dan evaluasi AI
├── ai-service/             # FastAPI + InsightFace
│   ├── main.py
│   ├── test_main.py         # Tes terisolasi tanpa kamera/model eksternal
│   ├── requirements.txt
│   ├── .dockerignore        # Mengecualikan environment, cache, dan tes dari image
│   └── Dockerfile
├── docs/                   # Template environment dan script audit
│   ├── intrack.server.env.example
│   ├── config-audit.cjs
│   └── live-function-audit.cjs
├── .github/workflows/      # Pemeriksaan otomatis
├── .gitignore              # Mengabaikan secret, dependency, cache, dan hasil audit
├── package.json            # Menjalankan client/server dan pemeriksaan
└── README.md               # Panduan utama project
```

`npm run dev` menjalankan frontend dan backend Node.js melalui `concurrently`. Layanan Python dijalankan secara terpisah.

File `.env` dibuat saat setup dan tidak disertakan dalam repository. Folder `node_modules/`, virtual environment Python, `client/dist/`, dan hasil audit JSON merupakan file lokal/hasil proses yang diabaikan Git. Manifest dan lockfile npm tetap diperlukan untuk instalasi dependency yang konsisten.

---

## Stack Teknologi

| Bagian | Teknologi |
|---|---|
| Frontend | React 19, Vite 7, Tailwind CSS 4, React Router DOM 7 |
| Komponen pendukung | Lucide React, Axios, react-webcam, jsPDF, jsPDF-AutoTable |
| Backend | Node.js, Express 5, Prisma 6.19.3, PostgreSQL |
| Autentikasi | bcryptjs, JWT, cookie HTTP-only, sesi dan rotasi refresh token di database |
| HTTP dan unggahan | Helmet, CORS, Morgan, Multer |
| Object storage | AWS SDK S3 untuk penyimpanan yang kompatibel dengan S3; template memakai Supabase Storage |
| Integrasi | Google APIs untuk Calendar |
| Face recognition | Python, FastAPI, InsightFace, ONNX Runtime, OpenCV, NumPy |
| AI Chat | REST API yang kompatibel dengan OpenAI; provider/model diatur melalui environment |
| Target hosting | VPS: frontend statis melalui Nginx, backend Node.js, dan layanan wajah lokal/private atau remote |

---

## Database Schema

Schema PostgreSQL dikelola melalui [Prisma](server/prisma/schema.prisma) dan saat ini memiliki **14 model**, termasuk satu model riwayat integrasi lama yang dipertahankan untuk kompatibilitas database:

| Model | Deskripsi |
|---|---|
| `User` | Akun, peran, profil, dan relasi mentor–intern |
| `Attendance` | Status absensi per tanggal, waktu pengiriman, lokasi, jarak, dan alasan |
| `AttendanceEvidence` | URL dan tipe file bukti absensi |
| `FaceEmbedding` | Embedding wajah 512 dimensi dan label foto |
| `LogbookEntry` | Catatan logbook per pengguna per tanggal |
| `LogbookTask` | Waktu, aktivitas, output, dan evidence setiap tugas |
| `PlannerEvent` | Agenda pengguna dan ID event Google Calendar |
| `ExternalSync` | Riwayat integrasi lama; tidak lagi menerima sinkronisasi baru |
| `AppSetting` | Jam absensi, koordinat kantor, dan pembukaan tanggal |
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
- Kredensial **Google Calendar** dan **provider AI Chat** jika menggunakan integrasi tersebut.

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
BOOTSTRAP_ADMIN_EMAIL=admin@intrack.com
BOOTSTRAP_ADMIN_PASSWORD=GANTI_DENGAN_PASSWORD_UNIK_MINIMAL_12_KARAKTER
BOOTSTRAP_ADMIN_NAME=InTrack Admin
```

Nilai koordinat di atas adalah contoh; sesuaikan dengan kantor yang digunakan. Setelah seed, pengaturan tersimpan dapat diubah melalui halaman admin.

| Integrasi | Variabel environment |
|---|---|
| Storage | `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET_NAME`, `S3_PUBLIC_URL` |
| Google Calendar | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` |
| AI Chat | `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL` |

Gunakan callback lokal berikut agar sesuai dengan route backend:

```env
GOOGLE_REDIRECT_URI=http://localhost:3001/api/google/callback
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

Contoh penamaan email sesuai peran:

| Peran | Contoh email | Pembuatan pada instalasi baru |
|---|---|---|
| Admin (`SUPERUSER`) | `admin@intrack.com` | Bootstrap melalui seed |
| Mentor (`MENTOR`) | `mentor@intrack.com` | Dibuat admin melalui Users |
| Intern (`INTERN`) | `intern@intrack.com` | Dibuat admin melalui Users |

Akun baru atau perubahan password melalui Users memerlukan minimal 12 karakter dan maksimal 72 byte UTF-8. Email divalidasi dan login tidak membedakan huruf besar/kecil. Password akun lama tetap berlaku.

Tabel ini bukan daftar kredensial bawaan. Pada database yang sebelumnya diperbarui, gunakan alamat `@intrack.com` dengan password masing-masing yang tetap sama. Pada database baru, tentukan password saat bootstrap/pembuatan akun. Placeholder login adalah `name@intrack.com`; aplikasi belum membatasi email hanya pada domain tersebut dan tidak membuat mailbox email.

### 4. Jalankan Frontend dan Backend

```powershell
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3001`
- Health check backend: `http://localhost:3001/api/health`

Port di atas mengikuti `.env`, default backend, dan proxy Vite (`3001`). Jika mengubah port backend, sesuaikan proxy Vite juga.

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
6. Hubungkan Google Calendar dari Planner jika diperlukan. Settings admin menampilkan jam absensi, lokasi kantor, dan petunjuk koneksi Calendar dari Planner.

---

## Konfigurasi Akun Layanan

### Neon PostgreSQL

Buat atau pilih project, branch, database, dan role di Neon, lalu salin connection string lengkap beserta parameter SSL ke `DATABASE_URL`. Yang diperlukan aplikasi adalah connection string PostgreSQL, bukan management API key. Gunakan database yang sudah tersedia jika datanya ingin dipertahankan; tidak perlu membuat ulang layanan hanya untuk pindah hosting backend.

Untuk database baru kosong, ikuti langkah migration dan bootstrap pada bagian instalasi. Database lama harus memiliki baseline yang cocok sebelum migration diterapkan. Seed tidak mengubah akun yang sudah ada. Pembuatan akun pengguna selanjutnya dilakukan melalui Users; aplikasi belum mengirim password lewat email atau menyediakan reset password mandiri. Simpan password bootstrap secara aman dan keluarkan variabelnya dari runtime setelah tidak diperlukan.

### Supabase Storage

Buat atau pilih bucket pada project Supabase. Salin endpoint, region, dan pasangan **S3 Access Key ID/Secret Access Key** dari konfigurasi storage ke environment backend. Kunci ini berbeda dari anon/publishable key. Contoh konfigurasi berikut memakai placeholder:

```env
S3_ENDPOINT=https://PROJECT_REF.storage.supabase.co/storage/v1/s3
S3_REGION=ap-southeast-1
S3_ACCESS_KEY_ID=GANTI_DENGAN_S3_ACCESS_KEY
S3_SECRET_ACCESS_KEY=GANTI_DENGAN_S3_SECRET_KEY
S3_BUCKET_NAME=intrack-files
S3_PUBLIC_URL=https://PROJECT_REF.supabase.co/storage/v1/object/public/intrack-files
```

Gunakan endpoint dan region persis dari dashboard serta nama bucket yang benar. `S3_PUBLIC_URL` berbeda dari endpoint upload: gunakan URL bucket tanpa object key dan tanpa trailing slash. Backend menambahkan object key sendiri. Implementasi sekarang membuka file melalui URL publik; bucket private memerlukan perubahan mekanisme download. Login InTrack menggunakan JWT backend, bukan Supabase Auth.

Verifikasi memakai upload avatar/evidence dummy, periksa objek pada bucket, lalu buka URL hasil upload. File evidence nyata yang membutuhkan privasi memerlukan unduhan berizin sebelum digunakan luas.

### Google Calendar

Aktifkan Google Calendar API pada project Google Cloud, atur consent screen dan test users, lalu buat OAuth Client tipe **Web application**. Gunakan scope `https://www.googleapis.com/auth/calendar.events` dan daftarkan redirect URI yang sama persis dengan `GOOGLE_REDIRECT_URI`.

Intern menghubungkan akun dari Planner. Refresh token disimpan otomatis ke database. Calendar memakai akun Google yang diberi izin, tidak harus sama dengan domain email login InTrack. Integrasi hanya meneruskan event dari InTrack ke kalender `primary`; perubahan di Google belum diimpor. Status Testing pada consent dapat membatasi masa berlaku token; uji consent ulang dan disconnect pada lingkungan tujuan.

### AI Chat dan Face ID

Isi `AI_API_KEY`, `AI_BASE_URL`, dan `AI_MODEL` sesuai provider yang mendukung Chat Completions. Backend menambahkan `/chat/completions` pada base URL. Contoh endpoint yang didukung pola request ini adalah `https://generativelanguage.googleapis.com/v1beta/openai`; pilih model yang tersedia pada akun provider. Kredensial AI berbeda dari OAuth Calendar. Konteks intern dikirim ke provider saat menjawab pertanyaan terkait data.

Face ID adalah layanan Python terpisah. `FACE_SERVICE_URL` harus dapat dijangkau dari mesin backend; `127.0.0.1` berarti mesin yang menjalankan Node.js. Backend belum mengirim token autentikasi layanan wajah, jadi deployment lokal menggunakan loopback/private network. Layanan remote yang memerlukan token butuh penyesuaian kode. Tunggu model berhasil dimuat dan periksa `/health` sebelum mencoba 15 foto enrollment.

---

## Deployment VPS

Target deployment adalah frontend statis, satu proses backend Node.js, database Neon, dan file Supabase. Panduan berikut adalah konfigurasi yang perlu disiapkan pada VPS; repository tidak otomatis memasang Nginx, sertifikat HTTPS, atau service manager.

### 1. Siapkan Artifact dan Environment

Build frontend di komputer development/CI untuk mengurangi beban VPS. Gunakan `VITE_API_URL=/api` saat build, lalu jalankan `npm run build --prefix client` dan kirim isi `client/dist/` ke lokasi web statis.

Backend membutuhkan `server/src/`, manifest/lockfile server, Prisma schema/migration, dependency Linux, dan environment runtime. Jangan menyalin `node_modules` atau virtual environment Python Windows ke VPS Linux. Source frontend, tes, workflow CI, dan dokumentasi tetap disimpan di repository, tetapi tidak perlu dimuat sebagai layanan production.

| Bagian | Kebutuhan pada VPS |
|---|---|
| `client/dist/` | Hasil build untuk disajikan Nginx; tidak perlu menjalankan Vite |
| `server/src/`, `server/package.json`, `server/package-lock.json` | Source dan manifest backend; install dependency pada Linux |
| `server/prisma/` | Schema, migration, dan seed untuk tahap setup/release; Prisma Client dihasilkan untuk platform tujuan |
| `ai-service/main.py`, `ai-service/requirements.txt` | Diperlukan jika layanan wajah berjalan di VPS yang sama, beserta dependency dan modelnya |
| `ai-service/Dockerfile` | Dipakai jika memilih menjalankan layanan wajah melalui container |
| Environment backend | Konfigurasi runtime, ditempatkan di luar direktori web publik |
| `client/src/`, `client/test/`, `server/test/`, `.github/`, `docs/` | Tetap disimpan di repository untuk pengembangan/pemeriksaan; tidak diperlukan dalam paket runtime setelah build |

Root dependency dari `npm ci` diperlukan untuk workflow development project, bukan untuk menjalankan backend production melalui `npm run start --prefix server`. Penghapusan dokumen dan cache mengurangi file lokal, tetapi tidak otomatis mengurangi RAM proses Node.js atau model wajah.

Contoh environment untuk satu domain frontend/API:

```env
NODE_ENV=production
PORT=3001
CLIENT_URL=https://intrack.domain-anda.com
GOOGLE_REDIRECT_URI=https://intrack.domain-anda.com/api/google/callback
FACE_SERVICE_URL=http://127.0.0.1:8001
```

Tambahkan database, JWT, S3, dan konfigurasi AI dari template. Gunakan domain milik sendiri dan daftarkan callback production tersebut di Google Cloud. Jangan menaruh secret di `VITE_*` atau di direktori publik Nginx. Environment backend dapat ditempatkan di `server/.env` sesuai loader yang tersedia; restart service setelah mengubahnya.

### 2. Jalankan Backend sebagai Service

Install dependency server pada lingkungan Linux. Fase setup/build membutuhkan Prisma CLI, sehingga jangan membuang dependency development sebelum `prisma generate` dan migration yang diperlukan selesai. Contoh dari root checkout:

```bash
npm ci --include=dev --prefix server
npm run db:generate --prefix server
# Terapkan hanya setelah target database dan baseline dipastikan benar:
npm run db:migrate --prefix server
npm run start --prefix server
```

`npm start` server memakai `node src/server.js`. Untuk proses persisten, konfigurasikan systemd atau process manager agar restart otomatis dan aktif setelah reboot, dengan working directory `server/`. Mulai dari satu proses Node.js pada VPS kecil. `npm run dev`, nodemon, dan Vite development server hanya untuk pengembangan. Jika memangkas dependency development untuk artifact runtime, pastikan Prisma Client/engine sudah dihasilkan untuk platform tujuan dan tetap tersedia; jalankan migration lewat tahap release yang mempunyai Prisma CLI.

### 3. Nginx untuk Frontend dan API

Nginx menyajikan hasil build, meneruskan `/api/` ke Node.js tanpa menghapus prefix, dan menyediakan fallback `index.html` untuk route React. Contoh blok HTTP awal di bawah perlu disesuaikan dengan direktori/domain VPS, kemudian dilengkapi HTTPS sebelum login, kamera, dan geolocation digunakan di production:

```nginx
server {
    listen 80;
    server_name intrack.domain-anda.com;
    root /srv/intrack/client/dist;
    index index.html;
    client_max_body_size 12m;

    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Batas request 12 MiB memberi ruang untuk multipart; backend tetap membatasi file 10 MiB. Terapkan aturan lokasi yang sama pada server HTTPS dan arahkan HTTP ke HTTPS. Jangan mengekspos port Node/Python langsung ke internet; batasi melalui konfigurasi host/firewall. Periksa konfigurasi Nginx sebelum reload. Referensi: [proxy_pass](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_pass) dan [try_files](https://nginx.org/en/docs/http/ngx_http_core_module.html#try_files).

Uji `/api/health`, login, reload route React, refresh sesi, upload, dan callback OAuth melalui domain HTTPS. Health check API hanya memeriksa proses HTTP; keberhasilan koneksi database/storage harus diuji lewat fitur terkait.

### 4. Layanan Wajah dan Batas VPS Kecil

Jika berjalan pada VPS yang sama, buat virtual environment Linux dari `ai-service/requirements.txt` dan jalankan satu worker Uvicorn pada `127.0.0.1:8001` melalui service manager. Jika memakai container, [Dockerfile](ai-service/Dockerfile) saat ini menggunakan Python 3.10 dan port internal **7860**; sesuaikan mapping port serta `FACE_SERVICE_URL`. Gunakan `ai-service/` sebagai build context; [.dockerignore](ai-service/.dockerignore) mengecualikan virtual environment, cache, file environment, log, dan tes dari image.

Pada VPS **2 vCPU/2 GB yang dibagi beberapa project**, Face ID perlu pengukuran RAM puncak dan latensi saat absensi bersamaan. Mulai dari satu worker; worker tambahan dapat memuat salinan model lagi. Layanan wajah terpisah merupakan opsi jika kapasitas tidak cukup. Layanan wajah membatasi satu inferensi aktif per worker, tetapi kapasitas VPS tetap perlu diuji dengan model nyata. Pagination menyeluruh dan optimasi model/dependency Python belum diimplementasikan.

---

## API Endpoints

Request perubahan data (`POST`, `PUT`, `PATCH`, `DELETE`) wajib menyertakan header `X-InTrack-Request: 1`. Jika header `Origin` dikirim, nilainya harus cocok dengan origin `CLIENT_URL`. Frontend dan script audit sudah mengirim header tersebut; sertakan juga pada client API buatan sendiri. Cookie memakai `HttpOnly`, `SameSite=Lax`, dan `Secure` pada HTTPS. Panduan VPS memakai frontend/API pada satu domain; hosting pada situs yang berbeda memerlukan rancangan cookie/CSRF tersendiri.

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
| `POST` | `/api/planner/events/:id/sync` | Mencoba ulang sinkronisasi agenda milik pengguna ke Google |

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

### Google Calendar

| Method | Endpoint | Deskripsi |
|---|---|---|
| `GET` | `/api/google/auth-url` | URL consent Google Calendar |
| `GET` | `/api/google/callback` | Callback OAuth Google |
| `GET` | `/api/google/status` | Status koneksi Calendar |
| `POST` | `/api/google/disconnect` | Memutus koneksi Calendar |

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
- Respons pesan dan riwayat diperiksa terhadap ruang asal. Respons yang terlambat setelah pengguna berpindah ruang tidak ditampilkan di ruang lain.

Atur `AI_API_KEY`, `AI_BASE_URL`, dan `AI_MODEL` sebagai satu konfigurasi yang sesuai dengan provider pilihan. Ketiganya wajib untuk permintaan provider; backend tidak memakai fallback provider/model lama. Evaluasi model diperlukan setelah perubahan model atau prompt; tes unit tidak menjamin ketahanan terhadap prompt injection maupun ketepatan semua jawaban model.

### Face Recognition

InsightFace menghasilkan embedding 512 dimensi. Setelah 15 foto terdaftar, foto verifikasi dibandingkan dengan embedding tersimpan menggunakan cosine similarity. Nilai threshold saat ini adalah **`0.4`**, ditetapkan sebagai konstanta `SIMILARITY_THRESHOLD` di [main.py](ai-service/main.py), bukan environment variable.

Setelah 15 foto, enrollment tambahan ditolak sampai mentor/admin meresetnya. Transaksi serializable melindungi batas foto dan reset; perubahan enrollment ketika verifikasi sedang diproses membatalkan penerbitan bukti.

Inferensi Python berjalan di thread terpisah dengan satu inferensi aktif per worker sehingga endpoint health tetap responsif. Request tambahan menerima HTTP 429 agar tidak membentuk antrean gambar tanpa batas. Layanan membatasi unggahan gambar hingga 10 MiB dan memerlukan tepat satu wajah. Backend memakai timeout 30 detik; respons sibuk/gangguan layanan tidak menghabiskan jatah kegagalan identitas.

Backend membatasi percobaan verifikasi; kegagalan berulang hingga batas 5 percobaan memicu pemblokiran selama 15 menit. Liveness detection belum diimplementasikan. Dependencies bawaan memakai `onnxruntime`; penggunaan GPU memerlukan runtime/provider dan dependensi GPU yang sesuai.

### Google Calendar

OAuth Google menghubungkan kalender pengguna yang sudah login. Sinkronisasi berjalan **satu arah dari InTrack ke kalender `primary` Google**, mencakup pembuatan, perubahan, dan penghapusan event. Belum ada impor event Google atau rekonsiliasi dua arah. Jika sinkronisasi gagal setelah penyimpanan lokal, respons memuat `calendarWarning` dan Planner menampilkan peringatan. Tombol **Sync to Google** mencoba ulang event yang sama dengan ID remote deterministik. Penghapusan event lokal ditahan jika penghapusan Google gagal; event yang sudah hilang di Google dianggap berhasil dihapus. Event tertaut memerlukan koneksi Google sebelum dihapus. Belum ada antrean retry otomatis atau penyimpanan status kegagalan sinkronisasi lintas restart; tombol retry tersedia pada setiap event saat Calendar terhubung.

---

## Perintah Development & Pengujian

Jalankan perintah berikut dari root repository sesuai kebutuhan:

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Menjalankan client dan backend Node.js |
| `npm run dev:client` | Menjalankan frontend saja |
| `npm run dev:server` | Menjalankan backend saja |
| `npm run start --prefix server` | Menjalankan backend tanpa nodemon; frontend/Python dijalankan terpisah |
| `npm run db:generate --prefix server` | Menghasilkan Prisma Client |
| `npm run db:migrate` | Menerapkan migration yang tersedia |
| `npm run db:seed` | Membuat admin dan pengaturan awal yang belum ada |
| `npm run db:studio` | Membuka Prisma Studio |
| `npm run db:push` | Menyamakan schema langsung; bukan alur migration utama |
| `npm test` | Menjalankan tes otomatis backend, tanggal frontend, dan respons AI Chat |
| `npm run lint --prefix client` | Memeriksa lint frontend |
| `npm run build --prefix client` | Menghasilkan build frontend di `client/dist` |

Workflow [Checks](.github/workflows/check.yml) menjalankan tes Node.js, lint, dan build tanpa kredensial production. Tes menggunakan fixture terisolasi untuk memeriksa sesi, token, OAuth, validasi, integrasi tiruan, konteks AI, dan pembatasan cakupan/bahasa. Tes Python dijalankan terpisah dan belum masuk workflow CI.

Untuk tes layanan wajah tanpa kamera atau unduhan model, gunakan virtual environment yang sudah diinstal pada langkah setup. Dari root repository pada Windows:

```powershell
cd ai-service
.\venv\Scripts\python.exe -B -m unittest test_main.py
```

Pada Linux/macOS:

```bash
cd ai-service
venv/bin/python -B -m unittest test_main.py
```

Kembali ke root repository sebelum menjalankan perintah berikutnya.

### Hasil Verifikasi Setelah Perbaikan Audit

Pemeriksaan pada **17 September 2026** menghasilkan:

| Pemeriksaan | Hasil |
|---|---|
| `npm test` | 50 tes lulus |
| Tes Python `test_main.py` | 3 tes lulus dengan model tiruan |
| Lint dan build frontend | Berhasil |
| Validasi schema dan generate Prisma Client | Berhasil pada Prisma 6.19.3 |
| Koneksi Neon | Query baca `SELECT 1` berhasil |
| HTTP lokal | Frontend, backend, proxy `/api/health`, dan health layanan wajah merespons 200 |
| Perlindungan request | Request tanpa header wajib dan dengan origin asing ditolak 403 |

Perbaikan audit terakhir tidak mengubah schema database dan tidak membutuhkan migration baru. Pemeriksaan di atas belum mencakup uji beban VPS, kamera/wajah fisik, consent dan perubahan Calendar nyata, maupun seluruh alur upload dan provider AI secara langsung.

Audit dependency npm pada pemeriksaan tersebut menggunakan:

```powershell
npm audit --omit=dev --prefix client
npm audit --omit=dev --prefix server
```

Frontend melaporkan **0 temuan**. Backend masih melaporkan **3 entri paket berstatus high** dalam satu rantai dependency `prisma` → `@prisma/config` → `deepmerge-ts`, terkait penggabungan rekursif yang dapat menghabiskan stack. Angka tersebut bukan tiga kerentanan terpisah. Dependency ini terkait konfigurasi Prisma CLI; hasil audit tetap perlu ditinjau untuk paket yang benar-benar dikirim ke VPS. Perbaikan otomatis yang memaksa downgrade Prisma belum diterapkan. Hasil ini merupakan snapshot, bukan jaminan bebas kerentanan; jalankan ulang audit sebelum release. Audit kerentanan dependency Python belum dilakukan.

Evaluasi langsung terhadap provider AI dijalankan secara terpisah:

```powershell
node --test server/test/ai-scope.live.cjs
```

Evaluasi tersebut menggunakan kuota provider dan data intern fiktif tanpa mengakses database. Skenario berjalan berurutan dengan jeda 15 detik antarpermintaan provider dan melewati skenario berikutnya ketika provider gagal. Jeda di dalam satu percakapan ikut dihitung dalam timeout 45 detik.

### Audit Konfigurasi dan Integrasi

`node docs/config-audit.cjs` memeriksa keberadaan/kecocokan konfigurasi tanpa menampilkan secret dan menulis laporan lokal yang diabaikan Git. Pemeriksaan ini tidak membuktikan layanan eksternal dapat diakses.

`node docs/live-function-audit.cjs` adalah audit yang menghubungi API lokal `http://localhost:5173/api`, database, storage, layanan wajah, dan provider AI. Jalankan hanya dengan akun/database pengujian yang sesuai serta `AUDIT_ADMIN_EMAIL` dan `AUDIT_ADMIN_PASSWORD` pada environment terminal. Script membuat/menghapus data sementara; periksa setiap nilai `passed` dan hasil cleanup dalam JSON, bukan hanya exit code. Audit ini tidak melakukan consent OAuth nyata atau pengenalan wajah fisik dan tidak dijalankan oleh `npm test`/CI.

Tes regresi juga mencakup admin terakhir, enrollment, perlindungan request lintas situs, pembatasan login, perpindahan ruang AI, tanggal WIB lintas zona waktu, dan kegagalan Calendar/storage. Skenario tambahan tersedia pada [audit-fixes.test.js](server/test/audit-fixes.test.js), [chat-room.test.mjs](client/test/chat-room.test.mjs), dan [test_main.py](ai-service/test_main.py).

Tes pada `server/test/` dan `client/test/` tetap dipertahankan. Hasil audit JSON merupakan artifact lokal yang dapat dibuat ulang, bukan bagian runtime.

---

## Batasan Implementasi & Pemeliharaan

Integrasi Notion telah dihapus dari UI, API, dan proses absensi. Kolom integrasi lama pada `User`, model `ExternalSync`, dan migration terdahulu dipertahankan untuk kompatibilitas database yang sudah ada. Data tersebut tidak mengaktifkan koneksi atau sinkronisasi. Tidak diperlukan reset/migration untuk perubahan ini.

- Evidence masih menggunakan URL publik; unduhan privat dengan pemeriksaan izin belum tersedia.
- Penghapusan akun belum memiliki antrean pembersihan otomatis untuk objek storage lama dan event provider. Kompensasi upload juga belum memiliki retry jika penghapusan objek gagal.
- Objek storage historis yang sudah tidak direferensikan belum dipindai atau dihapus otomatis.
- Pagination menyeluruh dan optimasi model/dependency Python belum tersedia. Mengurangi file repository tidak menggantikan pengukuran penggunaan RAM dan latensi di VPS.
- Edit tugas logbook tersedia melalui API; antarmuka belum menyediakan formulir edit tugas.
- Kamera, lokasi, PDF, consent OAuth, dan integrasi dengan akun layanan nyata perlu diuji pada lingkungan yang digunakan. Hasil tes terisolasi tidak menggantikan pemeriksaan integrasi dengan layanan nyata.

### Kontrol yang Sudah Tersedia

- Login dibatasi per kombinasi IP/email (10 percobaan gagal/masih diproses per 15 menit) serta per IP (60 per 15 menit). Login berhasil mengembalikan jatah percobaannya. Limiter berada di memori proses dan direset saat restart; beberapa instance membutuhkan limiter bersama. Proxy yang dipercaya hanya loopback, sesuai Nginx lokal pada panduan VPS.
- Admin terakhir tidak dapat dihapus/diturunkan perannya. Perubahan nama/departemen dengan peran yang tetap tidak mencabut sesi.
- Penggantian avatar/evidence logbook dan penghapusan tugas mencoba membersihkan objek lama setelah perubahan database berhasil. Kegagalan cleanup dicatat, tetapi belum memiliki antrean retry persisten.
- Access/refresh token dibedakan; refresh dirotasi dan sesi disimpan di database. Logout serta perubahan password/peran oleh admin mencabut sesi.
- OAuth state terikat pada browser/provider dan hanya dapat dikonsumsi sekali. Bukti verifikasi wajah terikat pengguna/tanggal, berumur singkat, dan sekali pakai.
- Backend memeriksa pemilik evidence/tugas; mentor dapat membaca seluruh intern sesuai aturan aplikasi.
- Evidence diwajibkan saat menambah tugas. Validasi tipe/signature file dilakukan sebelum upload; kegagalan transaksi database mencoba menghapus objek baru sebagai kompensasi. Validasi signature bukan pemindaian malware.
- Penghapusan pengguna memakai transaksi. Mentor yang masih mempunyai intern harus dialihkan terlebih dahulu; akun sendiri tidak dapat dihapus.
- Tanggal operasional memakai WIB. Koreksi tanggal data historis tidak dilakukan otomatis tanpa informasi tanggal yang benar.

### Desain dan Pemeriksaan Manual

Token tampilan berada di `client/src/index.css`; komponen identitas berada di `client/src/components/Brand.jsx`. Pertahankan logo asli, tema gelap netral, aksen coral untuk brand/AI, dan warna semantik untuk status. Halaman menggunakan pemuatan terpisah; PDF dibuat di browser.

Sebelum release, periksa login/reload/logout, hak akses antaruser, Settings, 15 foto Face ID, verifikasi dan evidence absensi, CRUD logbook, PDF, Planner, consent/sinkronisasi Calendar, serta AI Chat dengan data uji. Periksa pula tampilan mobile, error provider, dan penolakan upload yang tidak valid.

| Gejala | Pemeriksaan awal |
|---|---|
| API lokal tidak tersambung | Port backend 3001, proses Node, proxy Vite |
| Refresh route frontend 404 | Root hasil build dan fallback Nginx ke `index.html` |
| Respons API berupa HTML | Routing `/api/` dan `VITE_API_URL` saat build |
| Login online gagal/sesi hilang | `CLIENT_URL`, HTTPS, header proxy, cookie, dan log backend |
| Request perubahan data ditolak 403 | Header `X-InTrack-Request: 1`, kecocokan `Origin` dengan `CLIENT_URL`, lalu izin pengguna sesuai pesan respons |
| Login ditolak 429 | Tunggu sesuai `Retry-After`; periksa percobaan gagal dari kombinasi IP/email atau IP yang sama |
| Database tidak terhubung | Connection string, SSL, database/role Neon dan akses jaringan |
| Generate Prisma gagal karena file DLL terkunci di Windows | Hentikan backend yang memakai Prisma Client, jalankan generate, lalu hidupkan backend kembali |
| Seed gagal | Variabel bootstrap dan password minimal 12 karakter |
| Upload gagal/file tidak terbuka | S3 endpoint/region/keys, bucket, public URL, dan batas upload proxy |
| Google menolak callback | Redirect URI harus sama persis dengan konfigurasi Google Cloud |
| Agenda tersimpan tetapi sinkronisasi gagal | Periksa koneksi Google, lalu gunakan **Sync to Google** pada agenda yang sama |
| Agenda tertaut gagal dihapus | Hubungkan kembali Google jika terputus; kegagalan penghapusan remote mempertahankan agenda lokal |
| Chat gagal | Kecocokan key, base URL, model, kuota dan akses provider |
| Face ID gagal | URL layanan, kesiapan model, CPU/GPU dan izin kamera |
| Face ID ditolak 429 | Bedakan layanan sedang sibuk dengan batas kegagalan verifikasi melalui pesan API; tunggu sebelum mencoba lagi |

Template konfigurasi backend tersedia di [docs/intrack.server.env.example](docs/intrack.server.env.example). Panduan setup, deployment, desain, pengujian, dan batas implementasi dipusatkan di README ini.
