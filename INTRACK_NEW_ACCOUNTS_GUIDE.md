<!-- Setup diperbarui setelah implementasi dan uji regresi 15 September 2026. -->
# Panduan akun dan integrasi baru InTrack

**Untuk langkah klik di dashboard platform, langsung ke [bagian 10](#10-tutorial-setup-di-dashboard-platform).** Bagian 1–9 menjelaskan kebutuhan, perilaku kode, dan batas integrasi. Bagian 10 memandu pembuatan resource, pengisian environment, deployment, dan pemeriksaan hasil. Nama menu dapat berubah; tautan dokumentasi resmi disertakan pada setiap platform.

Tanggal: 15 September 2026. Pilihan: **mulai kosong**. Tidak menyalin user, absensi, file, chat, token OAuth, atau face embedding dari sistem lama.

## 1. Yang perlu dibuat

| Layanan | Akun/resource baru | Kredensial/config yang dibutuhkan | Kebutuhan |
|---|---|---|---|
| PostgreSQL/Neon | Akun owner InTrack, project baru, database `intrack`, role database | `DATABASE_URL` | Wajib: semua data aplikasi |
| Supabase Storage | Project Supabase, bucket `intrack-files`, S3 access keys | `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET_NAME`, `S3_PUBLIC_URL` | Wajib untuk bukti/avatar dengan implementasi sekarang |
| Google Calendar | Akun Google owner, Google Cloud project, OAuth web client | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` | Jika memakai sync Calendar |
| Notion | Workspace InTrack, database attendance, public OAuth connection | `NOTION_CLIENT_ID`, `NOTION_CLIENT_SECRET`, `NOTION_REDIRECT_URI`; token dan data source disimpan di AppSetting server | Jika memakai sync Notion |
| AI chat | Project/API key Gemini milik InTrack | `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL` | Jika memakai AI chat |
| Face ID | Proses Python/FastAPI sendiri; VPS atau Docker hosting jika online | `FACE_SERVICE_URL` | Wajib bagi alur absensi UI sekarang |
| Hosting | Hosting frontend, Node backend, dan Python service | URL frontend/backend, environment backend, domain/HTTPS | Untuk akses online |
| GitHub/deployment | Repository/team InTrack dan akses deploy baru | Otorisasi repository pada hosting; SSH secrets hanya jika membuat workflow VPS sendiri | Untuk pemisahan ownership dan deploy otomatis |
| Login InTrack | Satu SUPERUSER baru, lalu mentor/intern melalui Users | Email + password aplikasi; `JWT_SECRET` baru | Terpisah dari akun Google/Notion/Neon |

Gunakan satu email owner khusus InTrack untuk mengelola layanan. Project/resource baru tetap diperlukan meskipun beberapa layanan memakai email owner yang sama. Akun Google pengguna Calendar berbeda per intern; owner Google Cloud tidak perlu login Calendar atas nama semua intern.

Tidak perlu API key Google Maps untuk lokasi saat ini: browser mengambil koordinat dan backend menghitung jarak. Tidak ditemukan integrasi SMTP, pembayaran, Firebase, atau Supabase Auth. PDF menggunakan jsPDF lokal; Google Fonts tidak memerlukan API key. Login Google untuk masuk InTrack juga belum ada—OAuth Google saat ini hanya untuk Calendar.

## 2. Database kosong: Neon/PostgreSQL

1. Buat akun/project Neon khusus InTrack dan database `intrack`; pilih region dekat backend.
2. Buat atau gunakan role database project baru, lalu ambil connection string dari tombol **Connect**. Pastikan host, database, dan role mengarah ke project baru. Gunakan string beserta opsi SSL dari dashboard. [Dokumentasi koneksi Neon](https://neon.com/docs/guides/railway).
3. Simpan sebagai `DATABASE_URL` di **.env root**. Backend juga mendukung `server/.env` sebagai override lokal. Environment hosting backend harus diisi terpisah.
4. Dari root project, setelah memastikan target benar-benar database kosong baru:

```powershell
npm run db:generate --prefix server
npm run db:migrate --prefix server
```

Repository sekarang memiliki baseline dan migration keamanan. Untuk database baru yang kosong, `db:migrate` menerapkan seluruh migration. Database lokal Neon saat ini sudah dibaseline setelah pemeriksaan tanpa schema drift dan migration keamanan sudah diterapkan tanpa reset. Untuk database lama lain, periksa kesesuaian schema dan lakukan baseline secara terencana sebelum deploy migration; jangan menjalankan reset.

5. Seed publikasi sudah menggunakan BOOTSTRAP_ADMIN_EMAIL dan BOOTSTRAP_ADMIN_PASSWORD (minimal 12 karakter), serta BOOTSTRAP_ADMIN_NAME opsional. Set di .env. Seed membuat SUPERUSER tanpa password default dan tidak mengubah user yang sudah ada.
6. Setelah target database baru dikonfirmasi:

```powershell
npm run db:seed --prefix server
```

7. Login menggunakan akun baru tersebut. Tambah akun lain dari **Users → Add User**. Password tidak dikirim otomatis melalui email; pengiriman email/reset password self-service belum tersedia.

Yang dibutuhkan aplikasi adalah connection string PostgreSQL, **bukan Neon management API key**. Tidak perlu pg_dump/restore karena kamu memilih mulai kosong. Generate `JWT_SECRET` baru secara lokal, simpan di password manager/environment backend; jangan gunakan secret demo atau membagikannya di chat.

## 3. Penyimpanan file: Supabase Storage melalui S3

Konfigurasi storage pada `.env` yang diperiksa menggunakan Supabase. Penyebutan Cloudflare R2 sebagai layanan utama pada versi panduan sebelumnya keliru. **S3 adalah protokol akses; penyedianya pada konfigurasi ini adalah Supabase Storage.** Nama file `server/src/services/r2.service.js` merupakan penamaan lama: implementasinya memakai S3Client dengan endpoint, region, dan credentials dari environment.

Gunakan project/bucket Supabase yang memang ditujukan untuk InTrack. Contoh bucket baru dalam panduan adalah `intrack-files`; jika memakai bucket yang sudah dibuat, gunakan namanya persis dan sesuaikan bagian bucket pada public URL. Tidak perlu membuat akun Cloudflare atau mengganti bucket hanya untuk mengikuti panduan ini.

1. Buka project Supabase, buat/pilih bucket melalui menu Storage. [Membuat bucket](https://supabase.com/docs/guides/storage/buckets/creating-buckets).
2. Pada konfigurasi S3 Storage, buat Access Key ID dan Secret Access Key; salin endpoint dan region dari dashboard. Gunakan pasangan S3 access keys untuk backend, bukan anon/publishable key. [Autentikasi S3 Supabase](https://supabase.com/docs/guides/storage/s3/authentication).
3. Isi enam variabel `S3_*` sesuai tutorial bagian 10.3. Region mengikuti project Supabase, bukan `auto` milik R2.
4. Kode menghasilkan URL file langsung dari `S3_PUBLIC_URL`. Untuk bucket publik, bentuknya `https://<PROJECT_REF>.supabase.co/storage/v1/object/public/<BUCKET>`; kode menambahkan object key. [URL file Supabase](https://supabase.com/docs/guides/storage/serving/downloads).
5. Bukti izin/sakit dan dokumen pengguna memerlukan bucket private serta download yang memeriksa hak akses. Signed URL/proxy download belum diimplementasikan pada kode ini. Uji alur public URL hanya dengan file dummy.

Supabase Storage tidak berarti aplikasi memakai Supabase Auth. Login InTrack tetap email/password dan JWT dari backend; database aplikasi mengikuti `DATABASE_URL` secara terpisah. Tidak ada perubahan provider database yang diperlukan hanya untuk memakai storage ini.

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

Saat ini event masuk ke calendar **primary** pengguna, bukan kalender tim yang dapat dipilih. API key biasa maupun service account tidak menggantikan OAuth ini. State sekali pakai, tanggal all-day, dan sinkronisasi update sudah diimplementasikan. Uji create timed event, all-day, delete, penolakan consent, token expired, dan disconnect. Sync saat ini satu arah dan tidak mengimpor event Google ke InTrack.

## 5. Notion: satu integrasi bersama oleh admin

Kebijakan yang dipilih: **admin menghubungkan satu workspace/data source untuk absensi semua intern**. Intern dan mentor tidak mengelola koneksi tersebut.

1. Buat database **InTrack Attendance** dengan kolom berikut:

| Nama | Tipe | Nilai |
|---|---|---|
| Name | Title | Nama intern dan tanggal |
| Status | Select | HADIR, IZIN, SAKIT |
| Date | Date | Tanggal absensi |
| Distance | Number | Jarak dalam km |
| Reason | Text | Alasan izin/sakit |

2. Buat public OAuth connection, aktifkan kemampuan read, insert, dan update content. Isi client ID/secret di environment backend. Internal token bernama NOTION_TOKEN tidak dibaca aplikasi.
3. Daftarkan callback lokal **http://localhost:3001/api/auth/notion/callback**; untuk production gunakan **https://<BACKEND-DOMAIN>/api/auth/notion/callback**.
4. Login sebagai admin di InTrack ? **Settings ? Notion ? Connect**. Pada consent Notion pilih halaman/database yang dibagikan, lalu izinkan akses. Callback kembali ke **/admin/settings**.
5. Di Settings, pilih **Shared attendance database**, lalu **Save database**. Jika database tidak muncul, periksa akses connection di Notion lalu klik **Refresh**. Backend memvalidasi nama dan tipe kolom sebelum menyimpan pilihan.
6. Submit absensi intern penguji. Periksa page di Notion serta **Recent syncs** di Settings. Baris failed dapat dicoba lagi lewat **Retry**.

Kode memakai API **2025-09-03** dengan data source ID, token/refresh token bersama di AppSetting, serta nama intern dari database. ID page yang sudah berhasil dibuat disimpan agar perubahan berikutnya memperbarui page yang sama. Jika provider menerima create tetapi koneksi terputus sebelum ID diterima, retry masih berpotensi membuat duplikat; periksa workspace pada kasus tersebut. File evidence belum disinkronkan ke Notion.

Consent dan sinkronisasi workspace nyata masih perlu diuji dengan akun kamu. Tes otomatis menggunakan respons provider tiruan. Referensi: [otorisasi Notion](https://developers.notion.com/guides/get-started/authorization), [API resmi Notion di Postman](https://www.postman.com/notionhq/notion-s-api-workspace/documentation/52041987-03f70d8f-b6e5-4306-805c-f95f7cdf05b9).

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

User baru harus enroll 15 foto. Angka required/remaining dan bukti verifikasi server sudah diselaraskan; pengenalan wajah fisik tetap perlu diuji.

## 8. Hosting dan domain

Pilih satu pola deployment, tidak perlu membuat akun untuk semua alternatif:

- **Satu VPS/container host:** frontend build, Node API, dan Python service; reverse proxy melayani `/api` dan HTTPS. Ini memudahkan satu origin serta Python tetap private.
- **Frontend/backend terpisah:** dua project hosting, dan satu hosting Python. Repository mempunyai konfigurasi Vercel. Rewrite frontend sekarang hanya fallback ke `index.html`; koneksi ke backend perlu `VITE_API_URL` atau proxy `/api` yang dikonfigurasi sendiri.

Konfigurasi frontend: `VITE_API_URL=/api` jika memakai proxy satu origin, atau `https://<BACKEND>/api` jika langsung lintas origin. Konfigurasi backend: `CLIENT_URL` harus tepat origin frontend, tanpa `/api`. `VITE_*` bersifat publik: jangan masukkan password DB atau API secret.

Checkout ini belum mempunyai workflow GitHub Actions SSH. Jika memilih VPS, buat workflow dan konfigurasi proses/reverse proxy tersendiri. Jika memilih Git integration Vercel, tidak perlu membuat SSH secrets. Siapkan HTTPS untuk penggunaan kamera/geolocation di luar localhost.

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

## 10. Tutorial setup di dashboard platform

### 10.1 Persiapan lokal dan urutan pengerjaan

Panduan ini memakai Neon untuk database, Supabase Storage untuk file, Google Cloud untuk Calendar, Notion, Google AI Studio untuk chat, serta Vercel untuk frontend/backend. Hugging Face Docker Space dijelaskan sebagai opsi uji layanan wajah; production membutuhkan pengamanan layanan yang dijelaskan pada bagian 10.7. Layanan opsional dapat disiapkan belakangan.

Urutan: **database → environment lokal → admin → storage → integrasi → layanan wajah → hosting → callback production → uji aplikasi**.

1. Buka terminal PowerShell di root repository InTrack.
2. Instal dependensi masing-masing package:

   ```powershell
   npm ci
   npm ci --prefix client
   npm ci --prefix server
   ```

3. Buat `.env` dari [template backend](docs/intrack.server.env.example). Jika file sudah ada, edit nilai yang diperlukan; jangan menimpanya dengan placeholder. Backend membaca environment proses, lalu `server/.env` jika tersedia, kemudian `.env` root sebagai fallback.
4. Pastikan konfigurasi lokal berikut tersedia:

   ```dotenv
   NODE_ENV=development
   PORT=3001
   CLIENT_URL=http://localhost:5173
   FACE_SERVICE_URL=http://127.0.0.1:8001
   ```

5. Buat JWT secret baru melalui terminal lokal:

   ```powershell
   node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
   ```

   Salin hasilnya ke `JWT_SECRET` di `.env`. Nilai secret hanya disimpan di backend/password manager, bukan variabel `VITE_*`.

Semua nilai bertanda `<...>` di bawah adalah placeholder yang harus diganti. Setelah mengubah environment lokal, restart proses terkait. Untuk Vercel, lakukan deployment baru.

### 10.2 Neon: membuat database dan admin pertama

**Di platform:** buka [Neon Console](https://console.neon.tech/).

1. Login, pilih **New project**, beri nama `intrack`, lalu pilih region dekat lokasi backend.
2. Setelah project terbentuk, pilih branch yang akan dipakai. Pada pengelolaan database branch, buat database `intrack` jika belum tersedia; pilih role pemilik database baru.
3. Klik **Connect**. Pastikan pilihan branch, database `intrack`, dan role sudah benar.
4. Salin connection string PostgreSQL beserta parameter SSL. Untuk runtime serverless, gunakan opsi **Connection pooling**. Simpan connection string direct secara terpisah jika diperlukan untuk administrasi.

Panduan dashboard dan koneksi: [pengelolaan project Neon](https://neon.com/docs/manage/projects) dan [connection pooling](https://neon.com/docs/connect/connection-pooling).

**Di InTrack:**

```dotenv
DATABASE_URL="<CONNECTION-STRING-DARI-NEON>"
BOOTSTRAP_ADMIN_EMAIL=admin@example.com
BOOTSTRAP_ADMIN_PASSWORD="<PASSWORD-BARU-MINIMAL-12-KARAKTER>"
BOOTSTRAP_ADMIN_NAME="InTrack Admin"
```

Tambahkan tiga variabel bootstrap tersebut secara manual; template saat ini belum mencantumkannya. Variabel `PASSWORD` biasa tidak digunakan oleh seed.

Jalankan hanya pada database kosong yang baru dibuat:

```powershell
npm run db:generate --prefix server
npm run db:migrate --prefix server
npm run db:seed --prefix server
npm run dev
```

**Hasil yang diperiksa:** tabel muncul di Neon, login di `http://localhost:5173` berhasil menggunakan admin bootstrap, dan halaman Users dapat dibuka. `/api/health` saja tidak membuktikan database berhasil terhubung. Setelah bootstrap, hapus variabel password bootstrap dari konfigurasi runtime yang tidak memerlukannya; simpan password login di password manager.

### 10.3 Supabase Storage: bucket, S3 credentials, dan URL file

**Di platform:** buka [Supabase Dashboard](https://supabase.com/dashboard), lalu pilih project untuk storage InTrack. Jika project sudah tersedia, lanjutkan di project itu. Untuk resource baru, buat project khusus InTrack dan tunggu hingga siap.

1. Buka **Storage** dan buat bucket melalui **New bucket**. Contoh nama: `intrack-files`. Jika bucket sudah dibuat, gunakan bucket tersebut dan catat nama/ID-nya persis.
2. Untuk uji file dummy dengan implementasi public URL saat ini, pilih bucket publik. Bucket private tetap dapat menerima upload backend, tetapi membuka URL publiknya tidak akan memberikan akses file. [Pengaturan bucket](https://supabase.com/docs/guides/storage/buckets/creating-buckets).
3. Buka **Storage → Settings**, cari konfigurasi **S3 / S3 Connection**. Aktifkan protokol S3 jika diminta dashboard, lalu buat pasangan S3 access keys. Simpan **Access Key ID**, **Secret Access Key**, endpoint, dan region yang ditampilkan. Kunci S3 ini memberi akses luas ke bucket dan melewati RLS; simpan hanya di backend. [Konfigurasi dan autentikasi S3](https://supabase.com/docs/guides/storage/s3/authentication).

**Di `.env` atau environment hosting backend:**

```dotenv
# Salin endpoint persis dari dashboard. Contoh direct storage hostname:
S3_ENDPOINT=https://<PROJECT_REF>.storage.supabase.co/storage/v1/s3
# Contoh saja; sesuaikan dengan region project:
S3_REGION=ap-southeast-1
S3_ACCESS_KEY_ID=<S3-ACCESS-KEY-ID>
S3_SECRET_ACCESS_KEY=<S3-SECRET-ACCESS-KEY>
S3_BUCKET_NAME=intrack-files
S3_PUBLIC_URL=https://<PROJECT_REF>.supabase.co/storage/v1/object/public/intrack-files
```

Endpoint yang sudah dikonfigurasi dapat memakai hostname project `<PROJECT_REF>.supabase.co`; ikuti URL dashboard, jangan mengganti hostname secara sembarang. Endpoint upload mempunyai path `/storage/v1/s3`, sedangkan public URL memakai `/storage/v1/object/public/<BUCKET>`. Jangan menambahkan object key atau trailing slash ke `S3_PUBLIC_URL`; `uploadFile()` menambahkannya sendiri. [Penyajian file publik/private](https://supabase.com/docs/guides/storage/serving/downloads).

**Cocokkan dengan bucket kamu:** jika memakai nama bucket lain, ubah `S3_BUCKET_NAME` dan segmen terakhir `S3_PUBLIC_URL` ke nama yang sama. Placeholder `intrack-files` bukan instruksi untuk mengganti konfigurasi bucket yang sudah benar. Jangan memakai region `auto` atau endpoint Cloudflare pada konfigurasi Supabase.

**Batas kode:** JWT login InTrack bukan sesi Supabase Auth. Untuk file private, backend perlu memeriksa kepemilikan pengguna sebelum menerbitkan signed URL atau meneruskan download. Membuat policy RLS saja tidak otomatis menambahkan pemeriksaan tersebut pada S3 client backend ini.

**Hasil yang diperiksa:** restart backend, upload avatar/evidence dummy lewat InTrack, lihat objek di **Storage → bucket**, lalu buka URL file hasil upload. Jika gagal, periksa endpoint, region, pasangan S3 keys, bucket, dan izin baca file. Pemeriksaan endpoint lokal hanya mengenali provider; belum membuktikan credentials valid atau upload berhasil.

### 10.4 Google Cloud: OAuth Calendar

**Di platform:** buka [Google Cloud Console](https://console.cloud.google.com/).

1. Klik pemilih project → **New Project** → nama `InTrack` → **Create**, lalu pilih project tersebut.
2. Buka **APIs & Services → Library**, cari **Google Calendar API**, klik **Enable**.
3. Buka **Google Auth Platform**. Jika belum dikonfigurasi, pilih **Get started**; isi nama aplikasi InTrack dan email kontak.
4. Pada **Audience**, pilih **External** untuk pengujian akun Gmail biasa; **Internal** hanya jika sesuai organisasi Workspace. Tambahkan email intern penguji sebagai **Test users**.
5. Pada **Data Access**, tambahkan scope `https://www.googleapis.com/auth/calendar.events`. [Panduan consent screen](https://developers.google.com/workspace/guides/configure-oauth-consent) dan [scope Calendar](https://developers.google.com/workspace/calendar/api/auth).
6. Buka **Clients → Create client**, pilih **Web application**, nama `InTrack Web`.
7. Di **Authorized redirect URIs**, tambahkan `http://localhost:3001/api/google/callback`. Setelah online, tambahkan `https://<BACKEND-DOMAIN>/api/google/callback` sebagai URI kedua.
8. Klik **Create** dan simpan Client ID serta Client Secret. Alur ini memakai redirect backend; mengisi JavaScript origin saja tidak menggantikan redirect URI. [Pembuatan OAuth credentials](https://developers.google.com/workspace/guides/create-credentials).

**Di `.env`:**

```dotenv
GOOGLE_CLIENT_ID=<CLIENT-ID>
GOOGLE_CLIENT_SECRET=<CLIENT-SECRET>
GOOGLE_REDIRECT_URI=http://localhost:3001/api/google/callback
```

**Di InTrack:** restart backend → login intern penguji → Planner → Connect Calendar → pilih akun Google → izinkan akses. State sudah menggunakan nonce sekali pakai. Uji pembuatan event bertanggal/jam biasa dan pastikan muncul di kalender primary akun tersebut.

**Jika gagal:** `redirect_uri_mismatch` berarti URI pada dashboard dan environment berbeda; periksa protokol, domain, port, path, dan trailing slash. Jika akses ditolak dalam mode Testing, periksa daftar test users. Refresh token disimpan otomatis di database, bukan disalin manual ke `.env`. Sinkron update/all-day dan token Testing tetap memiliki batas pada bagian 4.

### 10.5 Notion: database dan public connection

**Di workspace:** buat halaman `InTrack`, lalu database tabel baru `InTrack Attendance`. Buat kolom `Name` (Title), `Status` (Select: HADIR/IZIN/SAKIT), `Date` (Date), `Distance` (Number), dan `Reason` (Text). Gunakan nama tepat seperti tabel pada bagian 5; jangan memilih tipe kolom Status untuk field `Status`.

**Di platform developer:** buka [Notion Developers](https://developers.notion.com/) dan masuk ke Developer portal/halaman pengelolaan connection.

1. Buat **public connection** bernama InTrack; pilih cakupan instalasi yang sesuai workspace penguji.
2. Isi informasi aplikasi yang diwajibkan form. Marketplace listing adalah pengaturan terpisah.
3. Pada konfigurasi OAuth, tambahkan `http://localhost:3001/api/auth/notion/callback` dan callback domain backend production setelah tersedia.
4. Aktifkan kemampuan membaca, memasukkan, dan memperbarui konten untuk pencarian database serta create/update page.
5. Pada **Configuration**, salin OAuth Client ID dan Client Secret ke `NOTION_CLIENT_ID` dan `NOTION_CLIENT_SECRET`. Isi `NOTION_REDIRECT_URI` dengan callback environment yang digunakan.
6. Pada alur consent, pilih workspace dan database/halaman InTrack melalui **Select pages**, lalu **Allow access**. Pengguna harus mempunyai akses penuh untuk membagikan resource. [Alur public connection Notion](https://developers.notion.com/guides/get-started/authorization).

**Di InTrack:** login admin ? Settings ? Connect Notion ? selesaikan consent ? pilih Shared attendance database ? Save database. Koneksi ini digunakan seluruh intern. Token berada pada konfigurasi server dan tidak ditampilkan pada API settings umum.

**Verifikasi:** submit absensi dua intern penguji dan pastikan nama/tanggal benar pada database yang dipilih. Ubah/submit kembali satu absensi dan periksa page yang sama diperbarui. Jika gagal, lihat Recent syncs dan gunakan Retry. Status Connected saja hanya membuktikan token tersimpan.

### 10.6 Google AI Studio: API key Gemini

**Di platform:** buka [Google AI Studio](https://aistudio.google.com/).

1. Login dengan owner InTrack dan selesaikan persetujuan awal jika diminta.
2. Buka **Dashboard → Projects**. Jika memakai project Google Cloud yang sudah dibuat, pilih **Import projects**, pilih InTrack, lalu import.
3. Buka **API Keys → Create API key**, pilih project InTrack, beri nama yang mudah dikenali, lalu simpan key. Gunakan key baru yang dibuat dashboard; periksa status/type key dan izin project jika tombol pembuatan tidak tersedia. [Pengelolaan project dan key Gemini](https://ai.google.dev/gemini-api/docs/api-key).
4. Periksa model yang tersedia untuk API project tersebut, serta halaman penggunaan/kuota dan billing jika dibutuhkan.

**Di `.env`:**

```dotenv
AI_API_KEY=<KEY-DARI-AI-STUDIO>
AI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
AI_MODEL=<ID-MODEL-YANG-MENDUKUNG-CHAT-COMPLETIONS>
```

InTrack menggunakan nama `AI_API_KEY`, bukan `GEMINI_API_KEY`. Base URL tidak ditambah `/chat/completions` karena kode menambahkannya sendiri. Cocokkan model dengan [dokumentasi endpoint kompatibel](https://ai.google.dev/gemini-api/docs/openai).

**Hasil yang diperiksa:** restart backend, login mentor/admin, buka AI Chat, kirim pertanyaan sederhana, kemudian pertanyaan data intern dummy. Respons berhasil harus datang dari provider, bukan hanya greeting UI. Jika gagal, periksa log untuk autentikasi, model tidak ditemukan, atau kuota habis.

### 10.7 Face ID: lokal dan Hugging Face Docker Space

**Lokal terlebih dahulu**, dari folder `ai-service`:

```powershell
python -m venv venv
.\venv\Scripts\python.exe -m pip install -r requirements.txt
.\venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8001
```

Gunakan instalasi Python yang sesuai dependensi; Dockerfile proyek menggunakan Python 3.10. Bila instalasi InsightFace gagal pada Windows karena kompilasi, periksa pesan build tool/dependensi sebelum melanjutkan. Model harus berhasil dimuat sebelum `/health` dapat diakses.

**Opsi dashboard untuk uji online:** buka [Create a Space](https://huggingface.co/new-space).

1. Pilih owner, isi nama `intrack-face`, pilih **Docker** sebagai SDK dan template kosong jika tersedia. Pilih hardware yang sesuai untuk uji CPU/GPU. [Pembuatan Spaces](https://huggingface.co/docs/hub/spaces-overview).
2. Pada repository Space, tempatkan `main.py`, `requirements.txt`, dan `Dockerfile` dari `ai-service/` tepat di root Space. Jangan mengunggah `venv`, `.env`, atau seluruh repository InTrack.
3. Pertahankan/buat `README.md` khusus Space dengan metadata:

   ```yaml
   ---
   title: InTrack Face Service
   sdk: docker
   app_port: 7860
   ---
   ```

4. Commit file melalui tab **Files**, pantau **Build logs** dan **Container logs** sampai model berhasil dimuat. Dockerfile InTrack sudah menjalankan port 7860. [Konfigurasi Docker Spaces](https://huggingface.co/docs/hub/spaces-sdks-docker).
5. Ambil URL aplikasi langsung dari Space, berbentuk `https://<HOST-SPACE>.hf.space`, bukan URL halaman `huggingface.co/spaces/...`. Uji `<URL>/health`.
6. Isi `FACE_SERVICE_URL=<URL-APLIKASI-SPACE>` di backend, tanpa `/health`, `/enroll`, atau `/verify`.

**Akses layanan:** Space publik hanya cocok untuk percobaan dummy dengan kode sekarang karena endpoint wajah belum memiliki autentikasi layanan. Private Space memerlukan penyesuaian autentikasi pada Node; sekadar membuat Hugging Face token belum cukup karena kode belum mengirimkannya. Untuk production, gunakan layanan berautentikasi atau jaringan private yang dapat dijangkau backend. Backend Vercel tidak bisa mengakses `127.0.0.1` laptop/VPS lain.

**Hasil yang diperiksa:** `/health` sukses, enrollment wajah dummy/akun penguji berhasil, dan verifikasi melalui InTrack berhasil. Startup model, konfigurasi CPU/GPU, serta angka 15 foto pada bagian 7 masih perlu diverifikasi; panduan ini tidak mengubah kode layanan.

### 10.8 Vercel: dua project dari satu repository

Siapkan repository InTrack pada GitHub yang bisa diakses akun Vercel. Checkout ini tidak mempunyai workflow SSH; integrasi Git Vercel cukup untuk jalur ini.

**A. Backend terlebih dahulu**

1. Buka [Vercel Dashboard](https://vercel.com/dashboard) → **Add New → Project**, hubungkan GitHub dan pilih repository InTrack.
2. Nama project: `intrack-api`. Set **Root Directory: `server`**. Gunakan konfigurasi deployment yang sudah ada di `server/vercel.json`; bila diminta preset manual gunakan Other, jangan memilih Vite atau menjalankan `npm run dev`.
3. Jika mengisi Install Command secara manual, gunakan `npm ci`; script `postinstall` sudah menjalankan Prisma generate. Tidak ada script build frontend atau output folder `dist` untuk backend ini.
4. Di **Environment Variables**, masukkan variabel backend dari template: database, JWT, S3, OAuth, AI, Face URL, koordinat kantor, serta `NODE_ENV=production`. `CLIENT_URL` sementara dapat memakai origin frontend yang direncanakan; harus diperbarui ke URL aktual sebelum uji login. Jangan memasukkan password bootstrap kecuali memang ada langkah bootstrap terpisah yang membutuhkannya.
5. Deploy, simpan URL stabil backend, lalu buka `https://<BACKEND>/api/health`. Periksa build/runtime logs jika gagal. Vercel menjalankan entry point API, bukan server persisten pada port 3001. [Express di Vercel](https://vercel.com/docs/frameworks/backend/express).

**B. Frontend**

1. Import repository yang sama sebagai project kedua bernama `intrack-web`, dengan **Root Directory: `client`**. Setiap aplikasi mempunyai project sendiri. [Monorepo di Vercel](https://vercel.com/docs/monorepos).
2. Pilih **Framework Preset: Vite**, Build Command `npm run build`, Output Directory `dist`, Install Command `npm ci`.
3. Tambahkan `VITE_API_URL=https://<BACKEND>/api`, lalu deploy. Nilai ini masuk saat build. `client/vercel.json` menangani fallback route React ke `index.html`, bukan penerusan request API. [Vite di Vercel](https://vercel.com/docs/frameworks/frontend/vite).
4. Simpan URL stabil frontend. Pada project backend → **Settings → Environment Variables**, ubah `CLIENT_URL=https://<FRONTEND>` tanpa trailing slash/path. Set callback Google dan Notion menggunakan URL backend aktual.
5. Redeploy backend setelah perubahan environment. Redeploy frontend jika mengubah `VITE_API_URL`. Pilih cakupan Production/Preview dengan sengaja; perubahan environment berlaku pada deployment baru. [Environment Vercel](https://vercel.com/docs/environment-variables).

**C. Kembali ke dashboard OAuth**

Tambahkan callback production pada Google Cloud Clients dan konfigurasi OAuth Notion sesuai tabel berikut. Jangan mengganti URI lokal jika masih digunakan untuk pengembangan.

| Pengaturan | Nilai production untuk pola dua project |
|---|---|
| Frontend `VITE_API_URL` | `https://<BACKEND>/api` |
| Backend `CLIENT_URL` | `https://<FRONTEND>` |
| Backend dan Google `GOOGLE_REDIRECT_URI` | `https://<BACKEND>/api/google/callback` |
| Backend dan Notion `NOTION_REDIRECT_URI` | `https://<BACKEND>/api/auth/notion/callback` |
| Backend `FACE_SERVICE_URL` | URL layanan wajah yang dapat dijangkau backend |

**D. Domain sendiri, jika sudah tersedia**

Pada masing-masing project Vercel, buka **Settings → Domains**, tambahkan misalnya `app.domainmu.com` dan `api.domainmu.com`, lalu ikuti record DNS yang ditampilkan dashboard registrar/DNS kamu. Setelah domain aktif, perbarui ketiga lokasi: environment frontend, environment backend, dan callback di dashboard OAuth. [Pengaturan domain Vercel](https://vercel.com/docs/domains/working-with-domains/add-a-domain).

**Pemeriksaan khusus kode InTrack:** frontend dan backend berbeda origin, sehingga uji cookie login, reload halaman, serta refresh sesi pada browser target. Jika browser memblokir cookie lintas situs, gunakan domain yang satu situs atau rancang proxy satu origin beserta penyesuaian OAuth/cookie; jangan hanya mengganti CORS menjadi wildcard. Uji upload ukuran yang benar-benar digunakan karena batas platform dapat lebih kecil daripada batas 10 MB di middleware aplikasi. Jika API malah mengembalikan HTML, periksa `VITE_API_URL` dan deployment frontend yang terakhir dibangun.

### 10.9 Pemeriksaan selesai dan pemecahan masalah

| Gejala | Yang diperiksa lebih dahulu |
|---|---|
| Lokal `/api` gagal terhubung | `.env` ada, `PORT=3001`, backend menyala |
| Prisma gagal terkoneksi | Project/branch/role/database Neon, connection string lengkap, SSL |
| Seed menolak konfigurasi | `BOOTSTRAP_ADMIN_EMAIL` dan password minimal 12 karakter |
| Login online gagal atau sesi hilang | `CLIENT_URL`, URL API, cookie browser, HTTPS, log backend |
| Upload berhasil tetapi file tidak terbuka | Public URL berbeda dari S3 endpoint; akses objek sesuai desain storage |
| Google menolak redirect | Callback dashboard sama persis dengan environment backend |
| Notion Connected tetapi absensi tidak muncul | Pemilik token admin/intern, akses database, defect pada bagian 5 |
| Chat gagal | Key, model, kuota, dan log response provider |
| Face service gagal | Model belum siap, URL salah/private, autentikasi, CPU/GPU |
| Refresh route frontend menghasilkan 404 | Root Directory `client`, fallback `client/vercel.json` |

Setup platform dianggap terverifikasi setelah login admin, pembuatan intern, upload dummy, enrollment/verifikasi wajah, absensi, logbook, Calendar, Notion setelah perbaikan, dan AI chat menghasilkan data yang sesuai di layanan baru. Build sukses atau status Connected tidak menggantikan pemeriksaan tersebut. Panduan ini menjelaskan langkah yang perlu dilakukan; tidak menyatakan akun/platform sudah dibuat atau deployment sudah diuji.
